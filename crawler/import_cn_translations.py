"""
从力扣中国站补充中文翻译（title_cn + description_cn）
流程：
1. 从国际站 API 获取题目列表（含 titleSlug）
2. 对每个 slug 请求中国站 GraphQL 获取翻译
3. UPDATE problems SET title_cn=?, description_cn=? WHERE id=?

并发 3，延迟 0.5s，先处理前 200 题
"""
import asyncio
import sys
import time

sys.path.insert(0, "src")

import httpx
import asyncmy

from crawler_service.adapters.leetcode_global import LeetCodeGlobalAdapter
from crawler_service.adapters.base import FetchOptions

# MySQL 连接配置
DB_CONFIG = {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "password": "",
    "db": "algorithm_help",
}

# 力扣中国站 GraphQL
CN_GRAPHQL_URL = "https://leetcode.cn/graphql/"
CN_HEADERS = {
    "Content-Type": "application/json",
    "Referer": "https://leetcode.cn/problems/two-sum/",
    "Origin": "https://leetcode.cn",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
}

CN_QUERY = """
query questionTranslations($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
        questionFrontendId
        translatedTitle
        translatedContent
    }
}
"""


async def fetch_cn_translation(client: httpx.AsyncClient, slug: str) -> dict | None:
    """请求力扣中国站获取单题翻译"""
    payload = {
        "query": CN_QUERY,
        "variables": {"titleSlug": slug},
    }
    try:
        resp = await client.post(CN_GRAPHQL_URL, json=payload)
        if resp.status_code != 200:
            return None
        data = resp.json()
        question = data.get("data", {}).get("question")
        if not question:
            return None
        return {
            "frontend_id": question.get("questionFrontendId"),
            "title_cn": question.get("translatedTitle"),
            "description_cn": question.get("translatedContent"),
        }
    except Exception as e:
        print(f"    ⚠️ {slug} 异常: {e}")
        return None


async def fetch_translations_batch(slugs: list[tuple[str, str]], concurrency=3):
    """批量获取翻译"""
    semaphore = asyncio.Semaphore(concurrency)
    results = []

    async with httpx.AsyncClient(headers=CN_HEADERS, timeout=30.0, follow_redirects=True) as client:
        completed = 0
        total_slugs = len(slugs)

        async def fetch_one(problem_id: str, slug: str):
            nonlocal completed
            async with semaphore:
                result = await fetch_cn_translation(client, slug)
                await asyncio.sleep(0.5)
                completed += 1
                if completed % 50 == 0:
                    print(f"    翻译进度: {completed}/{total_slugs}")
                if result:
                    result["problem_id"] = problem_id
                return result

        tasks = [fetch_one(pid, slug) for pid, slug in slugs]
        results = await asyncio.gather(*tasks)

    return [r for r in results if r]


async def update_db(translations: list[dict]):
    """批量更新数据库中的中文字段"""
    conn = await asyncmy.connect(**DB_CONFIG)
    async with conn.cursor() as cur:
        updated = 0
        for t in translations:
            title_cn = t.get("title_cn") or ""
            desc_cn = t.get("description_cn") or ""
            problem_id = t["problem_id"]
            if not title_cn and not desc_cn:
                continue
            try:
                await cur.execute(
                    "UPDATE problems SET title_cn=%s, description_cn=%s WHERE id=%s",
                    (title_cn, desc_cn, problem_id),
                )
                updated += 1
            except Exception as e:
                print(f"    ⚠️ 更新 {problem_id} 失败: {e}")
        await conn.commit()
    conn.close()
    return updated


async def main():
    print("=" * 60)
    print("  力扣中国站中文翻译导入")
    print("=" * 60)

    # Step 1: 获取国际站题目列表（含 titleSlug）
    print("\n📋 Step 1: 从国际站获取全部题目列表...")
    adapter = LeetCodeGlobalAdapter()
    all_problems = []
    batch_size = 50
    total = 3500
    for offset in range(0, total, batch_size):
        limit = min(batch_size, total - offset)
        options = FetchOptions(offset=offset, limit=limit)
        try:
            batch = await adapter.fetch_problem_list(options)
        except Exception:
            await asyncio.sleep(3)
            continue
        if not batch:
            break
        all_problems.extend(batch)
        if len(all_problems) % 200 == 0:
            print(f"  已获取 {len(all_problems)} 条...")
        await asyncio.sleep(0.8)

    print(f"  ✅ 共获取 {len(all_problems)} 条题目")

    # 构建 (problem_id, title_slug) 列表
    slugs = []
    for p in all_problems:
        slug = p.get("title_slug", "")
        frontend_id = p.get("platform_id", "")
        if slug and frontend_id:
            problem_id = f"lc-{frontend_id}"
            slugs.append((problem_id, slug))

    print(f"  有效 slug 数量: {len(slugs)}")

    # 过滤掉已有中文翻译的题目
    conn = await asyncmy.connect(**DB_CONFIG)
    async with conn.cursor() as cur:
        await cur.execute("SELECT id FROM problems WHERE title_cn IS NOT NULL AND title_cn != ''")
        existing_cn = {row[0] for row in await cur.fetchall()}
    conn.close()

    slugs = [(pid, slug) for pid, slug in slugs if pid not in existing_cn]
    print(f"  跳过已有翻译 {len(existing_cn)} 条，待采集: {len(slugs)} 条")

    # Step 2: 批量请求中国站翻译
    print(f"\n🌏 Step 2: 请求力扣中国站获取翻译（并发=3，延迟=0.5s）...")
    translations = await fetch_translations_batch(slugs, concurrency=3)
    print(f"  ✅ 成功获取 {len(translations)} 条翻译")

    # Step 3: 更新数据库
    print(f"\n💾 Step 3: 更新 MySQL...")
    updated = await update_db(translations)
    print(f"  ✅ 更新 {updated} 条记录")

    print(f"\n🎉 完成！共导入 {updated} 条中文翻译。")


if __name__ == "__main__":
    asyncio.run(main())
