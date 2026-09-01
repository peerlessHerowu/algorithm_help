"""洛谷适配器（骨架预留，默认 enabled=false）

洛谷（luogu.com.cn）是国内知名的算法竞赛在线评测平台。
当前为骨架实现，所有采集方法返回空结果。
待后续需要时可完善具体采集逻辑（HTML 解析或 API 调用）。

配置中 enabled=false，不会被插件发现机制注册。
"""

from typing import Optional

from .base import FetchOptions, PlatformAdapter
from ..models.enums import Platform, PlatformCapability


class LuoguAdapter(PlatformAdapter):
    """洛谷平台适配器骨架

    当前仅声明 PROBLEM_FETCH 能力，所有方法返回空结果。
    配置中默认 enabled=false，需手动开启后才会被注册使用。
    """

    def get_platform(self) -> Platform:
        """返回平台标识"""
        return Platform.LUOGU

    def get_capabilities(self) -> set[PlatformCapability]:
        """返回该平台支持的功能集合（仅题目采集）"""
        return {PlatformCapability.PROBLEM_FETCH}

    async def fetch_problem_list(self, options: FetchOptions) -> list[dict]:
        """采集题目列表（骨架，返回空列表）

        TODO: 后续实现洛谷题目列表采集逻辑
        可能方案：解析 https://www.luogu.com.cn/problem/list 页面
        或调用洛谷 API（如存在公开接口）

        Args:
            options: 采集参数，包含分页和增量时间戳

        Returns:
            空列表（骨架实现）
        """
        return []

    async def fetch_problem_detail(self, platform_problem_id: str) -> dict:
        """采集单题详情（骨架，返回空字典）

        TODO: 后续实现洛谷单题详情采集
        目标页面：https://www.luogu.com.cn/problem/{platform_problem_id}

        Args:
            platform_problem_id: 洛谷题目 ID（如 P1001）

        Returns:
            空字典（骨架实现）
        """
        return {}
