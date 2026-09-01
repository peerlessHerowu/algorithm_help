"""PlatformAdapter 抽象基类

定义所有平台适配器的统一接口。每个外部平台（LeetCode、Codeforces 等）
实现此基类，编排器通过统一接口调用采集逻辑。

非必须方法（fetch_solutions、fetch_editorial、fetch_comments）提供默认空实现，
子类可按平台能力选择性覆盖。
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

from ..models.enums import Platform, PlatformCapability


@dataclass
class FetchOptions:
    """采集参数

    Attributes:
        offset: 分页偏移量
        limit: 每次采集数量，默认 50
        last_fetch_time: 上次采集时间（UTC 毫秒），用于增量采集
    """

    offset: int = 0
    limit: int = 50
    last_fetch_time: Optional[int] = None


class PlatformAdapter(ABC):
    """平台适配器抽象基类，所有适配器必须继承此类。

    必须实现的方法：
        - get_platform: 返回平台标识
        - get_capabilities: 返回该平台支持的功能集合
        - fetch_problem_list: 采集题目列表
        - fetch_problem_detail: 采集单题详情

    可选覆盖的方法（默认空实现）：
        - fetch_solutions: 采集高赞题解
        - fetch_editorial: 采集官方 Editorial
        - fetch_comments: 采集优质评论
    """

    @abstractmethod
    def get_platform(self) -> Platform:
        """返回平台标识枚举"""
        ...

    @abstractmethod
    def get_capabilities(self) -> set[PlatformCapability]:
        """返回该平台支持的功能集合"""
        ...

    @abstractmethod
    async def fetch_problem_list(self, options: FetchOptions) -> list[dict]:
        """采集题目列表（支持分页和增量）

        Args:
            options: 采集参数，包含分页和增量时间戳

        Returns:
            题目原始数据列表，每条包含 platform_id、title 等字段
        """
        ...

    @abstractmethod
    async def fetch_problem_detail(self, platform_problem_id: str) -> dict:
        """采集单题详情

        Args:
            platform_problem_id: 平台侧题目 ID

        Returns:
            题目完整原始数据，包含 description_html、constraints、examples 等
        """
        ...

    async def fetch_solutions(
        self, platform_problem_id: str, top_n: int = 10
    ) -> list[dict]:
        """采集高赞题解（默认返回空列表，子类可覆盖）

        Args:
            platform_problem_id: 平台侧题目 ID
            top_n: 最多采集前 N 条高赞题解

        Returns:
            题解原始数据列表
        """
        return []

    async def fetch_editorial(
        self, platform_problem_id: str
    ) -> Optional[dict]:
        """采集官方 Editorial（默认返回 None，子类可覆盖）

        Args:
            platform_problem_id: 平台侧题目 ID

        Returns:
            Editorial 原始数据，无则返回 None
        """
        return None

    async def fetch_comments(
        self, solution_id: str, min_upvotes: int = 5
    ) -> list[dict]:
        """采集优质评论（默认返回空列表，子类可覆盖）

        Args:
            solution_id: 题解 ID
            min_upvotes: 最少点赞数过滤阈值

        Returns:
            评论原始数据列表
        """
        return []
