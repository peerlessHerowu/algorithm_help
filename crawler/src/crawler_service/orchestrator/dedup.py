"""
跨平台题目去重服务

精确匹配（platform + platform_id）→ 模糊匹配（Jaccard 标题相似度 + 约束比对）
阈值判断：>= 0.8 自动确认，0.5-0.8 待人工确认，< 0.5 新建

Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
"""

import json
import re
from enum import Enum

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crawler_service.database.repository import PlatformMappingRepository
from crawler_service.models.entities import PlatformMapping, RawSource


class DeduResult(str, Enum):
    """去重结果枚举"""

    CREATE_NEW = "create_new"
    UPDATE_EXISTING = "update_existing"
    AUTO_MAP_CONFIRMED = "auto_map_confirmed"
    AUTO_MAP_PENDING = "auto_map_pending"


class DeduplicationService:
    """
    跨平台题目去重服务

    流程：精确匹配（同平台同 platform_id）→ 模糊匹配（Jaccard 标题相似度 + 约束比对）
    """

    def __init__(
        self,
        session: AsyncSession,
        mapping_repo: PlatformMappingRepository,
        jaccard_threshold_high: float = 0.8,
        jaccard_threshold_low: float = 0.5,
    ):
        """
        :param session: 异步数据库会话，用于精确匹配查询
        :param mapping_repo: 平台映射仓储，用于写入映射记录
        :param jaccard_threshold_high: 自动确认阈值（>= 此值写入 confirmed=true）
        :param jaccard_threshold_low: 待人工确认阈值（>= 此值写入 confirmed=false）
        """
        self._session = session
        self._mapping_repo = mapping_repo
        self._threshold_high = jaccard_threshold_high
        self._threshold_low = jaccard_threshold_low

    async def check(
        self, raw: dict, platform: str, project: str = "algorithm-help"
    ) -> DeduResult:
        """
        执行去重检测：精确匹配 → 模糊匹配 → 写入 platform_mapping

        :param raw: 原始采集数据（需包含 platform_id、title、constraints 字段）
        :param platform: 来源平台标识
        :param project: 所属项目
        :return: 去重结果
        """
        platform_id = str(raw.get("platform_id", ""))

        # 1. 精确匹配：同平台同 platform_id 已存在
        existing = await self._exact_match(platform, platform_id)
        if existing is not None:
            return DeduResult.UPDATE_EXISTING

        # 2. 模糊匹配：Jaccard 标题相似度 + 约束比对
        title = raw.get("title", "")
        constraints = raw.get("constraints", "")
        confidence, matched_problem_id = await self._fuzzy_match(
            title, constraints, platform, project
        )

        # 3. 阈值判断
        if confidence >= self._threshold_high and matched_problem_id is not None:
            await self._mapping_repo.save_mapping(
                unified_problem_id=matched_problem_id,
                platform=platform,
                platform_problem_id=platform_id,
                platform_url=raw.get("url", ""),
                confidence=confidence,
                confirmed=True,
                project=project,
            )
            return DeduResult.AUTO_MAP_CONFIRMED

        if confidence >= self._threshold_low and matched_problem_id is not None:
            await self._mapping_repo.save_mapping(
                unified_problem_id=matched_problem_id,
                platform=platform,
                platform_problem_id=platform_id,
                platform_url=raw.get("url", ""),
                confidence=confidence,
                confirmed=False,
                project=project,
            )
            return DeduResult.AUTO_MAP_PENDING

        return DeduResult.CREATE_NEW

    async def _exact_match(
        self, platform: str, platform_id: str
    ) -> RawSource | None:
        """
        精确匹配：同平台同 platform_id 是否已存在 RawSource 记录

        :param platform: 来源平台
        :param platform_id: 平台原始 ID
        :return: 已存在的 RawSource 或 None
        """
        if not platform_id:
            return None

        query = select(RawSource).where(
            RawSource.platform == platform,
            RawSource.platform_id == platform_id,
        )
        result = await self._session.execute(query)
        return result.scalars().first()

    async def _fuzzy_match(
        self,
        title: str,
        constraints: str,
        platform: str,
        project: str,
    ) -> tuple[float, int | None]:
        """
        模糊匹配：对比标题 Jaccard 相似度 + 约束文本相似度

        遍历已有的 PlatformMapping 对应的 RawSource 记录，
        找到最高相似度的匹配。

        :param title: 待匹配题目标题
        :param constraints: 待匹配约束条件文本
        :param platform: 来源平台（排除同平台已有记录）
        :param project: 所属项目
        :return: (最高置信度, 匹配到的 unified_problem_id) 或 (0.0, None)
        """
        if not title:
            return 0.0, None

        # 查询已有的不同平台的 RawSource 记录进行比对
        query = select(RawSource).where(
            RawSource.project == project,
            RawSource.content_type == "PROBLEM",
            RawSource.platform != platform,
        )
        result = await self._session.execute(query)
        existing_records = result.scalars().all()

        if not existing_records:
            return 0.0, None

        title_tokens = self._tokenize(title)
        best_confidence = 0.0
        best_problem_id: int | None = None

        for record in existing_records:
            # 从 raw_json 解析标题和约束
            try:
                raw_data = json.loads(record.raw_json)
            except (json.JSONDecodeError, TypeError):
                continue

            existing_title = raw_data.get("title", "")
            existing_constraints = raw_data.get("constraints", "")

            # 标题相似度（权重 0.7）
            existing_tokens = self._tokenize(existing_title)
            title_similarity = self.jaccard_similarity(title_tokens, existing_tokens)

            # 约束相似度（权重 0.3）
            constraint_similarity = self._constraint_similarity(
                constraints, existing_constraints
            )

            # 综合置信度
            confidence = title_similarity * 0.7 + constraint_similarity * 0.3

            if confidence > best_confidence:
                best_confidence = confidence
                # 尝试从 platform_mapping 中查找对应的 unified_problem_id
                best_problem_id = await self._find_unified_id(
                    record.platform, record.platform_id
                )
                # 如果没有 mapping 记录，使用 RawSource 的 id 作为 fallback
                if best_problem_id is None:
                    best_problem_id = record.id

        return best_confidence, best_problem_id

    async def _find_unified_id(
        self, platform: str, platform_id: str
    ) -> int | None:
        """
        根据平台和平台题号查找已有的 unified_problem_id

        :param platform: 来源平台
        :param platform_id: 平台原始题号
        :return: unified_problem_id 或 None
        """
        query = select(PlatformMapping.unified_problem_id).where(
            PlatformMapping.platform == platform,
            PlatformMapping.platform_problem_id == platform_id,
        )
        result = await self._session.execute(query)
        row = result.scalars().first()
        return row if row is not None else None

    @staticmethod
    def jaccard_similarity(set_a: set, set_b: set) -> float:
        """
        计算两个集合的 Jaccard 相似度

        Jaccard(A, B) = |A ∩ B| / |A ∪ B|

        :param set_a: 集合 A
        :param set_b: 集合 B
        :return: 相似度值，范围 [0.0, 1.0]
        """
        if not set_a and not set_b:
            return 0.0
        intersection = set_a & set_b
        union = set_a | set_b
        return len(intersection) / len(union)

    @staticmethod
    def _tokenize(text: str) -> set[str]:
        """
        对文本进行分词，转为 token 集合

        支持中英文混合：英文按空格/标点分词，中文按单字分词。
        统一转小写。

        :param text: 原始文本
        :return: token 集合
        """
        if not text:
            return set()
        # 统一转小写
        text = text.lower().strip()
        # 提取英文单词
        english_tokens = set(re.findall(r"[a-z0-9]+", text))
        # 提取中文字符（按单字分词）
        chinese_chars = set(re.findall(r"[\u4e00-\u9fff]", text))
        return english_tokens | chinese_chars

    @staticmethod
    def _constraint_similarity(constraints_a: str, constraints_b: str) -> float:
        """
        约束条件相似度比对

        提取约束中的数值范围并比较匹配程度。

        :param constraints_a: 约束文本 A
        :param constraints_b: 约束文本 B
        :return: 相似度值，范围 [0.0, 1.0]
        """
        if not constraints_a and not constraints_b:
            return 0.0
        if not constraints_a or not constraints_b:
            return 0.0

        # 提取所有数值
        numbers_a = set(re.findall(r"\d+", constraints_a))
        numbers_b = set(re.findall(r"\d+", constraints_b))

        if not numbers_a and not numbers_b:
            # 没有数值时，回退到文本 Jaccard
            tokens_a = set(constraints_a.lower().split())
            tokens_b = set(constraints_b.lower().split())
            if not tokens_a and not tokens_b:
                return 0.0
            intersection = tokens_a & tokens_b
            union = tokens_a | tokens_b
            return len(intersection) / len(union) if union else 0.0

        # 数值集合的 Jaccard
        if not numbers_a or not numbers_b:
            return 0.0
        intersection = numbers_a & numbers_b
        union = numbers_a | numbers_b
        return len(intersection) / len(union)
