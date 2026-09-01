"""
数据质量检查正确性 - Property Test

**Validates: Requirements 16.1, 16.2**

使用 hypothesis 生成随机字符串验证：
1. title/description/difficulty 任一为空 → check() 返回 status=="INCOMPLETE"
2. title/description/difficulty 全部非空 → check() 返回 status=="OK"
3. content 长度 < 100 → check_solution() 返回 status=="LOW_QUALITY"
4. content 长度 >= 100 → check_solution() 返回 status=="OK"
"""

from hypothesis import given, settings
from hypothesis import strategies as st

from crawler_service.pipeline.quality_checker import QualityChecker


# 策略：生成非空字符串（至少 1 个字符，排除纯空白）
non_empty_text = st.text(min_size=1, max_size=200).filter(lambda s: len(s.strip()) > 0)

# 策略：生成空字符串或缺失值场景
empty_or_missing = st.sampled_from(["", None])


class TestQualityCheckerProperty:
    """Property 15: 数据质量检查正确性"""

    @given(
        title=empty_or_missing,
        description=non_empty_text,
        difficulty=non_empty_text,
    )
    @settings(max_examples=50)
    def test_missing_title_returns_incomplete(self, title, description, difficulty):
        """
        **Validates: Requirements 16.1**

        Property: title 为空/None 时，check() 必须返回 INCOMPLETE。
        """
        checker = QualityChecker()
        data = {"title": title, "description": description, "difficulty": difficulty}
        result = checker.check(data)
        assert result.status == "INCOMPLETE"

    @given(
        title=non_empty_text,
        description=empty_or_missing,
        difficulty=non_empty_text,
    )
    @settings(max_examples=50)
    def test_missing_description_returns_incomplete(self, title, description, difficulty):
        """
        **Validates: Requirements 16.1**

        Property: description 为空/None 时，check() 必须返回 INCOMPLETE。
        """
        checker = QualityChecker()
        data = {"title": title, "description": description, "difficulty": difficulty}
        result = checker.check(data)
        assert result.status == "INCOMPLETE"

    @given(
        title=non_empty_text,
        description=non_empty_text,
        difficulty=empty_or_missing,
    )
    @settings(max_examples=50)
    def test_missing_difficulty_returns_incomplete(self, title, description, difficulty):
        """
        **Validates: Requirements 16.1**

        Property: difficulty 为空/None 时，check() 必须返回 INCOMPLETE。
        """
        checker = QualityChecker()
        data = {"title": title, "description": description, "difficulty": difficulty}
        result = checker.check(data)
        assert result.status == "INCOMPLETE"

    @given(
        title=non_empty_text,
        description=non_empty_text,
        difficulty=non_empty_text,
    )
    @settings(max_examples=50)
    def test_all_fields_present_returns_ok(self, title, description, difficulty):
        """
        **Validates: Requirements 16.1**

        Property: title/description/difficulty 全部非空时，check() 必须返回 OK。
        """
        checker = QualityChecker()
        data = {"title": title, "description": description, "difficulty": difficulty}
        result = checker.check(data)
        assert result.status == "OK"

    @given(content=st.text(min_size=0, max_size=99))
    @settings(max_examples=50)
    def test_short_content_returns_low_quality(self, content):
        """
        **Validates: Requirements 16.2**

        Property: content 长度 < 100 时，check_solution() 必须返回 LOW_QUALITY。
        """
        checker = QualityChecker()
        result = checker.check_solution(content)
        assert result.status == "LOW_QUALITY"

    @given(content=st.text(min_size=100, max_size=5000))
    @settings(max_examples=50)
    def test_sufficient_content_returns_ok(self, content):
        """
        **Validates: Requirements 16.2**

        Property: content 长度 >= 100 时，check_solution() 必须返回 OK。
        """
        checker = QualityChecker()
        result = checker.check_solution(content)
        assert result.status == "OK"
