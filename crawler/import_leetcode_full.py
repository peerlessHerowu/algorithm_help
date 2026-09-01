"""
全量采集 LeetCode 题目并写入 MySQL
采集所有免费题目（约 2800+），每批 50 条，带礼貌延迟
"""
import asyncio
import json
import sys
import time

sys.path.insert(0, "src")

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

DIFFICULTY_MAP = {"Easy": "EASY", "Medium": "MEDIUM", "Hard": "HARD"}


async def get_total_count(adapter):
    """获取 LeetCode 题目总数"""
    options = FetchOptions(offset=0, limit=1)
    await adapter.fetch_problem_list(options)
    # GraphQL 返回中含 total，但我们的适配器只返回 list
    # 直接用大 offset 探测
    return 3500  # LeetCode 当前约 3300+ 题


async def fetch_all_problems(adapter, total=3500):
    """分页采集全部题目列表"""
    all_problems = []
    batch_size = 50
    for offset in range(0, total, batch_size):
        options = FetchOptions(offset=offset, limit=batch_size)
        try:
            batch = await adapter.fetch_problem_list(options)
        except Exception as e:
            print(f"  ⚠️ offset={offset} 获取失败: {e}")
            await asyncio.sleep(3)
            continue

        if not batch:
            print(f"  📭 offset={offset} 返回空，到达末尾")
            break

        all_problems.extend(batch)
        if len(all_problems) % 200 == 0 or not batch:
            print(f"  已获取 {len(all_problems)} 条...")
        await asyncio.sleep(0.8)  # 礼貌延迟

    return all_problems


async def fetch_details_batch(adapter, problems, concurrency=5):
    """并发采集题目详情"""
    semaphore = asyncio.Semaphore(concurrency)
    results = []
    total = len(problems)
    completed = 0

    async def fetch_one(p):
        nonlocal completed
        async with semaphore:
            slug = p.get("title_slug", "")
            if not slug:
                return None
            try:
                detail = await adapter.fetch_problem_detail(slug)
                await asyncio.sleep(0.3)
                completed += 1
                if completed % 50 == 0:
                    print(f"    详情进度: {completed}/{total}")
                return detail
            except Exception as e:
                completed += 1
                return None

    tasks = [fetch_one(p) for p in problems]
    results = await asyncio.gather(*tasks)
    return [r for r in results if r]


async def insert_to_db(details):
    """将数据写入 MySQL"""
    conn = await asyncmy.connect(**DB_CONFIG)
    async with conn.cursor() as cur:
        inserted = 0
        skipped = 0
        for d in details:
            problem_id = f"lc-{d.get('platform_id', '')}"
            title = d.get("title", "")
            difficulty = DIFFICULTY_MAP.get(d.get("difficulty", ""), "MEDIUM")
            tags = json.dumps(d.get("raw_tags", []), ensure_ascii=False)
            description = d.get("description_html", "")
            examples = json.dumps(
                [d.get("example_testcases", "")], ensure_ascii=False
            )
            now_ms = int(time.time() * 1000)

            if d.get("paid_only"):
                skipped += 1
                continue

            try:
                await cur.execute(
                    """INSERT INTO problems (id, title, difficulty, tags, description,
                       constraints, examples, company_tags, created_at, updated_at)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                       ON DUPLICATE KEY UPDATE
                       title=VALUES(title), tags=VALUES(tags),
                       description=VALUES(description), updated_at=VALUES(updated_at)""",
                    (problem_id, title, difficulty, tags, description,
                     json.dumps([]), examples, json.dumps([]), now_ms, now_ms),
                )
                inserted += 1
            except Exception as e:
                skipped += 1

        await conn.commit()
    conn.close()
    return inserted, skipped


async def main():
    print("=" * 60)
    print("  LeetCode 全量采集 → MySQL")
    print("=" * 60)

    adapter = LeetCodeGlobalAdapter()

    # Step 1: 采集题目列表
    print("\n📋 Step 1: 采集全部题目列表...")
    problems = await fetch_all_problems(adapter, total=3500)
    print(f"  ✅ 共获取 {len(problems)} 条题目元数据")

    free_problems = [p for p in problems if not p.get("paid_only")]
    paid_count = len(problems) - len(free_problems)
    print(f"  免费: {len(free_problems)} | 付费(跳过): {paid_count}")

    # Step 2: 采集详情（免费题目）
    # 已有的题目跳过详情采集
    conn = await asyncmy.connect(**DB_CONFIG)
    async with conn.cursor() as cur:
        await cur.execute("SELECT id FROM problems")
        existing_ids = {row[0] for row in await cur.fetchall()}
    conn.close()

    new_problems = [p for p in free_problems if f"lc-{p.get('platform_id', '')}" not in existing_ids]
    print(f"\n📖 Step 2: 采集新题详情（{len(new_problems)} 条新题，跳过已有 {len(free_problems) - len(new_problems)} 条）...")

    if new_problems:
        details = await fetch_details_batch(adapter, new_problems, concurrency=5)
        print(f"  ✅ 成功获取 {len(details)} 条详情")

        # Step 3: 写入数据库
        print(f"\n💾 Step 3: 写入 MySQL...")
        inserted, skipped = await insert_to_db(details)
        print(f"  ✅ 新增 {inserted} 条，跳过 {skipped} 条")
    else:
        print("  所有题目已存在，无需更新")

    # 最终统计
    conn = await asyncmy.connect(**DB_CONFIG)
    async with conn.cursor() as cur:
        await cur.execute("SELECT COUNT(*) FROM problems")
        total_in_db = (await cur.fetchone())[0]
    conn.close()
    print(f"\n🎉 完成！数据库总计 {total_in_db} 道 LeetCode 题目。")


if __name__ == "__main__":
    asyncio.run(main())
