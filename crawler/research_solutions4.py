"""基于错误提示修正字段名，最终验证"""
import asyncio
import httpx

GRAPHQL_URL = "https://leetcode.com/graphql"
HEADERS = {
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com",
    "Origin": "https://leetcode.com",
}

QUERIES = [
    # 修正后的 questionTopicsList（去掉 voteCount 和 topicTags）
    ("questionTopicsList (fixed)", """
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
                    creationDate
                }
            }
        }
    }
}
""", {"questionId": "1", "first": 5, "skip": 0, "orderBy": "most_votes"}),

    # 修正后的 ugcArticleSolutionArticle（用 userName 而非 username）
    ("ugcArticleSolutionArticle (fixed fields)", """
query ugcArticleSolutionArticle($slug: String!) {
    ugcArticleSolutionArticle(slug: $slug) {
        uuid
        title
        content
        summary
        hitCount
        createdAt
        author { userName userSlug }
        solutionTags { name slug }
    }
}
""", {"slug": "two-sum-hash-table-approach-oxvjmx"}),
]


async def main():
    async with httpx.AsyncClient(headers=HEADERS, timeout=30.0) as client:
        for name, query, variables in QUERIES:
            print(f"\n{'='*50}")
            print(f"  {name}")
            print(f"{'='*50}")
            resp = await client.post(GRAPHQL_URL, json={"query": query, "variables": variables})
            print(f"  HTTP {resp.status_code}")

            if resp.status_code == 200:
                data = resp.json()
                if "errors" in data:
                    for e in data["errors"][:3]:
                        print(f"  ❌ {e.get('message', '')[:150]}")
                else:
                    print(f"  ✅ 成功!")
                    d = data.get("data", {})
                    # 格式化打印
                    import json
                    print(f"  {json.dumps(d, indent=2, ensure_ascii=False)[:600]}")
            else:
                errors = resp.json().get("errors", [])
                for e in errors[:3]:
                    print(f"  ❌ {e.get('message', '')[:150]}")


if __name__ == "__main__":
    asyncio.run(main())
