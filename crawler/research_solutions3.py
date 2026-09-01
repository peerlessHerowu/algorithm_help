"""探测题解列表 API - 基于错误提示线索"""
import asyncio
import httpx

GRAPHQL_URL = "https://leetcode.com/graphql"
HEADERS = {
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com",
    "Origin": "https://leetcode.com",
}

QUERIES = [
    # 基于错误提示 "ugcArticleSolution" 尝试
    ("ugcArticleQuestionSolutions (list)", """
query ugcArticleQuestionSolutions($questionSlug: String!, $skip: Int!, $first: Int!, $orderBy: String!) {
    ugcArticleQuestionSolutions(questionSlug: $questionSlug, skip: $skip, first: $first, orderBy: $orderBy) {
        totalNum
        edges {
            node { uuid title slug summary author { username } voteCount createdAt }
        }
    }
}
""", {"questionSlug": "two-sum", "skip": 0, "first": 5, "orderBy": "DEFAULT"}),

    # 尝试不同 orderBy 类型
    ("ugcArticleQuestionSolutions (no orderBy type)", """
query ugcArticleQuestionSolutions($questionSlug: String!, $skip: Int!, $first: Int!) {
    ugcArticleQuestionSolutions(questionSlug: $questionSlug, skip: $skip, first: $first) {
        totalNum
        edges {
            node { uuid title slug summary author { username } voteCount createdAt }
        }
    }
}
""", {"questionSlug": "two-sum", "skip": 0, "first": 5}),

    # 单个题解详情
    ("ugcArticleSolutionArticle (detail)", """
query ugcArticleSolutionArticle($slug: String!) {
    ugcArticleSolutionArticle(slug: $slug) {
        uuid
        title
        content
        summary
        author { username }
        voteCount
        createdAt
        solutionTags { name slug }
    }
}
""", {"slug": "two-sum-hash-table-approach"}),  # 猜测的 slug

    # 用 userSolutionTopics 查题解
    ("userSolutionTopics", """
query userSolutionTopics($questionSlug: String!, $first: Int!, $skip: Int!, $orderBy: TopicSortingOption) {
    userSolutionTopics(questionSlug: $questionSlug, first: $first, skip: $skip, orderBy: $orderBy) {
        totalNum
        edges {
            node { id title viewCount voteCount post { content author { username } creationDate } topicTags { name } }
        }
    }
}
""", {"questionSlug": "two-sum", "first": 5, "skip": 0, "orderBy": "most_votes"}),

    # questionTopicsList 用 questionId
    ("questionTopicsList with tags=solution", """
query questionTopicsList($questionId: String!, $first: Int!, $skip: Int!, $orderBy: TopicSortingOption, $tags: [String!]) {
    questionTopicsList(questionId: $questionId, first: $first, skip: $skip, orderBy: $orderBy, tags: $tags) {
        totalNum
        edges {
            node { id title viewCount voteCount post { content author { username } creationDate } topicTags { name } }
        }
    }
}
""", {"questionId": "1", "first": 5, "skip": 0, "orderBy": "most_votes", "tags": ["solution"]}),
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
                    for e in data["errors"][:2]:
                        print(f"  ❌ {e.get('message', '')[:150]}")
                else:
                    print(f"  ✅ 成功!")
                    d = data.get("data", {})
                    print(f"  数据: {str(d)[:400]}")
            else:
                errors = resp.json().get("errors", [])
                for e in errors[:2]:
                    print(f"  ❌ {e.get('message', '')[:150]}")


if __name__ == "__main__":
    asyncio.run(main())
