#include <string>
#include <vector>
#include <algorithm>

using namespace std;

/**
 * @brief 删除列使之有序 III (LeetCode 960)
 *
 * 思路：将问题转化为求"最长合法列子序列"。
 * 定义 dp[i] = 以第 i 列结尾的最长合法子序列长度。
 * 对于列 j < i，如果所有行中第 j 列字符 ≤ 第 i 列字符，
 * 则可以从 j 转移到 i：dp[i] = max(dp[i], dp[j] + 1)。
 * 最终答案 = 总列数 - max(dp[...])。
 *
 * 时间复杂度：O(n² × m)，n 为列数，m 为行数
 * 空间复杂度：O(n)
 */
class Solution {
public:
    int minDeletionSize(vector<string>& strs) {
        const int m = static_cast<int>(strs.size());    // 行数
        const int n = static_cast<int>(strs[0].size()); // 列数

        // dp[i]: 以第 i 列结尾的最长合法子序列长度
        vector<int> dp(n, 1);

        for (int i = 1; i < n; ++i) {
            for (int j = 0; j < i; ++j) {
                // 检查列 j 是否可以作为列 i 的前驱：
                // 要求所有行中 strs[row][j] <= strs[row][i]
                if (isValidTransition(strs, m, j, i)) {
                    dp[i] = max(dp[i], dp[j] + 1);
                }
            }
        }

        // 最长合法子序列长度
        int longest = *max_element(dp.begin(), dp.end());

        // 需要删除的列数 = 总列数 - 最长合法子序列长度
        return n - longest;
    }

private:
    /**
     * @brief 判断列 j 能否作为列 i 的合法前驱
     *
     * 合法条件：对于每一行 row，strs[row][j] <= strs[row][i]
     *
     * @param strs 字符串数组
     * @param m 行数
     * @param j 前驱列索引
     * @param i 当前列索引
     * @return true 如果列 j 可以排在列 i 之前
     */
    bool isValidTransition(const vector<string>& strs, int m, int j, int i) {
        for (int row = 0; row < m; ++row) {
            if (strs[row][j] > strs[row][i]) {
                return false;
            }
        }
        return true;
    }
};
