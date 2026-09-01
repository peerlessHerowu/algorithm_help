"""DataStandardizer 主管线

串联 HTML 转换 → 图片处理 → 难度映射 → 标签映射 → 质量检查 五阶段管线，
将各平台原始采集数据标准化为统一内部模型。

Validates: Requirements 4.1, 4.6
"""

import structlog

from .html_converter import HtmlToMarkdownConverter
from .image_handler import ImageHandler
from .difficulty_mapper import DifficultyMapper
from .tag_mapper import TagMapper
from .quality_checker import QualityChecker, QualityResult

logger = structlog.get_logger()


class DataStandardizer:
    """数据标准化管线 —— 管道模式，各阶段独立可测

    五阶段管线：
    1. HTML → Markdown（HtmlToMarkdownConverter）
    2. 图片下载与 URL 替换（ImageHandler）
    3. 难度映射（DifficultyMapper）
    4. 标签映射（TagMapper）
    5. 质量检查（QualityChecker）
    """

    def __init__(
        self,
        html_converter: HtmlToMarkdownConverter,
        image_handler: ImageHandler,
        diff_mapper: DifficultyMapper,
        tag_mapper: TagMapper,
        quality_checker: QualityChecker,
    ):
        self._html_converter = html_converter
        self._image_handler = image_handler
        self._diff_mapper = diff_mapper
        self._tag_mapper = tag_mapper
        self._quality_checker = quality_checker

    async def standardize(self, raw: dict, platform: str) -> dict:
        """执行完整标准化管线

        接收原始采集数据字典和平台标识，依次执行五个标准化阶段，
        返回包含所有标准化字段的结果字典。

        :param raw: 原始采集数据字典，包含 description_html/raw_difficulty/raw_tags 等字段
        :param platform: 平台标识（如 leetcode_global、codeforces）
        :return: 标准化后的字典，包含 title、description、difficulty、tags、quality_status 等
        """
        log = logger.bind(platform=platform, platform_id=raw.get("platform_id", ""))

        # Stage 1: HTML → Markdown
        description_html = raw.get("description_html", "")
        description_md = self._html_converter.convert(description_html)
        log.debug("Stage 1 完成: HTML→Markdown 转换")

        # Stage 2: 图片下载与 URL 替换
        description_md = await self._image_handler.process(description_md, platform)
        log.debug("Stage 2 完成: 图片处理")

        # Stage 3: 难度映射
        raw_difficulty = raw.get("raw_difficulty", "")
        difficulty = self._diff_mapper.map(raw_difficulty, platform)
        log.debug("Stage 3 完成: 难度映射", difficulty=difficulty)

        # Stage 4: 标签映射
        raw_tags = raw.get("raw_tags", [])
        tags = self._tag_mapper.map(raw_tags, platform)
        log.debug("Stage 4 完成: 标签映射", tag_count=len(tags))

        # Stage 5: 质量检查
        quality_result = self._quality_checker.check({
            "title": raw.get("title"),
            "description": description_md,
            "difficulty": difficulty,
        })
        log.debug("Stage 5 完成: 质量检查", status=quality_result.status)

        return {
            "platform_id": raw.get("platform_id", ""),
            "title": raw.get("title", ""),
            "description": description_md,
            "difficulty": difficulty,
            "tags": tags,
            "constraints": raw.get("constraints"),
            "examples": raw.get("examples"),
            "quality_status": quality_result.status,
            "quality_message": quality_result.message,
            "platform": platform,
            "url": raw.get("url", ""),
        }

    async def standardize_solution(self, raw_solution: dict) -> dict | None:
        """标准化题解数据

        对题解执行 HTML→Markdown 转换和质量检查。
        质量不合格（LOW_QUALITY）的题解返回 None，表示不写入正式库。

        :param raw_solution: 原始题解数据字典，包含 content_html/content 等字段
        :return: 标准化后的题解字典，质量不合格时返回 None
        """
        # 提取题解内容（优先使用 HTML，否则使用纯文本 content）
        content_html = raw_solution.get("content_html", "")
        if content_html:
            content_md = self._html_converter.convert(content_html)
        else:
            content_md = raw_solution.get("content", "")

        # 质量检查：内容少于 100 字符标记为 LOW_QUALITY
        quality_result = self._quality_checker.check_solution(content_md)
        if quality_result.status == "LOW_QUALITY":
            logger.info(
                "题解质量不合格，跳过",
                platform_id=raw_solution.get("platform_id", ""),
                reason=quality_result.message,
            )
            return None

        return {
            "platform_id": raw_solution.get("platform_id", ""),
            "author": raw_solution.get("author", ""),
            "title": raw_solution.get("title", ""),
            "content": content_md,
            "upvotes": raw_solution.get("upvotes", 0),
            "language": raw_solution.get("language", ""),
            "quality_status": quality_result.status,
            "quality_message": quality_result.message,
        }
