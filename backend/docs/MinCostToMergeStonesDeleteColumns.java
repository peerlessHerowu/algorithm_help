import java.util.Arrays;

/**
 * LeetCode 960 - Delete Columns to Make Sorted III
 *
 * <p>解法名称：合并石头的最低成本（实际对应删除列使之有序 III）
 *
 * <p>核心思路：将问题转化为最长合法子序列问题。
 * 在所有列中找到最长的子序列，使得子序列中任意相邻列满足"每一行对应字符非递减"的约束。
 * 答案 = 总列数 - 最长合法子序列长度。
 *
 * <p>时间复杂度：O(n² × m)，其中 n 为列数，m 为行数
 * <p>空间复杂度：O(n)
 */
class Solution {

    /**
     * 计算最少需要删除的列数，使剩余列组成的每行字符串字典序非递减。
     *
     * @param strs 字符串数组，每个字符串长度相同
     * @return 最少删除的列数
     */
    public int minDeletionSize(String[] strs) {
        int m = strs.length;    // 行数
        int n = strs[0].length(); // 列数

        // dp[i] 表示以第 i 列结尾的最长合法子序列长度
        int[] dp = new int[n];
        Arrays.fill(dp, 1);

        // 枚举每一列作为子序列的结尾
        for (int j = 1; j < n; j++) {
            // 枚举 j 之前的列作为子序列中的前一个元素
            for (int i = 0; i < j; i++) {
                if (canFollow(strs, m, i, j)) {
                    dp[j] = Math.max(dp[j], dp[i] + 1);
                }
            }
        }

        // 最长合法子序列长度
        int maxLen = findMax(dp);
        return n - maxLen;
    }

    /**
     * 判断第 col2 列是否可以紧跟在第 col1 列之后（所有行都满足非递减）。
     *
     * @param strs 字符串数组
     * @param m    行数
     * @param col1 前一列的索引
     * @param col2 后一列的索引
     * @return 如果所有行中 col1 字符 ≤ col2 字符，返回 true
     */
    private boolean canFollow(String[] strs, int m, int col1, int col2) {
        for (int row = 0; row < m; row++) {
            if (strs[row].charAt(col1) > strs[row].charAt(col2)) {
                return false;
            }
        }
        return true;
    }

    /**
     * 找到数组中的最大值。
     *
     * @param dp 动态规划数组
     * @return 数组最大值
     */
    private int findMax(int[] dp) {
        int max = 0;
        for (int val : dp) {
            max = Math.max(max, val);
        }
        return max;
    }
}
