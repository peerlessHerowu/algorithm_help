"""DifficultyMapper 单元测试"""

import pytest

from crawler_service.pipeline.difficulty_mapper import DifficultyMapper


@pytest.fixture
def mapper():
    return DifficultyMapper()


class TestLeetCodeGlobal:
    """LeetCode 国际站难度文本映射"""

    def test_easy(self, mapper):
        assert mapper.map("Easy", "leetcode_global") == "EASY"

    def test_medium(self, mapper):
        assert mapper.map("Medium", "leetcode_global") == "MEDIUM"

    def test_hard(self, mapper):
        assert mapper.map("Hard", "leetcode_global") == "HARD"

    def test_unknown_text_defaults_to_medium(self, mapper):
        assert mapper.map("Unknown", "leetcode_global") == "MEDIUM"

    def test_empty_string_defaults_to_medium(self, mapper):
        assert mapper.map("", "leetcode_global") == "MEDIUM"


class TestLeetCodeCN:
    """力扣中文站难度文本映射"""

    def test_easy(self, mapper):
        assert mapper.map("简单", "leetcode_cn") == "EASY"

    def test_medium(self, mapper):
        assert mapper.map("中等", "leetcode_cn") == "MEDIUM"

    def test_hard(self, mapper):
        assert mapper.map("困难", "leetcode_cn") == "HARD"

    def test_unknown_text_defaults_to_medium(self, mapper):
        assert mapper.map("未知", "leetcode_cn") == "MEDIUM"


class TestCodeforces:
    """Codeforces rating 区间映射"""

    def test_easy_boundary(self, mapper):
        assert mapper.map(1200, "codeforces") == "EASY"

    def test_easy_low(self, mapper):
        assert mapper.map(800, "codeforces") == "EASY"

    def test_medium_lower_boundary(self, mapper):
        assert mapper.map(1201, "codeforces") == "MEDIUM"

    def test_medium_upper_boundary(self, mapper):
        assert mapper.map(1800, "codeforces") == "MEDIUM"

    def test_hard_boundary(self, mapper):
        assert mapper.map(1801, "codeforces") == "HARD"

    def test_hard_high(self, mapper):
        assert mapper.map(3000, "codeforces") == "HARD"

    def test_string_rating(self, mapper):
        """rating 作为字符串传入也能正常映射"""
        assert mapper.map("1500", "codeforces") == "MEDIUM"

    def test_empty_rating_defaults_to_medium(self, mapper):
        assert mapper.map("", "codeforces") == "MEDIUM"

    def test_invalid_rating_defaults_to_medium(self, mapper):
        assert mapper.map("abc", "codeforces") == "MEDIUM"

    def test_none_rating_defaults_to_medium(self, mapper):
        assert mapper.map(None, "codeforces") == "MEDIUM"

    def test_zero_rating_defaults_to_medium(self, mapper):
        """rating 为 0 时视为无效，默认 MEDIUM"""
        assert mapper.map(0, "codeforces") == "MEDIUM"


class TestUnknownPlatform:
    """未知平台默认处理"""

    def test_unknown_platform_defaults_to_medium(self, mapper):
        assert mapper.map("Hard", "unknown_platform") == "MEDIUM"

    def test_nowcoder_not_mapped_yet(self, mapper):
        assert mapper.map("简单", "nowcoder") == "MEDIUM"

    def test_atcoder_medium_rating(self, mapper):
        """AtCoder rating 1500 应映射为 MEDIUM（801-1600）"""
        assert mapper.map(1500, "atcoder") == "MEDIUM"
