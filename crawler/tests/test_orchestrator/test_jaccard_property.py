"""
Jaccard 相似度数学正确性 - Property Test

**Validates: Requirements 5.1**

使用 hypothesis 生成随机集合，验证：
1. 返回值始终在 [0.0, 1.0] 范围内
2. 相等非空集合返回 1.0
3. 不相交集合返回 0.0
4. 对称性：jaccard_similarity(A, B) == jaccard_similarity(B, A)
5. 两个空集返回 0.0
"""

from hypothesis import given, settings, assume
from hypothesis import strategies as st

from crawler_service.orchestrator.dedup import DeduplicationService


# 策略：生成随机字符串集合
string_sets = st.frozensets(st.text(min_size=1, max_size=10), min_size=0, max_size=50)
non_empty_string_sets = st.frozensets(st.text(min_size=1, max_size=10), min_size=1, max_size=50)


class TestJaccardSimilarityProperty:
    """Property 10: Jaccard 相似度数学正确性"""

    @given(set_a=string_sets, set_b=string_sets)
    @settings(max_examples=200)
    def test_return_value_in_range(self, set_a, set_b):
        """
        **Validates: Requirements 5.1**

        Property 1: 对任意两个集合，Jaccard 相似度始终在 [0.0, 1.0] 范围内。
        """
        result = DeduplicationService.jaccard_similarity(set(set_a), set(set_b))
        assert 0.0 <= result <= 1.0, (
            f"Jaccard 值超出范围: {result}, set_a={set_a}, set_b={set_b}"
        )

    @given(set_a=non_empty_string_sets)
    @settings(max_examples=200)
    def test_identical_sets_return_one(self, set_a):
        """
        **Validates: Requirements 5.1**

        Property 2: 对任意非空集合 A，jaccard_similarity(A, A) == 1.0。
        """
        result = DeduplicationService.jaccard_similarity(set(set_a), set(set_a))
        assert result == 1.0, (
            f"相同非空集合应返回 1.0，实际: {result}, set_a={set_a}"
        )

    @given(
        set_a=non_empty_string_sets,
        set_b=non_empty_string_sets,
    )
    @settings(max_examples=200)
    def test_disjoint_sets_return_zero(self, set_a, set_b):
        """
        **Validates: Requirements 5.1**

        Property 3: 当 A ∩ B == ∅ 时，jaccard_similarity(A, B) == 0.0。
        """
        # 确保两个集合不相交
        assume(set(set_a).isdisjoint(set(set_b)))

        result = DeduplicationService.jaccard_similarity(set(set_a), set(set_b))
        assert result == 0.0, (
            f"不相交集合应返回 0.0，实际: {result}, "
            f"set_a={set_a}, set_b={set_b}"
        )

    @given(set_a=string_sets, set_b=string_sets)
    @settings(max_examples=200)
    def test_symmetry(self, set_a, set_b):
        """
        **Validates: Requirements 5.1**

        Property 4: 对称性 - jaccard_similarity(A, B) == jaccard_similarity(B, A)。
        """
        result_ab = DeduplicationService.jaccard_similarity(set(set_a), set(set_b))
        result_ba = DeduplicationService.jaccard_similarity(set(set_b), set(set_a))
        assert result_ab == result_ba, (
            f"对称性不成立: J(A,B)={result_ab} != J(B,A)={result_ba}, "
            f"set_a={set_a}, set_b={set_b}"
        )

    def test_empty_sets_return_zero(self):
        """
        **Validates: Requirements 5.1**

        Property 5: jaccard_similarity(∅, ∅) == 0.0。
        """
        result = DeduplicationService.jaccard_similarity(set(), set())
        assert result == 0.0, (
            f"两个空集应返回 0.0，实际: {result}"
        )
