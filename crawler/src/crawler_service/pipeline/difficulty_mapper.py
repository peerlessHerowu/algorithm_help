"""难度映射器 —— 各平台难度标记到统一三级难度（EASY/MEDIUM/HARD）的映射"""

from typing import Callable

from ..models.enums import Difficulty


class DifficultyMapper:
    """
    难度映射器

    将各平台的原始难度标记映射为统一的三级难度枚举。
    - LeetCode 国际站：文本映射（Easy/Medium/Hard）
    - 力扣中文站：文本映射（简单/中等/困难）
    - Codeforces：rating 区间映射（<=1200 EASY, 1201-1800 MEDIUM, >1800 HARD）
    - 其他平台或无法识别的值：默认 MEDIUM

    Validates: Requirements 4.4
    """

    _PLATFORM_MAPPING: dict[str, dict[str, str] | Callable[[int], str]] = {
        "leetcode_global": {"Easy": "EASY", "Medium": "MEDIUM", "Hard": "HARD"},
        "leetcode_cn": {"简单": "EASY", "中等": "MEDIUM", "困难": "HARD"},
        "codeforces": lambda rating: (
            "EASY" if rating <= 1200
            else "MEDIUM" if rating <= 1800
            else "HARD"
        ),
        "atcoder": lambda rating: (
            "EASY" if rating <= 800
            else "MEDIUM" if rating <= 1600
            else "HARD"
        ),
    }

    def map(self, raw_difficulty: str | int, platform: str) -> str:
        """
        将平台原始难度映射为统一的 EASY/MEDIUM/HARD。

        :param raw_difficulty: 原始难度值（LeetCode 为文本，Codeforces 为 rating 整数）
        :param platform: 平台标识（如 leetcode_global、leetcode_cn、codeforces）
        :return: 统一难度字符串，必定为 EASY/MEDIUM/HARD 之一
        """
        mapping = self._PLATFORM_MAPPING.get(platform)

        # Codeforces 等使用 lambda 函数映射
        if callable(mapping):
            try:
                rating = int(raw_difficulty) if raw_difficulty else 0
                return mapping(rating) if rating > 0 else Difficulty.MEDIUM.value
            except (ValueError, TypeError):
                return Difficulty.MEDIUM.value

        # LeetCode 等使用字典文本映射
        if isinstance(mapping, dict):
            result = mapping.get(str(raw_difficulty), None)
            if result is not None:
                return result
            return Difficulty.MEDIUM.value

        # 未知平台，返回默认值
        return Difficulty.MEDIUM.value
