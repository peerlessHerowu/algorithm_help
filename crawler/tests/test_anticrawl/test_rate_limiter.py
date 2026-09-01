"""令牌桶限流器单元测试"""

import asyncio
import time

import pytest

from crawler_service.anticrawl.rate_limiter import TokenBucketRateLimiter


class TestTokenBucketRateLimiter:
    """TokenBucketRateLimiter 单元测试"""

    def test_init_valid_params(self):
        """正常参数初始化"""
        limiter = TokenBucketRateLimiter(rate=30, period=60.0)
        assert limiter.rate == 30
        assert limiter.period == 60.0
        assert limiter.available_tokens <= 30.0

    def test_init_invalid_rate(self):
        """rate <= 0 应抛出 ValueError"""
        with pytest.raises(ValueError, match="rate 必须为正整数"):
            TokenBucketRateLimiter(rate=0)
        with pytest.raises(ValueError, match="rate 必须为正整数"):
            TokenBucketRateLimiter(rate=-1)

    def test_init_invalid_period(self):
        """period <= 0 应抛出 ValueError"""
        with pytest.raises(ValueError, match="period 必须为正数"):
            TokenBucketRateLimiter(rate=10, period=0)
        with pytest.raises(ValueError, match="period 必须为正数"):
            TokenBucketRateLimiter(rate=10, period=-1.0)

    def test_available_tokens_initial(self):
        """初始化后令牌数等于 rate"""
        limiter = TokenBucketRateLimiter(rate=10, period=60.0)
        # 刚创建时 available_tokens 应接近 rate
        assert limiter.available_tokens == pytest.approx(10.0, abs=0.1)

    @pytest.mark.asyncio
    async def test_acquire_decrements_token(self):
        """acquire 消耗一个令牌"""
        limiter = TokenBucketRateLimiter(rate=10, period=60.0)
        initial = limiter.available_tokens
        await limiter.acquire()
        # 消耗后令牌减少约 1（考虑极短时间内的补充）
        assert limiter.available_tokens < initial

    @pytest.mark.asyncio
    async def test_acquire_multiple_within_capacity(self):
        """在桶容量内连续 acquire 不阻塞"""
        limiter = TokenBucketRateLimiter(rate=5, period=60.0)
        start = time.monotonic()
        for _ in range(5):
            await limiter.acquire()
        elapsed = time.monotonic() - start
        # 5 次 acquire 应该几乎不等待（桶内有 5 个令牌）
        assert elapsed < 0.5

    @pytest.mark.asyncio
    async def test_acquire_waits_when_empty(self):
        """令牌耗尽后 acquire 会等待"""
        # rate=2, period=1.0 → 每秒 2 个令牌，补充 1 个需要 0.5 秒
        limiter = TokenBucketRateLimiter(rate=2, period=1.0)
        # 消耗完所有令牌
        await limiter.acquire()
        await limiter.acquire()
        # 第 3 次应该等待
        start = time.monotonic()
        await limiter.acquire()
        elapsed = time.monotonic() - start
        # 应该等待约 0.5 秒
        assert elapsed >= 0.4

    @pytest.mark.asyncio
    async def test_tokens_cap_at_rate(self):
        """令牌数不超过 rate 上限"""
        limiter = TokenBucketRateLimiter(rate=5, period=1.0)
        # 等待一段时间让令牌补充
        await asyncio.sleep(0.5)
        # 即使时间过去了，令牌也不超过 rate
        assert limiter.available_tokens <= 5.0

    @pytest.mark.asyncio
    async def test_refill_over_time(self):
        """令牌随时间补充"""
        # rate=10, period=1.0 → 每秒 10 个令牌
        limiter = TokenBucketRateLimiter(rate=10, period=1.0)
        # 先消耗 5 个
        for _ in range(5):
            await limiter.acquire()
        tokens_after_consume = limiter.available_tokens
        # 等待 0.3 秒，应该补充约 3 个
        await asyncio.sleep(0.3)
        tokens_after_wait = limiter.available_tokens
        assert tokens_after_wait > tokens_after_consume

    @pytest.mark.asyncio
    async def test_concurrent_acquire_safety(self):
        """并发 acquire 的线程安全"""
        limiter = TokenBucketRateLimiter(rate=10, period=60.0)
        results = []

        async def acquire_task():
            await limiter.acquire()
            results.append(True)

        # 并发 10 个 acquire
        tasks = [acquire_task() for _ in range(10)]
        await asyncio.gather(*tasks)
        assert len(results) == 10
        # 令牌应该约为 0
        assert limiter.available_tokens < 1.0
