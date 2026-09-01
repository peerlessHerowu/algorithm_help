"""熔断器 —— 自实现，替代 Java Resilience4j CircuitBreaker

状态转换：
- CLOSED → OPEN：连续失败次数达到 failure_threshold
- OPEN → HALF_OPEN：距离上次失败时间超过 wait_duration
- HALF_OPEN → CLOSED：record_success 成功
- HALF_OPEN → OPEN：record_failure 再次失败
"""

import asyncio
import time
from enum import Enum


class CircuitState(str, Enum):
    """熔断器状态"""

    CLOSED = "closed"  # 正常，允许请求通过
    OPEN = "open"  # 熔断，拒绝所有请求
    HALF_OPEN = "half_open"  # 半开探测，允许单次请求试探


class CircuitOpenError(Exception):
    """熔断器打开时抛出的异常"""

    pass


class CircuitBreaker:
    """熔断器 —— 连续失败达阈值后熔断，等待一段时间后半开探测恢复"""

    def __init__(self, failure_threshold: int = 5, wait_duration_ms: int = 300000):
        """
        :param failure_threshold: 连续失败多少次后触发熔断
        :param wait_duration_ms: 熔断后等待多久（毫秒）进入半开状态
        """
        self._failure_threshold = failure_threshold
        self._wait_duration = wait_duration_ms / 1000.0  # 转为秒
        self._failure_count = 0
        self._state = CircuitState.CLOSED
        self._last_failure_time: float = 0.0
        self._lock = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        """获取当前状态，自动检测 OPEN → HALF_OPEN 转换"""
        if self._state == CircuitState.OPEN:
            elapsed = time.monotonic() - self._last_failure_time
            if elapsed >= self._wait_duration:
                self._state = CircuitState.HALF_OPEN
        return self._state

    @property
    def failure_count(self) -> int:
        """当前连续失败次数"""
        return self._failure_count

    @property
    def failure_threshold(self) -> int:
        """失败阈值"""
        return self._failure_threshold

    async def check(self) -> None:
        """检查是否允许请求通过，熔断状态时抛出 CircuitOpenError"""
        if self.state == CircuitState.OPEN:
            raise CircuitOpenError(
                f"熔断器已打开，连续失败 {self._failure_count} 次，"
                f"等待 {self._wait_duration:.1f}s 后恢复探测"
            )

    async def record_success(self) -> None:
        """记录成功：重置失败计数，HALF_OPEN → CLOSED"""
        async with self._lock:
            self._failure_count = 0
            self._state = CircuitState.CLOSED

    async def record_failure(self) -> None:
        """记录失败：累计失败次数，达到阈值 → OPEN；HALF_OPEN 状态下失败 → OPEN"""
        async with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.monotonic()
            if self._state == CircuitState.HALF_OPEN:
                # 半开状态下失败，直接回到 OPEN
                self._state = CircuitState.OPEN
            elif self._failure_count >= self._failure_threshold:
                # CLOSED 状态下连续失败达阈值，转为 OPEN
                self._state = CircuitState.OPEN
