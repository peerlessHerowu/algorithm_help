"""
AntiCrawlManager 总入口

协调 限流 → 熔断检查 → UA 选取 → Cookie → 随机延迟，
提供统一的反爬策略管理接口。

包含指数退避重试策略和 ProxyProvider 预留接口。
"""

import asyncio
import random
from abc import ABC, abstractmethod
from typing import Any, Callable, Coroutine, Optional, TypeVar

import structlog
from redis.asyncio import Redis

from ..config import PlatformConfig, Settings
from ..metrics import update_circuit_breaker_state, update_rate_limiter_tokens
from .circuit_breaker import CircuitBreaker, CircuitOpenError
from .cookie_store import RedisCookieStore
from .rate_limiter import TokenBucketRateLimiter
from .ua_rotator import UARotator

logger = structlog.get_logger()

T = TypeVar("T")


# ---- ProxyProvider 接口预留 ----


class ProxyProvider(ABC):
    """代理池接口（预留，当前使用 NoOp 实现）"""

    @abstractmethod
    def get_proxy(self) -> Optional[str]:
        """返回代理地址（如 http://host:port），None 表示不使用代理"""
        ...


class NoOpProxyProvider(ProxyProvider):
    """默认无代理实现（proxy.enabled=false 时使用）"""

    def get_proxy(self) -> Optional[str]:
        return None


# ---- AntiCrawlManager ----


class AntiCrawlManager:
    """
    反爬总管理器 —— 协调限流、熔断、UA 轮转、Cookie、随机延迟。

    使用方式：
        manager = AntiCrawlManager(config, redis_client)
        await manager.acquire_permit("leetcode_global")
        headers = await manager.get_headers("leetcode_global")
        # ... 发起请求 ...
        await manager.record_success("leetcode_global")
    """

    def __init__(self, config: Settings, redis_client: Redis):
        """
        :param config: 全局配置
        :param redis_client: Redis 异步客户端（用于 Cookie 管理）
        """
        self._config = config
        self._limiters: dict[str, TokenBucketRateLimiter] = {}
        self._breakers: dict[str, CircuitBreaker] = {}
        self._ua_rotator = UARotator(config.anti_detect.user_agents)
        self._cookie_store = RedisCookieStore(redis_client)
        self._proxy_provider: ProxyProvider = NoOpProxyProvider()
        self._init_platform_instances()

    def _init_platform_instances(self) -> None:
        """根据配置为每个平台创建独立的限流器和熔断器实例"""
        cb_config = self._config.anti_detect.circuit_breaker
        for platform_name, platform_cfg in self._config.platforms.items():
            if not platform_cfg.enabled:
                continue
            # 令牌桶限流器：rate 从平台配置读取，窗口 60 秒
            self._limiters[platform_name] = TokenBucketRateLimiter(
                rate=platform_cfg.rate_limit,
                period=60.0,
            )
            # 熔断器：阈值和等待时间从反爬配置读取
            self._breakers[platform_name] = CircuitBreaker(
                failure_threshold=cb_config.failure_threshold,
                wait_duration_ms=cb_config.wait_duration_ms,
            )
        logger.info(
            "反爬管理器初始化完成",
            platforms=list(self._limiters.keys()),
        )

    def _get_platform_config(self, platform: str) -> PlatformConfig:
        """获取平台配置，不存在时返回默认配置"""
        cfg = self._config.get_platform(platform)
        if cfg is None:
            return PlatformConfig()
        return cfg

    async def acquire_permit(self, platform: str) -> None:
        """
        获取采集许可：熔断检查 → 限流等待 → 随机延迟。

        :param platform: 平台标识
        :raises CircuitOpenError: 熔断器打开时抛出
        """
        # 1. 熔断器检查
        breaker = self.get_circuit_breaker(platform)
        await breaker.check()
        # 2. 限流器获取令牌
        limiter = self.get_rate_limiter(platform)
        await limiter.acquire()
        # 3. 随机延迟
        await self._random_delay(platform)

    async def get_headers(self, platform: str) -> dict[str, str]:
        """
        构建带反爬策略的请求头：UA 轮转 + Cookie + Proxy 信息。

        :param platform: 平台标识
        :return: 请求头字典
        """
        headers: dict[str, str] = {
            "User-Agent": self._ua_rotator.next(),
        }
        # Cookie（从 Redis 异步获取）
        cookie = await self._cookie_store.get(platform)
        if cookie:
            headers["Cookie"] = cookie
        # 代理信息（预留，当前 NoOp 不会设置）
        proxy = self._proxy_provider.get_proxy()
        if proxy:
            headers["X-Proxy"] = proxy
        return headers

    async def record_success(self, platform: str) -> None:
        """记录请求成功，重置熔断器失败计数"""
        breaker = self.get_circuit_breaker(platform)
        await breaker.record_success()
        # 更新 Prometheus 指标
        update_circuit_breaker_state(platform, breaker.state.value)
        limiter = self.get_rate_limiter(platform)
        update_rate_limiter_tokens(platform, limiter.available_tokens)

    async def record_failure(self, platform: str) -> None:
        """记录请求失败，累计熔断器失败计数"""
        breaker = self.get_circuit_breaker(platform)
        await breaker.record_failure()
        # 更新 Prometheus 指标
        update_circuit_breaker_state(platform, breaker.state.value)
        limiter = self.get_rate_limiter(platform)
        update_rate_limiter_tokens(platform, limiter.available_tokens)

    async def retry_with_backoff(
        self,
        func: Callable[[], Coroutine[Any, Any, T]],
        platform: str,
        retry_max: int = 3,
        base_delay_ms: int = 1000,
    ) -> T:
        """
        指数退避重试：base_delay * 2^n，最多 retry_max 次。

        :param func: 异步可调用对象（无参数）
        :param platform: 平台标识（用于记录成功/失败）
        :param retry_max: 最大重试次数
        :param base_delay_ms: 基础延迟（毫秒）
        :return: func 的返回值
        :raises Exception: 重试耗尽后抛出最后一次异常
        """
        last_exception: Optional[Exception] = None
        for attempt in range(retry_max + 1):
            try:
                result = await func()
                await self.record_success(platform)
                return result
            except Exception as e:
                last_exception = e
                await self.record_failure(platform)
                if attempt < retry_max:
                    delay_ms = base_delay_ms * (2 ** attempt)
                    logger.warning(
                        "请求失败，准备重试",
                        platform=platform,
                        attempt=attempt + 1,
                        max_retries=retry_max,
                        next_delay_ms=delay_ms,
                        error=str(e),
                    )
                    await asyncio.sleep(delay_ms / 1000.0)
                else:
                    logger.error(
                        "重试耗尽",
                        platform=platform,
                        total_attempts=retry_max + 1,
                        error=str(e),
                    )
        # 不应到达此处，但保险起见
        raise last_exception  # type: ignore[misc]

    async def _random_delay(self, platform: str) -> None:
        """在平台配置的 request_delay_ms 范围内随机等待"""
        platform_cfg = self._get_platform_config(platform)
        delay_range = platform_cfg.request_delay_ms
        if len(delay_range) >= 2:
            min_ms, max_ms = delay_range[0], delay_range[1]
        elif len(delay_range) == 1:
            min_ms, max_ms = delay_range[0], delay_range[0]
        else:
            # 使用全局默认
            global_range = self._config.anti_detect.request_delay_ms
            min_ms, max_ms = global_range[0], global_range[1]
        delay_s = random.uniform(min_ms / 1000.0, max_ms / 1000.0)
        await asyncio.sleep(delay_s)

    def get_circuit_breaker(self, platform: str) -> CircuitBreaker:
        """
        获取指定平台的熔断器实例（用于 Prometheus 指标暴露）。

        若平台未注册，动态创建默认实例。
        """
        if platform not in self._breakers:
            cb_config = self._config.anti_detect.circuit_breaker
            self._breakers[platform] = CircuitBreaker(
                failure_threshold=cb_config.failure_threshold,
                wait_duration_ms=cb_config.wait_duration_ms,
            )
        return self._breakers[platform]

    def get_rate_limiter(self, platform: str) -> TokenBucketRateLimiter:
        """
        获取指定平台的限流器实例（用于 Prometheus 指标暴露）。

        若平台未注册，动态创建默认实例（rate=30）。
        """
        if platform not in self._limiters:
            platform_cfg = self._get_platform_config(platform)
            self._limiters[platform] = TokenBucketRateLimiter(
                rate=platform_cfg.rate_limit,
                period=60.0,
            )
        return self._limiters[platform]

    @property
    def proxy_provider(self) -> ProxyProvider:
        """获取当前代理提供者"""
        return self._proxy_provider

    @proxy_provider.setter
    def proxy_provider(self, provider: ProxyProvider) -> None:
        """设置代理提供者（用于后续扩展接入代理服务）"""
        self._proxy_provider = provider
