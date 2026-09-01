"""
雪花 ID 生成器

与 Java 端 SnowflakeIdUtil 完全兼容：
- 结构：1 位符号 + 41 位时间戳 + 5 位 datacenterId + 5 位 workerId + 12 位序列号
- Epoch：2024-01-01 00:00:00 UTC = 1704067200000
- 线程安全（threading.Lock）
"""

import threading
import time


# 起始时间戳 (2024-01-01 00:00:00 UTC)，与 Java 端一致
EPOCH = 1704067200000

# 位数定义
WORKER_ID_BITS = 5
DATACENTER_ID_BITS = 5
SEQUENCE_BITS = 12

# 最大值
MAX_WORKER_ID = (1 << WORKER_ID_BITS) - 1        # 31
MAX_DATACENTER_ID = (1 << DATACENTER_ID_BITS) - 1  # 31
MAX_SEQUENCE = (1 << SEQUENCE_BITS) - 1            # 4095

# 位移量
WORKER_ID_SHIFT = SEQUENCE_BITS                                    # 12
DATACENTER_ID_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS               # 17
TIMESTAMP_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS + DATACENTER_ID_BITS  # 22


class SnowflakeIDGenerator:
    """
    雪花 ID 生成器，与 Java 端 SnowflakeIdUtil 兼容。

    ID 结构（64 位）：
        0 | 41 位毫秒级时间戳 | 5 位 datacenterId | 5 位 workerId | 12 位序列号

    用法：
        generator = SnowflakeIDGenerator(worker_id=1, datacenter_id=1)
        unique_id = generator.next_id()
    """

    def __init__(self, worker_id: int = 1, datacenter_id: int = 1):
        """
        初始化雪花 ID 生成器。

        :param worker_id: 工作节点 ID（0-31）
        :param datacenter_id: 数据中心 ID（0-31）
        """
        if worker_id < 0 or worker_id > MAX_WORKER_ID:
            raise ValueError(f"worker_id 超出范围 [0, {MAX_WORKER_ID}]: {worker_id}")
        if datacenter_id < 0 or datacenter_id > MAX_DATACENTER_ID:
            raise ValueError(f"datacenter_id 超出范围 [0, {MAX_DATACENTER_ID}]: {datacenter_id}")

        self._worker_id = worker_id
        self._datacenter_id = datacenter_id
        self._sequence = 0
        self._last_timestamp = -1
        self._lock = threading.Lock()

    def next_id(self) -> int:
        """
        生成下一个雪花 ID，保证单调递增且唯一。

        线程安全：使用 threading.Lock 保护。
        时钟回拨：抛出 RuntimeError。
        序列溢出：等待下一毫秒。

        :return: 64 位整数 ID
        """
        with self._lock:
            timestamp = self._current_time_millis()

            # 时钟回拨检测
            if timestamp < self._last_timestamp:
                raise RuntimeError(
                    f"时钟回拨，拒绝生成 ID。"
                    f"当前时间 {timestamp}ms < 上次时间 {self._last_timestamp}ms"
                )

            if timestamp == self._last_timestamp:
                # 同一毫秒内，序列号递增
                self._sequence = (self._sequence + 1) & MAX_SEQUENCE
                if self._sequence == 0:
                    # 序列号溢出，等待下一毫秒
                    timestamp = self._wait_next_millis(self._last_timestamp)
            else:
                # 新的毫秒，序列号重置
                self._sequence = 0

            self._last_timestamp = timestamp

            # 组装 ID：与 Java 端位运算完全一致
            return (
                ((timestamp - EPOCH) << TIMESTAMP_SHIFT)
                | (self._datacenter_id << DATACENTER_ID_SHIFT)
                | (self._worker_id << WORKER_ID_SHIFT)
                | self._sequence
            )

    @property
    def worker_id(self) -> int:
        """当前 worker_id"""
        return self._worker_id

    @property
    def datacenter_id(self) -> int:
        """当前 datacenter_id"""
        return self._datacenter_id

    @staticmethod
    def _current_time_millis() -> int:
        """获取当前 UTC 毫秒时间戳"""
        return int(time.time() * 1000)

    @staticmethod
    def _wait_next_millis(last_timestamp: int) -> int:
        """等待直到下一毫秒"""
        ts = int(time.time() * 1000)
        while ts <= last_timestamp:
            ts = int(time.time() * 1000)
        return ts
