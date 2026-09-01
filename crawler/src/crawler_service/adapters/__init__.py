"""平台适配器插件目录：自动发现与注册

基于 pkgutil.iter_modules 扫描 adapters/ 目录下的所有模块，
自动发现并注册 PlatformAdapter 子类。仅注册配置中 enabled=true 的平台。

使用方式：
    from crawler_service.adapters import discover_adapters, get_adapter
    discover_adapters()
    adapter = get_adapter(Platform.LEETCODE_GLOBAL)
"""

import importlib
import pkgutil
from pathlib import Path

import structlog

from .base import PlatformAdapter
from ..models.enums import Platform

logger = structlog.get_logger()

# 适配器注册表：Platform → PlatformAdapter 子类
_registry: dict[Platform, type[PlatformAdapter]] = {}


def _get_settings():
    """延迟导入 get_settings，避免循环依赖"""
    from ..config import get_settings
    return get_settings()


def discover_adapters() -> dict[Platform, type[PlatformAdapter]]:
    """扫描 adapters/ 目录，自动注册 enabled=true 的 PlatformAdapter 子类。

    遍历当前包目录下所有 .py 模块（排除 __init__ 和 base），
    找到 PlatformAdapter 的具体子类后，根据配置中的 enabled 字段决定是否注册。

    Returns:
        已注册的适配器映射表（Platform → adapter class）
    """
    global _registry
    _registry.clear()

    settings = _get_settings()
    package_dir = Path(__file__).parent

    for _, module_name, is_pkg in pkgutil.iter_modules([str(package_dir)]):
        if is_pkg or module_name in ("__init__", "base"):
            continue
        _try_register_module(module_name, settings)

    logger.info(
        "适配器发现完成",
        registered=[p.value for p in _registry],
        total=len(_registry),
    )
    return _registry


def _try_register_module(module_name: str, settings) -> None:
    """尝试导入模块并注册其中的适配器子类"""
    try:
        module = importlib.import_module(f".{module_name}", package=__package__)
    except Exception as e:
        logger.warning("适配器模块导入失败", module=module_name, error=str(e))
        return

    for attr_name in dir(module):
        attr = getattr(module, attr_name)
        if not _is_adapter_class(attr):
            continue
        _register_if_enabled(attr, settings)


def _is_adapter_class(attr) -> bool:
    """判断是否为 PlatformAdapter 的具体子类"""
    return (
        isinstance(attr, type)
        and issubclass(attr, PlatformAdapter)
        and attr is not PlatformAdapter
    )


def _register_if_enabled(adapter_cls: type[PlatformAdapter], settings) -> None:
    """根据配置判断是否注册该适配器"""
    try:
        instance = adapter_cls()
        platform = instance.get_platform()
    except Exception as e:
        logger.warning("适配器实例化失败", cls=adapter_cls.__name__, error=str(e))
        return

    # 配置 key 为小写，如 "leetcode_global"
    config_key = platform.value.lower()
    platform_cfg = settings.platforms.get(config_key)

    if platform_cfg is None:
        logger.debug("未找到平台配置，跳过注册", platform=platform.value)
        return

    if not platform_cfg.enabled:
        logger.debug("平台已禁用，跳过注册", platform=platform.value)
        return

    _registry[platform] = adapter_cls
    logger.debug("适配器已注册", platform=platform.value, cls=adapter_cls.__name__)


def get_adapter(platform: Platform) -> PlatformAdapter:
    """获取指定平台的适配器实例。

    Args:
        platform: 平台枚举标识

    Returns:
        对应平台的适配器实例

    Raises:
        ValueError: 平台未注册（未启用或不存在）
    """
    if platform not in _registry:
        raise ValueError(f"未注册的平台适配器: {platform.value}")
    return _registry[platform]()


def get_registered_platforms() -> list[Platform]:
    """获取所有已注册的平台列表"""
    return list(_registry.keys())


def is_registered(platform: Platform) -> bool:
    """检查指定平台是否已注册"""
    return platform in _registry


def reset_registry() -> None:
    """重置注册表（测试用）"""
    global _registry
    _registry.clear()
