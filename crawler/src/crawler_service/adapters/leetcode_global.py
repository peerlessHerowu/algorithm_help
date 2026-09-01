"""LeetCode 国际站适配器

通过 GraphQL API 采集题目列表/详情、高赞题解（前 10）、官方 Editorial。
处理分页（每次 50 题）、Cookie 认证、增量检测。

Requirements: 17.1, 17.3, 17.4, 17.5, 17.6, 17.7
"""

from typing import Optional

import httpx
import structlog

from ..config import get_settings
from ..models.enums import Platform, PlatformCapability
from .base import FetchOptions, PlatformAdapter

logger = structlog.get_logger()


# ---- GraphQL 查询定义 ----

_QUERY_PROBLEM_LIST = """
query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
    problemsetQuestionList: questionList(
        categorySlug: $categorySlug
        limit: $limit
        skip: $skip
        filters: $filters
    ) {
        total: totalNum
        questions: data {
            frontendQuestionId: questionFrontendId
            titleSlug
            title
            difficulty
            topicTags {
                name
                slug
            }
            acRate
            paidOnly: isPaidOnly
            status
        }
    }
}
"""

_QUERY_PROBLEM_DETAIL = """
query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
        questionId
        questionFrontendId
        title
        titleSlug
        content
        difficulty
        topicTags {
            name
            slug
        }
        hints
        exampleTestcases
        sampleTestCase
        metaData
        stats
        acRate
        likes
        dislikes
        isPaidOnly
    }
}
"""

_QUERY_SOLUTIONS = """
query communitySolutions($questionSlug: String!, $skip: Int!, $first: Int!, $orderBy: TopicSortingOption) {
    questionSolutions(
        questionSlug: $questionSlug
        skip: $skip
        first: $first
        orderBy: $orderBy
    ) {
        totalNum
        solutions {
            id
            title
            slug
            voteCount
            content
            createdAt
            author {
                username
            }
            topicTags {
                name
                slug
            }
        }
    }
}
"""

_QUERY_EDITORIAL = """
query questionEditorial($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
        solution {
            id
            content
            contentTypeId
            paidOnly
            rating {
                count
                average
            }
        }
    }
}
"""


class LeetCodeGlobalAdapter(PlatformAdapter):
    """LeetCode 国际站（leetcode.com）适配器

    通过 GraphQL API 采集题目、题解和 Editorial。
    需要 Cookie 认证以访问付费/登录限制内容。
    """

    def __init__(self) -> None:
        settings = get_settings()
        platform_cfg = settings.platforms.get("leetcode_global")
        self._graphql_url = (
            platform_cfg.graphql_url if platform_cfg else "https://leetcode.com/graphql"
        )
        self._base_url = platform_cfg.base_url if platform_cfg else "https://leetcode.com"
        self._cookie_key = platform_cfg.cookie_key if platform_cfg else ""

    def get_platform(self) -> Platform:
        """返回 LEETCODE_GLOBAL 平台标识"""
        return Platform.LEETCODE_GLOBAL

    def get_capabilities(self) -> set[PlatformCapability]:
        """返回 LeetCode 国际站支持的全部采集能力"""
        return {
            PlatformCapability.PROBLEM_FETCH,
            PlatformCapability.SOLUTION_FETCH,
            PlatformCapability.EDITORIAL_FETCH,
            PlatformCapability.COMMENT_FETCH,
        }

    async def fetch_problem_list(self, options: FetchOptions) -> list[dict]:
        """采集题目列表，支持分页（每次 limit 条，默认 50）

        通过 GraphQL problemsetQuestionList 查询获取题目列表。
        增量检测暂依赖编排器层 last_fetch_time 过滤。

        Args:
            options: 分页参数（offset/limit）和增量时间戳

        Returns:
            题目基本信息列表，包含 platform_id、title_slug、title、difficulty、tags
        """
        resp = await self._graphql_request(
            query=_QUERY_PROBLEM_LIST,
            variables={
                "categorySlug": "",
                "skip": options.offset,
                "limit": options.limit,
                "filters": {},
            },
        )

        question_list = resp.get("data", {}).get("problemsetQuestionList", {})
        questions = question_list.get("questions") or []

        return [self._normalize_list_item(q) for q in questions]

    async def fetch_problem_detail(self, platform_problem_id: str) -> dict:
        """采集单题详情

        通过 GraphQL questionData 查询获取完整题目数据。
        platform_problem_id 此处使用 titleSlug（如 "two-sum"）。

        Args:
            platform_problem_id: 题目的 titleSlug

        Returns:
            题目完整原始数据，包含 description_html、hints、examples 等
        """
        resp = await self._graphql_request(
            query=_QUERY_PROBLEM_DETAIL,
            variables={"titleSlug": platform_problem_id},
        )

        question = resp.get("data", {}).get("question")
        if not question:
            logger.warning("题目详情为空", title_slug=platform_problem_id)
            return {}

        return self._normalize_detail(question)

    async def fetch_solutions(
        self, platform_problem_id: str, top_n: int = 10
    ) -> list[dict]:
        """采集高赞题解（前 top_n 条，按 vote 降序）

        Args:
            platform_problem_id: 题目的 titleSlug
            top_n: 最多采集前 N 条高赞题解，默认 10

        Returns:
            题解原始数据列表
        """
        resp = await self._graphql_request(
            query=_QUERY_SOLUTIONS,
            variables={
                "questionSlug": platform_problem_id,
                "skip": 0,
                "first": top_n,
                "orderBy": "most_votes",
            },
        )

        solutions_data = resp.get("data", {}).get("questionSolutions", {})
        solutions = solutions_data.get("solutions") or []

        return [self._normalize_solution(s, platform_problem_id) for s in solutions]

    async def fetch_editorial(self, platform_problem_id: str) -> Optional[dict]:
        """采集官方 Editorial

        Args:
            platform_problem_id: 题目的 titleSlug

        Returns:
            Editorial 原始数据，不存在或付费限制时返回 None
        """
        resp = await self._graphql_request(
            query=_QUERY_EDITORIAL,
            variables={"titleSlug": platform_problem_id},
        )

        question = resp.get("data", {}).get("question", {})
        solution = question.get("solution") if question else None

        if not solution or not solution.get("content"):
            return None

        # 付费内容且无 Cookie 时跳过
        if solution.get("paidOnly"):
            logger.debug("Editorial 为付费内容", title_slug=platform_problem_id)
            return None

        return {
            "platform": Platform.LEETCODE_GLOBAL.value,
            "platform_problem_id": platform_problem_id,
            "editorial_id": str(solution.get("id", "")),
            "content": solution.get("content", ""),
            "content_type_id": solution.get("contentTypeId", ""),
            "rating_count": solution.get("rating", {}).get("count", 0),
            "rating_average": solution.get("rating", {}).get("average", 0),
        }

    # ---- 私有方法 ----

    async def _graphql_request(
        self,
        query: str,
        variables: dict,
    ) -> dict:
        """发送 GraphQL 请求并返回 JSON 响应

        内部创建 httpx 客户端，处理 Cookie 认证。
        当返回需要登录的错误时记录日志。

        Args:
            query: GraphQL 查询字符串
            variables: 查询变量

        Returns:
            GraphQL 响应的 JSON 数据

        Raises:
            httpx.HTTPStatusError: HTTP 状态码非 2xx 时抛出
        """
        payload = {"query": query, "variables": variables}

        # 附加 Cookie（如果有）
        cookies = await self._get_cookies()
        headers = {
            "Content-Type": "application/json",
            "Referer": self._base_url,
            "Origin": self._base_url,
        }
        if cookies:
            headers["Cookie"] = cookies

        async with httpx.AsyncClient(
            headers=headers,
            timeout=httpx.Timeout(30.0),
            follow_redirects=True,
        ) as client:
            response = await client.post(self._graphql_url, json=payload)
            response.raise_for_status()

        data = response.json()

        # 检查 GraphQL 层面错误（需要登录等）
        if "errors" in data:
            errors = data["errors"]
            error_msgs = [e.get("message", "") for e in errors]
            logger.warning(
                "GraphQL 返回错误",
                errors=error_msgs,
                variables=variables,
            )

        return data

    async def _get_cookies(self) -> str:
        """从 Redis 获取 Cookie（如果可用）

        适配器本身不直接依赖 Redis 实例，而是通过 cookie_key 配置读取。
        在编排器层通过 AntiCrawlManager 注入 Cookie。
        此处提供直连 fallback 以支持独立测试。
        """
        try:
            from ..anticrawl.cookie_store import RedisCookieStore
            from ..database.redis_client import get_redis

            redis = await get_redis()
            store = RedisCookieStore(redis)
            return await store.get("leetcode_global")
        except Exception:
            # Redis 不可用时跳过 Cookie
            return ""

    def _normalize_list_item(self, raw: dict) -> dict:
        """将 GraphQL 题目列表项转为统一内部格式"""
        tags = raw.get("topicTags") or []
        return {
            "platform": Platform.LEETCODE_GLOBAL.value,
            "platform_id": raw.get("frontendQuestionId", ""),
            "title_slug": raw.get("titleSlug", ""),
            "title": raw.get("title", ""),
            "difficulty": raw.get("difficulty", ""),
            "raw_difficulty": raw.get("difficulty", ""),
            "raw_tags": [t.get("name", "") for t in tags],
            "ac_rate": raw.get("acRate"),
            "paid_only": raw.get("paidOnly", False),
            "url": f"{self._base_url}/problems/{raw.get('titleSlug', '')}/",
        }

    def _normalize_detail(self, raw: dict) -> dict:
        """将 GraphQL 题目详情转为统一内部格式"""
        tags = raw.get("topicTags") or []
        return {
            "platform": Platform.LEETCODE_GLOBAL.value,
            "platform_id": raw.get("questionFrontendId", ""),
            "question_id": raw.get("questionId", ""),
            "title_slug": raw.get("titleSlug", ""),
            "title": raw.get("title", ""),
            "description_html": raw.get("content", ""),
            "difficulty": raw.get("difficulty", ""),
            "raw_difficulty": raw.get("difficulty", ""),
            "raw_tags": [t.get("name", "") for t in tags],
            "hints": raw.get("hints") or [],
            "example_testcases": raw.get("exampleTestcases", ""),
            "sample_test_case": raw.get("sampleTestCase", ""),
            "metadata": raw.get("metaData", ""),
            "stats": raw.get("stats", ""),
            "ac_rate": raw.get("acRate"),
            "likes": raw.get("likes", 0),
            "dislikes": raw.get("dislikes", 0),
            "paid_only": raw.get("isPaidOnly", False),
            "url": f"{self._base_url}/problems/{raw.get('titleSlug', '')}/",
        }

    def _normalize_solution(self, raw: dict, problem_slug: str) -> dict:
        """将 GraphQL 题解数据转为统一内部格式"""
        author = raw.get("author") or {}
        tags = raw.get("topicTags") or []
        return {
            "platform": Platform.LEETCODE_GLOBAL.value,
            "platform_problem_id": problem_slug,
            "solution_id": str(raw.get("id", "")),
            "title": raw.get("title", ""),
            "slug": raw.get("slug", ""),
            "content": raw.get("content", ""),
            "vote_count": raw.get("voteCount", 0),
            "author": author.get("username", ""),
            "created_at": raw.get("createdAt", ""),
            "tags": [t.get("name", "") for t in tags],
            "url": f"{self._base_url}/problems/{problem_slug}/solutions/{raw.get('slug', '')}/",
        }
