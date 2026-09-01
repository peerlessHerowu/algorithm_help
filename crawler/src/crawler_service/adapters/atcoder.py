"""AtCoder 适配器

通过 AtCoder Problems API（第三方开源，kenkoooo.com）采集题目列表和难度信息。
该 API 提供 JSON 数组格式的题目数据和难度模型。

capabilities: PROBLEM_FETCH（不支持题解/评论采集）

API 端点：
- /resources/problems: 全部题目列表（JSON array）
- /resources/problem-models: 题目难度模型（difficulty rating）

Validates: Requirements 19.2, 19.4, 19.5, 19.6
"""

import structlog
import httpx
from typing import Optional

from .base import PlatformAdapter, FetchOptions
from ..models.enums import Platform, PlatformCapability

logger = structlog.get_logger()

# AtCoder Problems API 基础 URL
ATCODER_PROBLEMS_API = "https://kenkoooo.com/atcoder/resources"


class AtCoderAdapter(PlatformAdapter):
    """AtCoder 平台适配器

    通过 kenkoooo.com 第三方开源 API 采集 AtCoder 题目列表和难度。
    仅支持 PROBLEM_FETCH，不支持题解和评论采集。
    """

    def __init__(self, api_base_url: str = ATCODER_PROBLEMS_API):
        self._api_base_url = api_base_url
        self._problems_cache: Optional[list[dict]] = None
        self._difficulty_cache: Optional[dict[str, dict]] = None

    def get_platform(self) -> Platform:
        """返回平台标识"""
        return Platform.ATCODER

    def get_capabilities(self) -> set[PlatformCapability]:
        """AtCoder 仅支持题目采集"""
        return {PlatformCapability.PROBLEM_FETCH}

    async def fetch_problem_list(self, options: FetchOptions) -> list[dict]:
        """采集 AtCoder 题目列表（支持分页和增量）

        从 /resources/problems 获取全部题目，同时从 /resources/problem-models
        获取难度 rating 信息并合并。

        Args:
            options: 采集参数，包含分页偏移和增量时间戳

        Returns:
            题目原始数据列表
        """
        problems = await self._fetch_all_problems()
        difficulty_map = await self._fetch_difficulty_models()

        # 合并难度信息到题目数据
        enriched = self._enrich_with_difficulty(problems, difficulty_map)

        # 分页裁剪
        start = options.offset
        end = start + options.limit
        page = enriched[start:end]

        logger.info(
            "AtCoder 题目列表采集完成",
            total=len(enriched),
            offset=options.offset,
            limit=options.limit,
            returned=len(page),
        )
        return page

    async def fetch_problem_detail(self, platform_problem_id: str) -> dict:
        """采集单题详情

        AtCoder Problems API 不提供单题详情接口，从缓存的题目列表中查找。
        如果需要题面 HTML，可访问 atcoder.jp/contests/{contest_id}/tasks/{problem_id}。

        Args:
            platform_problem_id: 题目 ID（如 "abc001_a"）

        Returns:
            题目原始数据字典
        """
        problems = await self._fetch_all_problems()
        difficulty_map = await self._fetch_difficulty_models()

        for problem in problems:
            if problem.get("id") == platform_problem_id:
                result = dict(problem)
                # 补充难度信息
                model = difficulty_map.get(platform_problem_id)
                if model:
                    result["difficulty"] = model.get("difficulty")
                # 构造题目 URL
                contest_id = problem.get("contest_id", "")
                result["url"] = f"https://atcoder.jp/contests/{contest_id}/tasks/{platform_problem_id}"
                return result

        logger.warning("AtCoder 题目未找到", problem_id=platform_problem_id)
        return {"id": platform_problem_id, "title": "", "contest_id": ""}

    async def _fetch_all_problems(self) -> list[dict]:
        """从 AtCoder Problems API 获取全部题目列表（带内存缓存）

        API 返回格式：
        [{"id": "abc001_a", "contest_id": "abc001", "title": "積雪深差"}, ...]
        """
        if self._problems_cache is not None:
            return self._problems_cache

        url = f"{self._api_base_url}/problems"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()

        # 转换为统一格式
        problems = []
        for item in data:
            problems.append({
                "platform_id": item.get("id", ""),
                "id": item.get("id", ""),
                "contest_id": item.get("contest_id", ""),
                "title": item.get("title", ""),
                "url": f"https://atcoder.jp/contests/{item.get('contest_id', '')}/tasks/{item.get('id', '')}",
            })

        self._problems_cache = problems
        logger.debug("AtCoder 题目列表已缓存", count=len(problems))
        return problems

    async def _fetch_difficulty_models(self) -> dict[str, dict]:
        """从 AtCoder Problems API 获取难度模型（带内存缓存）

        API 返回格式：
        {"abc001_a": {"slope": ..., "intercept": ..., "difficulty": 800, ...}, ...}
        """
        if self._difficulty_cache is not None:
            return self._difficulty_cache

        url = f"{self._api_base_url}/problem-models"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()

        self._difficulty_cache = data if isinstance(data, dict) else {}
        logger.debug("AtCoder 难度模型已缓存", count=len(self._difficulty_cache))
        return self._difficulty_cache

    def _enrich_with_difficulty(
        self, problems: list[dict], difficulty_map: dict[str, dict]
    ) -> list[dict]:
        """将难度 rating 合并到题目数据中

        AtCoder 难度 rating 映射为统一难度：
        - difficulty <= 800: EASY
        - 801 <= difficulty <= 1600: MEDIUM
        - difficulty > 1600: HARD

        Args:
            problems: 题目列表
            difficulty_map: problem_id → difficulty model 映射

        Returns:
            已合并难度信息的题目列表
        """
        enriched = []
        for problem in problems:
            result = dict(problem)
            problem_id = problem.get("id", "")
            model = difficulty_map.get(problem_id)
            if model and model.get("difficulty") is not None:
                rating = model["difficulty"]
                result["difficulty"] = rating
                result["raw_difficulty"] = rating
            else:
                # 无难度数据的题目，标记为未知
                result["difficulty"] = None
                result["raw_difficulty"] = None
            enriched.append(result)
        return enriched

    def clear_cache(self) -> None:
        """清除内存缓存（用于测试或强制刷新）"""
        self._problems_cache = None
        self._difficulty_cache = None
