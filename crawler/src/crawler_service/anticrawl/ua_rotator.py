"""User-Agent 轮转器

每次请求从配置的 UA 列表中随机选取一个 User-Agent，
避免使用固定 UA 被目标平台识别为爬虫。
"""

import random


class UARotator:
    """User-Agent 轮转器，每次请求随机选取一个 UA"""

    def __init__(self, user_agents: list[str]):
        """
        初始化 UA 轮转器。

        :param user_agents: UA 字符串列表，不能为空
        :raises ValueError: 当 UA 列表为空时抛出
        """
        if not user_agents:
            raise ValueError("UA 列表不能为空")
        self._user_agents = list(user_agents)

    def next(self) -> str:
        """从 UA 列表中随机选取一个 User-Agent"""
        return random.choice(self._user_agents)

    @property
    def agents(self) -> list[str]:
        """获取配置的 UA 列表（只读副本）"""
        return list(self._user_agents)
