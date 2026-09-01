"""
雪花 ID 单调递增且唯一 - Property Test

**Validates: Requirements 14.5**

使用 hypothesis 生成连续 N 个 ID，验证：
1. 所有生成的 ID 严格单调递增（id[i] < id[i+1] for all i）
2. 所有生成的 ID 唯一（len(set(ids)) == len(ids)）
3. 所有生成的 ID 为正整数
4. 所有生成的 ID 适配 64 位（< 2^63）
"""

from hypothesis import given, settings
from hypothesis import strategies as st

from crawler_service.utils.snowflake import SnowflakeIDGenerator


class TestSnowflakeMonotonicAndUnique:
    """Property 14: 雪花 ID 单调递增且唯一"""

    @given(n=st.integers(min_value=2, max_value=200))
    @settings(max_examples=50)
    def test_ids_strictly_monotonically_increasing(self, n):
        """
        **Validates: Requirements 14.5**

        Property: 从同一个 SnowflakeIDGenerator 实例连续生成 N 个 ID，
        每个后续 ID 严格大于前一个（id[i] < id[i+1]）。
        """
        generator = SnowflakeIDGenerator(worker_id=1, datacenter_id=1)
        ids = [generator.next_id() for _ in range(n)]

        for i in range(len(ids) - 1):
            assert ids[i] < ids[i + 1], (
                f"ID 不是严格递增: ids[{i}]={ids[i]} >= ids[{i+1}]={ids[i+1]}"
            )

    @given(n=st.integers(min_value=2, max_value=200))
    @settings(max_examples=50)
    def test_ids_are_unique(self, n):
        """
        **Validates: Requirements 14.5**

        Property: 从同一个 SnowflakeIDGenerator 实例连续生成 N 个 ID，
        所有 ID 互不相同（无重复）。
        """
        generator = SnowflakeIDGenerator(worker_id=1, datacenter_id=1)
        ids = [generator.next_id() for _ in range(n)]

        assert len(set(ids)) == len(ids), (
            f"发现重复 ID: 生成 {n} 个，唯一 {len(set(ids))} 个"
        )

    @given(n=st.integers(min_value=2, max_value=200))
    @settings(max_examples=50)
    def test_ids_are_positive_integers(self, n):
        """
        **Validates: Requirements 14.5**

        Property: 所有生成的 ID 都是正整数（> 0）。
        """
        generator = SnowflakeIDGenerator(worker_id=1, datacenter_id=1)
        ids = [generator.next_id() for _ in range(n)]

        for i, id_ in enumerate(ids):
            assert isinstance(id_, int), f"ids[{i}] 不是整数: {type(id_)}"
            assert id_ > 0, f"ids[{i}] 不是正整数: {id_}"

    @given(n=st.integers(min_value=2, max_value=200))
    @settings(max_examples=50)
    def test_ids_fit_in_64_bit(self, n):
        """
        **Validates: Requirements 14.5**

        Property: 所有生成的 ID 适配 64 位有符号整数范围（< 2^63）。
        """
        generator = SnowflakeIDGenerator(worker_id=1, datacenter_id=1)
        ids = [generator.next_id() for _ in range(n)]

        max_int64 = (1 << 63) - 1
        for i, id_ in enumerate(ids):
            assert id_ <= max_int64, (
                f"ids[{i}]={id_} 超出 64 位范围 (max={max_int64})"
            )
