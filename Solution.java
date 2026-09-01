import java.util.Arrays;

/**
 * LC 960: Delete Columns to Make Sorted III
 *
 * <p>思路：将问题转化为求最长合法列子序列（LIS 变体），答案 = 总列数 - 最长合法子序列长度。
 * 列 j 可以接在列 i 后面的条件：对所有行 r，strs[r][i] <= strs[r][j]。
 *
 * <p>时间复杂度：O(M·N²)，M 为行数，N 为列数
 * <p>空间复杂度：O(N)
 */
class Solution {

    /**
     * 计算最少需要删除的列数，使得每行剩余字符非递减。
     *
     * @param strs 字符串数组，每个字符串长度相同
     * @return 最少删除列数
     */
    public int minDeletionSize(String[] strs) {
        int n = strs[0].length(); // 列数
        int[] dp = new int[n]; // dp[i] 表示以第 i 列结尾的最长合法子序列长度
        Arrays.fill(dp, 1);

        int maxLen = 1;
        for (int j = 1; j < n; j++) {
            for (int i = 0; i < j; i++) {
                // 检查列 i 能否接在列 j 前面（所有行都满足非递减）
                if (canExtend(strs, i, j)) {
                    dp[j] = Math.max(dp[j], dp[i] + 1);
                }
            }
            maxLen = Math.max(maxLen, dp[j]);
        }

        return n - maxLen;
    }

    /**
     * 判断列 i 是否可以作为列 j 的前驱（对所有行满足非递减）。
     */
    private boolean canExtend(String[] strs, int i, int j) {
        for (String s : strs) {
            if (s.charAt(i) > s.charAt(j)) {
                return false;
            }
        }
        return true;
    }
}
