"""
采集 LeetCode 高赞题解并写入数据库
使用已验证的 questionTopicsList API
每题采集前 10 条高赞题解
"""
import asyncio
import json
import sys
import time

sys.path.insert(0, "src")

import asyncmy
import httpx

DB_CONFIG = {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "password": "",
    "db": "algorithm_help",
}

GRAPHQL_URL = "https://leetcode.com/graphql"
HEADERS = {
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com",
    "Origin": "https://leetcode.com",
}

_QUERY_SOLUTIONS = """
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
"""


async def get_problems_with_question_id():
    """从数据库获取所有题目的 ID（用于关联题解）
    由于我们存的 id 是 'lc-{frontendId}'，需要用 frontendId 作为 questionId
    """
    conn = await asyncmy.connect(**DB_CONFIG)
    async with conn.cursor() as cur:
        await cur.execute("SELECT id, title FROM problems ORDER BY id LIMIT 200")
        rows = await cur.fetchall()
    conn.close()
    # 提取数字部分作为 questionId
    result = []
    for row in rows:
        pid = row[0]  # lc-1, lc-2, ...
        num = pid.replace("lc-", "")
        result.append({"problem_id": pid, "question_id": num, "title": row[1]})
    return result


async def fetch_solutions_for_problem(client, question_id, top_n=10):
    """采集单题的高赞题解"""
    try:
        resp = await client.post(
            GRAPHQL_URL,
            json={
                "query": _QUERY_SOLUTIONS,
                "variables": {
                    "questionId": question_id,
                    "first": top_n,
                    "skip": 0,
                    "orderBy": "most_votes",
                },
            },
        )
        if resp.status_code != 200:
            return []

        data = resp.json()
        if "errors" in data:
            return []

        topics = data.get("data", {}).get("questionTopicsList", {})
        edges = topics.get("edges", [])

        solutions = []
        for edge in edges:
            node = edge.get("node", {})
            post = node.get("post", {})
            if not post.get("content"):
                continue
            solutions.append({
                "topic_id": node.get("id"),
                "title": node.get("title", ""),
                "view_count": node.get("viewCount", 0),
                "comment_count": node.get("commentCount", 0),
                "content": post.get("content", ""),
                "vote_count": post.get("voteCount", 0),
                "author": post.get("author", {}).get("username", ""),
                "created_at": post.get("creationDate", 0),
            })
        return solutions

    except Exception as e:
        return []


async def ensure_solutions_table():
    """确保 user_solutions 表存在且有正确结构"""
    conn = await asyncmy.connect(**DB_CONFIG)
    async with conn.cursor() as cur:
        await cur.execute("""
            CREATE TABLE IF NOT EXISTS crawled_solutions (
                id VARCHAR(64) PRIMARY KEY,
                problem_id VARCHAR(64) NOT NULL,
                topic_id VARCHAR(64),
                title VARCHAR(500),
                content MEDIUMTEXT,
                author VARCHAR(128),
                vote_count INT DEFAULT 0,
                view_count INT DEFAULT 0,
                comment_count INT DEFAULT 0,
                source VARCHAR(32) DEFAULT 'LEETCODE_GLOBAL',
                created_at BIGINT,
                fetched_at BIGINT,
                INDEX idx_problem_id (problem_id),
                INDEX idx_vote_count (vote_count DESC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        await conn.commit()
    conn.close()


async def save_solutions(problem_id, solutions):
    """批量保存题解到数据库"""
    if not solutions:
        return 0

    conn = await asyncmy.connect(**DB_CONFIG)
    saved = 0
    async with conn.cursor() as cur:
        for sol in solutions:
            sol_id = f"lcsol-{sol['topic_id']}"
            now_ms = int(time.time() * 1000)
            created_ms = sol["created_at"] * 1000 if sol["created_at"] else now_ms

            try:
                await cur.execute("""
                    INSERT INTO crawled_solutions
                    (id, problem_id, topic_id, title, content, author, vote_count, view_count, comment_count, source, created_at, fetched_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                    vote_count=VALUES(vote_count), view_count=VALUES(view_count), fetched_at=VALUES(fetched_at)
                """, (
                    sol_id, problem_id, sol["topic_id"], sol["title"],
                    sol["content"], sol["author"], sol["vote_count"],
                    sol["view_count"], sol["comment_count"],
                    "LEETCODE_GLOBAL", created_ms, now_ms,
                ))
                saved += 1
            except Exception:
                pass

        await conn.commit()
    conn.close()
    return saved


async def main():
    print("=" * 60)
    print("  LeetCode 高赞题解采集")
    print("=" * 60)

    # 1. 确保表存在
    await ensure_solutions_table()
    print("✅ crawled_solutions 表就绪")

    # 2. 获取题目列表
    problems = await get_problems_with_question_id()
    print(f"📋 待采集题目: {len(problems)} 道（前 200 道）")

    # 3. 并发采集题解
    total_saved = 0
    semaphore = asyncio.Semaphore(3)  # 并发限制

    async with httpx.AsyncClient(headers=HEADERS, timeout=30.0) as client:
        async def process_one(p, idx):
            nonlocal total_saved
            async with semaphore:
                solutions = await fetch_solutions_for_problem(client, p["question_id"], top_n=10)
                if solutions:
                    saved = await save_solutions(p["problem_id"], solutions)
                    total_saved += saved
                await asyncio.sleep(0.5)  # 礼貌延迟

                if (idx + 1) % 20 == 0:
                    print(f"  进度: {idx + 1}/{len(problems)}，已保存 {total_saved} 条题解")

        tasks = [process_one(p, i) for i, p in enumerate(problems)]
        await asyncio.gather(*tasks)

    print(f"\n🎉 完成！共采集 {total_saved} 条高赞题解（来自 {len(problems)} 道题）")

    # 统计
    conn = await asyncmy.connect(**DB_CONFIG)
    async with conn.cursor() as cur:
        await cur.execute("SELECT COUNT(*) FROM crawled_solutions")
        total = (await cur.fetchone())[0]
        await cur.execute("SELECT COUNT(DISTINCT problem_id) FROM crawled_solutions")
        problem_count = (await cur.fetchone())[0]
    conn.close()
    print(f"📊 数据库总计: {total} 条题解，覆盖 {problem_count} 道题")


if __name__ == "__main__":
    asyncio.run(main())
