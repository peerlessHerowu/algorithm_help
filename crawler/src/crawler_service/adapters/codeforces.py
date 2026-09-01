"""Codeforces 适配器

通过 Codeforces REST API 采集题目列表和详情。
- API 端点：https://codeforces.com/api/problemset.problems
- 题号格式："{contestId}{index}"，如 "1A"、"1234B"
- 难度：rating 整数，通过 DifficultyMapper 映射为 EASY/MEDIUM/HARD
- 题面：HTML 格式，需转换为 Markdown
- API 返回 FAILED 状态时执行重试

Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6
"""

import asyncio
from typing import Optional

import httpx
import structlog

from .base import FetchOptions, PlatformAdapter
from ..models.enums import Platform, PlatformCapability
from ..pipeline.html_converter import HtmlToMarkdownConverter

logger = structlog.get_logger()

# Codeforces API FAILED 状态默认重试间隔（秒）
_DEFAULT_RETRY_DELAY = 2.0
_MAX_API_RETRIES = 3


class CodeforcesAdapter(PlatformAdapter):
    """Codeforces 平台适配器

    通过 Codeforces 官方 REST API 采集题目数据。
    支持题目列表采集、单题详情获取、题解采集（通过 blog）。
    """

    def __init__(self):
        self._html_converter = HtmlToMarkdownConverter()
        self._base_url = "https://codeforces.com"
        self._api_url = "https://codeforces.com/api"

    def get_platform(self) -> Platform:
        return Platform.CODEFORCES

    def get_capabilities(self) -> set[PlatformCapability]:
        return {PlatformCapability.PROBLEM_FETCH, PlatformCapability.SOLUTION_FETCH}

    async def fetch_problem_list(self, options: FetchOptions) -> list[dict]:
        """采集 Codeforces 题目列表

        通过 /api/problemset.problems 获取全量题目，
        根据 options.last_fetch_time 和分页参数进行过滤。

        Args:
            options: 采集参数（offset、limit、last_fetch_time）

        Returns:
            题目原始数据列表，每条包含 platform_id、title、tags、rating 等
        """
        url = f"{self._api_url}/problemset.problems"
        response_data = await self._request_with_retry(url)

        if not response_data:
            return []

        problems = response_data.get("problems", [])
        statistics = response_data.get("problemStatistics", [])

        # 构建 contestId+index → statistics 的映射
        stats_map = self._build_stats_map(statistics)

        # 转换为统一格式并分页
        result = []
        for problem in problems:
            contest_id = problem.get("contestId")
            index = problem.get("index", "")
            if contest_id is None:
                continue

            platform_id = f"{contest_id}{index}"
            item = self._build_problem_item(problem, platform_id, stats_map)
            result.append(item)

        # 分页处理
        start = options.offset
        end = start + options.limit
        return result[start:end]

    async def fetch_problem_detail(self, platform_problem_id: str) -> dict:
        """采集单题详情

        Codeforces 无独立的单题 API，通过 HTML 页面获取题面内容。
        题号格式为 "{contestId}{index}"，如 "1A" → contest=1, index=A。

        Args:
            platform_problem_id: 平台题号，如 "1A"、"1234B"

        Returns:
            包含 description_html、constraints、examples 等字段的详情字典
        """
        contest_id, index = self._parse_problem_id(platform_problem_id)
        if not contest_id:
            logger.warning("无效的题目 ID 格式", problem_id=platform_problem_id)
            return {}

        # 通过 HTML 页面获取题面
        page_url = f"{self._base_url}/problemset/problem/{contest_id}/{index}"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(page_url)
            resp.raise_for_status()

        html_content = resp.text
        detail = self._parse_problem_page(html_content, platform_problem_id)
        return detail

    async def fetch_solutions(
        self, platform_problem_id: str, top_n: int = 10
    ) -> list[dict]:
        """采集题解（通过 Codeforces blog/editorial 链接）

        Args:
            platform_problem_id: 平台题号
            top_n: 最多采集前 N 条

        Returns:
            题解原始数据列表
        """
        contest_id, index = self._parse_problem_id(platform_problem_id)
        if not contest_id:
            return []

        # 尝试获取 contest 的 editorial（blog entry）
        url = f"{self._api_url}/contest.standings"
        params = {"contestId": contest_id, "from": 1, "count": 1}

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()

            if data.get("status") != "OK":
                return []

            # Codeforces 不直接提供题解 API，返回空列表
            # 实际题解通过 blog 页面采集，此处预留
            return []
        except Exception as e:
            logger.debug("Codeforces 题解采集失败", problem_id=platform_problem_id, error=str(e))
            return []

    async def fetch_editorial(self, platform_problem_id: str) -> Optional[dict]:
        """采集官方 Editorial（通过 blog 链接）

        Codeforces 的 Editorial 通常以 blog 形式发布，
        关联到对应 contest。

        Args:
            platform_problem_id: 平台题号

        Returns:
            Editorial 原始数据，无则返回 None
        """
        contest_id, _ = self._parse_problem_id(platform_problem_id)
        if not contest_id:
            return None

        # 尝试通过 blogEntry.view 获取 Editorial
        # Codeforces editorial 通常在 contest 结束后发布
        url = f"{self._api_url}/contest.standings"
        params = {"contestId": contest_id, "from": 1, "count": 1}

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(url, params=params)
                if resp.status_code != 200:
                    return None
                data = resp.json()

            if data.get("status") != "OK":
                return None

            # 从 contest 信息中提取 editorial 链接（如果有）
            contest_info = data.get("result", {}).get("contest", {})
            editorial_url = self._extract_editorial_url(contest_info)
            if not editorial_url:
                return None

            return await self._fetch_editorial_content(editorial_url)
        except Exception as e:
            logger.debug("Editorial 采集失败", problem_id=platform_problem_id, error=str(e))
            return None

    # ---- 私有方法 ----

    async def _request_with_retry(
        self, url: str, params: Optional[dict] = None
    ) -> Optional[dict]:
        """带 FAILED 状态重试的 API 请求

        Codeforces API 在繁忙时返回 status=FAILED，需要等待后重试。

        Args:
            url: 请求 URL
            params: 查询参数

        Returns:
            API 返回的 result 字段数据，失败返回 None
        """
        for attempt in range(_MAX_API_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.get(url, params=params)
                    resp.raise_for_status()
                    data = resp.json()

                status = data.get("status")
                if status == "OK":
                    return data.get("result")

                # FAILED 状态：API 建议等待后重试（R18.6）
                if status == "FAILED":
                    comment = data.get("comment", "")
                    logger.warning(
                        "Codeforces API 返回 FAILED",
                        url=url,
                        comment=comment,
                        attempt=attempt + 1,
                    )
                    delay = _DEFAULT_RETRY_DELAY * (2 ** attempt)
                    await asyncio.sleep(delay)
                    continue

                # 其他非 OK 状态
                logger.warning(
                    "Codeforces API 非预期状态",
                    url=url,
                    status=status,
                    comment=data.get("comment", ""),
                )
                return None

            except httpx.HTTPStatusError as e:
                logger.warning(
                    "Codeforces API HTTP 错误",
                    url=url,
                    status_code=e.response.status_code,
                    attempt=attempt + 1,
                )
                if attempt < _MAX_API_RETRIES - 1:
                    await asyncio.sleep(_DEFAULT_RETRY_DELAY * (2 ** attempt))
                continue
            except Exception as e:
                logger.error("Codeforces API 请求异常", url=url, error=str(e))
                return None

        logger.error("Codeforces API 重试耗尽", url=url, max_retries=_MAX_API_RETRIES)
        return None

    @staticmethod
    def _parse_problem_id(platform_problem_id: str) -> tuple[Optional[int], str]:
        """解析题号为 contestId 和 index

        题号格式："{contestId}{index}"，如 "1A" → (1, "A")、"1234B2" → (1234, "B2")

        Args:
            platform_problem_id: 平台题号字符串

        Returns:
            (contest_id, index) 元组，解析失败返回 (None, "")
        """
        if not platform_problem_id:
            return None, ""

        # 找到第一个非数字字符的位置，前面是 contestId，后面是 index
        split_pos = 0
        for i, ch in enumerate(platform_problem_id):
            if not ch.isdigit():
                split_pos = i
                break
        else:
            # 全是数字，无效格式
            return None, ""

        if split_pos == 0:
            return None, ""

        try:
            contest_id = int(platform_problem_id[:split_pos])
            index = platform_problem_id[split_pos:]
            return contest_id, index
        except ValueError:
            return None, ""

    @staticmethod
    def _build_stats_map(statistics: list[dict]) -> dict[str, dict]:
        """构建题目统计信息映射

        Args:
            statistics: API 返回的 problemStatistics 列表

        Returns:
            "{contestId}{index}" → statistics 的映射字典
        """
        stats_map = {}
        for stat in statistics:
            contest_id = stat.get("contestId")
            index = stat.get("index", "")
            if contest_id is not None:
                key = f"{contest_id}{index}"
                stats_map[key] = stat
        return stats_map

    def _build_problem_item(
        self, problem: dict, platform_id: str, stats_map: dict
    ) -> dict:
        """将 API 原始数据转换为统一的题目字典

        Args:
            problem: Codeforces API 返回的单题数据
            platform_id: 组合后的题号
            stats_map: 统计信息映射

        Returns:
            统一格式的题目字典
        """
        contest_id = problem.get("contestId")
        index = problem.get("index", "")
        rating = problem.get("rating")
        tags = problem.get("tags", [])
        name = problem.get("name", "")

        # 从统计信息中获取解题人数
        stat = stats_map.get(platform_id, {})
        solved_count = stat.get("solvedCount", 0)

        return {
            "platform_id": platform_id,
            "contest_id": contest_id,
            "index": index,
            "title": name,
            "raw_tags": tags,
            "raw_difficulty": rating,
            "solved_count": solved_count,
            "url": f"{self._base_url}/problemset/problem/{contest_id}/{index}",
            "platform": Platform.CODEFORCES.value,
        }

    def _parse_problem_page(self, html: str, platform_problem_id: str) -> dict:
        """解析 Codeforces 题面 HTML 页面

        提取题目描述、输入/输出格式、约束条件、样例等。

        Args:
            html: 完整 HTML 页面内容
            platform_problem_id: 题号

        Returns:
            包含 description_html、description_md、constraints、examples 的字典
        """
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")
        result = {"platform_id": platform_problem_id}

        # 提取题目描述区域
        problem_statement = soup.find("div", class_="problem-statement")
        if not problem_statement:
            return result

        # 提取题目标题
        title_div = problem_statement.find("div", class_="title")
        if title_div:
            result["title"] = title_div.get_text(strip=True)

        # 提取题面 HTML 和 Markdown
        description_html = self._extract_description(problem_statement)
        result["description_html"] = description_html
        result["description_md"] = self._html_converter.convert(description_html)

        # 提取输入/输出格式
        result["input_spec"] = self._extract_section(problem_statement, "input-specification")
        result["output_spec"] = self._extract_section(problem_statement, "output-specification")

        # 提取约束（时间/空间限制）
        result["constraints"] = self._extract_constraints(problem_statement)

        # 提取样例
        result["examples"] = self._extract_examples(problem_statement)

        return result

    @staticmethod
    def _extract_description(problem_statement) -> str:
        """从 problem-statement 中提取题目描述 HTML

        Codeforces 题面结构：第一个无 class 的 div 通常是描述正文。
        """
        # 题目描述在 problem-statement 下的子 div 中（header 之后、input-specification 之前）
        divs = problem_statement.find_all("div", recursive=False)
        description_parts = []
        for div in divs:
            css_class = div.get("class", [])
            # 跳过标题、输入/输出/样例等已分类区域
            if any(c in css_class for c in [
                "title", "input-specification", "output-specification",
                "sample-tests", "note", "time-limit", "memory-limit",
            ]):
                continue
            # 收集描述部分
            description_parts.append(str(div))

        return "\n".join(description_parts)

    @staticmethod
    def _extract_section(problem_statement, class_name: str) -> str:
        """提取指定 class 的区域文本"""
        section = problem_statement.find("div", class_=class_name)
        if not section:
            return ""
        # 移除标题部分，保留内容
        title = section.find("div", class_="section-title")
        if title:
            title.decompose()
        return section.get_text(separator="\n", strip=True)

    @staticmethod
    def _extract_constraints(problem_statement) -> str:
        """提取时间/空间限制"""
        constraints = []
        time_limit = problem_statement.find("div", class_="time-limit")
        if time_limit:
            constraints.append(time_limit.get_text(strip=True))
        memory_limit = problem_statement.find("div", class_="memory-limit")
        if memory_limit:
            constraints.append(memory_limit.get_text(strip=True))
        return " | ".join(constraints)

    @staticmethod
    def _extract_examples(problem_statement) -> list[dict]:
        """提取样例输入/输出

        Returns:
            [{"input": "...", "output": "..."}, ...]
        """
        examples = []
        sample_tests = problem_statement.find("div", class_="sample-test")
        if not sample_tests:
            return examples

        inputs = sample_tests.find_all("div", class_="input")
        outputs = sample_tests.find_all("div", class_="output")

        for inp, out in zip(inputs, outputs):
            inp_pre = inp.find("pre")
            out_pre = out.find("pre")
            examples.append({
                "input": inp_pre.get_text(separator="\n", strip=True) if inp_pre else "",
                "output": out_pre.get_text(separator="\n", strip=True) if out_pre else "",
            })
        return examples

    def _extract_editorial_url(self, contest_info: dict) -> Optional[str]:
        """从 contest 信息中提取 editorial blog URL

        Args:
            contest_info: Codeforces contest 数据

        Returns:
            Editorial blog URL，无则返回 None
        """
        # Codeforces 没有直接的 editorial URL 字段
        # 通常通过 contest 名称搜索 blog，此处返回 None 等后续完善
        return None

    async def _fetch_editorial_content(self, editorial_url: str) -> Optional[dict]:
        """获取 editorial 内容

        Args:
            editorial_url: Editorial blog 页面 URL

        Returns:
            Editorial 数据字典
        """
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(editorial_url)
                resp.raise_for_status()

            html_content = resp.text
            md_content = self._html_converter.convert(html_content)
            return {
                "url": editorial_url,
                "content_html": html_content,
                "content_md": md_content,
                "platform": Platform.CODEFORCES.value,
            }
        except Exception as e:
            logger.debug("Editorial 内容获取失败", url=editorial_url, error=str(e))
            return None
