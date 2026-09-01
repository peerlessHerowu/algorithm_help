"""
SQLAlchemy ORM 实体定义

定义 CrawlTask、RawSource、PlatformMapping 三个核心实体。
所有时间字段使用 BigInteger 存储 UTC 毫秒时间戳，与 Java Core 端保持一致。
"""

from sqlalchemy import BigInteger, Boolean, Float, Index, String, Text
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """ORM 声明基类"""
    pass


class CrawlTask(Base):
    """
    采集任务实体

    记录每次采集任务的类型、状态、进度和错误信息。
    last_fetch_time 用于增量检测：下次采集仅拉取该时间之后的新内容。
    """

    __tablename__ = "crawl_task"

    id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, comment="雪花ID"
    )
    platform: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="来源平台"
    )
    task_type: Mapped[str] = mapped_column(
        String(30), nullable=False, comment="PROBLEM_SYNC/SOLUTION_SYNC/SINGLE_FETCH"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="PENDING", comment="PENDING/RUNNING/COMPLETED/FAILED/CANCELLED"
    )
    progress: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment='{"total":100,"completed":50,"failed":2,"current_item":"two-sum"}'
    )
    trigger_type: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="SCHEDULED/MANUAL/INCREMENTAL"
    )
    error_message: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="失败原因"
    )
    project: Mapped[str] = mapped_column(
        String(50), nullable=False, default="algorithm-help", comment="所属项目"
    )
    created_at: Mapped[int] = mapped_column(
        BigInteger, nullable=False, comment="创建时间 UTC毫秒"
    )
    completed_at: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, comment="完成时间 UTC毫秒"
    )
    last_fetch_time: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, comment="上次采集时间 UTC毫秒，用于增量检测"
    )

    __table_args__ = (
        Index("idx_crawltask_platform_status", "platform", "status"),
        Index("idx_crawltask_project", "project"),
        Index("idx_crawltask_created", "created_at"),
    )

    def increment_completed(self) -> None:
        """递增已完成计数"""
        if self.progress is None:
            self.progress = {"total": 0, "completed": 0, "failed": 0}
        # SQLAlchemy JSON 字段需要重新赋值才能触发变更检测
        progress = dict(self.progress)
        progress["completed"] = progress.get("completed", 0) + 1
        self.progress = progress

    def increment_failed(self, item_id: str = "", error: str = "") -> None:
        """递增失败计数，并记录最近一次失败信息"""
        if self.progress is None:
            self.progress = {"total": 0, "completed": 0, "failed": 0}
        progress = dict(self.progress)
        progress["failed"] = progress.get("failed", 0) + 1
        if item_id or error:
            progress["last_error"] = f"{item_id}: {error}" if item_id else error
        self.progress = progress


class RawSource(Base):
    """
    原始采集数据实体

    保留平台原始 JSON 数据，用于重放和审计。
    process_status 标记处理生命周期。
    """

    __tablename__ = "raw_source"

    id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, comment="雪花ID"
    )
    platform: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="来源平台"
    )
    platform_id: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="平台原始ID"
    )
    content_type: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="PROBLEM/SOLUTION/EDITORIAL/COMMENT"
    )
    raw_json: Mapped[str] = mapped_column(
        Text, nullable=False, comment="原始JSON数据"
    )
    process_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="PENDING",
        comment="PENDING/PROCESSING/COMPLETED/FAILED/INCOMPLETE/LOW_QUALITY"
    )
    error_message: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="处理失败原因"
    )
    project: Mapped[str] = mapped_column(
        String(50), nullable=False, default="algorithm-help", comment="所属项目"
    )
    fetched_at: Mapped[int] = mapped_column(
        BigInteger, nullable=False, comment="采集时间 UTC毫秒"
    )
    processed_at: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, comment="处理完成时间 UTC毫秒"
    )

    __table_args__ = (
        Index("idx_rawsource_platform_id", "platform", "platform_id"),
        Index("idx_rawsource_status", "process_status"),
        Index("idx_rawsource_project", "project"),
    )


class PlatformMapping(Base):
    """
    跨平台题目映射实体

    记录不同平台题目到内部统一题目 ID 的映射关系。
    confidence 表示映射置信度，confirmed 表示是否经过人工确认。
    """

    __tablename__ = "platform_mapping"

    id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, comment="雪花ID"
    )
    unified_problem_id: Mapped[int] = mapped_column(
        BigInteger, nullable=False, comment="内部统一题目ID"
    )
    platform: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="来源平台"
    )
    platform_problem_id: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="平台原始题号"
    )
    platform_url: Mapped[str] = mapped_column(
        String(500), nullable=False, default="", comment="平台链接"
    )
    confidence: Mapped[float] = mapped_column(
        Float, nullable=False, default=1.0, comment="映射置信度 0-1"
    )
    confirmed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, comment="是否人工确认"
    )
    project: Mapped[str] = mapped_column(
        String(50), nullable=False, default="algorithm-help", comment="所属项目"
    )
    created_at: Mapped[int] = mapped_column(
        BigInteger, nullable=False, comment="创建时间 UTC毫秒"
    )

    __table_args__ = (
        Index("uk_mapping_platform_problemid", "platform", "platform_problem_id", unique=True),
        Index("idx_mapping_unified", "unified_problem_id"),
        Index("idx_mapping_project", "project"),
    )
