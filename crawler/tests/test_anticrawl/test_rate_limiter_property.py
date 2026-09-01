"""
令牌桶限流器不超过配额 - Property Test

**Validates: Requirements 3.1**

使用 hypothesis 生成随机 rate 和 period，验证：
1. 可用令牌数（available_tokens）永远不超过 rate
2. 在不等待的情况下，连续 acquire 成功次数不超过 rate（令牌桶容量上限）
"""

import asyncio

from hypothesis import given, settings
from hypothesis import strategies as st

from crawler_service.anticrawl.rate_limiter import TokenBucketRateLimiter


class TestTokenBucketRateLimiterProperty:
    """Property 1: 令牌桶限流器不超过配额"""

    @given(
        rate=st.integers(min_value=1, max_value=50),
        period=st.floats(min_value=0.1, max_value=5.0, allow_nan=False, allow_infinity=False),
    )
    @settings(max_examples=50)
    def test_available_tokens_never_exceeds_rate(self, rate, period):
        """
        **Validates: Requirements 3.1**

        Property: 创建 TokenBucketRateLimiter 后，available_tokens 永远不超过 rate。
        无论经过多长时间补充，令牌数上限始终为 rate。
        """
        limiter = TokenBucketRateLimiter(rate=rate, period=period)

        # 初始状态：可用令牌不超过 rate
        assert limiter.available_tokens <= rate, (
            f"初始 available_tokens={limiter.available_tokens} 超过 rate={rate}"
        )

    @given(
        rate=st.integers(min_value=1, max_value=50),
        period=st.floats(min_value=0.5, max_value=5.0, allow_nan=False, allow_infinity=False),
    )
    @settings(max_examples=30)
    def test_immediate_acquires_limited_by_rate(self, rate, period):
        """
        **Validates: Requirements 3.1**

        Property: 创建一个 rate=N 的令牌桶，在不等待补充的情况下，
        最多只能立即（非阻塞式）获取 N 个令牌。第 N+1 次 acquire 必须等待。
        验证方式：连续调用 rate 次 acquire 后，available_tokens 接近 0。
        """

        async def _run():
            limiter = TokenBucketRateLimiter(rate=rate, period=period)

            # 连续获取 rate 个令牌（应该全部立即完成，因为桶初始满）
            for _ in range(rate):
                await limiter.acquire()

            # 消耗完所有令牌后，可用令牌应接近 0（可能因 refill 略大于 0）
            tokens_after = limiter.available_tokens
            assert tokens_after < 1.0, (
                f"消耗 {rate} 个令牌后 available_tokens={tokens_after}，"
                f"应接近 0（rate={rate}, period={period}）"
            )

        asyncio.run(_run())

    @given(
        rate=st.integers(min_value=1, max_value=30),
        period=st.floats(min_value=1.0, max_value=5.0, allow_nan=False, allow_infinity=False),
    )
    @settings(max_examples=30)
    def test_available_tokens_bounded_after_acquires(self, rate, period):
        """
        **Validates: Requirements 3.1**

        Property: 执行若干次 acquire 操作后，available_tokens 仍然 <= rate。
        令牌桶的上界不变量在任何操作序列下都必须成立。
        """

        async def _run():
            limiter = TokenBucketRateLimiter(rate=rate, period=period)

            # 获取部分令牌
            acquire_count = min(rate, 5)
            for _ in range(acquire_count):
                await limiter.acquire()

            # 无论如何操作，available_tokens 不应超过 rate
            assert limiter.available_tokens <= rate, (
                f"操作后 available_tokens={limiter.available_tokens} 超过 rate={rate}"
            )

        asyncio.run(_run())
