"""
调研 LeetCode 付费题（Premium）爬取可行性

测试内容：
1. 无 Cookie 时请求付费题详情（预期返回空 content）
2. 有 Cookie 时请求付费题详情（需要有效的 LEETCODE_SESSION）
3. 分析 GraphQL 返回结构中哪些字段被付费限制

结论会写入 docs/ 目录
"""
import asyncio
import json
import sys

sys.path.insert(0, "src")

import httpx

GRAPHQL_URL = "https://leetcode.com/graphql"
BASE_URL = "https://leetcode.com"

# 已知的付费题 slug 列表（用于测试）
PREMIUM_SLUGS = [
    "two-sum-ii-input-array-is-sorted",  # 不是付费题，作为对照
    "meeting-rooms",                      # Premium
    "missing-ranges",                     # Premium
    "longest-substring-with-at-most-two-distinct-characters",  # Premium
]

_QUERY_DETAIL = """
query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
        questionId
        questionFrontendId
        title
        titleSlug
        content
        difficulty
        isPaidOnly
        topicTags { name }
        hints
        stats
    }
}
"""

_QUERY_SOLUTIONS = """
query communityQuestionSolutions($questionSlug: String!, $skip: Int!, $first: Int!, $orderBy: TopicSortingOption) {
    questionSolutions(
        questionSlug: $questionSlug
        skip: $skip
        first: $first
        orderBy: $orderBy
    ) {
        totalNum
        solutions {
            id
            title
            voteCount
            content
            author { username }
        }
    }
}
"""


async def test_without_cookie():
    """无 Cookie 测试：付费题 content 是否为空"""
    print("=" * 60)
    print("Test 1: 无 Cookie 请求付费题")
    print("=" * 60)

    headers = {
        "Content-Type": "application/json",
        "Referer": BASE_URL,
        "Origin": BASE_URL,
    }

    async with httpx.AsyncClient(headers=headers, timeout=30.0) as client:
        for slug in PREMIUM_SLUGS:
            resp = await client.post(
                GRAPHQL_URL,
                json={"query": _QUERY_DETAIL, "variables": {"titleSlug": slug}},
            )
            data = resp.json()
            question = data.get("data", {}).get("question", {})

            if not question:
                print(f"  ❌ {slug}: 返回为空（可能 slug 不存在或需要登录）")
                continue

            content = question.get("content")
            is_paid = question.get("isPaidOnly")
            title = question.get("title", "?")

            content_preview = content[:80] if content else "(null/empty)"
            print(f"  {'🔒' if is_paid else '🆓'} [{question.get('questionFrontendId')}] {title}")
            print(f"     isPaidOnly={is_paid}")
            print(f"     content: {content_preview}")
            print()


async def test_solutions_api():
    """测试题解 API（之前报 400 的原因调查）"""
    print("=" * 60)
    print("Test 2: 题解 API 调试")
    print("=" * 60)

    headers = {
        "Content-Type": "application/json",
        "Referer": BASE_URL,
        "Origin": BASE_URL,
    }

    # 尝试不同的 GraphQL query 格式
    queries_to_try = [
        # 原始版本（之前 400）
        ("原始 communityQuestionSolutions", _QUERY_SOLUTIONS, {
            "questionSlug": "two-sum",
            "skip": 0,
            "first": 3,
            "orderBy": "most_votes",
        }),
        # 简化版本
        ("简化版 questionSolutions", """
query ($questionSlug: String!, $skip: Int!, $first: Int!, $orderBy: TopicSortingOption) {
    questionSolutions(questionSlug: $questionSlug, skip: $skip, first: $first, orderBy: $orderBy) {
        totalNum
        solutions { id title voteCount }
    }
}
""", {
            "questionSlug": "two-sum",
            "skip": 0,
            "first": 3,
            "orderBy": "most_votes",
        }),
        # discussQuestionTopicSolutions（新版 API 可能用这个）
        ("discussQuestionTopicSolutions", """
query discussQuestionTopicSolutions($questionSlug: String!, $skip: Int!, $first: Int!, $orderBy: TopicSortingOption) {
    ugcArticleOfficialSolutionArticle(questionSlug: $questionSlug) {
        uuid
    }
    questionSolutions(questionSlug: $questionSlug, skip: $skip, first: $first, orderBy: $orderBy) {
        totalNum
        solutions { id title voteCount content }
    }
}
""", {
            "questionSlug": "two-sum",
            "skip": 0,
            "first": 3,
            "orderBy": "most_votes",
        }),
    ]

    async with httpx.AsyncClient(headers=headers, timeout=30.0) as client:
        for name, query, variables in queries_to_try:
            print(f"\n  尝试: {name}")
            resp = await client.post(
                GRAPHQL_URL,
                json={"query": query, "variables": variables},
            )
            print(f"    状态码: {resp.status_code}")
            if resp.status_code == 200:
                data = resp.json()
                if "errors" in data:
                    print(f"    GraphQL 错误: {data['errors'][:2]}")
                else:
                    sols = data.get("data", {}).get("questionSolutions", {})
                    total = sols.get("totalNum", 0)
                    solutions = sols.get("solutions", [])
                    print(f"    ✅ 成功！总计 {total} 条题解，返回 {len(solutions)} 条")
                    for s in solutions[:2]:
                        print(f"       - {s.get('title', '?')} (votes={s.get('voteCount', 0)})")
            else:
                print(f"    ❌ 响应: {resp.text[:200]}")


async def test_with_cookie():
    """有 Cookie 测试（如果环境变量中有 LEETCODE_SESSION）"""
    import os
    session = os.environ.get("LEETCODE_SESSION", "")
    csrf = os.environ.get("LEETCODE_CSRF", "")

    if not session:
        print("\n" + "=" * 60)
        print("Test 3: 有 Cookie 测试 —— 跳过（未设置 LEETCODE_SESSION 环境变量）")
        print("=" * 60)
        print("  提示：设置 LEETCODE_SESSION=<your cookie> 再运行")
        print("  获取方式：浏览器登录 leetcode.com → F12 → Application → Cookies → LEETCODE_SESSION")
        return

    print("\n" + "=" * 60)
    print("Test 3: 有 Cookie 测试付费题")
    print("=" * 60)

    cookies = f"LEETCODE_SESSION={session}"
    if csrf:
        cookies += f"; csrftoken={csrf}"

    headers = {
        "Content-Type": "application/json",
        "Referer": BASE_URL,
        "Origin": BASE_URL,
        "Cookie": cookies,
    }
    if csrf:
        headers["x-csrftoken"] = csrf

    async with httpx.AsyncClient(headers=headers, timeout=30.0) as client:
        for slug in ["meeting-rooms", "missing-ranges"]:
            resp = await client.post(
                GRAPHQL_URL,
                json={"query": _QUERY_DETAIL, "variables": {"titleSlug": slug}},
            )
            data = resp.json()
            question = data.get("data", {}).get("question", {})
            if question:
                content = question.get("content", "")
                print(f"  🔑 {slug}: content长度={len(content) if content else 0}")
                if content:
                    print(f"     前100字: {content[:100]}...")
            else:
                print(f"  ❌ {slug}: 仍然为空")


async def main():
    await test_without_cookie()
    await test_solutions_api()
    await test_with_cookie()

    print("\n" + "=" * 60)
    print("总结")
    print("=" * 60)
    print("""
付费题爬取结论：
1. 无 Cookie：isPaidOnly=true 的题目 content 返回 null
2. 有 Cookie（Premium 账号）：可以正常获取 content
3. 方案：需要一个有效的 LeetCode Premium LEETCODE_SESSION Cookie
   - 从浏览器 F12 → Application → Cookies 中获取
   - 存入 Redis（已有 RedisCookieStore 支持）
   - Cookie 通常有效期 2 周，需定期更新
""")


if __name__ == "__main__":
    asyncio.run(main())
