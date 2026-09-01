"""标签映射器 —— 各平台标签到统一内部标签体系"""

from dataclasses import dataclass


@dataclass
class MappedTag:
    """映射后的标签结果"""

    name: str
    confirmed: bool  # True=已映射到内部标签, False=待人工确认


class TagMapper:
    """
    标签映射器

    维护内部标准标签集合和各平台标签映射表。
    - 可映射的标签转换为内部标准名称，confirmed=True
    - 无法映射的标签保留原名，confirmed=False（待人工确认）
    """

    # 内部标准标签集合（英文 kebab-case）
    INTERNAL_TAGS: set[str] = {
        "array", "string", "hash-table", "dynamic-programming", "math",
        "sorting", "greedy", "binary-search", "tree", "graph",
        "depth-first-search", "breadth-first-search", "stack", "queue",
        "linked-list", "heap", "two-pointers", "sliding-window",
        "backtracking", "divide-and-conquer", "bit-manipulation",
        "recursion", "simulation", "design", "prefix-sum",
        "counting", "union-find", "segment-tree", "trie",
        "monotonic-stack", "topological-sort", "shortest-path",
        "binary-tree", "matrix", "number-theory", "geometry",
        "combinatorics", "game-theory", "interactive", "bitmask",
        "memoization", "enumeration", "string-matching",
        "data-stream", "hash-function", "rolling-hash",
    }

    # 各平台标签到内部标签的映射表
    _PLATFORM_MAP: dict[str, dict[str, str]] = {
        "LEETCODE_GLOBAL": {
            "Array": "array",
            "String": "string",
            "Hash Table": "hash-table",
            "Dynamic Programming": "dynamic-programming",
            "Math": "math",
            "Sorting": "sorting",
            "Greedy": "greedy",
            "Binary Search": "binary-search",
            "Tree": "tree",
            "Graph": "graph",
            "Depth-First Search": "depth-first-search",
            "Breadth-First Search": "breadth-first-search",
            "Stack": "stack",
            "Queue": "queue",
            "Linked List": "linked-list",
            "Heap (Priority Queue)": "heap",
            "Two Pointers": "two-pointers",
            "Sliding Window": "sliding-window",
            "Backtracking": "backtracking",
            "Divide and Conquer": "divide-and-conquer",
            "Bit Manipulation": "bit-manipulation",
            "Recursion": "recursion",
            "Simulation": "simulation",
            "Design": "design",
            "Prefix Sum": "prefix-sum",
            "Counting": "counting",
            "Union Find": "union-find",
            "Segment Tree": "segment-tree",
            "Trie": "trie",
            "Monotonic Stack": "monotonic-stack",
            "Topological Sort": "topological-sort",
            "Shortest Path": "shortest-path",
            "Binary Tree": "binary-tree",
            "Matrix": "matrix",
            "Number Theory": "number-theory",
            "Geometry": "geometry",
            "Combinatorics": "combinatorics",
            "Game Theory": "game-theory",
            "Interactive": "interactive",
            "Bitmask": "bitmask",
            "Memoization": "memoization",
            "Enumeration": "enumeration",
            "String Matching": "string-matching",
            "Data Stream": "data-stream",
            "Hash Function": "hash-function",
            "Rolling Hash": "rolling-hash",
        },
        "LEETCODE_CN": {
            "数组": "array",
            "字符串": "string",
            "哈希表": "hash-table",
            "动态规划": "dynamic-programming",
            "数学": "math",
            "排序": "sorting",
            "贪心": "greedy",
            "二分查找": "binary-search",
            "树": "tree",
            "图": "graph",
            "深度优先搜索": "depth-first-search",
            "广度优先搜索": "breadth-first-search",
            "栈": "stack",
            "队列": "queue",
            "链表": "linked-list",
            "堆（优先队列）": "heap",
            "双指针": "two-pointers",
            "滑动窗口": "sliding-window",
            "回溯": "backtracking",
            "分治": "divide-and-conquer",
            "位运算": "bit-manipulation",
            "递归": "recursion",
            "模拟": "simulation",
            "设计": "design",
            "前缀和": "prefix-sum",
            "计数": "counting",
            "并查集": "union-find",
            "线段树": "segment-tree",
            "字典树": "trie",
            "单调栈": "monotonic-stack",
            "拓扑排序": "topological-sort",
            "最短路": "shortest-path",
            "二叉树": "binary-tree",
            "矩阵": "matrix",
            "数论": "number-theory",
            "几何": "geometry",
            "组合数学": "combinatorics",
            "博弈": "game-theory",
            "交互": "interactive",
            "状态压缩": "bitmask",
            "记忆化搜索": "memoization",
            "枚举": "enumeration",
            "字符串匹配": "string-matching",
            "数据流": "data-stream",
            "哈希函数": "hash-function",
            "滚动哈希": "rolling-hash",
        },
        "CODEFORCES": {
            "dp": "dynamic-programming",
            "graphs": "graph",
            "greedy": "greedy",
            "math": "math",
            "binary search": "binary-search",
            "sortings": "sorting",
            "trees": "tree",
            "strings": "string",
            "dfs and similar": "depth-first-search",
            "bitmasks": "bitmask",
            "brute force": "enumeration",
            "data structures": "design",
            "constructive algorithms": "simulation",
            "two pointers": "two-pointers",
            "number theory": "number-theory",
            "geometry": "geometry",
            "combinatorics": "combinatorics",
            "games": "game-theory",
            "divide and conquer": "divide-and-conquer",
            "interactive": "interactive",
            "implementation": "simulation",
            "hashing": "hash-table",
            "shortest paths": "shortest-path",
        },
        "NOWCODER": {
            "数组": "array",
            "字符串": "string",
            "哈希": "hash-table",
            "动态规划": "dynamic-programming",
            "数学": "math",
            "排序": "sorting",
            "贪心": "greedy",
            "二分": "binary-search",
            "树": "tree",
            "图": "graph",
            "DFS": "depth-first-search",
            "BFS": "breadth-first-search",
            "栈": "stack",
            "队列": "queue",
            "链表": "linked-list",
            "堆": "heap",
            "双指针": "two-pointers",
            "滑动窗口": "sliding-window",
            "回溯": "backtracking",
            "位运算": "bit-manipulation",
            "模拟": "simulation",
            "前缀和": "prefix-sum",
            "并查集": "union-find",
            "线段树": "segment-tree",
            "字典树": "trie",
            "单调栈": "monotonic-stack",
            "拓扑排序": "topological-sort",
        },
        "ATCODER": {
            "dp": "dynamic-programming",
            "graph": "graph",
            "greedy": "greedy",
            "math": "math",
            "binary_search": "binary-search",
            "sort": "sorting",
            "tree": "tree",
            "string": "string",
            "dfs": "depth-first-search",
            "bfs": "breadth-first-search",
            "bit": "bit-manipulation",
            "two_pointers": "two-pointers",
            "number_theory": "number-theory",
            "geometry": "geometry",
            "combinatorics": "combinatorics",
            "game": "game-theory",
            "simulation": "simulation",
            "hash": "hash-table",
        },
    }

    def map(self, raw_tags: list[str], platform: str) -> list[dict]:
        """
        将平台原始标签映射为内部标准标签

        :param raw_tags: 平台原始标签列表
        :param platform: 平台标识（如 LEETCODE_GLOBAL、CODEFORCES）
        :return: 映射结果列表，每项包含 name 和 confirmed 字段
        """
        if not raw_tags:
            return []

        platform_map = self._PLATFORM_MAP.get(platform, {})
        results: list[dict] = []
        seen: set[str] = set()  # 去重，避免多个原始标签映射到同一内部标签

        for raw_tag in raw_tags:
            mapped = self._map_single(raw_tag, platform_map)
            # 去重：同一内部标签只保留一次
            if mapped.name not in seen:
                seen.add(mapped.name)
                results.append({"name": mapped.name, "confirmed": mapped.confirmed})

        return results

    def _map_single(self, raw_tag: str, platform_map: dict[str, str]) -> MappedTag:
        """映射单个标签"""
        # 1. 尝试从平台映射表直接查找
        if raw_tag in platform_map:
            internal_name = platform_map[raw_tag]
            return MappedTag(name=internal_name, confirmed=True)

        # 2. 尝试标准化后匹配内部标签集合（大小写不敏感）
        normalized = self._normalize(raw_tag)
        if normalized in self.INTERNAL_TAGS:
            return MappedTag(name=normalized, confirmed=True)

        # 3. 无法映射，保留原名，标记待人工确认
        return MappedTag(name=raw_tag, confirmed=False)

    @staticmethod
    def _normalize(tag: str) -> str:
        """标准化标签名：小写、空格/下划线替换为短横线"""
        return tag.lower().replace(" ", "-").replace("_", "-")
