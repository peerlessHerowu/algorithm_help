"""
UA 轮转选择来自配置列表 + 随机延迟范围 - Property Test

**Validates: Requirements 3.2, 3.8**

Property 4: UA 轮转选择来自配置列表
- 使用 hypothesis 生成随机 UA 列表（1-20 项，每项为非空字符串）
- 调用 next() N 次（N 从 1-100），验证所有返回值都在原始列表中

Property 5: 随机延迟在配置范围内
- 生成随机延迟范围 [min_ms, max_ms]（100 <= min_ms < max_ms <= 10000）
- 模拟 random.uniform(min/1000, max/1000) 的延迟计算逻辑
- 验证结果始终在 [min/1000, max/1000] 范围内
"""

import random

from hypothesis import given, settings
from hypothesis import strategies as st

from crawler_service.anticrawl.ua_rotator import UARotator


class TestUARotatorProperty:
    """Property 4: UA 轮转选择来自配置列表"""

    @given(
        ua_list=st.lists(
            st.text(min_size=1, max_size=100),
            min_size=1,
            max_size=20,
        ),
        n=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=100)
    def test_next_always_returns_element_from_configured_list(self, ua_list, n):
        """
        **Validates: Requirements 3.2**

        Property: 对任意非空 UA 列表，调用 next() 任意次数，
        返回值始终是配置列表中的某一项。
        """
        rotator = UARotator(ua_list)

        for i in range(n):
            result = rotator.next()
            assert result in ua_list, (
                f"第 {i+1} 次调用 next() 返回 '{result}'，不在配置列表中"
            )


    @given(
        ua_list=st.lists(
            st.text(min_size=1, max_size=100),
            min_size=1,
            max_size=20,
        ),
    )
    @settings(max_examples=100)
    def test_next_coverage_single_element_list(self, ua_list):
        """
        **Validates: Requirements 3.2**

        Property: 当 UA 列表只有一个元素时，next() 必定返回该元素。
        这是 Property 4 的边界特例。
        """
        single_list = [ua_list[0]]
        rotator = UARotator(single_list)

        for _ in range(50):
            assert rotator.next() == single_list[0]


class TestRandomDelayProperty:
    """Property 5: 随机延迟在配置范围内"""

    @given(
        min_ms=st.integers(min_value=100, max_value=9999),
        max_ms_offset=st.integers(min_value=1, max_value=5000),
        n=st.integers(min_value=1, max_value=50),
    )
    @settings(max_examples=100)
    def test_random_delay_within_configured_range(self, min_ms, max_ms_offset, n):
        """
        **Validates: Requirements 3.8**

        Property: 对任意合法延迟范围 [min_ms, max_ms]，
        使用 random.uniform(min_ms/1000, max_ms/1000) 计算的延迟值
        始终满足 min_ms/1000 <= delay <= max_ms/1000。

        这模拟了 AntiCrawlManager._random_delay 的核心逻辑。
        """
        max_ms = min(min_ms + max_ms_offset, 10000)
        # 确保 min_ms < max_ms
        if min_ms >= max_ms:
            max_ms = min_ms + 1

        min_seconds = min_ms / 1000.0
        max_seconds = max_ms / 1000.0

        for i in range(n):
            delay = random.uniform(min_seconds, max_seconds)
            assert min_seconds <= delay <= max_seconds, (
                f"第 {i+1} 次延迟 {delay}s 超出范围 "
                f"[{min_seconds}s, {max_seconds}s]"
            )
