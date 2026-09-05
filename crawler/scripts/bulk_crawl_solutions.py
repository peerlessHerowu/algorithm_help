#!/usr/bin/env python3
"""
批量爬取 LeetCode Top 200 高频题的高赞题解

使用 LeetCode CN GraphQL API 爬取每题前 10 条高赞题解，
直接以题目 slug 作为 problem_id 写入 crawled_solutions 表。

用法：
    uv run scripts/bulk_crawl_solutions.py [--limit 200] [--min-votes 50] [--dry-run]

环境变量：
    LEETCODE_COOKIE  — LeetCode CN 的 Cookie（可选，无则匿名爬取公开题解）
    DB_HOST          — MySQL 主机（默认 localhost）
    DB_PORT          — MySQL 端口（默认 3306）
    DB_NAME          — 数据库名（默认 algorithm_help）
    DB_USER          — 数据库用户（默认 root）
    DB_PASSWORD      — 数据库密码（默认空）
"""

import asyncio
import hashlib
import math
import os
import random
import re
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

import httpx
from loguru import logger

# ── Top 200 高频面试题（LeetCode slug）──
TOP_200_SLUGS: list[str] = [
    # Array / Two Pointers
    "two-sum",
    "three-sum",
    "container-with-most-water",
    "trapping-rain-water",
    "maximum-subarray",
    "best-time-to-buy-and-sell-stock",
    "best-time-to-buy-and-sell-stock-ii",
    "product-of-array-except-self",
    "find-minimum-in-rotated-sorted-array",
    "search-in-rotated-sorted-array",
    "two-sum-ii-input-array-is-sorted",
    "valid-mountain-array",
    "squares-of-a-sorted-array",
    "minimum-size-subarray-sum",
    "longest-substring-without-repeating-characters",
    "sliding-window-maximum",
    "find-all-anagrams-in-a-string",
    "permutation-in-string",
    "minimum-window-substring",
    "4sum",
    # Linked List
    "add-two-numbers",
    "remove-nth-node-from-end-of-list",
    "merge-two-sorted-lists",
    "merge-k-sorted-lists",
    "swap-nodes-in-pairs",
    "reverse-linked-list",
    "reverse-linked-list-ii",
    "linked-list-cycle",
    "linked-list-cycle-ii",
    "intersection-of-two-linked-lists",
    "palindrome-linked-list",
    "copy-list-with-random-pointer",
    "lru-cache",
    "sort-list",
    "reorder-list",
    # Tree
    "binary-tree-inorder-traversal",
    "binary-tree-preorder-traversal",
    "binary-tree-postorder-traversal",
    "binary-tree-level-order-traversal",
    "binary-tree-level-order-traversal-ii",
    "binary-tree-zigzag-level-order-traversal",
    "maximum-depth-of-binary-tree",
    "minimum-depth-of-binary-tree",
    "balanced-binary-tree",
    "same-tree",
    "symmetric-tree",
    "invert-binary-tree",
    "path-sum",
    "path-sum-ii",
    "binary-tree-maximum-path-sum",
    "lowest-common-ancestor-of-a-binary-tree",
    "lowest-common-ancestor-of-a-binary-search-tree",
    "validate-binary-search-tree",
    "serialize-and-deserialize-binary-tree",
    "construct-binary-tree-from-preorder-and-inorder-traversal",
    "construct-binary-tree-from-inorder-and-postorder-traversal",
    "populating-next-right-pointers-in-each-node",
    "diameter-of-binary-tree",
    "flatten-binary-tree-to-linked-list",
    "count-complete-tree-nodes",
    "binary-search-tree-iterator",
    # BST
    "insert-into-a-binary-search-tree",
    "delete-node-in-a-bst",
    "kth-smallest-element-in-a-bst",
    "recover-binary-search-tree",
    "unique-binary-search-trees",
    "unique-binary-search-trees-ii",
    # Dynamic Programming
    "climbing-stairs",
    "house-robber",
    "house-robber-ii",
    "coin-change",
    "coin-change-ii",
    "longest-increasing-subsequence",
    "edit-distance",
    "longest-common-subsequence",
    "word-break",
    "partition-equal-subset-sum",
    "target-sum",
    "ones-and-zeroes",
    "maximum-product-subarray",
    "jump-game",
    "jump-game-ii",
    "unique-paths",
    "unique-paths-ii",
    "minimum-path-sum",
    "triangle",
    "maximal-square",
    "maximal-rectangle",
    "palindrome-partitioning",
    "palindromic-substrings",
    "longest-palindromic-substring",
    "burst-balloons",
    "regular-expression-matching",
    "wildcard-matching",
    "interleaving-string",
    "decode-ways",
    "perfect-squares",
    # Graph / BFS / DFS
    "number-of-islands",
    "clone-graph",
    "course-schedule",
    "course-schedule-ii",
    "number-of-provinces",
    "word-ladder",
    "word-ladder-ii",
    "surrounded-regions",
    "pacific-atlantic-water-flow",
    "redundant-connection",
    "graph-valid-tree",
    "network-delay-time",
    "cheapest-flights-within-k-stops",
    "reconstruct-itinerary",
    "find-the-town-judge",
    # Backtracking
    "subsets",
    "subsets-ii",
    "permutations",
    "permutations-ii",
    "combinations",
    "combination-sum",
    "combination-sum-ii",
    "combination-sum-iii",
    "letter-combinations-of-a-phone-number",
    "n-queens",
    "n-queens-ii",
    "sudoku-solver",
    "word-search",
    "word-search-ii",
    "generate-parentheses",
    "restore-ip-addresses",
    # Greedy
    "jump-game",
    "task-scheduler",
    "partition-labels",
    "non-overlapping-intervals",
    "meeting-rooms",
    "meeting-rooms-ii",
    "gas-station",
    "candy",
    "lemonade-change",
    # Stack / Queue / Monotone Stack
    "valid-parentheses",
    "min-stack",
    "daily-temperatures",
    "largest-rectangle-in-histogram",
    "trapping-rain-water",
    "basic-calculator",
    "basic-calculator-ii",
    "evaluate-reverse-polish-notation",
    "decode-string",
    "remove-k-digits",
    "next-greater-element-i",
    "next-greater-element-ii",
    "sum-of-subarray-minimums",
    # Binary Search
    "binary-search",
    "search-a-2d-matrix",
    "find-peak-element",
    "find-minimum-in-rotated-sorted-array",
    "search-in-rotated-sorted-array",
    "first-bad-version",
    "sqrtx",
    "median-of-two-sorted-arrays",
    "kth-largest-element-in-an-array",
    "find-k-th-smallest-pair-distance",
    "split-array-largest-sum",
    # Heap
    "kth-largest-element-in-an-array",
    "top-k-frequent-elements",
    "top-k-frequent-words",
    "find-median-from-data-stream",
    "sliding-window-maximum",
    "ugly-number-ii",
    "k-closest-points-to-origin",
    # String
    "longest-common-prefix",
    "valid-anagram",
    "group-anagrams",
    "encode-and-decode-strings",
    "palindrome-number",
    "reverse-words-in-a-string",
    "longest-repeating-character-replacement",
    "minimum-window-substring",
    "implement-strstr",
    "count-and-say",
    # Hash Table / Design
    "two-sum",
    "happy-number",
    "contains-duplicate",
    "intersection-of-two-arrays",
    "first-missing-positive",
    "majority-element",
    "missing-number",
    "single-number",
    "lru-cache",
    "time-based-key-value-store",
    # Math / Bit Manipulation
    "number-of-1-bits",
    "counting-bits",
    "reverse-bits",
    "missing-number",
    "sum-of-two-integers",
    "power-of-two",
    "power-of-three",
    "palindrome-number",
    "excel-sheet-column-number",
    "roman-to-integer",
    "integer-to-roman",
    # Trie
    "implement-trie-prefix-tree",
    "design-add-and-search-words-data-structure",
    "word-search-ii",
    # Union Find
    "number-of-provinces",
    "redundant-connection",
    "accounts-merge",
    "number-of-islands",
]

# 去重
TOP_200_SLUGS = list(dict.fromkeys(TOP_200_SLUGS))

GRAPHQL_URL = "https://leetcode.cn/graphql"

SOLUTIONS_QUERY = """
query communitySolutions($titleSlug: String!, $skip: Int, $first: Int) {
  questionSolutionArticles(
    questionSlug: $titleSlug
    skip: $skip
    first: $first
  ) {
    totalNum
    edges {
      node {
        slug
        title
        content
        tags {
          name
          slug
        }
        author {
          username
        }
        upvoteCount
        createdAt
      }
    }
  }
}
"""

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]


@dataclass
class CrawlStats:
    """爬取统计"""
    total_problems: int = 0
    success: int = 0
    failed: int = 0
    skipped: int = 0
    total_solutions: int = 0
    start_time: float = field(default_factory=time.time)

    @property
    def elapsed(self) -> str:
        s = int(time.time() - self.start_time)
        return f"{s // 60}m{s % 60}s"


def pre_score_solution(content: str, vote_count: int) -> float:
    """对题解内容进行质量预评分 (0-1)"""
    score = 0.0

    # 字数（200-5000 字为佳）
    word_count = len(content)
    if 200 <= word_count <= 5000:
        score += 0.25
    elif word_count > 100:
        score += 0.10

    # 有代码块
    if "```" in content or "<code>" in content:
        score += 0.25

    # 有图片或 ASCII 图
    if "![" in content or ("```\n" in content and "─" in content):
        score += 0.10

    # 点赞数（对数归一化）
    if vote_count > 0:
        score += min(0.30, math.log10(vote_count + 1) / 4)

    # 有复杂度分析
    if "O(" in content or "时间复杂度" in content or "Time Complexity" in content:
        score += 0.10

    return min(1.0, score)


def detect_approach_tag(content: str, tags: list[dict]) -> str | None:
    """从题解 tags 和内容中识别解法标签"""
    if tags:
        slug = tags[0].get("slug", "")
        if slug:
            return slug[:50]
    # 内容关键词推断
    content_lower = content.lower()
    if "哈希" in content or "hash" in content_lower:
        return "hash"
    if "动态规划" in content or "dp" in content_lower:
        return "dp"
    if "双指针" in content or "two pointer" in content_lower:
        return "two-pointer"
    if "二分" in content or "binary search" in content_lower:
        return "binary-search"
    if "回溯" in content or "backtrack" in content_lower:
        return "backtracking"
    if "贪心" in content or "greedy" in content_lower:
        return "greedy"
    if "栈" in content or "stack" in content_lower:
        return "stack"
    if "bfs" in content_lower or "广度优先" in content:
        return "bfs"
    if "dfs" in content_lower or "深度优先" in content:
        return "dfs"
    return None


async def fetch_solutions(
    client: httpx.AsyncClient,
    slug: str,
    top_n: int = 10,
    min_votes: int = 20,
) -> list[dict[str, Any]]:
    """爬取单题高赞题解

    Args:
        client: 复用的 httpx 客户端
        slug: 题目 titleSlug
        top_n: 最多取前 N 条
        min_votes: 最低点赞数过滤

    Returns:
        题解数据列表（已过滤低质量）
    """
    variables = {
        "titleSlug": slug,
        "skip": 0,
        "first": top_n,
    }
    headers = {
        "Content-Type": "application/json",
        "Referer": f"https://leetcode.cn/problems/{slug}/solutions/",
        "Origin": "https://leetcode.cn",
        "User-Agent": random.choice(USER_AGENTS),
    }
    cookie = os.getenv("LEETCODE_COOKIE", "")
    if cookie:
        headers["Cookie"] = cookie

    for attempt in range(1, 4):  # 最多重试 3 次
        try:
            resp = await client.post(
                GRAPHQL_URL,
                json={"query": SOLUTIONS_QUERY, "variables": variables},
                headers=headers,
                timeout=30,
            )
            resp.raise_for_status()
            # 某些情况 LeetCode 返回 HTML（限流/重定向），需检测
            content_type = resp.headers.get("content-type", "")
            if "json" not in content_type:
                wait = attempt * 8 + random.uniform(3, 8)
                logger.warning(
                    f"[{slug}] 第 {attempt}/3 次：返回非 JSON (可能被限流)，"
                    f"等待 {wait:.0f}s 后重试"
                )
                await asyncio.sleep(wait)
                continue
            data = resp.json()
            break
        except httpx.HTTPStatusError as e:
            logger.warning(f"[{slug}] HTTP {e.response.status_code}，跳过")
            return []
        except Exception as e:
            if attempt < 3:
                logger.warning(f"[{slug}] 第 {attempt}/3 次请求异常: {e}，{attempt * 3}s 后重试")
                await asyncio.sleep(attempt * 3)
                continue
            logger.warning(f"[{slug}] 请求失败: {e}")
            return []
    else:
        logger.warning(f"[{slug}] 重试 3 次均失败")
        return []

    articles = data.get("data", {}).get("questionSolutionArticles") or {}
    edges = articles.get("edges") or []

    solutions = []
    for edge in edges:
        node = edge.get("node", {})
        content = node.get("content", "") or ""
        vote_count = node.get("upvoteCount", 0) or 0

        # 过滤：太短或点赞数不够
        if len(content) < 150 or vote_count < min_votes:
            continue

        content_hash = hashlib.sha256(content.encode()).hexdigest()
        tags = node.get("tags") or []

        solutions.append({
            "id": str(uuid.uuid4()),
            "problem_id": slug,          # 用 slug 作为 problem_id
            "topic_id": node.get("slug", ""),
            "title": node.get("title", ""),
            "content": content,
            "author": (node.get("author") or {}).get("username", ""),
            "vote_count": vote_count,
            "view_count": 0,
            "comment_count": 0,
            "source": "leetcode-cn",
            "platform": "leetcode-cn",
            "source_url": f"https://leetcode.cn/problems/{slug}/solutions/{node.get('slug', '')}/",
            "crawl_quality": pre_score_solution(content, vote_count),
            "content_hash": content_hash,
            "approach_tag": detect_approach_tag(content, tags),
            "crawled_at": int(time.time() * 1000),
            "created_at": int(time.time() * 1000),
            "fetched_at": int(time.time() * 1000),
        })

    return solutions


async def save_solutions_to_db(
    solutions: list[dict[str, Any]],
    db_config: dict[str, str],
) -> int:
    """批量写入 crawled_solutions 表，已存在则跳过（按 content_hash 去重）

    策略：
    1. 先查 problems 表，找到 slug 对应的真实 problem_id（可能是 lc-XXX 或 slug 本身）
    2. 用真实 problem_id 存入，确保 Pipeline 能通过 problemId 查到素材
    3. 同时记录 source_url 中包含 slug 信息，便于溯源

    Returns:
        实际写入数量
    """
    import aiomysql

    saved = 0
    async with aiomysql.connect(**db_config) as conn:
        async with conn.cursor() as cur:

            # 批量查询 slug → real problem_id 的映射
            # problems 表里 id 可能是 'lc-1' 或 'two-sum'，title 匹配 slug
            slug_to_pid: dict[str, str] = {}
            if solutions:
                slugs = list({s["problem_id"] for s in solutions})
                # 先尝试直接用 slug 作为 id 查
                for slug in slugs:
                    await cur.execute(
                        "SELECT id FROM problems WHERE id = %s LIMIT 1", (slug,)
                    )
                    row = await cur.fetchone()
                    if row:
                        slug_to_pid[slug] = row[0]
                        continue
                    # 再尝试用 title 匹配（slug 转 title 格式）
                    # slug: "container-with-most-water" → title: "Container With Most Water"
                    title_from_slug = " ".join(w.capitalize() for w in slug.replace("-", " ").split())
                    await cur.execute(
                        "SELECT id FROM problems WHERE title = %s LIMIT 1",
                        (title_from_slug,)
                    )
                    row = await cur.fetchone()
                    if row:
                        slug_to_pid[slug] = row[0]
                        continue
                    # 再尝试用 title_slug 方式查（platform_mappings）
                    await cur.execute(
                        """SELECT pm.problem_id FROM platform_mappings pm
                           WHERE pm.platform_id = %s LIMIT 1""",
                        (slug,)
                    )
                    row = await cur.fetchone()
                    if row:
                        slug_to_pid[slug] = row[0]
                    else:
                        # 找不到映射，直接用 slug 本身（兜底）
                        slug_to_pid[slug] = slug

            for s in solutions:
                # 使用真实 problem_id
                real_pid = slug_to_pid.get(s["problem_id"], s["problem_id"])

                # 按 content_hash 去重
                await cur.execute(
                    "SELECT id FROM crawled_solutions WHERE content_hash = %s LIMIT 1",
                    (s["content_hash"],),
                )
                if await cur.fetchone():
                    continue  # 已存在，跳过

                await cur.execute(
                    """INSERT INTO crawled_solutions
                       (id, problem_id, topic_id, title, content, author,
                        vote_count, view_count, comment_count, source, platform,
                        source_url, crawl_quality, content_hash, approach_tag,
                        crawled_at, created_at, fetched_at)
                       VALUES
                       (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (
                        s["id"], real_pid, s["topic_id"], s["title"],
                        s["content"], s["author"], s["vote_count"], s["view_count"],
                        s["comment_count"], s["source"], s["platform"],
                        s["source_url"], s["crawl_quality"], s["content_hash"],
                        s["approach_tag"], s["crawled_at"], s["created_at"],
                        s["fetched_at"],
                    ),
                )
                saved += 1
        await conn.commit()
    return saved


async def main(
    limit: int = 200,
    min_votes: int = 20,
    top_n: int = 10,
    concurrency: int = 3,
    dry_run: bool = False,
) -> None:
    """批量爬取主流程"""
    db_config = {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "3306")),
        "db": os.getenv("DB_NAME", "algorithm_help"),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", ""),
        "charset": "utf8mb4",
        "autocommit": False,
    }

    slugs = TOP_200_SLUGS[:limit]
    stats = CrawlStats(total_problems=len(slugs))

    logger.info(f"开始批量爬取: {len(slugs)} 道题, concurrency={concurrency}, "
                f"min_votes={min_votes}, dry_run={dry_run}")

    semaphore = asyncio.Semaphore(concurrency)

    async def _process_one(slug: str) -> None:
        async with semaphore:
            # 随机延迟（保守策略避免限流：5-10 秒）
            await asyncio.sleep(random.uniform(5.0, 10.0))

            async with httpx.AsyncClient() as client:
                solutions = await fetch_solutions(client, slug, top_n, min_votes)

            if not solutions:
                logger.warning(f"[{slug}] 无有效题解（可能无公开题解或点赞数不足）")
                stats.failed += 1
                return

            if dry_run:
                logger.info(f"[DRY-RUN] [{slug}] 获取 {len(solutions)} 条题解")
                stats.success += 1
                stats.total_solutions += len(solutions)
                return

            try:
                saved = await save_solutions_to_db(solutions, db_config)
                stats.success += 1
                stats.total_solutions += saved
                logger.info(
                    f"[{slug}] 爬取 {len(solutions)} 条，写入 {saved} 条"
                    f"（新增，重复跳过 {len(solutions) - saved} 条）"
                )
            except Exception as e:
                logger.error(f"[{slug}] 写入 DB 失败: {e}")
                stats.failed += 1

    # 并发执行
    await asyncio.gather(*[_process_one(slug) for slug in slugs])

    logger.info(
        f"批量爬取完成 | 耗时: {stats.elapsed} | "
        f"成功: {stats.success}/{stats.total_problems} | "
        f"失败: {stats.failed} | "
        f"总写入题解: {stats.total_solutions}"
    )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="批量爬取 LeetCode Top N 高频题题解")
    parser.add_argument("--limit", type=int, default=200, help="爬取题目数量（默认200）")
    parser.add_argument("--min-votes", type=int, default=20, help="最低点赞数过滤（默认20）")
    parser.add_argument("--top-n", type=int, default=10, help="每题最多取前 N 条（默认10）")
    parser.add_argument("--concurrency", type=int, default=3, help="并发协程数（默认3）")
    parser.add_argument("--dry-run", action="store_true", help="只爬取不写入 DB")
    args = parser.parse_args()

    asyncio.run(main(
        limit=args.limit,
        min_votes=args.min_votes,
        top_n=args.top_n,
        concurrency=args.concurrency,
        dry_run=args.dry_run,
    ))
