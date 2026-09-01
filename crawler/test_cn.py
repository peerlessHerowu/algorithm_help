"""测试国际站是否返回中文翻译字段"""
import asyncio
import httpx

async def main():
    headers = {
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com",
        "Origin": "https://leetcode.com",
    }
    query = """
query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
        title
        translatedTitle
        translatedContent
        content
    }
}
"""
    async with httpx.AsyncClient(headers=headers, timeout=30) as c:
        r = await c.post(
            "https://leetcode.com/graphql",
            json={"query": query, "variables": {"titleSlug": "two-sum"}},
        )
        d = r.json().get("data", {}).get("question", {})
        print(f"title: {d.get('title')}")
        print(f"translatedTitle: {d.get('translatedTitle')}")
        tc = d.get("translatedContent") or ""
        print(f"translatedContent 长度: {len(tc)}")
        if tc:
            print(f"前 200 字: {tc[:200]}")

asyncio.run(main())
