"""AntiCrawlManager 单元测试"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from crawler_service.anticrawl.circuit_breaker import CircuitOpenError, CircuitState
from crawler_service.anticrawl.manager import (
    AntiCrawlManager,
    NoOpProxyProvider,
    ProxyProvider,
)
from crawler_service.config import (
    AntiDetectConfig,
    CircuitBreakerConfig,
    PlatformConfig,
    ProxyConfig,
    Settings,
)


@pytest.fixture
def mock_settings() -> Settings:
    """构建测试用 Settings"""
    return Settings(
        platforms={
            "leetcode_global": PlatformConfig(
                enabled=True,
                base_url="https://leetcode.com",
                rate_limit=10,
                retry_max=3,
                retry_delay_ms=100,
                request_delay_ms=[10, 50],
            ),
            "codeforces": PlatformConfig(
                enabled=True,
                base_url="https://codeforces.com",
                rate_limit=20,
                request_delay_ms=[20, 80],
            ),
            "luogu": PlatformConfig(
                enabled=False,
                base_url="https://luogu.com.cn",
            ),
        },
        anti_detect=AntiDetectConfig(
            user_agents=[
                "Mozilla/5.0 TestAgent/1.0",
                "Mozilla/5.0 TestAgent/2.0",
            ],
            request_delay_ms=[100, 300],
            circuit_breaker=CircuitBreakerConfig(
                failure_threshold=3,
                wait_duration_ms=5000,
            ),
            proxy=ProxyConfig(enabled=False),
        ),
    )


@pytest.fixture
def mock_redis() -> AsyncMock:
    """Mock Redis 客户端"""
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    return redis


@pytest.fixture
def manager(mock_settings: Settings, mock_redis: AsyncMock) -> AntiCrawlManager:
    """创建 AntiCrawlManager 实例"""
    return AntiCrawlManager(mock_settings, mock_redis)


class TestAntiCrawlManagerInit:
    """初始化测试"""

    def test_creates_limiters_for_enabled_platforms(self, manager: AntiCrawlManager):
        """仅为 enabled=True 的平台创建限流器"""
        assert "leetcode_global" in manager._limiters
        assert "codeforces" in manager._limiters
        assert "luogu" not in manager._limiters

    def test_creates_breakers_for_enabled_platforms(self, manager: AntiCrawlManager):
        """仅为 enabled=True 的平台创建熔断器"""
        assert "leetcode_global" in manager._breakers
        assert "codeforces" in manager._breakers
        assert "luogu" not in manager._breakers

    def test_rate_limiter_uses_platform_rate(self, manager: AntiCrawlManager):
        """限流器使用平台配置的 rate_limit"""
        assert manager._limiters["leetcode_global"].rate == 10
        assert manager._limiters["codeforces"].rate == 20

    def test_breaker_uses_global_threshold(self, manager: AntiCrawlManager):
        """熔断器使用全局反爬配置的 failure_threshold"""
        assert manager._breakers["leetcode_global"].failure_threshold == 3
        assert manager._breakers["codeforces"].failure_threshold == 3

    def test_default_proxy_provider_is_noop(self, manager: AntiCrawlManager):
        """默认代理提供者为 NoOp"""
        assert isinstance(manager.proxy_provider, NoOpProxyProvider)


class TestAcquirePermit:
    """acquire_permit 测试"""

    @pytest.mark.asyncio
    async def test_acquire_permit_success(self, manager: AntiCrawlManager):
        """正常获取许可不抛异常"""
        with patch("asyncio.sleep", new_callable=AsyncMock):
            await manager.acquire_permit("leetcode_global")

    @pytest.mark.asyncio
    async def test_acquire_permit_circuit_open_raises(self, manager: AntiCrawlManager):
        """熔断器打开时 acquire_permit 抛出 CircuitOpenError"""
        # 连续失败使熔断器打开
        breaker = manager.get_circuit_breaker("leetcode_global")
        for _ in range(3):
            await breaker.record_failure()
        assert breaker.state == CircuitState.OPEN

        with pytest.raises(CircuitOpenError):
            await manager.acquire_permit("leetcode_global")


class TestGetHeaders:
    """get_headers 测试"""

    @pytest.mark.asyncio
    async def test_headers_contain_user_agent(self, manager: AntiCrawlManager):
        """返回的 headers 包含 User-Agent"""
        headers = await manager.get_headers("leetcode_global")
        assert "User-Agent" in headers
        assert headers["User-Agent"] in [
            "Mozilla/5.0 TestAgent/1.0",
            "Mozilla/5.0 TestAgent/2.0",
        ]

    @pytest.mark.asyncio
    async def test_headers_contain_cookie_when_exists(
        self, mock_settings: Settings, mock_redis: AsyncMock
    ):
        """Redis 中有 Cookie 时，headers 包含 Cookie"""
        mock_redis.get = AsyncMock(return_value="session=abc123")
        mgr = AntiCrawlManager(mock_settings, mock_redis)
        headers = await mgr.get_headers("leetcode_global")
        assert headers.get("Cookie") == "session=abc123"

    @pytest.mark.asyncio
    async def test_headers_no_cookie_when_empty(self, manager: AntiCrawlManager):
        """Redis 中没有 Cookie 时，headers 不包含 Cookie 字段"""
        headers = await manager.get_headers("leetcode_global")
        assert "Cookie" not in headers

    @pytest.mark.asyncio
    async def test_noop_proxy_no_proxy_header(self, manager: AntiCrawlManager):
        """NoOp 代理不设置 X-Proxy"""
        headers = await manager.get_headers("leetcode_global")
        assert "X-Proxy" not in headers


class TestRecordSuccessFailure:
    """record_success / record_failure 测试"""

    @pytest.mark.asyncio
    async def test_record_success_resets_breaker(self, manager: AntiCrawlManager):
        """record_success 重置熔断器"""
        breaker = manager.get_circuit_breaker("leetcode_global")
        await breaker.record_failure()
        await breaker.record_failure()
        assert breaker.failure_count == 2

        await manager.record_success("leetcode_global")
        assert breaker.failure_count == 0
        assert breaker.state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_record_failure_increments_breaker(self, manager: AntiCrawlManager):
        """record_failure 累计熔断器失败次数"""
        breaker = manager.get_circuit_breaker("leetcode_global")
        await manager.record_failure("leetcode_global")
        assert breaker.failure_count == 1
        await manager.record_failure("leetcode_global")
        assert breaker.failure_count == 2


class TestRetryWithBackoff:
    """retry_with_backoff 指数退避测试"""

    @pytest.mark.asyncio
    async def test_success_on_first_attempt(self, manager: AntiCrawlManager):
        """首次成功直接返回结果"""
        func = AsyncMock(return_value="ok")
        result = await manager.retry_with_backoff(
            func, "leetcode_global", retry_max=3, base_delay_ms=10
        )
        assert result == "ok"
        assert func.call_count == 1

    @pytest.mark.asyncio
    async def test_success_on_retry(self, manager: AntiCrawlManager):
        """失败后重试成功"""
        call_count = 0

        async def flaky_func():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise RuntimeError("暂时失败")
            return "recovered"

        with patch("asyncio.sleep", new_callable=AsyncMock):
            result = await manager.retry_with_backoff(
                flaky_func, "leetcode_global", retry_max=3, base_delay_ms=10
            )
        assert result == "recovered"
        assert call_count == 3

    @pytest.mark.asyncio
    async def test_raises_after_max_retries(self, manager: AntiCrawlManager):
        """超过最大重试次数抛出最后异常"""
        func = AsyncMock(side_effect=RuntimeError("永远失败"))

        with patch("asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises(RuntimeError, match="永远失败"):
                await manager.retry_with_backoff(
                    func, "leetcode_global", retry_max=2, base_delay_ms=10
                )
        # 首次尝试 + 2 次重试 = 3 次
        assert func.call_count == 3

    @pytest.mark.asyncio
    async def test_exponential_delay_calculation(self, manager: AntiCrawlManager):
        """验证指数退避延迟：base_delay * 2^n"""
        func = AsyncMock(side_effect=RuntimeError("失败"))
        sleep_calls = []

        async def mock_sleep(delay):
            sleep_calls.append(delay)

        with patch("asyncio.sleep", side_effect=mock_sleep):
            with pytest.raises(RuntimeError):
                await manager.retry_with_backoff(
                    func, "leetcode_global", retry_max=3, base_delay_ms=1000
                )
        # 3 次重试的延迟：1000*2^0=1s, 1000*2^1=2s, 1000*2^2=4s
        assert len(sleep_calls) == 3
        assert sleep_calls[0] == pytest.approx(1.0)
        assert sleep_calls[1] == pytest.approx(2.0)
        assert sleep_calls[2] == pytest.approx(4.0)


class TestGetCircuitBreakerAndRateLimiter:
    """get_circuit_breaker / get_rate_limiter 动态创建测试"""

    def test_get_breaker_for_unknown_platform_creates_default(
        self, manager: AntiCrawlManager
    ):
        """未注册平台动态创建默认熔断器"""
        breaker = manager.get_circuit_breaker("unknown_platform")
        assert breaker is not None
        assert breaker.failure_threshold == 3

    def test_get_limiter_for_unknown_platform_creates_default(
        self, manager: AntiCrawlManager
    ):
        """未注册平台动态创建默认限流器（rate=30）"""
        limiter = manager.get_rate_limiter("unknown_platform")
        assert limiter is not None
        assert limiter.rate == 30  # PlatformConfig 默认值

    def test_get_breaker_returns_same_instance(self, manager: AntiCrawlManager):
        """同平台多次调用返回同一实例"""
        b1 = manager.get_circuit_breaker("leetcode_global")
        b2 = manager.get_circuit_breaker("leetcode_global")
        assert b1 is b2

    def test_get_limiter_returns_same_instance(self, manager: AntiCrawlManager):
        """同平台多次调用返回同一实例"""
        l1 = manager.get_rate_limiter("leetcode_global")
        l2 = manager.get_rate_limiter("leetcode_global")
        assert l1 is l2


class TestProxyProvider:
    """ProxyProvider 接口测试"""

    def test_noop_returns_none(self):
        """NoOpProxyProvider 始终返回 None"""
        provider = NoOpProxyProvider()
        assert provider.get_proxy() is None

    def test_custom_proxy_provider(self, manager: AntiCrawlManager):
        """可替换为自定义代理提供者"""

        class CustomProxy(ProxyProvider):
            def get_proxy(self):
                return "http://proxy.example.com:8080"

        manager.proxy_provider = CustomProxy()
        assert manager.proxy_provider.get_proxy() == "http://proxy.example.com:8080"
