"""
CrawlOrchestrator 编排器单元测试

验证核心编排逻辑：
- 任务加载和状态流转
- 并发控制（Semaphore）
- 单题失败不中断批次
- cancel() 取消支持
- task_type 采集范围控制
- solution_fetch_enabled 配置控制
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from crawler_service.config import PlatformConfig, Settings
from crawler_service.events.publisher import EventPublisher
from crawler_service.models.entities import CrawlTask
from crawler_service.orchestrator.dedup import DeduResult
from crawler_service.orchestrator.engine import (
    CoreServiceClient,
    CrawlOrchestrator,
)


# ---- Fixtures ----


def _make_task(
    task_id=1001,
    platform="LEETCODE_GLOBAL",
    task_type="PROBLEM_SYNC",
    status="PENDING",
    project="algorithm-help",
) -> CrawlTask:
    """创建测试用 CrawlTask 实体"""
    task = CrawlTask(
        id=task_id,
        platform=platform,
        task_type=task_type,
        status=status,
        trigger_type="MANUAL",
        project=project,
        created_at=1700000000000,
        last_fetch_time=None,
    )
    return task


def _make_orchestrator(
    task: CrawlTask = None,
    raw_problems: list[dict] = None,
    platform_cfg: PlatformConfig = None,
) -> tuple[CrawlOrchestrator, dict]:
    """创建带 mock 依赖的 CrawlOrchestrator 和 mock 字典"""
    if raw_problems is None:
        raw_problems = [
            {"platform_id": "1", "title": "Two Sum"},
            {"platform_id": "2", "title": "Add Two Numbers"},
        ]

    # Mock 依赖
    anti_crawl = AsyncMock()
    anti_crawl.acquire_permit = AsyncMock()
    anti_crawl.record_success = AsyncMock()
    anti_crawl.record_failure = AsyncMock()

    standardizer = AsyncMock()
    standardizer.standardize = AsyncMock(return_value={
        "platform_id": "1",
        "title": "Two Sum",
        "description": "# Two Sum",
        "difficulty": "EASY",
        "tags": ["array"],
        "quality_status": "COMPLETE",
    })
    standardizer.standardize_solution = AsyncMock(return_value={
        "platform_id": "sol1",
        "title": "Solution",
        "content": "# Solution content",
    })

    dedup = AsyncMock()
    dedup.check = AsyncMock(return_value=DeduResult.CREATE_NEW)

    task_repo = AsyncMock()
    if task:
        task_repo.get_by_id = AsyncMock(return_value=task)
    else:
        task_repo.get_by_id = AsyncMock(return_value=_make_task())
    task_repo.save = AsyncMock()
    task_repo.update_progress = AsyncMock()

    raw_repo = AsyncMock()
    raw_repo.save_raw = AsyncMock()

    event_publisher = EventPublisher(redis=None)  # 空操作模式

    core_client = AsyncMock(spec=CoreServiceClient)
    core_client.save_problem = AsyncMock(return_value=12345)
    core_client.save_solution = AsyncMock(return_value=67890)

    # 配置
    if platform_cfg is None:
        platform_cfg = PlatformConfig(
            enabled=True,
            solution_fetch_enabled=True,
            rate_limit=30,
        )
    config = MagicMock(spec=Settings)
    config.get_platform = MagicMock(return_value=platform_cfg)

    orchestrator = CrawlOrchestrator(
        anti_crawl=anti_crawl,
        standardizer=standardizer,
        dedup=dedup,
        task_repo=task_repo,
        raw_repo=raw_repo,
        event_publisher=event_publisher,
        core_client=core_client,
        config=config,
        max_concurrency=3,
    )

    mocks = {
        "anti_crawl": anti_crawl,
        "standardizer": standardizer,
        "dedup": dedup,
        "task_repo": task_repo,
        "raw_repo": raw_repo,
        "core_client": core_client,
        "config": config,
    }
    return orchestrator, mocks


# ---- 测试：任务状态流转 ----


@pytest.mark.asyncio
async def test_execute_crawl_completes_successfully():
    """正常执行完毕后任务状态为 COMPLETED"""
    task = _make_task()
    orchestrator, mocks = _make_orchestrator(task=task)

    # Mock adapter
    mock_adapter = AsyncMock()
    mock_adapter.fetch_problem_list = AsyncMock(return_value=[
        {"platform_id": "1", "title": "Two Sum"},
    ])
    mock_adapter.fetch_editorial = AsyncMock(return_value=None)

    with patch("crawler_service.orchestrator.engine.get_adapter", return_value=mock_adapter):
        await orchestrator.execute_crawl(task.id)

    assert task.status == "COMPLETED"
    assert task.last_fetch_time is not None
    assert task.completed_at is not None


@pytest.mark.asyncio
async def test_execute_crawl_task_not_found():
    """任务不存在时直接返回"""
    orchestrator, mocks = _make_orchestrator()
    mocks["task_repo"].get_by_id = AsyncMock(return_value=None)

    await orchestrator.execute_crawl(9999)
    # 不应调用 save
    mocks["task_repo"].save.assert_not_called()


@pytest.mark.asyncio
async def test_execute_crawl_empty_list_completes():
    """题目列表为空时任务状态为 COMPLETED"""
    task = _make_task()
    orchestrator, mocks = _make_orchestrator(task=task)

    mock_adapter = AsyncMock()
    mock_adapter.fetch_problem_list = AsyncMock(return_value=[])

    with patch("crawler_service.orchestrator.engine.get_adapter", return_value=mock_adapter):
        await orchestrator.execute_crawl(task.id)

    assert task.status == "COMPLETED"


# ---- 测试：单题失败不中断批次 ----


@pytest.mark.asyncio
async def test_single_item_failure_does_not_break_batch():
    """单题失败不影响其他题目处理"""
    task = _make_task()
    orchestrator, mocks = _make_orchestrator(task=task)

    # 第一题标准化抛异常，第二题正常
    call_count = {"n": 0}
    original_standardize = mocks["standardizer"].standardize

    async def side_effect(raw, platform):
        call_count["n"] += 1
        if call_count["n"] == 1:
            raise RuntimeError("模拟标准化失败")
        return {
            "platform_id": raw.get("platform_id"),
            "title": raw.get("title"),
            "quality_status": "COMPLETE",
        }

    mocks["standardizer"].standardize = AsyncMock(side_effect=side_effect)

    mock_adapter = AsyncMock()
    mock_adapter.fetch_problem_list = AsyncMock(return_value=[
        {"platform_id": "1", "title": "Two Sum"},
        {"platform_id": "2", "title": "Add Two Numbers"},
    ])
    mock_adapter.fetch_editorial = AsyncMock(return_value=None)

    with patch("crawler_service.orchestrator.engine.get_adapter", return_value=mock_adapter):
        await orchestrator.execute_crawl(task.id)

    # 批次应该完成，不是 FAILED
    assert task.status == "COMPLETED"
    # progress 中应记录 1 失败 1 成功
    assert task.progress["failed"] == 1
    assert task.progress["completed"] == 1


# ---- 测试：取消支持 ----


@pytest.mark.asyncio
async def test_cancel_sets_flag():
    """cancel() 设置取消标志"""
    task = _make_task()
    orchestrator, _ = _make_orchestrator(task=task)

    orchestrator.cancel(task.id)
    assert orchestrator.is_cancelled(task.id) is True


@pytest.mark.asyncio
async def test_cancelled_task_status():
    """取消后任务状态为 CANCELLED"""
    task = _make_task()
    orchestrator, mocks = _make_orchestrator(task=task)

    mock_adapter = AsyncMock()
    mock_adapter.fetch_problem_list = AsyncMock(return_value=[
        {"platform_id": "1", "title": "Two Sum"},
        {"platform_id": "2", "title": "Add Two Numbers"},
        {"platform_id": "3", "title": "Longest Substring"},
    ])

    # 在获取许可时设置取消标志
    async def cancel_on_acquire(platform):
        orchestrator.cancel(task.id)

    mocks["anti_crawl"].acquire_permit = AsyncMock(side_effect=cancel_on_acquire)

    with patch("crawler_service.orchestrator.engine.get_adapter", return_value=mock_adapter):
        await orchestrator.execute_crawl(task.id)

    assert task.status == "CANCELLED"


# ---- 测试：task_type 采集范围控制 ----


@pytest.mark.asyncio
async def test_problem_sync_fetches_editorial_not_solutions():
    """PROBLEM_SYNC 只采集 Editorial，不采集题解"""
    task = _make_task(task_type="PROBLEM_SYNC")
    orchestrator, mocks = _make_orchestrator(task=task)

    mock_adapter = AsyncMock()
    mock_adapter.fetch_problem_list = AsyncMock(return_value=[
        {"platform_id": "1", "title": "Two Sum"},
    ])
    mock_adapter.fetch_editorial = AsyncMock(return_value={"content": "editorial"})
    mock_adapter.fetch_solutions = AsyncMock(return_value=[])

    with patch("crawler_service.orchestrator.engine.get_adapter", return_value=mock_adapter):
        await orchestrator.execute_crawl(task.id)

    # Editorial 被调用
    mock_adapter.fetch_editorial.assert_called()
    # Solutions 不被调用
    mock_adapter.fetch_solutions.assert_not_called()


@pytest.mark.asyncio
async def test_solution_sync_fetches_solutions():
    """SOLUTION_SYNC 采集题解和评论"""
    task = _make_task(task_type="SOLUTION_SYNC")
    orchestrator, mocks = _make_orchestrator(task=task)

    mock_adapter = AsyncMock()
    mock_adapter.fetch_problem_list = AsyncMock(return_value=[
        {"platform_id": "1", "title": "Two Sum"},
    ])
    mock_adapter.fetch_solutions = AsyncMock(return_value=[
        {"platform_id": "sol1", "title": "Best solution", "content_html": "<p>test</p>"},
    ])
    mock_adapter.fetch_comments = AsyncMock(return_value=[])
    mock_adapter.fetch_editorial = AsyncMock(return_value=None)

    with patch("crawler_service.orchestrator.engine.get_adapter", return_value=mock_adapter):
        await orchestrator.execute_crawl(task.id)

    # Solutions 被调用
    mock_adapter.fetch_solutions.assert_called()


# ---- 测试：solution_fetch_enabled 配置控制 ----


@pytest.mark.asyncio
async def test_solution_fetch_disabled_skips_solutions():
    """solution_fetch_enabled=false 时跳过题解采集"""
    task = _make_task(task_type="SOLUTION_SYNC")
    platform_cfg = PlatformConfig(enabled=True, solution_fetch_enabled=False)
    orchestrator, mocks = _make_orchestrator(task=task, platform_cfg=platform_cfg)

    mock_adapter = AsyncMock()
    mock_adapter.fetch_problem_list = AsyncMock(return_value=[
        {"platform_id": "1", "title": "Two Sum"},
    ])
    mock_adapter.fetch_solutions = AsyncMock(return_value=[])
    mock_adapter.fetch_editorial = AsyncMock(return_value=None)

    with patch("crawler_service.orchestrator.engine.get_adapter", return_value=mock_adapter):
        await orchestrator.execute_crawl(task.id)

    # 即使是 SOLUTION_SYNC，配置禁用时也不调用 fetch_solutions
    mock_adapter.fetch_solutions.assert_not_called()


# ---- 测试：CoreServiceClient ----


@pytest.mark.asyncio
async def test_core_client_save_problem_incomplete_skipped():
    """质量为 INCOMPLETE 的题目不调用 core_client.save_problem"""
    task = _make_task()
    orchestrator, mocks = _make_orchestrator(task=task)

    # 标准化返回 INCOMPLETE
    mocks["standardizer"].standardize = AsyncMock(return_value={
        "platform_id": "1",
        "title": "Two Sum",
        "quality_status": "INCOMPLETE",
    })

    mock_adapter = AsyncMock()
    mock_adapter.fetch_problem_list = AsyncMock(return_value=[
        {"platform_id": "1", "title": "Two Sum"},
    ])
    mock_adapter.fetch_editorial = AsyncMock(return_value=None)

    with patch("crawler_service.orchestrator.engine.get_adapter", return_value=mock_adapter):
        await orchestrator.execute_crawl(task.id)

    # INCOMPLETE 不应写入 Core
    mocks["core_client"].save_problem.assert_not_called()
