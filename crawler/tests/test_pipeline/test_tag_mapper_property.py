"""
标签映射闭合性 - Property Test

**Validates: Requirements 4.5, 4.7**

使用 hypothesis 生成随机标签列表和平台标识，验证：
对 TagMapper().map(raw_tags, platform) 的每个输出项，满足以下闭合性：
- confirmed == True 时，name 必须属于 TagMapper.INTERNAL_TAGS
- confirmed == False 时，name 可以是任意值（待人工确认）
"""

from hypothesis import given, settings
from hypothesis import strategies as st

from crawler_service.pipeline.tag_mapper import TagMapper


# 已知平台列表
KNOWN_PLATFORMS = ["LEETCODE_GLOBAL", "LEETCODE_CN", "CODEFORCES", "NOWCODER", "ATCODER"]

# 随机标签策略：混合可能映射和不可映射的标签
random_tag = st.text(min_size=1, max_size=50, alphabet=st.characters(
    whitelist_categories=("L", "N", "P", "Z"),
    blacklist_characters="\x00",
))

# 平台策略：已知平台 + 随机未知平台
platform_strategy = st.one_of(
    st.sampled_from(KNOWN_PLATFORMS),
    st.text(min_size=1, max_size=20, alphabet=st.characters(
        whitelist_categories=("L", "N"),
    )),
)


class TestTagMapperClosureProperty:
    """Property 9: 标签映射闭合性"""

    @given(
        raw_tags=st.lists(random_tag, min_size=1, max_size=20),
        platform=platform_strategy,
    )
    @settings(max_examples=200)
    def test_closure_confirmed_implies_internal_tag(self, raw_tags, platform):
        """
        **Validates: Requirements 4.5, 4.7**

        Property: 对于 TagMapper().map(raw_tags, platform) 的每个输出项：
        - 若 item["confirmed"] == True，则 item["name"] 必须属于 INTERNAL_TAGS
        - 若 item["confirmed"] == False，则 name 可以是任意值（待人工确认）
        """
        mapper = TagMapper()
        results = mapper.map(raw_tags, platform)

        for item in results:
            assert "name" in item, f"输出项缺少 name 字段: {item}"
            assert "confirmed" in item, f"输出项缺少 confirmed 字段: {item}"
            assert isinstance(item["confirmed"], bool), (
                f"confirmed 不是布尔值: {item['confirmed']}"
            )

            if item["confirmed"] is True:
                assert item["name"] in TagMapper.INTERNAL_TAGS, (
                    f"confirmed=True 但 name='{item['name']}' "
                    f"不属于 INTERNAL_TAGS 集合"
                )

    @given(
        raw_tags=st.lists(
            st.sampled_from(list(TagMapper._PLATFORM_MAP.get("LEETCODE_GLOBAL", {}).keys())),
            min_size=1,
            max_size=10,
        ),
    )
    @settings(max_examples=100)
    def test_known_platform_tags_always_confirmed(self, raw_tags):
        """
        **Validates: Requirements 4.5**

        Property: 已知平台映射表中的标签映射后一定 confirmed=True，
        且 name 属于 INTERNAL_TAGS。
        """
        mapper = TagMapper()
        results = mapper.map(raw_tags, "LEETCODE_GLOBAL")

        for item in results:
            assert item["confirmed"] is True, (
                f"已知标签映射后未 confirmed: {item}"
            )
            assert item["name"] in TagMapper.INTERNAL_TAGS, (
                f"已知标签映射结果不在 INTERNAL_TAGS: {item['name']}"
            )

    @given(
        raw_tags=st.lists(random_tag, min_size=0, max_size=20),
        platform=platform_strategy,
    )
    @settings(max_examples=100)
    def test_output_is_list_of_dicts_with_required_fields(self, raw_tags, platform):
        """
        **Validates: Requirements 4.5, 4.7**

        Property: 输出始终是 list[dict]，每项包含 name(str) 和 confirmed(bool)。
        """
        mapper = TagMapper()
        results = mapper.map(raw_tags, platform)

        assert isinstance(results, list)
        for item in results:
            assert isinstance(item, dict)
            assert isinstance(item.get("name"), str)
            assert isinstance(item.get("confirmed"), bool)
