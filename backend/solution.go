package solution

// minDeletionSize 删除列使之有序 III（LeetCode 960）
//
// 给定字符串数组 strs，找到最少需要删除的列数，使得剩余列组成的每一行字符串字典序非递减。
// 转化为：找最长合法列子序列，答案 = 总列数 - 最长合法子序列长度。
//
// 时间复杂度：O(n² × m)，n 为列数，m 为行数
// 空间复杂度：O(n)
func minDeletionSize(strs []string) int {
	if len(strs) == 0 || len(strs[0]) == 0 {
		return 0
	}

	m := len(strs)    // 行数
	n := len(strs[0]) // 列数

	// dp[i] 表示以第 i 列结尾的最长合法子序列长度
	dp := make([]int, n)
	for i := range dp {
		dp[i] = 1 // 每列自身至少构成长度为 1 的子序列
	}

	maxLen := 1 // 记录全局最长合法子序列长度

	for i := 1; i < n; i++ {
		for j := 0; j < i; j++ {
			// 检查列 j 能否作为列 i 的前驱：所有行中 strs[row][j] <= strs[row][i]
			if canExtend(strs, m, j, i) {
				if dp[j]+1 > dp[i] {
					dp[i] = dp[j] + 1
				}
			}
		}
		if dp[i] > maxLen {
			maxLen = dp[i]
		}
	}

	// 最少删除列数 = 总列数 - 最长合法子序列长度
	return n - maxLen
}

// canExtend 判断列 j 能否作为列 i 的前驱
// 条件：对于所有行 row，strs[row][j] <= strs[row][i]
func canExtend(strs []string, m, j, i int) bool {
	for row := 0; row < m; row++ {
		if strs[row][j] > strs[row][i] {
			return false // 存在某行不满足非递减，不能衔接
		}
	}
	return true
}
