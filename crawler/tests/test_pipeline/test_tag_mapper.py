"""标签映射器单元测试"""

import pytest

from crawler_service.pipeline.tag_mapper import MappedTag, TagMapper


@pytest.fixture
def mapper() -> TagMapper:
    return TagMapper()


class TestTagMapperBasic:
    """基本映射功能"""

    def test_empty_tags_returns_empty(self, mapper: TagMapper):
        result = mapper.map([], "LEETCODE_GLOBAL")
        assert result == []

    def test_none_tags_returns_empty(self, mapper: TagMapper):
        result = mapper.map(None, "LEETCODE_GLOBAL")
        assert result == []

    def test_leetcode_global_known_tag(self, mapper: TagMapper):
        result = mapper.map(["Array"], "LEETCODE_GLOBAL")
        assert result == [{"name": "array", "confirmed": True}]

    def test_leetcode_cn_known_tag(self, mapper: TagMapper):
        result = mapper.map(["动态规划"], "LEETCODE_CN")
        assert result == [{"name": "dynamic-programming", "confirmed": True}]

    def test_codeforces_known_tag(self, mapper: TagMapper):
        result = mapper.map(["dp"], "CODEFORCES")
        assert result == [{"name": "dynamic-programming", "confirmed": True}]

    def test_atcoder_known_tag(self, mapper: TagMapper):
        result = mapper.map(["binary_search"], "ATCODER")
        assert result == [{"name": "binary-search", "confirmed": True}]

    def test_nowcoder_known_tag(self, mapper: TagMapper):
        result = mapper.map(["哈希"], "NOWCODER")
        assert result == [{"name": "hash-table", "confirmed": True}]


class TestTagMapperUnmapped:
    """无法映射的标签处理"""

    def test_unknown_tag_preserved_with_unconfirmed(self, mapper: TagMapper):
        """无法映射的标签保留原名，confirmed=False"""
        result = mapper.map(["SomeWeirdTag"], "LEETCODE_GLOBAL")
        assert result == [{"name": "SomeWeirdTag", "confirmed": False}]

    def test_unknown_platform_tags_unconfirmed(self, mapper: TagMapper):
        """未知平台的标签全部标记为待确认"""
        result = mapper.map(["Array", "Custom"], "UNKNOWN_PLATFORM")
        # "Array" 标准化后 "array" 属于 INTERNAL_TAGS，应该 confirmed=True
        assert result[0] == {"name": "array", "confirmed": True}
        assert result[1] == {"name": "Custom", "confirmed": False}

    def test_chinese_unknown_tag_on_global(self, mapper: TagMapper):
        """中文标签在国际站无法映射"""
        result = mapper.map(["动态规划"], "LEETCODE_GLOBAL")
        assert result == [{"name": "动态规划", "confirmed": False}]


class TestTagMapperNormalization:
    """标准化匹配回退"""

    def test_normalize_fallback_lowercase(self, mapper: TagMapper):
        """标准化后匹配内部集合（大小写不敏感）"""
        result = mapper.map(["GREEDY"], "UNKNOWN_PLATFORM")
        assert result == [{"name": "greedy", "confirmed": True}]

    def test_normalize_fallback_underscore(self, mapper: TagMapper):
        """标准化：下划线转短横线"""
        result = mapper.map(["binary_search"], "UNKNOWN_PLATFORM")
        assert result == [{"name": "binary-search", "confirmed": True}]

    def test_normalize_fallback_space(self, mapper: TagMapper):
        """标准化：空格转短横线"""
        result = mapper.map(["hash table"], "UNKNOWN_PLATFORM")
        assert result == [{"name": "hash-table", "confirmed": True}]


class TestTagMapperMultipleTags:
    """多标签场景"""

    def test_multiple_tags_mixed(self, mapper: TagMapper):
        """混合已知和未知标签"""
        result = mapper.map(["Array", "String", "CustomTag"], "LEETCODE_GLOBAL")
        assert len(result) == 3
        assert result[0] == {"name": "array", "confirmed": True}
        assert result[1] == {"name": "string", "confirmed": True}
        assert result[2] == {"name": "CustomTag", "confirmed": False}

    def test_dedup_same_internal_tag(self, mapper: TagMapper):
        """去重：多个原始标签映射到同一内部标签时只保留一次"""
        # Codeforces "implementation" 和 "constructive algorithms" 都映射到 "simulation"
        result = mapper.map(
            ["implementation", "constructive algorithms"], "CODEFORCES"
        )
        simulation_entries = [r for r in result if r["name"] == "simulation"]
        assert len(simulation_entries) == 1

    def test_all_platforms_coverage(self, mapper: TagMapper):
        """所有支持平台的映射表不为空"""
        for platform in ["LEETCODE_GLOBAL", "LEETCODE_CN", "CODEFORCES", "NOWCODER", "ATCODER"]:
            platform_map = mapper._PLATFORM_MAP.get(platform, {})
            assert len(platform_map) > 0, f"平台 {platform} 映射表为空"


class TestMappedTag:
    """MappedTag 数据类"""

    def test_confirmed_tag(self):
        tag = MappedTag(name="array", confirmed=True)
        assert tag.name == "array"
        assert tag.confirmed is True

    def test_unconfirmed_tag(self):
        tag = MappedTag(name="未知标签", confirmed=False)
        assert tag.name == "未知标签"
        assert tag.confirmed is False
