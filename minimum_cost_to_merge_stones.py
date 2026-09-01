# 时间复杂度：O(M·N²)，M为行数，N为列数
# 空间复杂度：O(N)

from typing import List


class Solution:
    """删除列使之有序 III（LeetCode 960）

    找到最长的列子序列，使得对所有行该子序列是非递减的。
    答案 = 总列数 - 最长合法子序列长度。
    """

    def minDeletionSize(self, strs: List[str]) -> int:
        """计算最少删除的列数。

        Args:
            strs: 等长字符串数组

        Returns:
            最少需要删除的列数
        """
        if not strs:
            return 0

        m: int = len(strs)       # 行数
        n: int = len(strs[0])    # 列数

        # dp[i] 表示以第 i 列结尾的最长合法子序列长度
        dp: List[int] = [1] * n

        for j in range(1, n):
            for i in range(j):
                # 检查列 i 能否排在列 j 前面：所有行中 strs[row][i] <= strs[row][j]
                if all(strs[row][i] <= strs[row][j] for row in range(m)):
                    dp[j] = max(dp[j], dp[i] + 1)

        # 答案 = 总列数 - 最长合法子序列长度
        return n - max(dp)
