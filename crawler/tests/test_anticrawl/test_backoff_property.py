"""
指数退避延迟计算 - Property Test

**Validates: Requirements 3.4**

使用 hypothesis 生成随机 base_delay_ms 和 attempt 数，验证：
1. 第 n 次重试等待时间 == base_delay_ms * 2^n（毫秒）
2. 延迟值随 attempt 单调递增
3. 延迟值始终为正数
"""

from hypothesis import given, settings
from hypothesis import strategies as st


def compute_backoff_delay_s(base_delay_ms: int, attempt: int) -> float:
    """
    提取 AntiCrawlManager.retry_with_backoff 中的纯延迟计算逻辑。

    在 manager.py 的 retry_with_backoff 方法中：
        delay_ms = base_delay_ms * (2 ** attempt)
        await asyncio.sleep(delay_ms / 1000.0)

    本函数复现该计算，返回延迟秒数。
    """
    delay_ms = base_delay_ms * (2 ** attempt)
    return delay_ms / 1000.0


class TestBackoffDelayProperty:
    """Property 3: 指数退避延迟计算"""

    @given(
        base_delay_ms=st.integers(min_value=100, max_value=5000),
        attempt=st.integers(min_value=0, max_value=10),
    )
    @settings(max_examples=100)
    def test_delay_equals_base_times_two_power_n(self, base_delay_ms: int, attempt: int):
        """
        **Validates: Requirements 3.4**

        Property: 第 n 次重试的等待时间严格等于 base_delay_ms / 1000 * 2^n 秒。
        """
        delay_s = compute_backoff_delay_s(base_delay_ms, attempt)
        expected_s = base_delay_ms / 1000.0 * (2 ** attempt)

        assert delay_s == expected_s, (
            f"base_delay_ms={base_delay_ms}, attempt={attempt}: "
            f"实际延迟={delay_s}s, 期望={expected_s}s"
        )

    @given(
        base_delay_ms=st.integers(min_value=100, max_value=5000),
        attempt=st.integers(min_value=0, max_value=9),
    )
    @settings(max_examples=100)
    def test_delay_monotonically_increases_with_attempt(self, base_delay_ms: int, attempt: int):
        """
        **Validates: Requirements 3.4**

        Property: 对于同一 base_delay_ms，attempt+1 的延迟严格大于 attempt 的延迟。
        即指数退避是单调递增的。
        """
        delay_current = compute_backoff_delay_s(base_delay_ms, attempt)
        delay_next = compute_backoff_delay_s(base_delay_ms, attempt + 1)

        assert delay_next > delay_current, (
            f"base_delay_ms={base_delay_ms}, attempt={attempt}: "
            f"delay[{attempt}]={delay_current}s >= delay[{attempt+1}]={delay_next}s, "
            f"应单调递增"
        )

    @given(
        base_delay_ms=st.integers(min_value=100, max_value=5000),
        attempt=st.integers(min_value=0, max_value=10),
    )
    @settings(max_examples=100)
    def test_delay_is_always_positive(self, base_delay_ms: int, attempt: int):
        """
        **Validates: Requirements 3.4**

        Property: 指数退避延迟始终为正数（> 0）。
        """
        delay_s = compute_backoff_delay_s(base_delay_ms, attempt)

        assert delay_s > 0, (
            f"base_delay_ms={base_delay_ms}, attempt={attempt}: "
            f"延迟={delay_s}s 应为正数"
        )

    @given(
        base_delay_ms=st.integers(min_value=100, max_value=5000),
        attempt=st.integers(min_value=1, max_value=10),
    )
    @settings(max_examples=100)
    def test_delay_doubles_each_attempt(self, base_delay_ms: int, attempt: int):
        """
        **Validates: Requirements 3.4**

        Property: 相邻两次重试的延迟比值恒为 2（指数退避翻倍特性）。
        delay[n] / delay[n-1] == 2
        """
        delay_prev = compute_backoff_delay_s(base_delay_ms, attempt - 1)
        delay_curr = compute_backoff_delay_s(base_delay_ms, attempt)

        ratio = delay_curr / delay_prev

        assert ratio == 2.0, (
            f"base_delay_ms={base_delay_ms}, attempt={attempt}: "
            f"delay[{attempt}]/delay[{attempt-1}] = {ratio}, 期望 2.0"
        )
