"""测试力扣中国站获取中文内容的方法"""
import asyncio
import httpx

async def main():
    # 方法 1：力扣中国站 GraphQL（模拟浏览器请求）
    headers = {
        "Content-Type": "application/json",
        "Referer": "https://leetcode.cn/problems/two-sum/",
        "Origin": "https://leetcode.cn",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    }
    query = """
query questionTranslations($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
        translatedTitle
        translatedContent
    }
}
"""
    async with httpx.AsyncClient(headers=headers, timeout=30, follow_redirects=True) as c:
        # 先请求一个页面获取 csrftoken
        page = await c.get("https://leetcode.cn/problems/two-sum/")
        cookies = page.cookies
        csrf = cookies.get("csrftoken", "")
        print(f"获取 csrftoken: {csrf[:20]}..." if csrf else "无 csrftoken")

        # 带 csrf 请求 GraphQL
        h = {**headers}
        if csrf:
            h["x-csrftoken"] = csrf
            h["Cookie"] = f"csrftoken={csrf}"

        r = await c.post(
            "https://leetcode.cn/graphql/",
            json={"query": query, "variables": {"titleSlug": "two-sum"}},
            headers=h,
        )
        print(f"HTTP {r.status_code}")
        if r.status_code == 200:
            d = r.json().get("data", {}).get("question", {})
            print(f"translatedTitle: {d.get('translatedTitle')}")
            tc = d.get("translatedContent") or ""
            print(f"translatedContent 长度: {len(tc)}")
            if tc:
                print(f"前 150 字: {tc[:150]}")
        else:
            print(f"响应: {r.text[:200]}")

asyncio.run(main())
