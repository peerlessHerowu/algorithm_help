"""
令牌桶限流器

自实现令牌桶算法，替代 Java Resilience4j RateLimiter。
每个平台独立实例，rate 从配置动态读取。
"""

import asyncio
import time


class TokenBucketRateLimiter:
    """
    令牌桶限流器 —— 异步安全，支持 Prometheus 指标暴露。

    算法：
    - 桶容量为 rate（最大令牌数）
    - 每秒补充 rate/period 个令牌
    - acquire() 获取一个令牌，不足时异步等待补充
    """

    def __init__(self, rate: int, period: float = 60.0):
        """
        :param rate: period 时间内允许的最大请求数（同时也是桶容量）
        :param period: 时间窗口（秒），默认 60s
        """
        if rate <= 0:
            raise ValueError("rate 必须为正整数")
        if period <= 0:
            raise ValueError("period 必须为正数")

        self._rate = rate
        self._period = period
        self._tokens = float(rate)
        self._last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        """获取一个令牌，令牌不足时 await 等待直到令牌可用"""
        async with self._lock:
            self._refill()
            while self._tokens < 1.0:
                # 计算需要等待的时间：需要补充 (1.0 - tokens) 个令牌
                wait_time = (1.0 - self._tokens) / (self._rate / self._period)
                await asyncio.sleep(wait_time)
                self._refill()
            self._tokens -= 1.0

    def _refill(self) -> None:
        """根据经过的时间补充令牌，上限为 rate"""
        now = time.monotonic()
        elapsed = now - self._last_refill
        self._tokens = min(
            float(self._rate),
            self._tokens + elapsed * (self._rate / self._period),
        )
        self._last_refill = now

    @property
    def available_tokens(self) -> float:
        """当前可用令牌数（用于 Prometheus 指标暴露）"""
        self._refill()
        return self._tokens

    @property
    def rate(self) -> int:
        """配置的速率上限"""
        return self._rate

    @property
    def period(self) -> float:
        """配置的时间窗口（秒）"""
        return self._period
