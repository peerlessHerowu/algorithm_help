import java.util.Arrays;

/**
 * LeetCode 960. Delete Columns to Make Sorted III
 *
 * <p>解法：最长递增子序列（LIS）变体 — 动态规划
 *
 * <p>思路：将问题转化为"保留最多的列，使得保留列构成的子序列在每一行都非递减"。
 * 这等价于在列维度上求满足多行约束的最长非递减子序列，答案 = 总列数 - 最长保留列数。
 *
 * <p>时间复杂度：O(m × n²)，其中 m 为行数，n 为列数
 * <p>空间复杂度：O(n)，dp 数组长度为列数
 */
class Solution {

    /**
     * 计算使所有行非递减所需删除的最少列数。
     *
     * @param strs 字符串数组，每个字符串长度相同
     * @return 最少需要删除的列数
     */
    public int minDeletionSize(String[] strs) {
        int m = strs.length;   // 行数
        int n = strs[0].length(); // 列数

        // dp[i] 表示以第 i 列结尾的最长可保留列子序列长度
        int[] dp = new int[n];
        Arrays.fill(dp, 1); // 每列自身至少构成长度为 1 的子序列

        int maxKeep = 1; // 记录全局最长保留列数

        for (int i = 1; i < n; i++) {
            for (int j = 0; j < i; j++) {
                // 检查第 j 列能否排在第 i 列前面（所有行都满足非递减）
                if (canExtend(strs, m, j, i)) {
                    dp[i] = Math.max(dp[i], dp[j] + 1);
                }
            }
            maxKeep = Math.max(maxKeep, dp[i]);
        }

        // 总列数减去最多可保留的列数 = 最少删除列数
        return n - maxKeep;
    }

    /**
     * 判断在保留的列子序列中，第 col2 列能否紧接在第 col1 列之后。
     * 条件：对于所有行 r，strs[r][col1] <= strs[r][col2]。
     *
     * @param strs 字符串数组
     * @param m    行数
     * @param col1 前一列下标
     * @param col2 后一列下标
     * @return 如果所有行都满足非递减约束则返回 true
     */
    private boolean canExtend(String[] strs, int m, int col1, int col2) {
        for (int r = 0; r < m; r++) {
            if (strs[r].charAt(col1) > strs[r].charAt(col2)) {
                return false; // 存在某行递减，不可衔接
            }
        }
        return true;
    }
}
