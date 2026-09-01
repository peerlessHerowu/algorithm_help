# 时间复杂度：O(n² × m)，n 为列数，m 为行数
# 空间复杂度：O(n)，dp 数组长度为列数
from typing import List


class Solution:
    """删除列使之有序 III（LeetCode 960）

    给定字符串数组 strs，删除最少的列，使得剩余列组成的每行字符串字典序非递减。
    本质是最长递增子序列（LIS）的变体：找最长的列子序列满足所有行非递减约束。
    """

    def minDeletionSize(self, strs: List[str]) -> int:
        """计算最少需要删除的列数。

        Args:
            strs: 等长字符串数组

        Returns:
            最少需要删除的列数
        """
        if not strs or not strs[0]:
            return 0

        num_rows: int = len(strs)  # 行数
        num_cols: int = len(strs[0])  # 列数

        # dp[i] 表示以第 i 列结尾的最长合法子序列长度
        dp: List[int] = [1] * num_cols

        for i in range(1, num_cols):
            for j in range(i):
                # 检查列 j 能否作为列 i 的前驱：
                # 所有行中第 j 列字符 <= 第 i 列字符
                if all(strs[r][j] <= strs[r][i] for r in range(num_rows)):
                    dp[i] = max(dp[i], dp[j] + 1)

        # 最长合法子序列长度
        max_kept: int = max(dp)

        # 答案 = 总列数 - 最长合法子序列长度
        return num_cols - max_kept
