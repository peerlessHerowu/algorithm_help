"""Pydantic DTO 模型，与 Java Core 端 CrawlTriggerRequest、CrawlTaskDTO 语义一致"""

from typing import Generic, Optional, TypeVar

from pydantic import BaseModel, Field

from crawler_service.models.enums import (
    Platform,
    TaskStatus,
    TaskType,
    TriggerType,
)

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """
    统一 API 响应格式

    与 Java Core 端保持一致的 code/message/data 结构。
    code=0 表示成功，非 0 表示失败。
    """

    code: int = Field(default=0, description="响应码，0 表示成功")
    message: str = Field(default="success", description="响应消息")
    data: Optional[T] = Field(default=None, description="响应数据")


class CrawlTriggerRequest(BaseModel):
    """
    采集触发请求 DTO

    对应 Java 端：com.algorithm.help.api.dto.CrawlTriggerRequest
    - platform: 目标平台（不传则对所有 enabled 平台触发）
    - task_type: 任务类型（PROBLEM_SYNC / SOLUTION_SYNC / SINGLE_FETCH）
    - platform_problem_id: 单题采集时的平台题目 ID（SINGLE_FETCH 时必传）
    - project: 项目标识，用于多项目隔离

    注：Java 端有 triggerType 字段，Python HTTP API 层自动推断为 MANUAL，
    定时任务触发则为 SCHEDULED，因此请求体中不要求传入。
    """

    platform: Optional[Platform] = Field(
        default=None, description="目标平台，不传则全平台"
    )
    task_type: TaskType = Field(
        default=TaskType.PROBLEM_SYNC, description="任务类型"
    )
    platform_problem_id: Optional[str] = Field(
        default=None,
        description="单题采集时的平台题目 ID（SINGLE_FETCH 用）",
    )
    project: str = Field(
        default="algorithm-help", description="项目标识"
    )


class CrawlTaskDTO(BaseModel):
    """
    采集任务 DTO

    对应 Java 端：com.algorithm.help.api.dto.CrawlTaskDTO
    - Java 端将 total/completed/failed/currentItem 展平为独立字段
    - Python 端使用 progress dict 封装进度信息，API 序列化时保持兼容
    - 所有时间字段使用 UTC 毫秒时间戳（Long）
    """

    id: int = Field(description="任务 ID（雪花 ID）")
    platform: str = Field(description="平台标识")
    task_type: str = Field(description="任务类型")
    status: str = Field(description="任务状态")
    progress: Optional[dict] = Field(
        default=None,
        description="进度信息：{total, completed, failed, current_item}",
    )
    trigger_type: str = Field(description="触发方式")
    error_message: Optional[str] = Field(
        default=None, description="错误信息"
    )
    project: str = Field(description="项目标识")
    created_at: int = Field(description="创建时间（UTC 毫秒时间戳）")
    completed_at: Optional[int] = Field(
        default=None, description="完成时间（UTC 毫秒时间戳）"
    )
    last_fetch_time: Optional[int] = Field(
        default=None,
        description="上次采集时间（UTC 毫秒），用于增量检测",
    )


class PaginatedResponse(BaseModel, Generic[T]):
    """
    通用分页响应

    用于 GET /api/v1/crawl/tasks 等列表接口的分页返回。
    """

    items: list[T] = Field(description="当前页数据列表")
    total: int = Field(description="总记录数")
    page: int = Field(description="当前页码（从 1 开始）")
    page_size: int = Field(description="每页条数")
