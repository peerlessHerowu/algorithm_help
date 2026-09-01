"""雪花 ID 生成器单元测试"""

import threading
import time
from unittest.mock import patch

import pytest

from crawler_service.utils.snowflake import (
    DATACENTER_ID_SHIFT,
    EPOCH,
    MAX_DATACENTER_ID,
    MAX_SEQUENCE,
    MAX_WORKER_ID,
    SEQUENCE_BITS,
    TIMESTAMP_SHIFT,
    WORKER_ID_SHIFT,
    SnowflakeIDGenerator,
)


class TestSnowflakeIDGeneratorInit:
    """初始化参数校验"""

    def test_valid_params(self):
        gen = SnowflakeIDGenerator(worker_id=0, datacenter_id=0)
        assert gen.worker_id == 0
        assert gen.datacenter_id == 0

    def test_max_valid_params(self):
        gen = SnowflakeIDGenerator(worker_id=MAX_WORKER_ID, datacenter_id=MAX_DATACENTER_ID)
        assert gen.worker_id == 31
        assert gen.datacenter_id == 31

    def test_invalid_worker_id_negative(self):
        with pytest.raises(ValueError, match="worker_id 超出范围"):
            SnowflakeIDGenerator(worker_id=-1)

    def test_invalid_worker_id_too_large(self):
        with pytest.raises(ValueError, match="worker_id 超出范围"):
            SnowflakeIDGenerator(worker_id=32)

    def test_invalid_datacenter_id_negative(self):
        with pytest.raises(ValueError, match="datacenter_id 超出范围"):
            SnowflakeIDGenerator(datacenter_id=-1)

    def test_invalid_datacenter_id_too_large(self):
        with pytest.raises(ValueError, match="datacenter_id 超出范围"):
            SnowflakeIDGenerator(datacenter_id=32)

    def test_default_params(self):
        gen = SnowflakeIDGenerator()
        assert gen.worker_id == 1
        assert gen.datacenter_id == 1


class TestSnowflakeIDGeneratorNextId:
    """next_id() 功能测试"""

    def test_generates_positive_integer(self):
        gen = SnowflakeIDGenerator()
        id_ = gen.next_id()
        assert isinstance(id_, int)
        assert id_ > 0

    def test_monotonically_increasing(self):
        """连续生成的 ID 严格递增"""
        gen = SnowflakeIDGenerator()
        ids = [gen.next_id() for _ in range(100)]
        for i in range(1, len(ids)):
            assert ids[i] > ids[i - 1], f"ID[{i}]={ids[i]} <= ID[{i-1}]={ids[i-1]}"

    def test_uniqueness(self):
        """连续生成的 ID 无重复"""
        gen = SnowflakeIDGenerator()
        ids = [gen.next_id() for _ in range(1000)]
        assert len(set(ids)) == 1000

    def test_bit_structure_compatibility(self):
        """验证位结构与 Java 端一致"""
        gen = SnowflakeIDGenerator(worker_id=3, datacenter_id=5)
        # mock 固定时间戳以验证位布局
        fixed_ts = EPOCH + 12345678  # 固定偏移量
        with patch.object(SnowflakeIDGenerator, '_current_time_millis', return_value=fixed_ts):
            id_ = gen.next_id()

        # 解析各段
        sequence = id_ & MAX_SEQUENCE
        worker_id = (id_ >> WORKER_ID_SHIFT) & 0x1F
        datacenter_id = (id_ >> DATACENTER_ID_SHIFT) & 0x1F
        timestamp_part = id_ >> TIMESTAMP_SHIFT

        assert sequence == 0  # 第一个 ID，序列号为 0
        assert worker_id == 3
        assert datacenter_id == 5
        assert timestamp_part == 12345678

    def test_sequence_increments_within_same_millisecond(self):
        """同一毫秒内序列号递增"""
        gen = SnowflakeIDGenerator(worker_id=1, datacenter_id=1)
        fixed_ts = EPOCH + 100000
        with patch.object(SnowflakeIDGenerator, '_current_time_millis', return_value=fixed_ts):
            id1 = gen.next_id()
            id2 = gen.next_id()
            id3 = gen.next_id()

        seq1 = id1 & MAX_SEQUENCE
        seq2 = id2 & MAX_SEQUENCE
        seq3 = id3 & MAX_SEQUENCE

        assert seq1 == 0
        assert seq2 == 1
        assert seq3 == 2

    def test_sequence_overflow_waits_next_millis(self):
        """序列号溢出时等待下一毫秒"""
        gen = SnowflakeIDGenerator(worker_id=1, datacenter_id=1)
        gen._sequence = MAX_SEQUENCE  # 预设序列号到最大值
        gen._last_timestamp = EPOCH + 100000

        # 模拟：第一次返回同一毫秒，第二次返回下一毫秒
        next_ts = EPOCH + 100001
        with patch.object(
            SnowflakeIDGenerator, '_current_time_millis', return_value=EPOCH + 100000
        ):
            with patch.object(
                SnowflakeIDGenerator, '_wait_next_millis', return_value=next_ts
            ):
                id_ = gen.next_id()

        # 验证时间戳部分已推进到下一毫秒
        timestamp_part = id_ >> TIMESTAMP_SHIFT
        assert timestamp_part == 100001

    def test_clock_rollback_raises_error(self):
        """时钟回拨抛出 RuntimeError"""
        gen = SnowflakeIDGenerator()
        gen._last_timestamp = int(time.time() * 1000) + 10000  # 未来时间

        with pytest.raises(RuntimeError, match="时钟回拨"):
            gen.next_id()


class TestSnowflakeThreadSafety:
    """多线程安全测试"""

    def test_concurrent_generation_unique(self):
        """多线程并发生成的 ID 唯一"""
        gen = SnowflakeIDGenerator()
        ids: list[int] = []
        lock = threading.Lock()
        num_threads = 4
        ids_per_thread = 250

        def generate():
            local_ids = [gen.next_id() for _ in range(ids_per_thread)]
            with lock:
                ids.extend(local_ids)

        threads = [threading.Thread(target=generate) for _ in range(num_threads)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(ids) == num_threads * ids_per_thread
        assert len(set(ids)) == len(ids), "发现重复 ID"

    def test_concurrent_generation_monotonic(self):
        """单线程视角下生成的 ID 单调递增"""
        gen = SnowflakeIDGenerator()
        ids = [gen.next_id() for _ in range(500)]
        for i in range(1, len(ids)):
            assert ids[i] > ids[i - 1]
