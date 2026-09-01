"""牛客网适配器

通过 HTML 页面解析采集题目数据，使用 httpx + BeautifulSoup 解析页面。
牛客网不支持题解/评论采集（capabilities 仅包含 PROBLEM_FETCH）。

Requirements: 19.1, 19.4, 19.5, 19.6
"""

import structlog
import httpx
from bs4 import BeautifulSoup
from typing import Optional

from .base import PlatformAdapter, FetchOptions
from ..config import get_settings
from ..models.enums import Platform, PlatformCapability

logger = structlog.get_logger()


class NowcoderAdapter(PlatformAdapter):
    """牛客网平台适配器

    通过 HTML 页面解析采集题目列表和详情。
    仅支持 PROBLEM_FETCH，不支持题解和评论采集。
    """

    def __init__(self):
        settings = get_settings()
        platform_cfg = settings.platforms.get("nowcoder")
        self._base_url = platform_cfg.base_url if platform_cfg else "https://www.nowcoder.com"
        self._timeout = 30

    def get_platform(self) -> Platform:
        return Platform.NOWCODER

    def get_capabilities(self) -> set[PlatformCapability]:
        return {PlatformCapability.PROBLEM_FETCH}


    async def fetch_problem_list(self, options: FetchOptions) -> list[dict]:
        """采集牛客网题目列表

        通过牛客网题库页面的 API 接口获取题目列表，支持分页。
        牛客网题库接口返回 JSON 数据，包含题目基本信息。

        Args:
            options: 采集参数，包含分页偏移和增量时间戳

        Returns:
            题目原始数据列表
        """
        problems = []
        page = (options.offset // options.limit) + 1

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                # 牛客网题库列表接口
                url = f"{self._base_url}/api/questionbank/questionList"
                params = {
                    "page": page,
                    "pageSize": options.limit,
                    "order": "hot",
                }
                resp = await client.get(url, params=params)
                resp.raise_for_status()

                data = resp.json()
                question_list = data.get("data", {}).get("list", [])

                for item in question_list:
                    problem = self._parse_list_item(item)
                    if problem:
                        problems.append(problem)

        except httpx.HTTPStatusError as e:
            logger.error(
                "牛客网题目列表请求失败",
                status_code=e.response.status_code,
                url=str(e.request.url),
            )
            raise
        except Exception as e:
            logger.error("牛客网题目列表采集异常", error=str(e))
            raise

        logger.info("牛客网题目列表采集完成", count=len(problems), page=page)
        return problems


    async def fetch_problem_detail(self, platform_problem_id: str) -> dict:
        """采集牛客网单题详情

        通过题目详情页 HTML 解析获取完整题目内容，包括描述、约束、示例等。

        Args:
            platform_problem_id: 牛客网题目 ID

        Returns:
            题目完整原始数据
        """
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                # 尝试通过 API 接口获取题目详情
                api_url = f"{self._base_url}/api/questionbank/detail"
                params = {"questionId": platform_problem_id}
                resp = await client.get(api_url, params=params)
                resp.raise_for_status()

                data = resp.json()
                detail = data.get("data", {})

                if detail:
                    return self._parse_detail_from_api(detail, platform_problem_id)

                # 回退：通过 HTML 页面解析
                return await self._fetch_detail_from_html(client, platform_problem_id)

        except httpx.HTTPStatusError as e:
            logger.warning(
                "牛客网 API 请求失败，尝试 HTML 解析",
                status_code=e.response.status_code,
                problem_id=platform_problem_id,
            )
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                return await self._fetch_detail_from_html(client, platform_problem_id)
        except Exception as e:
            logger.error(
                "牛客网题目详情采集异常",
                problem_id=platform_problem_id,
                error=str(e),
            )
            raise


    async def fetch_solutions(
        self, platform_problem_id: str, top_n: int = 10
    ) -> list[dict]:
        """牛客网不支持题解采集，返回空列表

        牛客网 capabilities 中不包含 SOLUTION_FETCH，
        调用此方法时直接返回空结果。
        """
        return []

    async def fetch_editorial(
        self, platform_problem_id: str
    ) -> Optional[dict]:
        """牛客网不支持 Editorial 采集，返回 None"""
        return None

    async def fetch_comments(
        self, solution_id: str, min_upvotes: int = 5
    ) -> list[dict]:
        """牛客网不支持评论采集，返回空列表"""
        return []


    # ---- 私有方法 ----

    def _parse_list_item(self, item: dict) -> Optional[dict]:
        """解析题目列表中的单条数据

        Args:
            item: 牛客网 API 返回的题目列表项

        Returns:
            标准化后的题目基本信息，解析失败返回 None
        """
        try:
            question_id = str(item.get("questionId", ""))
            if not question_id:
                return None

            title = item.get("title", "")
            difficulty_raw = item.get("difficulty", 0)
            tags = [tag.get("name", "") for tag in item.get("tags", []) if tag.get("name")]

            return {
                "platform_id": question_id,
                "title": title,
                "raw_difficulty": difficulty_raw,
                "raw_tags": tags,
                "url": f"{self._base_url}/practice/{question_id}",
            }
        except Exception as e:
            logger.warning("解析牛客网题目列表项失败", error=str(e), item=item)
            return None


    def _parse_detail_from_api(self, detail: dict, platform_problem_id: str) -> dict:
        """从 API 响应中解析题目详情

        Args:
            detail: 牛客网 API 返回的题目详情数据
            platform_problem_id: 题目 ID

        Returns:
            题目完整原始数据字典
        """
        title = detail.get("title", "")
        description_html = detail.get("content", "")
        difficulty_raw = detail.get("difficulty", 0)
        tags = [
            tag.get("name", "")
            for tag in detail.get("tags", [])
            if tag.get("name")
        ]
        examples = detail.get("examples", [])
        constraints = detail.get("constraints", "")

        return {
            "platform_id": platform_problem_id,
            "title": title,
            "description_html": description_html,
            "raw_difficulty": difficulty_raw,
            "raw_tags": tags,
            "examples": examples,
            "constraints": constraints,
            "url": f"{self._base_url}/practice/{platform_problem_id}",
        }


    async def _fetch_detail_from_html(
        self, client: httpx.AsyncClient, platform_problem_id: str
    ) -> dict:
        """回退方案：通过 HTML 页面解析题目详情

        当 API 接口不可用时，通过解析题目详情页面 HTML 获取内容。

        Args:
            client: httpx 异步客户端
            platform_problem_id: 题目 ID

        Returns:
            解析后的题目数据字典
        """
        page_url = f"{self._base_url}/practice/{platform_problem_id}"
        resp = await client.get(page_url)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")

        title = self._extract_title(soup)
        description_html = self._extract_description(soup)
        tags = self._extract_tags(soup)
        difficulty_raw = self._extract_difficulty(soup)

        return {
            "platform_id": platform_problem_id,
            "title": title,
            "description_html": description_html,
            "raw_difficulty": difficulty_raw,
            "raw_tags": tags,
            "examples": [],
            "constraints": "",
            "url": page_url,
        }

    def _extract_title(self, soup: BeautifulSoup) -> str:
        """从 HTML 中提取题目标题"""
        title_tag = soup.find("h1") or soup.find("title")
        if title_tag:
            return title_tag.get_text(strip=True)
        return ""

    def _extract_description(self, soup: BeautifulSoup) -> str:
        """从 HTML 中提取题目描述（保留 HTML 格式）"""
        # 牛客网题目描述通常在特定 class 的 div 中
        desc_div = (
            soup.find("div", class_="question-content")
            or soup.find("div", class_="nc-post-content")
            or soup.find("div", class_="subject-describe")
        )
        if desc_div:
            return str(desc_div)
        return ""

    def _extract_tags(self, soup: BeautifulSoup) -> list[str]:
        """从 HTML 中提取题目标签"""
        tags = []
        tag_container = soup.find("div", class_="tags") or soup.find("div", class_="question-tags")
        if tag_container:
            for tag_el in tag_container.find_all("a"):
                tag_text = tag_el.get_text(strip=True)
                if tag_text:
                    tags.append(tag_text)
        return tags

    def _extract_difficulty(self, soup: BeautifulSoup) -> str:
        """从 HTML 中提取难度信息"""
        diff_el = soup.find("span", class_="difficulty") or soup.find("span", class_="tag-difficulty")
        if diff_el:
            return diff_el.get_text(strip=True)
        return ""
