"""
难度映射输出合法性 - Property Test

**Validates: Requirements 4.4**

使用 hypothesis 生成：
- 随机 platform 字符串（包括已知和未知平台）
- 随机 difficulty 值（字符串、整数、None、空字符串）

Property: DifficultyMapper().map(raw_difficulty, platform) 的返回值
必须是 {"EASY", "MEDIUM", "HARD"} 之一，对任意输入都不会崩溃或返回非法值。
"""

from hypothesis import given, settings
from hypothesis import strategies as st

from crawler_service.pipeline.difficulty_mapper import DifficultyMapper

# 合法输出集合
VALID_DIFFICULTIES = {"EASY", "MEDIUM", "HARD"}

# 已知平台标识
KNOWN_PLATFORMS = ["leetcode_global", "leetcode_cn", "codeforces"]

# 生成随机平台字符串：包含已知平台 + 随机文本
platform_strategy = st.one_of(
    st.sampled_from(KNOWN_PLATFORMS),
    st.text(min_size=0, max_size=50),
)

# 生成随机难度值：字符串、整数、None、空字符串
difficulty_strategy = st.one_of(
    st.text(min_size=0, max_size=100),
    st.integers(min_value=-10000, max_value=10000),
    st.none(),
)


class TestDifficultyMapperOutputValidity:
    """Property 8: 难度映射输出合法性"""

    @given(raw_difficulty=difficulty_strategy, platform=platform_strategy)
    @settings(max_examples=200)
    def test_output_always_in_valid_set(self, raw_difficulty, platform):
        """
        **Validates: Requirements 4.4**

        Property: 对任意 raw_difficulty（字符串、整数、None）和任意 platform 字符串，
        DifficultyMapper().map() 返回值必须是 EASY/MEDIUM/HARD 之一。
        """
        mapper = DifficultyMapper()
        result = mapper.map(raw_difficulty, platform)

        assert result in VALID_DIFFICULTIES, (
            f"非法输出 '{result}' (input: raw_difficulty={raw_difficulty!r}, "
            f"platform={platform!r})，期望值为 {VALID_DIFFICULTIES}"
        )
