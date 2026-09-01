"""
批量采集 LeetCode 题目并写入 MySQL
直接使用适配器 + pipeline 标准化，跳过完整服务启动
"""
import asyncio
import json
import sys
import time

sys.path.insert(0, "src")

import asyncmy

from crawler_service.adapters.leetcode_global import LeetCodeGlobalAdapter
from crawler_service.adapters.base import FetchOptions

# MySQL 连接配置（本地 root 无密码）
DB_CONFIG = {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "password": "",
    "db": "algorithm_help",
}

# 难度映射
DIFFICULTY_MAP = {"Easy": "EASY", "Medium": "MEDIUM", "Hard": "HARD"}


async def fetch_all_problems(adapter, total=200):
    """分页采集题目列表"""
    all_problems = []
    batch_size = 50
    for offset in range(0, total, batch_size):
        limit = min(batch_size, total - offset)
        options = FetchOptions(offset=offset, limit=limit)
        batch = await adapter.fetch_problem_list(options)
        all_problems.extend(batch)
        print(f"  已获取 {len(all_problems)}/{total} 条...")
        await asyncio.sleep(1)  # 礼貌延迟
    return all_problems


async def fetch_detail_batch(adapter, problems, concurrency=3):
    """并发采集题目详情"""
    semaphore = asyncio.Semaphore(concurrency)
    results = []

    async def fetch_one(p):
        async with semaphore:
            slug = p.get("title_slug", "")
            if not slug:
                return None
            try:
                detail = await adapter.fetch_problem_detail(slug)
                await asyncio.sleep(0.5)  # 礼貌延迟
                return detail
            except Exception as e:
                print(f"    ⚠️ 采集 {slug} 失败: {e}")
                return None

    tasks = [fetch_one(p) for p in problems]
    results = await asyncio.gather(*tasks)
    return [r for r in results if r]


async def insert_to_db(details):
    """将标准化数据写入 MySQL"""
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
            hints = d.get("hints", [])
            constraints_text = ""  # HTML 中自带
            examples = json.dumps(
                [d.get("example_testcases", "")], ensure_ascii=False
            )
            now_ms = int(time.time() * 1000)

            # 跳过付费题
            if d.get("paid_only"):
                skipped += 1
                continue

            try:
                await cur.execute(
                    """INSERT INTO problems (id, title, difficulty, tags, description, 
                       constraints, examples, company_tags, created_at, updated_at)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                       ON DUPLICATE KEY UPDATE title=VALUES(title), tags=VALUES(tags),
                       description=VALUES(description), updated_at=VALUES(updated_at)""",
                    (
                        problem_id,
                        title,
                        difficulty,
                        tags,
                        description,
                        json.dumps([], ensure_ascii=False),
                        examples,
                        json.dumps([], ensure_ascii=False),
                        now_ms,
                        now_ms,
                    ),
                )
                inserted += 1
            except Exception as e:
                print(f"    ⚠️ 写入 {title} 失败: {e}")
                skipped += 1

        await conn.commit()
    conn.close()
    return inserted, skipped


async def main():
    print("=" * 60)
    print("  LeetCode 题目批量采集 → MySQL")
    print("=" * 60)

    adapter = LeetCodeGlobalAdapter()

    # 1. 采集题目列表
    print("\n📋 Step 1: 采集题目列表（前 200 道）...")
    problems = await fetch_all_problems(adapter, total=200)
    print(f"  ✅ 共获取 {len(problems)} 条题目元数据")

    # 过滤付费题
    free_problems = [p for p in problems if not p.get("paid_only")]
    print(f"  免费题: {len(free_problems)} 条（跳过付费题 {len(problems) - len(free_problems)} 条）")

    # 2. 并发采集详情
    print(f"\n📖 Step 2: 采集题目详情（并发=3）...")
    details = await fetch_detail_batch(adapter, free_problems, concurrency=3)
    print(f"  ✅ 成功采集 {len(details)} 条题目详情")

    # 3. 写入数据库
    print(f"\n💾 Step 3: 写入 MySQL...")
    inserted, skipped = await insert_to_db(details)
    print(f"  ✅ 写入 {inserted} 条，跳过 {skipped} 条")

    print(f"\n🎉 完成！数据库中现有 {inserted} 道真实 LeetCode 题目。")


if __name__ == "__main__":
    asyncio.run(main())
