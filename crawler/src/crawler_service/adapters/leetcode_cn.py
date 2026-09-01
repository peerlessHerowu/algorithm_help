"""力扣中文站适配器

通过 GraphQL API 采集力扣中文站（leetcode.cn）题目列表、题目详情、
高赞题解和官方 Editorial。字段映射与国际站类似，配置独立。
"""

import structlog

from ..config import get_settings
from ..models.enums import Platform, PlatformCapability
from .base import FetchOptions, PlatformAdapter

logger = structlog.get_logger()

# ---- GraphQL 查询模板 ----

# 题目列表查询（支持分页、增量）
_PROBLEM_LIST_QUERY = """
query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList(
    categorySlug: $categorySlug
    limit: $limit
    skip: $skip
    filters: $filters
  ) {
    hasMore
    total
    questions {
      frontendQuestionId: questionFrontendId
      titleSlug
      title
      translatedTitle
      difficulty
      topicTags {
        name
        translatedName
        slug
      }
      acRate
      paidOnly
      status
    }
  }
}
"""

# 单题详情查询
_PROBLEM_DETAIL_QUERY = """
query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionId
    questionFrontendId
    title
    translatedTitle
    translatedContent
    content
    difficulty
    topicTags {
      name
      translatedName
      slug
    }
    hints
    sampleTestCase
    exampleTestcases
    constraints
    stats
    acRate
    likes
    dislikes
  }
}
"""

# 高赞题解查询（按点赞数降序）
_SOLUTIONS_QUERY = """
query communitySolutions($titleSlug: String!, $skip: Int, $first: Int, $orderBy: SolutionArticleOrderBy) {
  questionSolutionArticles(
    questionSlug: $titleSlug
    skip: $skip
    first: $first
    orderBy: $orderBy
  ) {
    totalNum
    edges {
      node {
        slug
        title
        summary
        content
        solutionTags {
          name
          slug
        }
        author {
          username
        }
        voteCount
        createdAt
      }
    }
  }
}
"""

# 官方 Editorial 查询
_EDITORIAL_QUERY = """
query questionOfficialSolution($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    solution {
      id
      title
      content
      contentTypeId
      paidOnly
    }
  }
}
"""


class LeetCodeCNAdapter(PlatformAdapter):
    """力扣中文站（leetcode.cn）适配器

    通过 GraphQL API 采集中文版题目列表、详情、高赞题解和 Editorial。
    配置独立于国际站，使用 platforms["leetcode_cn"] 中的 graphql_url。
    """

    def __init__(self):
        settings = get_settings()
        platform_cfg = settings.platforms.get("leetcode_cn")
        self._graphql_url = (
            platform_cfg.graphql_url if platform_cfg else "https://leetcode.cn/graphql"
        )
        self._cookie_key = (
            platform_cfg.cookie_key if platform_cfg else "crawler:cookie:leetcode_cn"
        )

    def get_platform(self) -> Platform:
        """返回平台标识：LEETCODE_CN"""
        return Platform.LEETCODE_CN

    def get_capabilities(self) -> set[PlatformCapability]:
        """力扣中文站支持全部四种采集能力"""
        return {
            PlatformCapability.PROBLEM_FETCH,
            PlatformCapability.SOLUTION_FETCH,
            PlatformCapability.EDITORIAL_FETCH,
            PlatformCapability.COMMENT_FETCH,
        }

    async def fetch_problem_list(self, options: FetchOptions) -> list[dict]:
        """采集题目列表（支持分页，每次最多 50 题）

        通过 GraphQL problemsetQuestionList 接口分页获取题目列表。
        自动翻页直到采集完毕或无更多数据。

        Args:
            options: 采集参数，包含 offset/limit/last_fetch_time

        Returns:
            题目原始数据列表，每条包含 platform_id、title、difficulty 等字段
        """
        import httpx

        all_problems: list[dict] = []
        offset = options.offset
        limit = min(options.limit, 50)  # 每次最多 50 题
        has_more = True

        while has_more:
            variables = {
                "categorySlug": "",
                "limit": limit,
                "skip": offset,
                "filters": {},
            }
            payload = {"query": _PROBLEM_LIST_QUERY, "variables": variables}

            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.post(
                        self._graphql_url,
                        json=payload,
                        headers=self._build_headers(),
                    )
                    resp.raise_for_status()
                    data = resp.json()
            except httpx.HTTPStatusError as e:
                logger.error(
                    "力扣中文站题目列表请求失败",
                    status=e.response.status_code,
                    offset=offset,
                )
                raise
            except Exception as e:
                logger.error("力扣中文站题目列表请求异常", error=str(e), offset=offset)
                raise

            question_list = (
                data.get("data", {}).get("problemsetQuestionList") or {}
            )
            questions = question_list.get("questions") or []
            has_more = question_list.get("hasMore", False)

            for q in questions:
                problem = self._map_list_item(q)
                all_problems.append(problem)

            offset += limit

            # 安全边界：如果无更多数据则停止
            if not questions:
                break

        logger.info(
            "力扣中文站题目列表采集完成",
            total=len(all_problems),
        )
        return all_problems

    async def fetch_problem_detail(self, platform_problem_id: str) -> dict:
        """采集单题详情

        通过 titleSlug 查询题目完整信息，包含中文描述、约束、示例等。

        Args:
            platform_problem_id: 题目的 titleSlug

        Returns:
            题目完整原始数据
        """
        import httpx

        variables = {"titleSlug": platform_problem_id}
        payload = {"query": _PROBLEM_DETAIL_QUERY, "variables": variables}

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                self._graphql_url,
                json=payload,
                headers=self._build_headers(),
            )
            resp.raise_for_status()
            data = resp.json()

        question = data.get("data", {}).get("question")
        if not question:
            logger.warning(
                "力扣中文站题目详情为空",
                title_slug=platform_problem_id,
            )
            return {}

        return self._map_detail(question)

    async def fetch_solutions(
        self, platform_problem_id: str, top_n: int = 10
    ) -> list[dict]:
        """采集高赞题解（前 N 条，按点赞数降序）

        Args:
            platform_problem_id: 题目的 titleSlug
            top_n: 最多采集前 N 条

        Returns:
            题解原始数据列表
        """
        import httpx

        variables = {
            "titleSlug": platform_problem_id,
            "skip": 0,
            "first": top_n,
            "orderBy": "MOST_VOTES",
        }
        payload = {"query": _SOLUTIONS_QUERY, "variables": variables}

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    self._graphql_url,
                    json=payload,
                    headers=self._build_headers(),
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            logger.warning(
                "力扣中文站题解采集失败",
                title_slug=platform_problem_id,
                error=str(e),
            )
            return []

        articles = (
            data.get("data", {}).get("questionSolutionArticles") or {}
        )
        edges = articles.get("edges") or []

        solutions = []
        for edge in edges:
            node = edge.get("node", {})
            solutions.append(self._map_solution(node, platform_problem_id))
        return solutions

    async def fetch_editorial(self, platform_problem_id: str):
        """采集官方 Editorial（如果存在）

        Args:
            platform_problem_id: 题目的 titleSlug

        Returns:
            Editorial 原始数据，无则返回 None
        """
        import httpx

        variables = {"titleSlug": platform_problem_id}
        payload = {"query": _EDITORIAL_QUERY, "variables": variables}

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    self._graphql_url,
                    json=payload,
                    headers=self._build_headers(),
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            logger.warning(
                "力扣中文站 Editorial 采集失败",
                title_slug=platform_problem_id,
                error=str(e),
            )
            return None

        solution = (
            data.get("data", {}).get("question", {}).get("solution")
        )
        if not solution or solution.get("paidOnly"):
            return None

        return {
            "platform": Platform.LEETCODE_CN.value,
            "platform_problem_id": platform_problem_id,
            "editorial_id": str(solution.get("id", "")),
            "title": solution.get("title", ""),
            "content_html": solution.get("content", ""),
            "content_type": solution.get("contentTypeId", ""),
        }

    # ---- 私有方法：字段映射 ----

    def _build_headers(self) -> dict[str, str]:
        """构建请求头（含 Referer 和 Content-Type）"""
        return {
            "Content-Type": "application/json",
            "Referer": "https://leetcode.cn/",
            "Origin": "https://leetcode.cn",
        }

    def _map_list_item(self, raw: dict) -> dict:
        """将 GraphQL 列表项映射为统一格式"""
        tags = raw.get("topicTags") or []
        return {
            "platform": Platform.LEETCODE_CN.value,
            "platform_id": raw.get("frontendQuestionId", ""),
            "title_slug": raw.get("titleSlug", ""),
            "title": raw.get("translatedTitle") or raw.get("title", ""),
            "title_en": raw.get("title", ""),
            "raw_difficulty": raw.get("difficulty", ""),
            "raw_tags": [
                t.get("translatedName") or t.get("name", "")
                for t in tags
            ],
            "ac_rate": raw.get("acRate"),
            "paid_only": raw.get("paidOnly", False),
        }

    def _map_detail(self, raw: dict) -> dict:
        """将 GraphQL 详情响应映射为统一格式"""
        tags = raw.get("topicTags") or []
        return {
            "platform": Platform.LEETCODE_CN.value,
            "platform_id": raw.get("questionFrontendId", ""),
            "question_id": raw.get("questionId", ""),
            "title_slug": raw.get("title", ""),
            "title": raw.get("translatedTitle") or raw.get("title", ""),
            "title_en": raw.get("title", ""),
            "description_html": (
                raw.get("translatedContent") or raw.get("content", "")
            ),
            "raw_difficulty": raw.get("difficulty", ""),
            "raw_tags": [
                t.get("translatedName") or t.get("name", "")
                for t in tags
            ],
            "hints": raw.get("hints") or [],
            "sample_test_case": raw.get("sampleTestCase", ""),
            "example_testcases": raw.get("exampleTestcases", ""),
            "constraints": raw.get("constraints", ""),
            "stats": raw.get("stats", ""),
            "ac_rate": raw.get("acRate"),
            "likes": raw.get("likes", 0),
            "dislikes": raw.get("dislikes", 0),
        }

    def _map_solution(self, node: dict, title_slug: str) -> dict:
        """将题解 GraphQL 响应映射为统一格式"""
        author = node.get("author") or {}
        solution_tags = node.get("solutionTags") or []
        return {
            "platform": Platform.LEETCODE_CN.value,
            "platform_problem_id": title_slug,
            "solution_id": node.get("slug", ""),
            "title": node.get("title", ""),
            "summary": node.get("summary", ""),
            "content_html": node.get("content", ""),
            "author": author.get("username", ""),
            "vote_count": node.get("voteCount", 0),
            "tags": [t.get("name", "") for t in solution_tags],
            "created_at": node.get("createdAt", ""),
        }
