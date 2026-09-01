"""快速测试 LeetCode 适配器能否正常采集数据"""
import asyncio
import json
import sys

sys.path.insert(0, "src")

from crawler_service.adapters.leetcode_global import LeetCodeGlobalAdapter
from crawler_service.adapters.base import FetchOptions


async def main():
    adapter = LeetCodeGlobalAdapter()

    print("=" * 50)
    print("1. 测试采集题目列表（前 5 条）")
    print("=" * 50)
    options = FetchOptions(offset=0, limit=5)
    problems = await adapter.fetch_problem_list(options)
    print(f"获取到 {len(problems)} 条题目")
    for p in problems[:3]:
        print(f"  - [{p['platform_id']}] {p['title']} ({p['difficulty']}) tags={p['raw_tags'][:3]}")

    if not problems:
        print("ERROR: 没有获取到任何题目，检查网络或 API")
        return

    print()
    print("=" * 50)
    print("2. 测试采集单题详情（two-sum）")
    print("=" * 50)
    detail = await adapter.fetch_problem_detail("two-sum")
    if detail:
        print(f"  标题: {detail['title']}")
        print(f"  难度: {detail['difficulty']}")
        print(f"  标签: {detail['raw_tags']}")
        print(f"  描述前100字: {detail['description_html'][:100]}...")
    else:
        print("  ERROR: 详情为空")

    print()
    print("=" * 50)
    print("3. 测试采集高赞题解（two-sum 前 3 条）")
    print("=" * 50)
    solutions = await adapter.fetch_solutions("two-sum", top_n=3)
    print(f"获取到 {len(solutions)} 条题解")
    for s in solutions[:3]:
        print(f"  - {s['title']} (votes={s['vote_count']}, author={s['author']})")

    print()
    print("✅ LeetCode 适配器测试完成！")


if __name__ == "__main__":
    asyncio.run(main())
