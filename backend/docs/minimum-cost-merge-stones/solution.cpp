#include <climits>
#include <string>
#include <vector>

using namespace std;

/**
 * @brief 删除列使每行有序 III（LeetCode 960）
 *
 * 问题本质：找到最长的列子序列，使得保留这些列后每一行都是非递减的。
 * 答案 = 总列数 - 最长合法列子序列长度。
 *
 * 思路：类似最长递增子序列（LIS），但"递增"条件变为"所有行在该位置都满足非递减"。
 * 定义 dp[j] = 以第 j 列结尾的最长合法列子序列长度。
 * 转移：dp[j] = max(dp[i] + 1)，其中 i < j 且对所有行 r 有 strs[r][i] <= strs[r][j]。
 *
 * 时间复杂度：O(m × n²)，m 为行数，n 为列数
 * 空间复杂度：O(n)
 */
class Solution {
public:
    int minDeletionSize(vector<string>& strs) {
        const int m = static_cast<int>(strs.size());    // 行数
        const int n = static_cast<int>(strs[0].size()); // 列数

        // dp[j] 表示以第 j 列结尾的最长合法列子序列长度
        vector<int> dp(n, 1);

        // 记录全局最长合法子序列长度
        int max_keep = 1;

        for (int j = 1; j < n; ++j) {
            for (int i = 0; i < j; ++i) {
                // 检查第 i 列是否可以排在第 j 列前面
                // 条件：所有行中，第 i 列字符 <= 第 j 列字符
                if (isValidTransition(strs, m, i, j)) {
                    dp[j] = max(dp[j], dp[i] + 1);
                }
            }
            max_keep = max(max_keep, dp[j]);
        }

        // 最少删除列数 = 总列数 - 最多可保留列数
        return n - max_keep;
    }

private:
    /**
     * @brief 判断列 i 是否可以作为列 j 的前驱
     *
     * 合法条件：对于每一行 r，strs[r][i] <= strs[r][j]
     * 即保留列 i 和列 j 后，每行在这两个位置仍然非递减。
     *
     * @param strs 字符串数组
     * @param m 行数
     * @param i 前驱列下标
     * @param j 当前列下标
     * @return true 如果列 i 可以排在列 j 前面
     */
    bool isValidTransition(const vector<string>& strs, int m, int i, int j) {
        for (int r = 0; r < m; ++r) {
            if (strs[r][i] > strs[r][j]) {
                return false; // 存在某行不满足非递减，不能保留这对列
            }
        }
        return true;
    }
};
