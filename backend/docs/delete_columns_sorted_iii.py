# 时间复杂度：O(m × n²)，其中 m 为字符串数量，n 为字符串长度
# 空间复杂度：O(n)，dp 数组长度为 n

from typing import List


class Solution:
    """删除列使之有序 III（LeetCode 960）

    给定字符串数组 strs，每个字符串长度相同。
    删除最少的列，使得剩余每一行字符串都是非递减（字典序）的。

    核心思路：
    - 问题转化为：保留最多的列，使保留列构成的子序列满足每行非递减。
    - 这本质上是「最长递增子序列（LIS）」的多维扩展。
    - dp[j] 表示以第 j 列结尾、能保留的最大列数。
    - 对于列 i < j，如果所有行都满足 strs[r][i] <= strs[r][j]，
      则可以将第 j 列接在第 i 列后面，即 dp[j] = max(dp[j], dp[i] + 1)。
    - 最终答案 = 总列数 - max(dp)。
    """

    def minDeletionSize(self, strs: List[str]) -> int:
        """计算使每行非递减所需删除的最少列数。

        Args:
            strs: 等长字符串数组

        Returns:
            最少需要删除的列数
        """
        if not strs or not strs[0]:
            return 0

        m: int = len(strs)       # 行数（字符串数量）
        n: int = len(strs[0])    # 列数（字符串长度）

        # dp[j] 表示以第 j 列结尾时，能保留的最大列数
        dp: List[int] = [1] * n

        for j in range(1, n):
            for i in range(j):
                # 检查是否所有行都满足第 i 列 <= 第 j 列
                # 即：将第 j 列接在第 i 列后面是否合法
                if self._is_compatible(strs, m, i, j):
                    dp[j] = max(dp[j], dp[i] + 1)

        # 保留最多的列数 = max(dp)，删除列数 = 总列数 - 保留列数
        max_keep: int = max(dp)
        return n - max_keep

    def _is_compatible(self, strs: List[str], m: int, col_i: int, col_j: int) -> bool:
        """判断列 col_i 和列 col_j 是否兼容（所有行都满足非递减）。

        Args:
            strs: 字符串数组
            m: 行数
            col_i: 前一列下标
            col_j: 后一列下标

        Returns:
            如果所有行都满足 strs[r][col_i] <= strs[r][col_j] 则返回 True
        """
        for r in range(m):
            if strs[r][col_i] > strs[r][col_j]:
                return False
        return True


# ==================== 测试代码 ====================
if __name__ == "__main__":
    sol = Solution()

    # 测试用例 1
    # 保留第 0、2 列 -> ["ac", "bc", "cd"]，每行非递减
    # 删除 1 列
    test1: List[str] = ["babca", "bbazb"]
    print(f"测试1: {sol.minDeletionSize(test1)}")  # 预期: 3

    # 测试用例 2
    # 所有列本身就满足非递减，无需删除
    test2: List[str] = ["abcdef"]
    print(f"测试2: {sol.minDeletionSize(test2)}")  # 预期: 0

    # 测试用例 3
    test3: List[str] = ["baabab"]
    print(f"测试3: {sol.minDeletionSize(test3)}")  # 预期: 2
