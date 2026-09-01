"""探测 LeetCode 新版题解 + 评论 API"""
import asyncio
import httpx

GRAPHQL_URL = "https://leetcode.com/graphql"
HEADERS = {
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com",
    "Origin": "https://leetcode.com",
}

QUERIES = [
    # LeetCode 2024 新版：题目讨论区（Solutions Tab 底层）
    ("questionDiscussionTopics (discuss)", """
query questionDiscussionTopics($topicId: Int!, $orderBy: String, $pageNo: Int, $numPerPage: Int) {
    topicComments(topicId: $topicId, orderBy: $orderBy, pageNo: $pageNo, numPerPage: $numPerPage) {
        data {
            id
            post { content voteCount author { username } }
        }
    }
}
""", {"topicId": 127810, "orderBy": "best", "pageNo": 1, "numPerPage": 3}),

    # LeetCode Solutions Tab 列表（2025最新）
    ("questionSolutionArticles", """
query questionSolutionArticles($questionSlug: String!, $skip: Int!, $first: Int!, $orderBy: SolutionArticleOrderBy!, $userInput: String, $tagSlugs: [String!]) {
    questionSolutionArticles(questionSlug: $questionSlug, skip: $skip, first: $first, orderBy: $orderBy, userInput: $userInput, tagSlugs: $tagSlugs) {
        totalNum
        edges {
            node {
                uuid
                title
                slug
                summary
                solutionTags { name slug }
                author { username }
                voteCount
                createdAt
                isOfficialSolution
            }
        }
    }
}
""", {"questionSlug": "two-sum", "skip": 0, "first": 5, "orderBy": "DEFAULT", "userInput": "", "tagSlugs": []}),

    # 单个题解文章详情
    ("solutionArticleContent", """
query solutionArticleContent($slug: String!) {
    solutionArticle(slug: $slug) {
        uuid
        title
        content
        author { username }
        voteCount
        createdAt
        solutionTags { name }
    }
}
""", {"slug": "two-sum"}),  # 占位，实际需要题解 slug

    # 官方题解
    ("officialSolution", """
query officialSolution($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
        solution {
            id
            content
            contentTypeId
            paidOnly
        }
    }
}
""", {"titleSlug": "two-sum"}),

    # 评论区
    ("questionDiscussComments (discuss comments)", """
query discussComments($topicId: Int!, $orderBy: String, $pageNo: Int, $numPerPage: Int) {
    topicComments(topicId: $topicId, orderBy: $orderBy, pageNo: $pageNo, numPerPage: $numPerPage) {
        data {
            id
            post {
                content
                voteCount
                author { username }
                creationDate
            }
        }
    }
}
""", {"topicId": 127810, "orderBy": "best", "pageNo": 1, "numPerPage": 5}),
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
                        print(f"  ❌ {e.get('message', '')[:100]}")
                else:
                    print(f"  ✅ 成功!")
                    # 打印精简结果
                    d = data.get("data", {})
                    print(f"  数据: {str(d)[:300]}")
            else:
                print(f"  响应: {resp.text[:200]}")


if __name__ == "__main__":
    asyncio.run(main())
