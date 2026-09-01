"""UARotator 单元测试"""

import pytest

from crawler_service.anticrawl.ua_rotator import UARotator


class TestUARotator:
    """UARotator 基本功能测试"""

    def test_init_with_valid_list(self):
        """正常初始化"""
        ua_list = ["UA1", "UA2", "UA3"]
        rotator = UARotator(ua_list)
        assert rotator.agents == ua_list

    def test_init_with_empty_list_raises(self):
        """空列表应抛出 ValueError"""
        with pytest.raises(ValueError, match="UA 列表不能为空"):
            UARotator([])

    def test_next_returns_from_list(self):
        """next() 返回值必须来自配置列表"""
        ua_list = ["Chrome/120", "Firefox/121", "Safari/17"]
        rotator = UARotator(ua_list)
        for _ in range(100):
            assert rotator.next() in ua_list

    def test_next_with_single_item(self):
        """单元素列表，next() 始终返回该元素"""
        rotator = UARotator(["OnlyUA"])
        for _ in range(50):
            assert rotator.next() == "OnlyUA"

    def test_agents_returns_copy(self):
        """agents 属性返回列表副本，修改不影响内部状态"""
        ua_list = ["UA1", "UA2"]
        rotator = UARotator(ua_list)
        agents_copy = rotator.agents
        agents_copy.append("UA3")
        assert len(rotator.agents) == 2

    def test_init_does_not_mutate_input(self):
        """初始化不修改传入的列表"""
        ua_list = ["UA1", "UA2"]
        original = list(ua_list)
        UARotator(ua_list)
        assert ua_list == original
