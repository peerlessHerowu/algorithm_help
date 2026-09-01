#include <string>
#include <vector>
#include <algorithm>

using namespace std;

/**
 * @brief 删除列使之有序 III（LeetCode 960）
 *
 * 思路：将问题转化为求最长合法列子序列（LIS 变体）。
 * 列 j 可以接在列 i 后面，当且仅当对所有行 r，strs[r][i] <= strs[r][j]。
 * 答案 = 总列数 - 最长合法子序列长度。
 *
 * 时间复杂度：O(M * N²)，M 为行数，N 为列数
 * 空间复杂度：O(N)
 */
class Solution {
public:
    int minDeletionSize(vector<string>& strs) {
        auto n = static_cast<int>(strs[0].size()); // 列数
        auto m = static_cast<int>(strs.size());    // 行数

        // dp[i] 表示以第 i 列结尾的最长合法子序列长度
        vector<int> dp(n, 1);

        for (int i = 1; i < n; ++i) {
            for (int j = 0; j < i; ++j) {
                // 检查列 j 是否可以作为列 i 的前驱
                if (canFollow(strs, m, j, i)) {
                    dp[i] = max(dp[i], dp[j] + 1);
                }
            }
        }

        int longest = *max_element(dp.begin(), dp.end());
        return n - longest;
    }

private:
    /**
     * @brief 判断列 prev 是否可以作为列 curr 的前驱
     * 条件：对所有行 r，strs[r][prev] <= strs[r][curr]
     */
    bool canFollow(const vector<string>& strs, int m, int prev, int curr) {
        for (int r = 0; r < m; ++r) {
            if (strs[r][prev] > strs[r][curr]) {
                return false;
            }
        }
        return true;
    }
};
