"""熔断器单元测试"""

import asyncio
import time
from unittest.mock import patch

import pytest

from crawler_service.anticrawl.circuit_breaker import (
    CircuitBreaker,
    CircuitOpenError,
    CircuitState,
)


class TestCircuitState:
    """测试 CircuitState 枚举"""

    def test_state_values(self):
        assert CircuitState.CLOSED == "closed"
        assert CircuitState.OPEN == "open"
        assert CircuitState.HALF_OPEN == "half_open"

    def test_state_is_string_enum(self):
        assert isinstance(CircuitState.CLOSED, str)


class TestCircuitBreaker:
    """测试熔断器核心逻辑"""

    @pytest.fixture
    def breaker(self):
        """默认参数的熔断器：5 次失败触发，等待 300 秒"""
        return CircuitBreaker(failure_threshold=5, wait_duration_ms=300000)

    @pytest.fixture
    def fast_breaker(self):
        """快速恢复的熔断器：3 次失败触发，等待 100ms"""
        return CircuitBreaker(failure_threshold=3, wait_duration_ms=100)

    async def test_initial_state_is_closed(self, breaker):
        """初始状态为 CLOSED"""
        assert breaker.state == CircuitState.CLOSED
        assert breaker.failure_count == 0

    async def test_check_passes_when_closed(self, breaker):
        """CLOSED 状态 check() 正常通过"""
        await breaker.check()  # 不应抛异常

    async def test_record_failure_increments_count(self, breaker):
        """record_failure 增加失败计数"""
        await breaker.record_failure()
        assert breaker.failure_count == 1
        assert breaker.state == CircuitState.CLOSED

    async def test_closed_to_open_transition(self, breaker):
        """连续失败达到阈值后 CLOSED → OPEN"""
        for _ in range(5):
            await breaker.record_failure()
        assert breaker.state == CircuitState.OPEN
        assert breaker.failure_count == 5

    async def test_check_raises_when_open(self, breaker):
        """OPEN 状态 check() 抛出 CircuitOpenError"""
        for _ in range(5):
            await breaker.record_failure()
        with pytest.raises(CircuitOpenError):
            await breaker.check()

    async def test_below_threshold_stays_closed(self, breaker):
        """失败次数未达阈值，保持 CLOSED"""
        for _ in range(4):
            await breaker.record_failure()
        assert breaker.state == CircuitState.CLOSED

    async def test_success_resets_failure_count(self, breaker):
        """record_success 重置失败计数并回到 CLOSED"""
        for _ in range(3):
            await breaker.record_failure()
        await breaker.record_success()
        assert breaker.failure_count == 0
        assert breaker.state == CircuitState.CLOSED

    async def test_open_to_half_open_after_wait(self, fast_breaker):
        """等待 wait_duration 后 OPEN → HALF_OPEN"""
        for _ in range(3):
            await fast_breaker.record_failure()
        assert fast_breaker.state == CircuitState.OPEN

        # 等待超过 wait_duration（100ms）
        await asyncio.sleep(0.15)
        assert fast_breaker.state == CircuitState.HALF_OPEN

    async def test_half_open_to_closed_on_success(self, fast_breaker):
        """HALF_OPEN 状态 record_success → CLOSED"""
        for _ in range(3):
            await fast_breaker.record_failure()
        await asyncio.sleep(0.15)
        assert fast_breaker.state == CircuitState.HALF_OPEN

        await fast_breaker.record_success()
        assert fast_breaker.state == CircuitState.CLOSED
        assert fast_breaker.failure_count == 0

    async def test_half_open_to_open_on_failure(self, fast_breaker):
        """HALF_OPEN 状态 record_failure → 回到 OPEN"""
        for _ in range(3):
            await fast_breaker.record_failure()
        await asyncio.sleep(0.15)
        assert fast_breaker.state == CircuitState.HALF_OPEN

        await fast_breaker.record_failure()
        assert fast_breaker.state == CircuitState.OPEN

    async def test_open_check_does_not_transition_before_wait(self, breaker):
        """未到等待时间，OPEN 状态不会转为 HALF_OPEN"""
        for _ in range(5):
            await breaker.record_failure()
        # wait_duration 为 300s，远未到达
        assert breaker.state == CircuitState.OPEN

    async def test_custom_threshold(self):
        """自定义失败阈值"""
        breaker = CircuitBreaker(failure_threshold=2, wait_duration_ms=1000)
        await breaker.record_failure()
        assert breaker.state == CircuitState.CLOSED
        await breaker.record_failure()
        assert breaker.state == CircuitState.OPEN

    async def test_circuit_open_error_message(self, breaker):
        """CircuitOpenError 包含有意义的错误信息"""
        for _ in range(5):
            await breaker.record_failure()
        with pytest.raises(CircuitOpenError) as exc_info:
            await breaker.check()
        assert "熔断器已打开" in str(exc_info.value)

    async def test_full_lifecycle(self, fast_breaker):
        """完整生命周期：CLOSED → OPEN → HALF_OPEN → CLOSED"""
        # 初始 CLOSED
        assert fast_breaker.state == CircuitState.CLOSED
        await fast_breaker.check()

        # 连续失败 → OPEN
        for _ in range(3):
            await fast_breaker.record_failure()
        assert fast_breaker.state == CircuitState.OPEN
        with pytest.raises(CircuitOpenError):
            await fast_breaker.check()

        # 等待 → HALF_OPEN
        await asyncio.sleep(0.15)
        assert fast_breaker.state == CircuitState.HALF_OPEN
        await fast_breaker.check()  # HALF_OPEN 允许通过

        # 成功 → CLOSED
        await fast_breaker.record_success()
        assert fast_breaker.state == CircuitState.CLOSED
        await fast_breaker.check()
