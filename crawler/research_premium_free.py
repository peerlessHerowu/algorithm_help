"""
调研不用 Premium 账号获取付费题内容的方案

方案汇总：
1. GitHub 开源数据集（AkashSingh3031/Complete-LeetCode-Premium-Problems）
2. LintCode 等平台的同题映射（很多 LC Premium 题在 LintCode 免费）
3. 力扣中国站（leetcode.cn）— 可能不需要 Premium 看部分内容
4. 社区讨论区中的题目描述还原（免费用户也能看 Discuss）
"""
import asyncio
import httpx


async def test_leetcode_cn():
    """测试力扣中国站是否能免费获取付费题"""
    print("=" * 60)
    print("方案 1: 力扣中国站（leetcode.cn）")
    print("=" * 60)

    # 力扣中国站 GraphQL
    url = "https://leetcode.cn/graphql"
    headers = {
        "Content-Type": "application/json",
        "Referer": "https://leetcode.cn",
        "Origin": "https://leetcode.cn",
    }

    # Meeting Rooms 在中国站的 slug
    premium_slugs = [
        "meeting-rooms",       # LC 252 Premium
        "missing-ranges",      # LC 163 Premium
        "palindrome-permutation",  # LC 266 Premium
    ]

    query = """
query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
        questionId
        title
        titleSlug
        translatedTitle
        translatedContent
        difficulty
        isPaidOnly
        topicTags { name translatedName }
    }
}
"""

    async with httpx.AsyncClient(headers=headers, timeout=30.0) as client:
        for slug in premium_slugs:
            resp = await client.post(url, json={"query": query, "variables": {"titleSlug": slug}})
            if resp.status_code == 200:
                data = resp.json()
                q = data.get("data", {}).get("question")
                if q:
                    content = q.get("translatedContent") or ""
                    title = q.get("translatedTitle") or q.get("title", "?")
                    paid = q.get("isPaidOnly")
                    print(f"  {'🔒' if paid else '🆓'} {title}")
                    print(f"     isPaidOnly={paid}")
                    print(f"     translatedContent 长度={len(content)}")
                    if content:
                        print(f"     前80字: {content[:80]}...")
                else:
                    print(f"  ❌ {slug}: question 为 null")
            else:
                print(f"  ❌ {slug}: HTTP {resp.status_code}")
            print()


async def test_github_dataset():
    """测试 GitHub 开源 Premium 题目数据集"""
    print("=" * 60)
    print("方案 2: GitHub 开源数据集")
    print("=" * 60)

    # AkashSingh3031/Complete-LeetCode-Premium-Problems
    # 检查仓库结构
    api_url = "https://api.github.com/repos/AkashSingh3031/Complete-LeetCode-Premium-Problems/contents"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(api_url)
        if resp.status_code == 200:
            items = resp.json()
            dirs = [i["name"] for i in items if i["type"] == "dir"]
            print(f"  仓库根目录: {dirs[:10]}...")
            print(f"  总目录数: {len(dirs)}")

            # 尝试获取一个具体题目
            if dirs:
                # 查找包含 "Meeting" 的目录
                target = next((d for d in dirs if "Meeting" in d or "252" in d), dirs[0])
                detail_url = f"{api_url}/{target}"
                resp2 = await client.get(detail_url)
                if resp2.status_code == 200:
                    files = resp2.json()
                    print(f"\n  示例目录 '{target}':")
                    for f in files[:5]:
                        print(f"    - {f['name']} ({f.get('size', '?')} bytes)")
        else:
            print(f"  ❌ GitHub API: HTTP {resp.status_code}")
            print(f"     可能被 rate limit（未认证每小时 60 次）")


async def test_lintcode_mapping():
    """测试 LintCode 平台同题映射"""
    print("\n" + "=" * 60)
    print("方案 3: LintCode 同题免费访问")
    print("=" * 60)

    # LintCode API（很多 LC Premium 题在 LintCode 免费）
    # LintCode 的搜索 API
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 搜索 "meeting rooms"
        resp = await client.get(
            "https://www.lintcode.com/api/problems/",
            params={"search": "meeting rooms", "page": 1, "limit": 5},
        )
        print(f"  LintCode API 状态: HTTP {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            problems = data.get("data", {}).get("problems", data.get("problems", []))
            if problems:
                print(f"  找到 {len(problems)} 个结果:")
                for p in problems[:3]:
                    print(f"    - {p.get('title', '?')} (难度={p.get('difficulty', '?')})")
            else:
                print(f"  响应结构: {list(data.keys())[:5]}")
                print(f"  前200字: {str(data)[:200]}")
        else:
            print(f"  响应: {resp.text[:200]}")


async def test_discuss_content():
    """测试从讨论区还原付费题描述"""
    print("\n" + "=" * 60)
    print("方案 4: 从讨论区/题解中还原付费题描述")
    print("=" * 60)

    # 即使是付费题，讨论区（Solutions Tab）是所有用户可见的
    # 很多高赞题解会在开头引用题目描述
    headers = {
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com",
        "Origin": "https://leetcode.com",
    }

    # Meeting Rooms 的 questionId = 252
    query = """
query questionTopicsList($questionId: String!, $first: Int!, $skip: Int!, $orderBy: TopicSortingOption) {
    questionTopicsList(questionId: $questionId, first: $first, skip: $skip, orderBy: $orderBy) {
        totalNum
        edges {
            node {
                id
                title
                viewCount
                commentCount
                post {
                    content
                    voteCount
                    author { username }
                }
            }
        }
    }
}
"""
    async with httpx.AsyncClient(headers=headers, timeout=30.0) as client:
        resp = await client.post(
            "https://leetcode.com/graphql",
            json={"query": query, "variables": {"questionId": "252", "first": 3, "skip": 0, "orderBy": "most_votes"}},
        )
        if resp.status_code == 200:
            data = resp.json()
            topics = data.get("data", {}).get("questionTopicsList", {})
            total = topics.get("totalNum", 0)
            edges = topics.get("edges", [])
            print(f"  Meeting Rooms (LC 252, Premium) 讨论区: {total} 条帖子")
            print(f"  说明: 即使是付费题，讨论区/题解仍可免费访问！")
            for edge in edges[:2]:
                node = edge.get("node", {})
                post = node.get("post", {})
                content = post.get("content", "")
                print(f"\n  📝 '{node.get('title', '?')}' (votes={post.get('voteCount', 0)})")
                print(f"     内容前150字: {content[:150]}...")
        else:
            print(f"  HTTP {resp.status_code}")


async def main():
    await test_leetcode_cn()
    await test_github_dataset()
    await test_lintcode_mapping()
    await test_discuss_content()

    print("\n" + "=" * 60)
    print("总结：不用 Premium 获取付费题的可行方案")
    print("=" * 60)
    print("""
✅ 方案 A: 力扣中国站（如果中国站该题免费则可获取中文翻译内容）
✅ 方案 B: GitHub 开源数据集（别人整理好的 Premium 题目全集）
✅ 方案 C: LintCode 同题映射（LC Premium 题在 LintCode 通常免费）
✅ 方案 D: 从讨论区高赞帖子还原题目描述（discuss tab 不受 Premium 限制）
⚠️ 方案 E: Premium Bypass 浏览器插件（灰色地带，不推荐用于爬虫）

推荐组合策略：
1. 先用 GitHub 数据集批量导入付费题目描述（最快、最全）
2. 讨论区/题解对所有题目（含付费）都可以正常采集（关键发现！）
3. 力扣中国站补充中文翻译
""")


if __name__ == "__main__":
    asyncio.run(main())
