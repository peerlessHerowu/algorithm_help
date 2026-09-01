"""
采集管理 API 端点

提供采集任务的触发、查询、取消和 AI 加工重触发功能。
所有响应统一使用 ApiResponse[T] 格式：{"code": 0, "message": "success", "data": ...}

Validates: Requirements 22.1, 22.4, 23.1, 23.2, 23.3, 23.4, 23.5, 6.5
"""

import asyncio
from typing import Optional

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, Query

from ..config import Settings, get_settings
from ..database.repository import CrawlTaskRepository, RawSourceRepository
from ..models.entities import CrawlTask
from ..models.enums import Platform, TaskStatus, TriggerType
from ..models.schemas import (
    ApiResponse,
    CrawlTaskDTO,
    CrawlTriggerRequest,
    PaginatedResponse,
)
from ..orchestrator.ai_trigger import AiTriggerService
from ..orchestrator.engine import CrawlOrchestrator

logger = structlog.get_logger()

router = APIRouter(prefix="/api/v1/crawl", tags=["采集管理"])


# ---- 依赖注入占位（由 main.py 中 app.state 注入或通过 Depends 获取） ----

# 全局实例引用（在 main.py 启动时设置）
_orchestrator: Optional[CrawlOrchestrator] = None
_task_repo: Optional[CrawlTaskRepository] = None
_raw_repo: Optional[RawSourceRepository] = None
_ai_trigger: Optional[AiTriggerService] = None


def set_dependencies(
    orchestrator: CrawlOrchestrator,
    task_repo: CrawlTaskRepository,
    raw_repo: Optional[RawSourceRepository] = None,
    ai_trigger: Optional[AiTriggerService] = None,
) -> None:
    """由 main.py 在启动时调用，注入核心依赖"""
    global _orchestrator, _task_repo, _raw_repo, _ai_trigger
    _orchestrator = orchestrator
    _task_repo = task_repo
    _raw_repo = raw_repo
    _ai_trigger = ai_trigger


def get_orchestrator() -> CrawlOrchestrator:
    """获取 CrawlOrchestrator 实例"""
    if _orchestrator is None:
        raise RuntimeError("CrawlOrchestrator 未初始化")
    return _orchestrator


def get_task_repo() -> CrawlTaskRepository:
    """获取 CrawlTaskRepository 实例"""
    if _task_repo is None:
        raise RuntimeError("CrawlTaskRepository 未初始化")
    return _task_repo


def get_ai_trigger() -> AiTriggerService:
    """获取 AiTriggerService 实例"""
    if _ai_trigger is None:
        raise RuntimeError("AiTriggerService 未初始化")
    return _ai_trigger


# ---- 辅助函数 ----


def _task_to_dto(task: CrawlTask) -> CrawlTaskDTO:
    """将 CrawlTask ORM 实体转换为 CrawlTaskDTO"""
    return CrawlTaskDTO(
        id=task.id,
        platform=task.platform,
        task_type=task.task_type,
        status=task.status,
        progress=task.progress,
        trigger_type=task.trigger_type,
        error_message=task.error_message,
        project=task.project,
        created_at=task.created_at,
        completed_at=task.completed_at,
        last_fetch_time=task.last_fetch_time,
    )


# ---- API 端点 ----


@router.post("/trigger", response_model=ApiResponse[CrawlTaskDTO])
async def trigger_crawl(
    request: CrawlTriggerRequest,
    background_tasks: BackgroundTasks,
    orchestrator: CrawlOrchestrator = Depends(get_orchestrator),
    task_repo: CrawlTaskRepository = Depends(get_task_repo),
):
    """
    触发采集任务

    - platform 不传则对所有 enabled 平台触发
    - task_type 默认 PROBLEM_SYNC
    - 创建 CrawlTask 后异步启动编排器执行
    """
    settings = get_settings()

    # 确定目标平台列表
    if request.platform is not None:
        platforms = [request.platform.value]
    else:
        # 对所有 enabled 平台触发
        platforms = [
            p for p, cfg in settings.platforms.items() if cfg.enabled
        ]

    if not platforms:
        return ApiResponse(code=400, message="无可用平台", data=None)

    # 创建任务（对每个平台创建一个任务，返回第一个）
    first_task: Optional[CrawlTask] = None
    for platform in platforms:
        task = await task_repo.create(
            platform=platform,
            task_type=request.task_type.value,
            trigger_type=TriggerType.MANUAL.value,
            project=request.project,
        )
        if first_task is None:
            first_task = task
        # 异步启动编排器执行
        background_tasks.add_task(orchestrator.execute_crawl, task.id)
        logger.info("采集任务已创建", task_id=task.id, platform=platform)

    return ApiResponse(
        code=0,
        message="success",
        data=_task_to_dto(first_task),
    )


@router.get("/tasks", response_model=ApiResponse[PaginatedResponse[CrawlTaskDTO]])
async def list_tasks(
    platform: Optional[str] = Query(None, description="平台筛选"),
    status: Optional[str] = Query(None, description="状态筛选"),
    page: int = Query(1, ge=1, description="页码（从 1 开始）"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    task_repo: CrawlTaskRepository = Depends(get_task_repo),
):
    """
    分页查询采集任务列表

    支持按 platform 和 status 筛选，按创建时间降序排列。
    """
    tasks, total = await task_repo.list_tasks(
        page=page,
        page_size=page_size,
        platform=platform,
        status=status,
    )

    items = [_task_to_dto(t) for t in tasks]
    paginated = PaginatedResponse[CrawlTaskDTO](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )
    return ApiResponse(code=0, message="success", data=paginated)


@router.get("/tasks/{task_id}", response_model=ApiResponse[CrawlTaskDTO])
async def get_task_detail(
    task_id: int,
    task_repo: CrawlTaskRepository = Depends(get_task_repo),
):
    """
    查询采集任务详情（含进度信息）

    返回单个任务的完整状态，包括 progress 中的 total/completed/failed。
    """
    task = await task_repo.get_by_id(task_id)
    if task is None:
        return ApiResponse(code=404, message="任务不存在", data=None)

    return ApiResponse(code=0, message="success", data=_task_to_dto(task))


@router.post("/tasks/{task_id}/cancel", response_model=ApiResponse[CrawlTaskDTO])
async def cancel_task(
    task_id: int,
    orchestrator: CrawlOrchestrator = Depends(get_orchestrator),
    task_repo: CrawlTaskRepository = Depends(get_task_repo),
):
    """
    取消采集任务

    设置取消标志，正在执行的任务会在下一循环点检查并退出。
    仅 PENDING/RUNNING 状态的任务可取消。
    """
    task = await task_repo.get_by_id(task_id)
    if task is None:
        return ApiResponse(code=404, message="任务不存在", data=None)

    if task.status not in (TaskStatus.PENDING.value, TaskStatus.RUNNING.value):
        return ApiResponse(
            code=400,
            message=f"任务状态为 {task.status}，无法取消",
            data=_task_to_dto(task),
        )

    # 设置取消标志
    orchestrator.cancel(task_id)

    # 如果任务还是 PENDING 状态，直接标记为 CANCELLED
    if task.status == TaskStatus.PENDING.value:
        task.status = TaskStatus.CANCELLED.value
        await task_repo.save(task)

    return ApiResponse(code=0, message="success", data=_task_to_dto(task))


@router.post("/retry-ai/{raw_source_id}", response_model=ApiResponse[dict])
async def retry_ai_enrichment(
    raw_source_id: int,
    ai_trigger: AiTriggerService = Depends(get_ai_trigger),
):
    """
    手动重触发 AI 加工

    对 FAILED 状态的 raw_source 重新入队 AI 加工，以高优先级处理。
    """
    success = await ai_trigger.retry_ai(raw_source_id)
    if success:
        return ApiResponse(
            code=0,
            message="success",
            data={"raw_source_id": raw_source_id, "status": "queued"},
        )
    return ApiResponse(
        code=500,
        message="AI 加工重触发失败",
        data=None,
    )
