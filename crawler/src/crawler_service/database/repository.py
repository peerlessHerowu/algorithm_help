"""
数据仓储层：CrawlTaskRepository、RawSourceRepository、PlatformMappingRepository

所有仓储类使用 AsyncSession 进行数据库操作，ID 生成使用 SnowflakeIDGenerator。
时间字段统一使用 Long 类型 UTC 毫秒时间戳。
"""

import json
import time

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from crawler_service.models.entities import CrawlTask, PlatformMapping, RawSource
from crawler_service.utils.snowflake import SnowflakeIDGenerator

# 全局雪花 ID 生成器实例
_id_generator = SnowflakeIDGenerator(worker_id=1, datacenter_id=1)


def _now_ms() -> int:
    """获取当前 UTC 毫秒时间戳"""
    return int(time.time() * 1000)


class CrawlTaskRepository:
    """
    采集任务仓储

    提供 CrawlTask 的 CRUD 操作，包括创建任务、查询、更新进度、分页列表。
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(
        self,
        platform: str,
        task_type: str,
        trigger_type: str,
        project: str = "algorithm-help",
    ) -> CrawlTask:
        """
        创建采集任务。

        :param platform: 来源平台
        :param task_type: 任务类型 PROBLEM_SYNC/SOLUTION_SYNC/SINGLE_FETCH
        :param trigger_type: 触发方式 SCHEDULED/MANUAL/INCREMENTAL
        :param project: 所属项目
        :return: 新建的 CrawlTask 实体
        """
        task = CrawlTask(
            id=_id_generator.next_id(),
            platform=platform,
            task_type=task_type,
            status="PENDING",
            trigger_type=trigger_type,
            project=project,
            created_at=_now_ms(),
        )
        self._session.add(task)
        await self._session.flush()
        return task

    async def get_by_id(self, task_id: int) -> CrawlTask | None:
        """
        根据 ID 查询采集任务。

        :param task_id: 任务雪花 ID
        :return: CrawlTask 实体或 None
        """
        result = await self._session.get(CrawlTask, task_id)
        return result

    async def update_progress(self, task: CrawlTask) -> None:
        """
        更新任务进度（提交当前 session 中对 task 的修改）。

        :param task: 已修改 progress/status 的 CrawlTask 实体
        """
        await self._session.flush()

    async def save(self, task: CrawlTask) -> None:
        """
        保存任务（merge 到 session 并 flush）。

        :param task: CrawlTask 实体
        """
        await self._session.merge(task)
        await self._session.flush()

    async def list_tasks(
        self,
        page: int = 1,
        page_size: int = 20,
        platform: str | None = None,
        status: str | None = None,
    ) -> tuple[list[CrawlTask], int]:
        """
        分页查询采集任务列表，支持按 platform 和 status 筛选。

        :param page: 页码（从 1 开始）
        :param page_size: 每页数量
        :param platform: 平台筛选（可选）
        :param status: 状态筛选（可选）
        :return: (任务列表, 总数)
        """
        # 构建基础查询
        query = select(CrawlTask)
        count_query = select(func.count()).select_from(CrawlTask)

        # 条件筛选
        if platform is not None:
            query = query.where(CrawlTask.platform == platform)
            count_query = count_query.where(CrawlTask.platform == platform)
        if status is not None:
            query = query.where(CrawlTask.status == status)
            count_query = count_query.where(CrawlTask.status == status)

        # 总数
        total_result = await self._session.execute(count_query)
        total = total_result.scalar_one()

        # 分页排序（按创建时间降序）
        offset = (page - 1) * page_size
        query = query.order_by(CrawlTask.created_at.desc()).offset(offset).limit(page_size)

        result = await self._session.execute(query)
        tasks = list(result.scalars().all())

        return tasks, total


class RawSourceRepository:
    """
    原始采集数据仓储

    提供 RawSource 的保存、查询、状态更新操作。
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    async def save_raw(
        self,
        raw_data: dict,
        platform: str,
        project: str,
        content_type: str = "PROBLEM",
    ) -> RawSource:
        """
        保存原始采集数据。

        :param raw_data: 原始 JSON 数据（dict，将序列化为 JSON 字符串）
        :param platform: 来源平台
        :param project: 所属项目
        :param content_type: 内容类型 PROBLEM/SOLUTION/EDITORIAL/COMMENT
        :return: 新建的 RawSource 实体
        """
        # 从 raw_data 中提取 platform_id
        platform_id = str(raw_data.get("platform_id", raw_data.get("id", "")))

        raw_source = RawSource(
            id=_id_generator.next_id(),
            platform=platform,
            platform_id=platform_id,
            content_type=content_type,
            raw_json=json.dumps(raw_data, ensure_ascii=False),
            process_status="PENDING",
            project=project,
            fetched_at=_now_ms(),
        )
        self._session.add(raw_source)
        await self._session.flush()
        return raw_source

    async def get_by_platform_id(
        self, platform: str, platform_id: str
    ) -> RawSource | None:
        """
        根据平台和平台原始 ID 查询 RawSource。

        :param platform: 来源平台
        :param platform_id: 平台原始 ID
        :return: RawSource 实体或 None
        """
        query = select(RawSource).where(
            RawSource.platform == platform,
            RawSource.platform_id == platform_id,
        )
        result = await self._session.execute(query)
        return result.scalars().first()

    async def update_status(
        self,
        raw_source_id: int,
        status: str,
        error_message: str | None = None,
    ) -> None:
        """
        更新 RawSource 的处理状态。

        :param raw_source_id: RawSource 雪花 ID
        :param status: 新状态 PENDING/PROCESSING/COMPLETED/FAILED/INCOMPLETE/LOW_QUALITY
        :param error_message: 错误信息（可选）
        """
        raw_source = await self._session.get(RawSource, raw_source_id)
        if raw_source is None:
            return

        raw_source.process_status = status
        if error_message is not None:
            raw_source.error_message = error_message

        # 如果是完成状态，记录处理完成时间
        if status in ("COMPLETED", "FAILED", "INCOMPLETE", "LOW_QUALITY"):
            raw_source.processed_at = _now_ms()

        await self._session.flush()


class PlatformMappingRepository:
    """
    跨平台题目映射仓储

    提供 PlatformMapping 的保存和查询操作。
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    async def save_mapping(
        self,
        unified_problem_id: int,
        platform: str,
        platform_problem_id: str,
        platform_url: str,
        confidence: float,
        confirmed: bool,
        project: str = "algorithm-help",
    ) -> PlatformMapping:
        """
        保存跨平台映射记录。

        :param unified_problem_id: 内部统一题目 ID
        :param platform: 来源平台
        :param platform_problem_id: 平台原始题号
        :param platform_url: 平台链接
        :param confidence: 映射置信度 0-1
        :param confirmed: 是否人工确认
        :param project: 所属项目
        :return: 新建的 PlatformMapping 实体
        """
        mapping = PlatformMapping(
            id=_id_generator.next_id(),
            unified_problem_id=unified_problem_id,
            platform=platform,
            platform_problem_id=platform_problem_id,
            platform_url=platform_url,
            confidence=confidence,
            confirmed=confirmed,
            project=project,
            created_at=_now_ms(),
        )
        self._session.add(mapping)
        await self._session.flush()
        return mapping

    async def find_by_platform_and_id(
        self, platform: str, platform_problem_id: str
    ) -> PlatformMapping | None:
        """
        根据平台和平台题号查询映射记录。

        :param platform: 来源平台
        :param platform_problem_id: 平台原始题号
        :return: PlatformMapping 实体或 None
        """
        query = select(PlatformMapping).where(
            PlatformMapping.platform == platform,
            PlatformMapping.platform_problem_id == platform_problem_id,
        )
        result = await self._session.execute(query)
        return result.scalars().first()
