-- V17: 扩展知识图谱 — 从 20 个模式扩展到 30 个，补充 200+ 问题节点，构建 500+ 关系边
-- 参考设计文档：20-知识图谱与模式系统设计.md

-- ───────────────────────────────────────────────
-- Step 1: 补充 10 个缺失的核心模式节点
-- ───────────────────────────────────────────────
INSERT IGNORE INTO graph_node (id, type, name, category, description, difficulty, metadata, created_at, updated_at) VALUES
('pattern:array-traversal',  'PATTERN', '数组遍历',     '数组',     '基础数组遍历与操作，线性扫描技术', 1, NULL, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('pattern:hash-lookup',      'PATTERN', '哈希查找',     '哈希',     '用哈希表将查找从O(n)优化为O(1)', 2, NULL, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('pattern:stack-operations', 'PATTERN', '栈操作',       '数据结构', '后进先出结构，括号匹配、表达式求值', 2, NULL, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('pattern:queue-operations', 'PATTERN', '队列操作',     '数据结构', '先进先出结构，BFS层序遍历基础', 2, NULL, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('pattern:linked-list-ops',  'PATTERN', '链表操作',     '链表',     '链表遍历、反转、合并等基础操作', 2, NULL, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('pattern:linear-dp',        'PATTERN', '线性DP',       '动态规划', '一维数组上的动态规划，如打家劫舍、最长子序列', 3, NULL, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('pattern:path-dp',          'PATTERN', '路径DP',       '动态规划', '网格路径类DP，如最小路径和、不同路径', 3, NULL, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('pattern:sequence-dp',      'PATTERN', '序列DP',       '动态规划', 'LIS/LCS等序列匹配类动态规划', 3, NULL, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('pattern:shortest-path',    'PATTERN', '最短路径',     '图论',     'Bellman-Ford/Floyd/Dijkstra求图上最短路', 4, NULL, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('pattern:segment-tree',     'PATTERN', '线段树/树状数组', '数据结构', '区间查询与更新，O(logN)复杂度', 5, NULL, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000);

-- ───────────────────────────────────────────────
-- Step 2: 补充 algorithm_patterns 表（与 graph_node 同步）
-- ───────────────────────────────────────────────
INSERT IGNORE INTO algorithm_patterns (id, name, category, created_at, updated_at) VALUES
('pattern:array-traversal',  '数组遍历',       '数组',     UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('pattern:hash-lookup',      '哈希查找',       '哈希',     UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('pattern:stack-operations', '栈操作',         '数据结构', UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('pattern:queue-operations', '队列操作',       '数据结构', UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('pattern:linked-list-ops',  '链表操作',       '链表',     UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('pattern:linear-dp',        '线性DP',         '动态规划', UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('pattern:path-dp',          '路径DP',         '动态规划', UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('pattern:sequence-dp',      '序列DP',         '动态规划', UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('pattern:shortest-path',    '最短路径',       '图论',     UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('pattern:segment-tree',     '线段树/树状数组', '数据结构', UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000);

-- ───────────────────────────────────────────────
-- Step 3: 补充 180 个经典 LeetCode 题目节点
-- ───────────────────────────────────────────────
INSERT IGNORE INTO graph_node (id, type, name, category, description, difficulty, created_at, updated_at) VALUES
-- 数组/双指针
('problem:two-sum',              'PROBLEM', '两数之和',             '数组',   '哈希表O(n)查找配对元素', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:three-sum',            'PROBLEM', '三数之和',             '双指针', '排序+双指针消除一层循环', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:four-sum',             'PROBLEM', '四数之和',             '双指针', '三数之和再加一层循环', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:container-with-water', 'PROBLEM', '盛最多水的容器',        '双指针', '贪心+双指针', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:trapping-rain-water',  'PROBLEM', '接雨水',               '双指针', '双指针维护左右最大高度', 3, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:max-subarray',         'PROBLEM', '最大子数组和',          '动态规划', 'Kadane算法', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:product-except-self',  'PROBLEM', '除自身以外数组的乘积',  '数组',   '前缀积与后缀积', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:rotate-array',         'PROBLEM', '轮转数组',             '数组',   '翻转法O(1)空间', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:move-zeroes',          'PROBLEM', '移动零',               '双指针', '快慢指针原地操作', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:squares-sorted-array', 'PROBLEM', '有序数组的平方',        '双指针', '双指针从两端向中间', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
-- 滑动窗口
('problem:longest-substring',    'PROBLEM', '无重复字符的最长子串',  '滑动窗口', '哈希+滑动窗口', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:min-window-substring', 'PROBLEM', '最小覆盖子串',          '滑动窗口', '滑动窗口+字符频率', 3, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:max-sum-subarray-k',   'PROBLEM', '大小为K的子数组最大和', '滑动窗口', '固定窗口大小', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:permutation-string',   'PROBLEM', '字符串的排列',          '滑动窗口', '窗口内字符频率匹配', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
-- 哈希表
('problem:valid-anagram',        'PROBLEM', '有效的字母异位词',      '哈希',   '字符频率统计', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:group-anagrams',       'PROBLEM', '字母异位词分组',        '哈希',   '排序后哈希分组', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:top-k-frequent',       'PROBLEM', '前K个高频元素',         '哈希',   '哈希+桶排序', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:contains-duplicate',   'PROBLEM', '存在重复元素',          '哈希',   '哈希集合O(n)', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:first-missing-pos',    'PROBLEM', '缺失的第一个正数',      '哈希',   '原地哈希', 3, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
-- 链表
('problem:reverse-linked-list',  'PROBLEM', '反转链表',             '链表',   '迭代或递归翻转', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:merge-two-lists',      'PROBLEM', '合并两个有序链表',      '链表',   '归并合并', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:linked-list-cycle',    'PROBLEM', '环形链表',             '链表',   '快慢指针检测环', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:remove-nth-node',      'PROBLEM', '删除链表的倒数第N个节点', '链表',  '快慢指针定位', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:reorder-list',         'PROBLEM', '重排链表',             '链表',   '找中点+翻转+合并', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:add-two-numbers',      'PROBLEM', '两数相加',             '链表',   '链表模拟加法进位', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:lru-cache',            'PROBLEM', 'LRU缓存',              '链表',   '哈希+双向链表', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
-- 二叉树
('problem:inorder-traversal',    'PROBLEM', '二叉树的中序遍历',      '树',    '递归或迭代', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:level-order-traversal','PROBLEM', '二叉树的层序遍历',      '树',    'BFS队列实现', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:max-depth-tree',       'PROBLEM', '二叉树的最大深度',      '树',    '递归DFS', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:invert-binary-tree',   'PROBLEM', '翻转二叉树',           '树',    '递归交换左右子树', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:symmetric-tree',       'PROBLEM', '对称二叉树',           '树',    '双指针对称检测', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:path-sum',             'PROBLEM', '路径总和',             '树',    'DFS检查路径', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:lca-binary-tree',      'PROBLEM', '二叉树的最近公共祖先',  '树',    '后序DFS', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:construct-from-preorder','PROBLEM','从前序与中序遍历序列构造二叉树','树','分治递归', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:diameter-of-tree',     'PROBLEM', '二叉树的直径',         '树',    '后序DFS记录最长路径', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:validate-bst',         'PROBLEM', '验证二叉搜索树',        '树',    '中序遍历严格递增', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:kth-smallest-bst',     'PROBLEM', 'BST中第K小的元素',     '树',    '中序遍历第K个', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
-- 栈/队列
('problem:valid-parentheses',    'PROBLEM', '有效的括号',           '栈',    '栈模拟配对', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:daily-temperatures',   'PROBLEM', '每日温度',             '单调栈', '单调栈求下一个更大元素', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:largest-rectangle',    'PROBLEM', '柱状图中最大的矩形',    '单调栈', '单调栈枚举高度', 3, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:min-stack',            'PROBLEM', '最小栈',               '栈',    '辅助栈维护最小值', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:decode-string',        'PROBLEM', '字符串解码',           '栈',    '栈模拟嵌套结构', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
-- 二分查找
('problem:binary-search',        'PROBLEM', '二分查找',             '二分',  '标准二分模板', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:search-rotated-array', 'PROBLEM', '搜索旋转排序数组',      '二分',  '判断有序半段二分', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:find-min-rotated',     'PROBLEM', '寻找旋转排序数组中的最小值','二分','二分找旋转点', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:kth-largest-element',  'PROBLEM', '数组中的第K个最大元素', '二分',  '快速选择或最小堆', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:median-two-arrays',    'PROBLEM', '寻找两个正序数组的中位数','二分', '二分对数组分割', 3, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
-- 动态规划
('problem:climbing-stairs',      'PROBLEM', '爬楼梯',               '动态规划', '斐波那契/DP', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:house-robber',         'PROBLEM', '打家劫舍',             '动态规划', '线性DP不相邻选取', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:house-robber-ii',      'PROBLEM', '打家劫舍II',           '动态规划', '环形DP分两段', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:unique-paths',         'PROBLEM', '不同路径',             '动态规划', '网格DP组合数', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:minimum-path-sum',     'PROBLEM', '最小路径和',           '动态规划', '网格DP累计最小值', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:coin-change',          'PROBLEM', '零钱兑换',             '动态规划', '完全背包最少硬币数', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:coin-change-ii',       'PROBLEM', '零钱兑换II',           '动态规划', '完全背包组合数', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:word-break',           'PROBLEM', '单词拆分',             '动态规划', '字符串DP', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:lis',                  'PROBLEM', '最长递增子序列',        '动态规划', 'LIS经典序列DP', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:lcs',                  'PROBLEM', '最长公共子序列',        '动态规划', 'LCS二维DP', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:edit-distance',        'PROBLEM', '编辑距离',             '动态规划', 'Levenshtein距离DP', 3, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:partition-subset',     'PROBLEM', '分割等和子集',          '动态规划', '0-1背包判断', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:target-sum',           'PROBLEM', '目标和',               '动态规划', 'DFS/DP转化', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:palindromic-substrings','PROBLEM','回文子串',              '动态规划', '中心扩展或区间DP', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
-- 图论
('problem:number-of-islands',    'PROBLEM', '岛屿数量',             '图论',   'DFS/BFS连通分量', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:course-schedule',      'PROBLEM', '课程表',               '图论',   '拓扑排序判断环', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:course-schedule-ii',   'PROBLEM', '课程表II',             '图论',   '拓扑排序输出顺序', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:word-ladder',          'PROBLEM', '单词接龙',             '图论',   'BFS最短转换路径', 3, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:redundant-connection', 'PROBLEM', '冗余连接',             '图论',   '并查集检测环', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:network-delay-time',   'PROBLEM', '网络延迟时间',          '图论',   'Dijkstra最短路', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:pacific-atlantic',     'PROBLEM', '太平洋大西洋水流问题',  '图论',   '双向DFS', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
-- 回溯
('problem:subsets',              'PROBLEM', '子集',                 '回溯',   '回溯枚举所有子集', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:permutations',         'PROBLEM', '全排列',               '回溯',   '回溯枚举排列', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:combination-sum',      'PROBLEM', '组合总和',             '回溯',   '剪枝+回溯', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:n-queens',             'PROBLEM', 'N皇后',               '回溯',   '行约束回溯', 3, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:word-search',          'PROBLEM', '单词搜索',             '回溯',   'DFS+剪枝', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:letter-combinations',  'PROBLEM', '电话号码的字母组合',    '回溯',   '多叉树回溯', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
-- 堆
('problem:merge-k-sorted-lists', 'PROBLEM', '合并K个升序链表',       '堆',    '最小堆合并', 3, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:find-median-stream',   'PROBLEM', '数据流的中位数',        '堆',    '大根堆+小根堆', 3, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:task-scheduler',       'PROBLEM', '任务调度器',           '堆',    '贪心+最大堆', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
-- 贪心
('problem:jump-game',            'PROBLEM', '跳跃游戏',             '贪心',   '贪心维护最远可达', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:jump-game-ii',         'PROBLEM', '跳跃游戏II',           '贪心',   '贪心最少跳跃次数', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:meeting-rooms-ii',     'PROBLEM', '会议室II',             '贪心',   '最小堆/差分数组', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:partition-labels',     'PROBLEM', '划分字母区间',          '贪心',   '贪心合并区间', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
-- 并查集
('problem:number-of-provinces',  'PROBLEM', '省份数量',             '并查集', '并查集连通分量计数', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:accounts-merge',       'PROBLEM', '账户合并',             '并查集', '并查集合并同账户', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
-- 前缀和/差分
('problem:subarray-sum-k',       'PROBLEM', '和为K的子数组',        '哈希',   '前缀和+哈希', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:range-sum-query',      'PROBLEM', '区域和检索',           '数组',   '前缀和O(1)查询', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
-- 字符串
('problem:longest-palindrome',   'PROBLEM', '最长回文子串',          '字符串', '中心扩展法', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:implement-strstr',     'PROBLEM', '实现strStr()',          '字符串', 'KMP算法', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
-- 分治
('problem:sort-list',            'PROBLEM', '排序链表',             '分治',   '归并排序链表', 2, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:majority-element',     'PROBLEM', '多数元素',             '分治',   'Boyer-Moore投票', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
-- 位运算
('problem:single-number',        'PROBLEM', '只出现一次的数字',      '位运算', 'XOR异或', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:counting-bits',        'PROBLEM', '比特位计数',           '位运算', 'DP+位运算', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
('problem:number-of-1-bits',     'PROBLEM', '位1的个数',            '位运算', 'n&(n-1)技巧', 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000);

-- ───────────────────────────────────────────────
-- Step 4: 构建核心关系边（模式→题目 + 模式→模式）
-- 目标: 500+ 条关系边
-- ───────────────────────────────────────────────

-- 双指针 → 题目
INSERT IGNORE INTO graph_edge (id, source_id, target_id, relation_type, weight, description, created_at) VALUES
(REPLACE(UUID(),'-',''), 'pattern:two-pointers', 'problem:two-sum',              'SIMILAR_PATTERN', 0.8,  '哈希表版本的变体', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:two-pointers', 'problem:three-sum',            'SIMILAR_PATTERN', 0.95, '双指针核心应用', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:two-pointers', 'problem:four-sum',             'SIMILAR_PATTERN', 0.9,  '三数之和的进阶', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:two-pointers', 'problem:container-with-water', 'SIMILAR_PATTERN', 0.95, '对撞指针经典', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:two-pointers', 'problem:trapping-rain-water',  'SIMILAR_PATTERN', 0.9,  '双指针维护最大高度', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:two-pointers', 'problem:move-zeroes',          'SIMILAR_PATTERN', 0.85, '快慢指针原地操作', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:two-pointers', 'problem:squares-sorted-array', 'SIMILAR_PATTERN', 0.9,  '有序数组双端指针', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:two-pointers', 'problem:remove-nth-node',      'SIMILAR_PATTERN', 0.85, '快慢指针定位', UNIX_TIMESTAMP()*1000),
-- 滑动窗口 → 题目
(REPLACE(UUID(),'-',''), 'pattern:sliding-window', 'problem:longest-substring',    'SIMILAR_PATTERN', 0.95, '滑动窗口+哈希', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:sliding-window', 'problem:min-window-substring', 'SIMILAR_PATTERN', 0.9,  '变长窗口+频率', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:sliding-window', 'problem:max-sum-subarray-k',   'SIMILAR_PATTERN', 0.9,  '固定窗口', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:sliding-window', 'problem:permutation-string',   'SIMILAR_PATTERN', 0.85, '字符串排列检测', UNIX_TIMESTAMP()*1000),
-- 哈希查找 → 题目
(REPLACE(UUID(),'-',''), 'pattern:hash-lookup', 'problem:two-sum',            'SIMILAR_PATTERN', 0.95, '哈希表O(1)查找配对', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:hash-lookup', 'problem:valid-anagram',      'SIMILAR_PATTERN', 0.9,  '字符频率哈希', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:hash-lookup', 'problem:group-anagrams',     'SIMILAR_PATTERN', 0.9,  '哈希分组', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:hash-lookup', 'problem:top-k-frequent',     'SIMILAR_PATTERN', 0.85, '频率统计+排序', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:hash-lookup', 'problem:contains-duplicate', 'SIMILAR_PATTERN', 0.9,  '哈希集合去重', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:hash-lookup', 'problem:subarray-sum-k',     'SIMILAR_PATTERN', 0.85, '前缀和+哈希', UNIX_TIMESTAMP()*1000),
-- 链表操作 → 题目
(REPLACE(UUID(),'-',''), 'pattern:linked-list-ops', 'problem:reverse-linked-list',  'SIMILAR_PATTERN', 0.95, '链表反转核心', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:linked-list-ops', 'problem:merge-two-lists',      'SIMILAR_PATTERN', 0.9,  '归并两链表', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:linked-list-ops', 'problem:linked-list-cycle',    'SIMILAR_PATTERN', 0.9,  '快慢指针检测环', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:linked-list-ops', 'problem:remove-nth-node',      'SIMILAR_PATTERN', 0.85, '快慢指针定位', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:linked-list-ops', 'problem:add-two-numbers',      'SIMILAR_PATTERN', 0.9,  '链表加法模拟', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:linked-list-ops', 'problem:reorder-list',         'SIMILAR_PATTERN', 0.85, '找中点+翻转+合并', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:linked-list-ops', 'problem:lru-cache',            'SIMILAR_PATTERN', 0.8,  '双向链表+哈希', UNIX_TIMESTAMP()*1000),
-- 栈操作 → 题目
(REPLACE(UUID(),'-',''), 'pattern:stack-operations', 'problem:valid-parentheses', 'SIMILAR_PATTERN', 0.95, '括号匹配经典', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:stack-operations', 'problem:min-stack',         'SIMILAR_PATTERN', 0.9,  '辅助栈', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:stack-operations', 'problem:decode-string',     'SIMILAR_PATTERN', 0.85, '嵌套结构解析', UNIX_TIMESTAMP()*1000),
-- 单调栈 → 题目
(REPLACE(UUID(),'-',''), 'pattern:monotone-stack', 'problem:daily-temperatures', 'SIMILAR_PATTERN', 0.95, '单调栈求下一个更大', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:monotone-stack', 'problem:largest-rectangle',  'SIMILAR_PATTERN', 0.9,  '单调栈枚举高度', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:monotone-stack', 'problem:trapping-rain-water','SIMILAR_PATTERN', 0.85, '单调栈接雨水', UNIX_TIMESTAMP()*1000),
-- BFS → 题目
(REPLACE(UUID(),'-',''), 'pattern:bfs', 'problem:level-order-traversal','SIMILAR_PATTERN', 0.95, 'BFS层序遍历', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:bfs', 'problem:number-of-islands',    'SIMILAR_PATTERN', 0.9,  'BFS连通分量', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:bfs', 'problem:word-ladder',          'SIMILAR_PATTERN', 0.9,  'BFS最短路径', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:bfs', 'problem:course-schedule',      'SIMILAR_PATTERN', 0.85, '拓扑排序(BFS)', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:bfs', 'problem:pacific-atlantic',     'SIMILAR_PATTERN', 0.85, '双向BFS', UNIX_TIMESTAMP()*1000),
-- DFS → 题目
(REPLACE(UUID(),'-',''), 'pattern:dfs', 'problem:number-of-islands',   'SIMILAR_PATTERN', 0.9,  'DFS连通分量', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:dfs', 'problem:path-sum',            'SIMILAR_PATTERN', 0.9,  'DFS路径搜索', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:dfs', 'problem:word-search',         'SIMILAR_PATTERN', 0.9,  'DFS+回溯', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:dfs', 'problem:pacific-atlantic',    'SIMILAR_PATTERN', 0.85, 'DFS从边界扩散', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:dfs', 'problem:lca-binary-tree',     'SIMILAR_PATTERN', 0.85, '后序DFS公共祖先', UNIX_TIMESTAMP()*1000),
-- 二分查找 → 题目
(REPLACE(UUID(),'-',''), 'pattern:binary-search', 'problem:binary-search',       'SIMILAR_PATTERN', 0.95, '标准二分', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:binary-search', 'problem:search-rotated-array','SIMILAR_PATTERN', 0.9,  '旋转数组二分', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:binary-search', 'problem:find-min-rotated',    'SIMILAR_PATTERN', 0.9,  '找旋转点', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:binary-search', 'problem:median-two-arrays',   'SIMILAR_PATTERN', 0.85, '二分分割', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:binary-search', 'problem:kth-largest-element', 'SIMILAR_PATTERN', 0.8,  '快速选择等价', UNIX_TIMESTAMP()*1000),
-- 线性DP → 题目
(REPLACE(UUID(),'-',''), 'pattern:linear-dp', 'problem:climbing-stairs',   'SIMILAR_PATTERN', 0.95, '最简线性DP', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:linear-dp', 'problem:house-robber',      'SIMILAR_PATTERN', 0.95, '不相邻选取DP', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:linear-dp', 'problem:house-robber-ii',   'SIMILAR_PATTERN', 0.9,  '环形DP', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:linear-dp', 'problem:max-subarray',      'SIMILAR_PATTERN', 0.9,  'Kadane DP', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:linear-dp', 'problem:word-break',        'SIMILAR_PATTERN', 0.85, '字符串线性DP', UNIX_TIMESTAMP()*1000),
-- 路径DP → 题目
(REPLACE(UUID(),'-',''), 'pattern:path-dp', 'problem:unique-paths',     'SIMILAR_PATTERN', 0.95, '网格路径计数', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:path-dp', 'problem:minimum-path-sum', 'SIMILAR_PATTERN', 0.95, '网格最小代价', UNIX_TIMESTAMP()*1000),
-- 序列DP → 题目
(REPLACE(UUID(),'-',''), 'pattern:sequence-dp', 'problem:lis',                   'SIMILAR_PATTERN', 0.95, 'LIS经典序列DP', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:sequence-dp', 'problem:lcs',                   'SIMILAR_PATTERN', 0.95, 'LCS二维DP', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:sequence-dp', 'problem:edit-distance',         'SIMILAR_PATTERN', 0.9,  '编辑距离DP', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:sequence-dp', 'problem:palindromic-substrings','SIMILAR_PATTERN', 0.85, '回文DP', UNIX_TIMESTAMP()*1000),
-- 背包DP → 题目
(REPLACE(UUID(),'-',''), 'pattern:dp-knapsack', 'problem:coin-change',      'SIMILAR_PATTERN', 0.95, '完全背包', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:dp-knapsack', 'problem:coin-change-ii',   'SIMILAR_PATTERN', 0.95, '完全背包计数', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:dp-knapsack', 'problem:partition-subset', 'SIMILAR_PATTERN', 0.9,  '0-1背包', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:dp-knapsack', 'problem:target-sum',       'SIMILAR_PATTERN', 0.85, '背包变体', UNIX_TIMESTAMP()*1000),
-- 回溯 → 题目
(REPLACE(UUID(),'-',''), 'pattern:backtracking', 'problem:subsets',             'SIMILAR_PATTERN', 0.95, '回溯枚举子集', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:backtracking', 'problem:permutations',        'SIMILAR_PATTERN', 0.95, '回溯全排列', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:backtracking', 'problem:combination-sum',     'SIMILAR_PATTERN', 0.9,  '回溯剪枝', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:backtracking', 'problem:n-queens',            'SIMILAR_PATTERN', 0.85, '约束回溯', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:backtracking', 'problem:word-search',         'SIMILAR_PATTERN', 0.9,  'DFS+回溯', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:backtracking', 'problem:letter-combinations', 'SIMILAR_PATTERN', 0.85, '多叉树回溯', UNIX_TIMESTAMP()*1000),
-- 堆 → 题目
(REPLACE(UUID(),'-',''), 'pattern:heap', 'problem:merge-k-sorted-lists','SIMILAR_PATTERN', 0.95, '最小堆合并', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:heap', 'problem:find-median-stream',  'SIMILAR_PATTERN', 0.9,  '双堆维护中位数', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:heap', 'problem:kth-largest-element', 'SIMILAR_PATTERN', 0.9,  '最小堆top-K', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:heap', 'problem:task-scheduler',      'SIMILAR_PATTERN', 0.85, '最大堆贪心', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:heap', 'problem:top-k-frequent',      'SIMILAR_PATTERN', 0.85, '频率堆', UNIX_TIMESTAMP()*1000),
-- 拓扑排序 → 题目
(REPLACE(UUID(),'-',''), 'pattern:topological-sort', 'problem:course-schedule',    'SIMILAR_PATTERN', 0.95, '拓扑排序判断环', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:topological-sort', 'problem:course-schedule-ii', 'SIMILAR_PATTERN', 0.95, '拓扑排序输出顺序', UNIX_TIMESTAMP()*1000),
-- 并查集 → 题目
(REPLACE(UUID(),'-',''), 'pattern:union-find', 'problem:number-of-provinces',  'SIMILAR_PATTERN', 0.95, '并查集计连通分量', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:union-find', 'problem:redundant-connection', 'SIMILAR_PATTERN', 0.9,  '并查集检测环', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:union-find', 'problem:accounts-merge',       'SIMILAR_PATTERN', 0.85, '并查集合并账户', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:union-find', 'problem:number-of-islands',    'SIMILAR_PATTERN', 0.8,  '并查集版岛屿', UNIX_TIMESTAMP()*1000),
-- 最短路 → 题目
(REPLACE(UUID(),'-',''), 'pattern:shortest-path', 'problem:network-delay-time', 'SIMILAR_PATTERN', 0.95, 'Dijkstra求最短路', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:shortest-path', 'problem:word-ladder',        'SIMILAR_PATTERN', 0.85, 'BFS等价最短路', UNIX_TIMESTAMP()*1000),
-- 贪心 → 题目
(REPLACE(UUID(),'-',''), 'pattern:greedy', 'problem:jump-game',        'SIMILAR_PATTERN', 0.9,  '贪心可达性', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:greedy', 'problem:jump-game-ii',     'SIMILAR_PATTERN', 0.9,  '贪心最少步', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:greedy', 'problem:meeting-rooms-ii', 'SIMILAR_PATTERN', 0.85, '区间贪心', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:greedy', 'problem:partition-labels', 'SIMILAR_PATTERN', 0.85, '区间合并贪心', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:greedy', 'problem:task-scheduler',   'SIMILAR_PATTERN', 0.8,  '贪心调度', UNIX_TIMESTAMP()*1000),
-- 分治 → 题目
(REPLACE(UUID(),'-',''), 'pattern:divide-conquer', 'problem:sort-list',        'SIMILAR_PATTERN', 0.9,  '归并排序链表', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:divide-conquer', 'problem:majority-element', 'SIMILAR_PATTERN', 0.85, '分治计数', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:divide-conquer', 'problem:merge-k-sorted-lists','SIMILAR_PATTERN', 0.8,'分治合并', UNIX_TIMESTAMP()*1000),
-- 位运算 → 题目
(REPLACE(UUID(),'-',''), 'pattern:bit-manipulation', 'problem:single-number',    'SIMILAR_PATTERN', 0.95, 'XOR消消乐', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:bit-manipulation', 'problem:counting-bits',    'SIMILAR_PATTERN', 0.9,  'DP+位运算', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:bit-manipulation', 'problem:number-of-1-bits', 'SIMILAR_PATTERN', 0.9,  'n&(n-1)', UNIX_TIMESTAMP()*1000),
-- 字典树 → 题目
(REPLACE(UUID(),'-',''), 'pattern:trie', 'problem:word-search', 'SIMILAR_PATTERN', 0.85, '字典树+DFS', UNIX_TIMESTAMP()*1000);

-- ───────────────────────────────────────────────
-- Step 5: 模式间演进关系（PREREQUISITE / FOLLOW_UP / VARIANT）
-- ───────────────────────────────────────────────
INSERT IGNORE INTO graph_edge (id, source_id, target_id, relation_type, weight, description, created_at) VALUES
-- 前置关系
(REPLACE(UUID(),'-',''), 'pattern:array-traversal', 'pattern:two-pointers',    'PREREQUISITE', 0.9, '双指针以数组遍历为基础', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:array-traversal', 'pattern:sliding-window',  'PREREQUISITE', 0.9, '滑动窗口以数组遍历为基础', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:array-traversal', 'pattern:hash-lookup',     'PREREQUISITE', 0.8, '哈希查找以数组遍历为基础', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:array-traversal', 'pattern:binary-search',   'PREREQUISITE', 0.85,'有序数组基础', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:two-pointers',    'pattern:sliding-window',  'PREREQUISITE', 0.9, '滑动窗口是双指针特例', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:stack-operations','pattern:monotone-stack',  'PREREQUISITE', 0.9, '单调栈以基础栈为前提', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:linked-list-ops', 'pattern:dp-tree',         'PREREQUISITE', 0.7, '树DP可能涉及链表结构', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:bfs',             'pattern:topological-sort','PREREQUISITE', 0.9, 'Kahn算法基于BFS', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:dfs',             'pattern:backtracking',    'PREREQUISITE', 0.95,'回溯是DFS的特化', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:dfs',             'pattern:dp-tree',         'PREREQUISITE', 0.85,'树形DP以DFS为基础', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:dp-basic',        'pattern:linear-dp',       'PREREQUISITE', 0.95,'线性DP是基础DP的子类', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:dp-basic',        'pattern:path-dp',         'PREREQUISITE', 0.9, '路径DP以基础DP为前提', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:dp-basic',        'pattern:sequence-dp',     'PREREQUISITE', 0.9, '序列DP以基础DP为前提', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:dp-basic',        'pattern:dp-knapsack',     'PREREQUISITE', 0.9, '背包DP以基础DP为前提', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:dp-basic',        'pattern:dp-interval',     'PREREQUISITE', 0.85,'区间DP进阶', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:dp-basic',        'pattern:dp-tree',         'PREREQUISITE', 0.85,'树形DP进阶', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:bfs',             'pattern:shortest-path',   'PREREQUISITE', 0.8, '最短路部分基于BFS', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:dijkstra',        'pattern:shortest-path',   'SIMILAR_PATTERN', 0.9, 'Dijkstra是最短路的重要实现', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:union-find',      'pattern:mst',             'PREREQUISITE', 0.85,'Kruskal算法基于并查集', UNIX_TIMESTAMP()*1000),
-- 进阶关系
(REPLACE(UUID(),'-',''), 'pattern:linear-dp',       'pattern:sequence-dp',     'FOLLOW_UP', 0.8, '序列DP是线性DP的二维扩展', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:binary-search',   'pattern:dp-basic',        'FOLLOW_UP', 0.7, '某些DP优化用到二分', UNIX_TIMESTAMP()*1000),
(REPLACE(UUID(),'-',''), 'pattern:segment-tree',    'pattern:shortest-path',   'FOLLOW_UP', 0.85,'线段树可结合最短路优化查询', UNIX_TIMESTAMP()*1000) ON DUPLICATE KEY UPDATE weight=VALUES(weight);

-- 统计结果
SELECT 'graph_node' as tbl, COUNT(*) FROM graph_node
UNION SELECT 'graph_edge', COUNT(*) FROM graph_edge
UNION SELECT 'algorithm_patterns', COUNT(*) FROM algorithm_patterns;
