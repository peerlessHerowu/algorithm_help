package algorithm_help

// minDeletionSize 删除列使之有序 III（LC 960）
// 找到最长的列子序列，使得对所有行该子序列非递减，答案 = 总列数 - 最长合法子序列长度。
// 时间复杂度：O(M·N²)，M 为行数，N 为列数
// 空间复杂度：O(N)
func minDeletionSize(strs []string) int {
	if len(strs) == 0 || len(strs[0]) == 0 {
		return 0
	}

	m := len(strs)  // 行数
	n := len(strs[0]) // 列数
	dp := make([]int, n) // dp[i] 表示以第 i 列结尾的最长合法子序列长度

	for i := range dp {
		dp[i] = 1
	}

	best := 1

	for i := 1; i < n; i++ {
		for j := 0; j < i; j++ {
			// 检查列 j 能否排在列 i 前面：所有行中 strs[r][j] <= strs[r][i]
			valid := true
			for r := 0; r < m; r++ {
				if strs[r][j] > strs[r][i] {
					valid = false
					break
				}
			}
			if valid && dp[j]+1 > dp[i] {
				dp[i] = dp[j] + 1
			}
		}
		if dp[i] > best {
			best = dp[i]
		}
	}

	return n - best
}
