"""数据质量检查器单元测试"""

import pytest

from crawler_service.pipeline.quality_checker import QualityChecker, QualityResult


@pytest.fixture
def checker():
    return QualityChecker()


class TestQualityCheckerCheck:
    """题目完整性校验测试"""

    def test_complete_data_returns_ok(self, checker: QualityChecker):
        """所有必填字段存在时返回 OK"""
        data = {
            "title": "Two Sum",
            "description": "Given an array of integers...",
            "difficulty": "EASY",
        }
        result = checker.check(data)
        assert result.status == "OK"
        assert result.message == ""

    def test_missing_title_returns_incomplete(self, checker: QualityChecker):
        """缺失 title 时返回 INCOMPLETE"""
        data = {
            "title": "",
            "description": "Some description",
            "difficulty": "MEDIUM",
        }
        result = checker.check(data)
        assert result.status == "INCOMPLETE"
        assert "title" in result.message

    def test_missing_description_returns_incomplete(self, checker: QualityChecker):
        """缺失 description 时返回 INCOMPLETE"""
        data = {
            "title": "Two Sum",
            "description": "",
            "difficulty": "HARD",
        }
        result = checker.check(data)
        assert result.status == "INCOMPLETE"
        assert "description" in result.message

    def test_missing_difficulty_returns_incomplete(self, checker: QualityChecker):
        """缺失 difficulty 时返回 INCOMPLETE"""
        data = {
            "title": "Two Sum",
            "description": "Some description",
            "difficulty": "",
        }
        result = checker.check(data)
        assert result.status == "INCOMPLETE"
        assert "difficulty" in result.message

    def test_missing_multiple_fields_returns_incomplete(self, checker: QualityChecker):
        """缺失多个字段时全部列出"""
        data = {"title": "", "description": "", "difficulty": ""}
        result = checker.check(data)
        assert result.status == "INCOMPLETE"
        assert "title" in result.message
        assert "description" in result.message
        assert "difficulty" in result.message

    def test_missing_key_in_dict_returns_incomplete(self, checker: QualityChecker):
        """字典中完全没有必填 key 时返回 INCOMPLETE"""
        data = {}
        result = checker.check(data)
        assert result.status == "INCOMPLETE"

    def test_none_values_treated_as_missing(self, checker: QualityChecker):
        """None 值视为缺失"""
        data = {"title": None, "description": "desc", "difficulty": "EASY"}
        result = checker.check(data)
        assert result.status == "INCOMPLETE"
        assert "title" in result.message


class TestQualityCheckerCheckSolution:
    """题解内容质量校验测试"""

    def test_short_content_returns_low_quality(self, checker: QualityChecker):
        """内容长度 < 100 字符时返回 LOW_QUALITY"""
        content = "这是一个很短的题解"
        result = checker.check_solution(content)
        assert result.status == "LOW_QUALITY"
        assert str(len(content)) in result.message

    def test_empty_content_returns_low_quality(self, checker: QualityChecker):
        """空内容返回 LOW_QUALITY"""
        result = checker.check_solution("")
        assert result.status == "LOW_QUALITY"

    def test_exactly_100_chars_returns_ok(self, checker: QualityChecker):
        """恰好 100 字符返回 OK"""
        content = "a" * 100
        result = checker.check_solution(content)
        assert result.status == "OK"

    def test_long_content_returns_ok(self, checker: QualityChecker):
        """超过 100 字符的内容返回 OK"""
        content = "这是一篇详细的题解，使用动态规划方法解决两数之和问题。" * 10
        result = checker.check_solution(content)
        assert result.status == "OK"
        assert result.message == ""

    def test_99_chars_returns_low_quality(self, checker: QualityChecker):
        """99 字符刚好不满足最小长度"""
        content = "a" * 99
        result = checker.check_solution(content)
        assert result.status == "LOW_QUALITY"
