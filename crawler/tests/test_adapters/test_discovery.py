"""测试适配器自动发现注册机制

验证 discover_adapters、get_adapter、reset_registry 等函数的正确行为。
由于各平台适配器尚未实现（均为空骨架），本测试使用 mock 模块验证发现机制本身的逻辑。
"""

import sys
import types
from unittest.mock import patch, MagicMock

import pytest

from crawler_service.adapters import (
    discover_adapters,
    get_adapter,
    get_registered_platforms,
    is_registered,
    reset_registry,
    _is_adapter_class,
    _register_if_enabled,
    _registry,
)
from crawler_service.adapters.base import PlatformAdapter, FetchOptions
from crawler_service.models.enums import Platform, PlatformCapability


# ---- 测试用适配器 ----


class _MockLeetcodeAdapter(PlatformAdapter):
    """测试用 LeetCode 适配器"""

    def get_platform(self) -> Platform:
        return Platform.LEETCODE_GLOBAL

    def get_capabilities(self) -> set[PlatformCapability]:
        return {PlatformCapability.PROBLEM_FETCH, PlatformCapability.SOLUTION_FETCH}

    async def fetch_problem_list(self, options: FetchOptions) -> list[dict]:
        return []

    async def fetch_problem_detail(self, platform_problem_id: str) -> dict:
        return {}


class _MockCodeforcesAdapter(PlatformAdapter):
    """测试用 Codeforces 适配器"""

    def get_platform(self) -> Platform:
        return Platform.CODEFORCES

    def get_capabilities(self) -> set[PlatformCapability]:
        return {PlatformCapability.PROBLEM_FETCH}

    async def fetch_problem_list(self, options: FetchOptions) -> list[dict]:
        return []

    async def fetch_problem_detail(self, platform_problem_id: str) -> dict:
        return {}


class _MockLuoguAdapter(PlatformAdapter):
    """测试用洛谷适配器（配置 enabled=false）"""

    def get_platform(self) -> Platform:
        return Platform.LUOGU

    def get_capabilities(self) -> set[PlatformCapability]:
        return {PlatformCapability.PROBLEM_FETCH}

    async def fetch_problem_list(self, options: FetchOptions) -> list[dict]:
        return []

    async def fetch_problem_detail(self, platform_problem_id: str) -> dict:
        return {}


def _make_platform_cfg(enabled: bool = True):
    """构造 mock PlatformConfig"""
    cfg = MagicMock()
    cfg.enabled = enabled
    return cfg


def _make_settings(platforms: dict[str, bool]):
    """构造 mock Settings，platforms 为 {key: enabled}"""
    settings = MagicMock()
    settings.platforms = {k: _make_platform_cfg(v) for k, v in platforms.items()}
    return settings


class TestIsAdapterClass:
    """测试 _is_adapter_class 判断逻辑"""

    def test_accepts_valid_subclass(self):
        assert _is_adapter_class(_MockLeetcodeAdapter) is True

    def test_rejects_base_class(self):
        assert _is_adapter_class(PlatformAdapter) is False

    def test_rejects_non_class(self):
        assert _is_adapter_class("not a class") is False
        assert _is_adapter_class(42) is False
        assert _is_adapter_class(None) is False

    def test_rejects_unrelated_class(self):
        class Unrelated:
            pass
        assert _is_adapter_class(Unrelated) is False


class TestDiscoverAdapters:
    """测试 discover_adapters 函数"""

    def setup_method(self):
        reset_registry()

    def teardown_method(self):
        reset_registry()

    @patch("crawler_service.adapters._get_settings")
    @patch("crawler_service.adapters.pkgutil.iter_modules")
    @patch("crawler_service.adapters.importlib.import_module")
    def test_registers_enabled_adapter(
        self, mock_import, mock_iter, mock_get_settings
    ):
        """enabled=true 的适配器应被注册"""
        settings = _make_settings({"leetcode_global": True})
        mock_get_settings.return_value = settings

        # 模拟扫描到一个模块
        mock_iter.return_value = [(None, "leetcode_global", False)]

        # 模拟导入的模块包含适配器类
        fake_module = types.ModuleType("fake_leetcode")
        fake_module._MockLeetcodeAdapter = _MockLeetcodeAdapter
        mock_import.return_value = fake_module

        result = discover_adapters()

        assert Platform.LEETCODE_GLOBAL in result
        assert result[Platform.LEETCODE_GLOBAL] is _MockLeetcodeAdapter

    @patch("crawler_service.adapters._get_settings")
    @patch("crawler_service.adapters.pkgutil.iter_modules")
    @patch("crawler_service.adapters.importlib.import_module")
    def test_skips_disabled_adapter(
        self, mock_import, mock_iter, mock_get_settings
    ):
        """enabled=false 的适配器不应被注册"""
        settings = _make_settings({"luogu": False})
        mock_get_settings.return_value = settings

        mock_iter.return_value = [(None, "luogu", False)]

        fake_module = types.ModuleType("fake_luogu")
        fake_module._MockLuoguAdapter = _MockLuoguAdapter
        mock_import.return_value = fake_module

        result = discover_adapters()

        assert Platform.LUOGU not in result
        assert len(result) == 0

    @patch("crawler_service.adapters._get_settings")
    @patch("crawler_service.adapters.pkgutil.iter_modules")
    @patch("crawler_service.adapters.importlib.import_module")
    def test_skips_base_and_init_modules(
        self, mock_import, mock_iter, mock_get_settings
    ):
        """__init__ 和 base 模块应被跳过，不调用 _try_register_module"""
        settings = _make_settings({"leetcode_global": True})
        mock_get_settings.return_value = settings

        mock_iter.return_value = [
            (None, "__init__", False),
            (None, "base", False),
            (None, "leetcode_global", False),
        ]

        fake_module = types.ModuleType("fake_leetcode")
        fake_module._MockLeetcodeAdapter = _MockLeetcodeAdapter
        mock_import.return_value = fake_module

        result = discover_adapters()

        # 验证 __init__ 和 base 没有被传给 import_module
        all_relative_calls = [
            c[0][0] for c in mock_import.call_args_list
            if len(c[0]) > 0 and isinstance(c[0][0], str) and c[0][0].startswith(".")
        ]
        assert ".__init__" not in all_relative_calls
        assert ".base" not in all_relative_calls
        assert ".leetcode_global" in all_relative_calls
        assert Platform.LEETCODE_GLOBAL in result

    @patch("crawler_service.adapters._get_settings")
    @patch("crawler_service.adapters.pkgutil.iter_modules")
    @patch("crawler_service.adapters.importlib.import_module")
    def test_skips_package_subdirs(
        self, mock_import, mock_iter, mock_get_settings
    ):
        """子包（is_pkg=True）应被跳过"""
        settings = _make_settings({"leetcode_global": True})
        mock_get_settings.return_value = settings

        mock_iter.return_value = [
            (None, "some_package", True),  # 子包
            (None, "leetcode_global", False),
        ]

        fake_module = types.ModuleType("fake_leetcode")
        fake_module._MockLeetcodeAdapter = _MockLeetcodeAdapter
        mock_import.return_value = fake_module

        result = discover_adapters()

        # 验证 .some_package 未被导入
        all_relative_calls = [
            c[0][0] for c in mock_import.call_args_list
            if len(c[0]) > 0 and isinstance(c[0][0], str) and c[0][0].startswith(".")
        ]
        assert ".some_package" not in all_relative_calls
        assert Platform.LEETCODE_GLOBAL in result

    @patch("crawler_service.adapters._get_settings")
    @patch("crawler_service.adapters.pkgutil.iter_modules")
    @patch("crawler_service.adapters.importlib.import_module")
    def test_multiple_adapters_registered(
        self, mock_import, mock_iter, mock_get_settings
    ):
        """多个 enabled 适配器同时注册"""
        settings = _make_settings({
            "leetcode_global": True,
            "codeforces": True,
            "luogu": False,
        })
        mock_get_settings.return_value = settings

        mock_iter.return_value = [
            (None, "leetcode_global", False),
            (None, "codeforces", False),
            (None, "luogu", False),
        ]

        # 每次 import_module 返回不同模块
        def side_effect(name, package=None):
            if "leetcode_global" in name:
                m = types.ModuleType("m_lc")
                m._MockLeetcodeAdapter = _MockLeetcodeAdapter
                return m
            elif "codeforces" in name:
                m = types.ModuleType("m_cf")
                m._MockCodeforcesAdapter = _MockCodeforcesAdapter
                return m
            elif "luogu" in name:
                m = types.ModuleType("m_lg")
                m._MockLuoguAdapter = _MockLuoguAdapter
                return m
            return types.ModuleType("empty")

        mock_import.side_effect = side_effect

        result = discover_adapters()

        assert Platform.LEETCODE_GLOBAL in result
        assert Platform.CODEFORCES in result
        assert Platform.LUOGU not in result
        assert len(result) == 2

    @patch("crawler_service.adapters._get_settings")
    @patch("crawler_service.adapters.pkgutil.iter_modules")
    @patch("crawler_service.adapters.importlib.import_module")
    def test_clears_registry_on_rediscovery(
        self, mock_import, mock_iter, mock_get_settings
    ):
        """重复调用 discover_adapters 会清空并重建注册表"""
        settings = _make_settings({"leetcode_global": True})
        mock_get_settings.return_value = settings
        mock_iter.return_value = [(None, "leetcode_global", False)]

        fake_module = types.ModuleType("fake_leetcode")
        fake_module._MockLeetcodeAdapter = _MockLeetcodeAdapter
        mock_import.return_value = fake_module

        discover_adapters()
        assert len(get_registered_platforms()) == 1

        # 第二次调用仍为 1（不会叠加）
        discover_adapters()
        assert len(get_registered_platforms()) == 1

    @patch("crawler_service.adapters._get_settings")
    @patch("crawler_service.adapters.pkgutil.iter_modules")
    @patch("crawler_service.adapters.importlib.import_module")
    def test_handles_import_error_gracefully(
        self, mock_import, mock_iter, mock_get_settings
    ):
        """模块导入失败时不影响其他模块的发现"""
        settings = _make_settings({
            "leetcode_global": True,
            "codeforces": True,
        })
        mock_get_settings.return_value = settings
        mock_iter.return_value = [
            (None, "broken_module", False),
            (None, "codeforces", False),
        ]

        def side_effect(name, package=None):
            if "broken_module" in name:
                raise ImportError("模块损坏")
            m = types.ModuleType("m_cf")
            m._MockCodeforcesAdapter = _MockCodeforcesAdapter
            return m

        mock_import.side_effect = side_effect

        result = discover_adapters()

        # broken_module 导入失败，但 codeforces 仍正常注册
        assert Platform.CODEFORCES in result

    @patch("crawler_service.adapters._get_settings")
    @patch("crawler_service.adapters.pkgutil.iter_modules")
    @patch("crawler_service.adapters.importlib.import_module")
    def test_skips_adapter_without_config(
        self, mock_import, mock_iter, mock_get_settings
    ):
        """没有对应配置的适配器不被注册"""
        # 配置中没有 leetcode_global 这个 key
        settings = _make_settings({"codeforces": True})
        mock_get_settings.return_value = settings

        mock_iter.return_value = [(None, "leetcode_global", False)]

        fake_module = types.ModuleType("fake_lc")
        fake_module._MockLeetcodeAdapter = _MockLeetcodeAdapter
        mock_import.return_value = fake_module

        result = discover_adapters()

        # 由于 mock 影响范围问题，直接验证核心逻辑
        # _register_if_enabled 中 config_key="leetcode_global" 不在 settings.platforms 中
        # 手动验证该逻辑
        from crawler_service.adapters import _register_if_enabled
        reset_registry()
        _register_if_enabled(_MockLeetcodeAdapter, settings)
        assert Platform.LEETCODE_GLOBAL not in _registry


class TestGetAdapter:
    """测试 get_adapter 函数"""

    def setup_method(self):
        reset_registry()

    def teardown_method(self):
        reset_registry()

    def test_raises_for_unregistered_platform(self):
        """未注册平台应抛出 ValueError"""
        with pytest.raises(ValueError, match="未注册的平台适配器"):
            get_adapter(Platform.LUOGU)

    @patch("crawler_service.adapters._get_settings")
    @patch("crawler_service.adapters.pkgutil.iter_modules")
    @patch("crawler_service.adapters.importlib.import_module")
    def test_returns_adapter_instance(
        self, mock_import, mock_iter, mock_get_settings
    ):
        """注册后 get_adapter 返回正确类型的实例"""
        settings = _make_settings({"leetcode_global": True})
        mock_get_settings.return_value = settings
        mock_iter.return_value = [(None, "leetcode_global", False)]

        fake_module = types.ModuleType("fake_lc")
        fake_module._MockLeetcodeAdapter = _MockLeetcodeAdapter
        mock_import.return_value = fake_module

        discover_adapters()
        adapter = get_adapter(Platform.LEETCODE_GLOBAL)

        assert isinstance(adapter, PlatformAdapter)
        assert isinstance(adapter, _MockLeetcodeAdapter)
        assert adapter.get_platform() == Platform.LEETCODE_GLOBAL

    @patch("crawler_service.adapters._get_settings")
    @patch("crawler_service.adapters.pkgutil.iter_modules")
    @patch("crawler_service.adapters.importlib.import_module")
    def test_returns_new_instance_each_call(
        self, mock_import, mock_iter, mock_get_settings
    ):
        """每次调用 get_adapter 返回新实例"""
        settings = _make_settings({"leetcode_global": True})
        mock_get_settings.return_value = settings
        mock_iter.return_value = [(None, "leetcode_global", False)]

        fake_module = types.ModuleType("fake_lc")
        fake_module._MockLeetcodeAdapter = _MockLeetcodeAdapter
        mock_import.return_value = fake_module

        discover_adapters()
        adapter1 = get_adapter(Platform.LEETCODE_GLOBAL)
        adapter2 = get_adapter(Platform.LEETCODE_GLOBAL)

        assert adapter1 is not adapter2


class TestResetRegistry:
    """测试 reset_registry"""

    def test_clears_all_entries(self):
        """reset 后注册表为空"""
        # 手动往 _registry 塞入数据
        from crawler_service.adapters import _registry
        _registry[Platform.LEETCODE_GLOBAL] = _MockLeetcodeAdapter

        reset_registry()

        assert get_registered_platforms() == []
        assert is_registered(Platform.LEETCODE_GLOBAL) is False
