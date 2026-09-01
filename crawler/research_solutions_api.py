"""
探测 LeetCode 当前的题解 API 格式
通过 introspection 和多种参数组合找到正确的 GraphQL schema
"""
import asyncio
import sys

sys.path.insert(0, "src")

import httpx

GRAPHQL_URL = "https://leetcode.com/graphql"
BASE_URL = "https://leetcode.com"

HEADERS = {
    "Content-Type": "application/json",
    "Referer": BASE_URL,
    "Origin": BASE_URL,
}


async def try_query(client, name, query, variables):
    """尝试一个 GraphQL 查询并打印结果"""
    print(f"\n--- {name} ---")
    resp = await client.post(GRAPHQL_URL, json={"query": query, "variables": variables})
    if resp.status_code != 200:
        print(f"  HTTP {resp.status_code}")
        return None

    data = resp.json()
    if "errors" in data:
        errors = data["errors"]
        for e in errors[:2]:
            print(f"  ❌ {e.get('message', '')[:120]}")
        return None

    print(f"  ✅ 成功!")
    return data


async def main():
    async with httpx.AsyncClient(headers=HEADERS, timeout=30.0) as client:
        # 1. 尝试 introspection 查询 questionSolutions 字段的参数
        print("=" * 60)
        print("探测 questionSolutions 字段参数")
        print("=" * 60)

        await try_query(client, "Introspection: questionSolutions args", """
{
    __type(name: "Query") {
        fields {
            name
            args { name type { name kind ofType { name } } }
        }
    }
}
""", {})

        # 2. 尝试新版 communityArticles / ugcArticles API
        print("\n" + "=" * 60)
        print("尝试新版题解 API")
        print("=" * 60)

        # 方案 A: questionTopicsList（discuss 论坛形式）
        await try_query(client, "questionTopicsList", """
query questionTopicsList($questionId: String!, $orderBy: TopicSortingOption, $skip: Int!, $query: String, $first: Int!, $tags: [String!]) {
    questionTopicsList(
        questionId: $questionId
        orderBy: $orderBy
        skip: $skip
        query: $query
        first: $first
        tags: $tags
    ) {
        totalNum
        edges {
            node {
                id
                title
                viewCount
                voteCount
                post { content author { username } creationDate }
            }
        }
    }
}
""", {
            "questionId": "1",  # Two Sum 的 questionId
            "orderBy": "most_votes",
            "skip": 0,
            "first": 3,
            "query": "",
            "tags": [],
        })

        # 方案 B: ugcArticleSolutions
        await try_query(client, "ugcArticleSolutions (新版)", """
query ugcArticleSolutions($questionSlug: String!, $skip: Int!, $first: Int!, $orderBy: SolutionArticleOrderBy, $userInput: String, $tagSlugs: [String!]) {
    ugcArticleQuestionSolutions(
        questionSlug: $questionSlug
        skip: $skip
        first: $first
        orderBy: $orderBy
        userInput: $userInput
        tagSlugs: $tagSlugs
    ) {
        totalNum
        solutions {
            uuid
            title
            slug
            summary
            author { username }
            voteCount
            createdAt
            topicTags { name slug }
        }
    }
}
""", {
            "questionSlug": "two-sum",
            "skip": 0,
            "first": 3,
            "orderBy": "HOT",
            "userInput": "",
            "tagSlugs": [],
        })

        # 方案 C: communitySolutions (不同参数名)
        await try_query(client, "communitySolutions (slug param)", """
query communitySolutions($questionSlug: String!, $skip: Int!, $first: Int!, $orderBy: TopicSortingOption) {
    questionSolutions: questionTopicsList(
        questionId: $questionSlug
        orderBy: $orderBy
        skip: $skip
        first: $first
        tags: [""]
    ) {
        totalNum
        edges {
            node { id title voteCount post { content author { username } } }
        }
    }
}
""", {
            "questionSlug": "1",
            "skip": 0,
            "first": 3,
            "orderBy": "most_votes",
        })

        # 方案 D: 直接用 questionId (数字) 的 questionTopicsList
        result = await try_query(client, "questionTopicsList (questionId=1 数字字符串)", """
query questionTopicsList($questionId: String!, $orderBy: TopicSortingOption, $skip: Int!, $first: Int!) {
    questionTopicsList(
        questionId: $questionId
        orderBy: $orderBy
        skip: $skip
        first: $first
    ) {
        totalNum
        edges {
            node {
                id
                title
                viewCount
                voteCount
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
""", {
            "questionId": "1",
            "orderBy": "most_votes",
            "skip": 0,
            "first": 3,
        })

        if result:
            topics = result.get("data", {}).get("questionTopicsList", {})
            total = topics.get("totalNum", 0)
            edges = topics.get("edges", [])
            print(f"  总计: {total} 条讨论/题解")
            for edge in edges[:3]:
                node = edge.get("node", {})
                post = node.get("post", {})
                print(f"    - {node.get('title', '?')} (votes={node.get('voteCount', 0)}, author={post.get('author', {}).get('username', '?')})")
                content = post.get("content", "")
                if content:
                    print(f"      内容前80字: {content[:80]}...")


if __name__ == "__main__":
    asyncio.run(main())
