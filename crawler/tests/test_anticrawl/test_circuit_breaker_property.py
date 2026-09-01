"""
熔断器状态转换正确性 - Property Test

**Validates: Requirements 3.5**

使用 hypothesis 生成连续失败/成功序列，验证状态转换逻辑：
1. 连续失败达到 failure_threshold 次后，state == OPEN
2. 任何 record_success() 后，failure_count 重置为 0 且 state == CLOSED
3. failure_count 不超过连续失败次数（中间无 success）
4. 连续失败少于 failure_threshold 次时，state 保持 CLOSED
"""

import asyncio

from hypothesis import given, settings
from hypothesis import strategies as st

from crawler_service.anticrawl.circuit_breaker import (
    CircuitBreaker,
    CircuitState,
)


class TestCircuitBreakerStateTransitionProperty:
    """Property 2: 熔断器状态转换正确性"""

    @given(
        failure_threshold=st.integers(min_value=1, max_value=20),
        extra_failures=st.integers(min_value=0, max_value=10),
    )
    @settings(max_examples=100)
    def test_exact_threshold_failures_triggers_open(self, failure_threshold, extra_failures):
        """
        **Validates: Requirements 3.5**

        Property: 连续失败恰好达到 failure_threshold 次后，state == OPEN。
        继续失败依然保持 OPEN。
        """

        async def _run():
            breaker = CircuitBreaker(
                failure_threshold=failure_threshold, wait_duration_ms=300000
            )
            # 连续失败恰好 failure_threshold 次
            for _ in range(failure_threshold):
                await breaker.record_failure()
            assert breaker.state == CircuitState.OPEN, (
                f"连续失败 {failure_threshold} 次后状态应为 OPEN，"
                f"实际为 {breaker.state}"
            )
            # 继续失败，应保持 OPEN
            for _ in range(extra_failures):
                await breaker.record_failure()
            assert breaker.state == CircuitState.OPEN

        asyncio.run(_run())

    @given(
        failure_threshold=st.integers(min_value=1, max_value=20),
        actions=st.lists(
            st.sampled_from(["success", "failure"]),
            min_size=1,
            max_size=50,
        ),
    )
    @settings(max_examples=100)
    def test_record_success_resets_to_closed(self, failure_threshold, actions):
        """
        **Validates: Requirements 3.5**

        Property: 在任意操作序列中，任何 record_success() 调用后，
        failure_count 重置为 0 且 state == CLOSED。
        """

        async def _run():
            breaker = CircuitBreaker(
                failure_threshold=failure_threshold, wait_duration_ms=300000
            )
            for action in actions:
                if action == "success":
                    await breaker.record_success()
                    assert breaker.failure_count == 0, (
                        f"record_success 后 failure_count 应为 0，"
                        f"实际为 {breaker.failure_count}"
                    )
                    assert breaker.state == CircuitState.CLOSED, (
                        f"record_success 后 state 应为 CLOSED，"
                        f"实际为 {breaker.state}"
                    )
                else:
                    await breaker.record_failure()

        asyncio.run(_run())

    @given(
        failure_threshold=st.integers(min_value=1, max_value=20),
        actions=st.lists(
            st.sampled_from(["success", "failure"]),
            min_size=1,
            max_size=50,
        ),
    )
    @settings(max_examples=100)
    def test_failure_count_never_exceeds_consecutive_failures(
        self, failure_threshold, actions
    ):
        """
        **Validates: Requirements 3.5**

        Property: failure_count 永远不超过当前连续失败次数
        （即中间没有 success 的 failure 计数）。
        """

        async def _run():
            breaker = CircuitBreaker(
                failure_threshold=failure_threshold, wait_duration_ms=300000
            )
            consecutive_failures = 0
            for action in actions:
                if action == "success":
                    await breaker.record_success()
                    consecutive_failures = 0
                else:
                    await breaker.record_failure()
                    consecutive_failures += 1
                assert breaker.failure_count <= consecutive_failures, (
                    f"failure_count={breaker.failure_count} 超过了"
                    f"连续失败次数={consecutive_failures}"
                )

        asyncio.run(_run())

    @given(
        failure_threshold=st.integers(min_value=2, max_value=20),
        num_failures=st.integers(min_value=0, max_value=19),
    )
    @settings(max_examples=100)
    def test_fewer_than_threshold_stays_closed(self, failure_threshold, num_failures):
        """
        **Validates: Requirements 3.5**

        Property: 连续失败次数少于 failure_threshold 时，state 保持 CLOSED。
        """
        # 确保 num_failures 严格小于 threshold
        num_failures = num_failures % failure_threshold  # 保证 < threshold

        async def _run():
            breaker = CircuitBreaker(
                failure_threshold=failure_threshold, wait_duration_ms=300000
            )
            for _ in range(num_failures):
                await breaker.record_failure()
            assert breaker.state == CircuitState.CLOSED, (
                f"连续失败 {num_failures} 次（阈值 {failure_threshold}）"
                f"状态应为 CLOSED，实际为 {breaker.state}"
            )

        asyncio.run(_run())
