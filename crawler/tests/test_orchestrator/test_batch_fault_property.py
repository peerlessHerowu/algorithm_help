"""
批次容错不中断 - Property Test

**Validates: Requirements 13.1**

使用 hypothesis 生成：
1. 随机批次大小 N (2-20 items)
2. 随机子集 M 个 item 会失败 (0 <= M <= N)
3. 验证：execute_crawl 后 task.progress["completed"] == N - M 且 task.progress["failed"] == M
4. 任务最终状态为 COMPLETED（不是 FAILED），即使有部分失败

通过 mock 适配器/标准化器，让指定子集的 item 在标准化阶段抛异常，
验证编排器的批次容错逻辑。
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from crawler_service.config import PlatformConfig, Settings
from crawler_service.events.publisher import EventPublisher
from crawler_service.models.entities import CrawlTask
from crawler_service.orchestrator.dedup import DeduResult
from crawler_service.orchestrator.engine import (
    CoreServiceClient,
    CrawlOrchestrator,
)


def _make_task(task_id=2001) -> CrawlTask:
    """创建测试用 CrawlTask 实体"""
    return CrawlTask(
        id=task_id,
        platform="LEETCODE_GLOBAL",
        task_type="PROBLEM_SYNC",
        status="PENDING",
        trigger_type="MANUAL",
        project="algorithm-help",
        created_at=1700000000000,
        last_fetch_time=None,
    )


def _make_orchestrator(task: CrawlTask) -> tuple[CrawlOrchestrator, dict]:
    """创建带 mock 依赖的 CrawlOrchestrator"""
    anti_crawl = AsyncMock()
    anti_crawl.acquire_permit = AsyncMock()
    anti_crawl.record_success = AsyncMock()
    anti_crawl.record_failure = AsyncMock()

    standardizer = AsyncMock()
    # 标准化默认返回正常结果（后续由测试按需覆盖 side_effect）
    standardizer.standardize = AsyncMock(return_value={
        "title": "Test",
        "quality_status": "COMPLETE",
    })

    dedup = AsyncMock()
    dedup.check = AsyncMock(return_value=DeduResult.CREATE_NEW)

    task_repo = AsyncMock()
    task_repo.get_by_id = AsyncMock(return_value=task)
    task_repo.save = AsyncMock()
    task_repo.update_progress = AsyncMock()

    raw_repo = AsyncMock()
    raw_repo.save_raw = AsyncMock()

    event_publisher = EventPublisher(redis=None)

    core_client = AsyncMock(spec=CoreServiceClient)
    core_client.save_problem = AsyncMock(return_value=12345)

    platform_cfg = PlatformConfig(enabled=True, solution_fetch_enabled=True, rate_limit=30)
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


# ---- Strategy：生成批次大小 N 和失败子集 M ----

@st.composite
def batch_with_failures(draw):
    """
    生成一个批次配置：
    - n: 批次大小 (2-20)
    - fail_indices: 失败 item 的索引集合 (0 <= |fail_indices| <= n)
    """
    n = draw(st.integers(min_value=2, max_value=20))
    # 从 [0, n) 中随机选择一个子集作为失败项
    fail_indices = draw(
        st.frozensets(st.integers(min_value=0, max_value=n - 1), max_size=n)
    )
    return n, fail_indices


class TestBatchFaultToleranceProperty:
    """Property 16: 批次容错不中断"""

    @given(data=batch_with_failures())
    @settings(max_examples=50)
    @pytest.mark.asyncio
    async def test_partial_failure_counts_correctly(self, data):
        """
        **Validates: Requirements 13.1**

        Property: 对于 N 个 item 的批次，如果其中 M 个失败，则：
        - task.progress["completed"] == N - M
        - task.progress["failed"] == M
        - task.status == "COMPLETED"（不因部分失败而整体 FAILED）
        """
        n, fail_indices = data
        m = len(fail_indices)

        task = _make_task()
        orchestrator, mocks = _make_orchestrator(task)

        # 构造 N 个 raw_problems
        raw_problems = [
            {"platform_id": str(i), "title": f"Problem {i}"}
            for i in range(n)
        ]

        # 使用计数器追踪调用顺序，根据 platform_id 决定成功或失败
        async def standardize_side_effect(raw, platform):
            idx = int(raw["platform_id"])
            if idx in fail_indices:
                raise RuntimeError(f"模拟第 {idx} 项标准化失败")
            return {
                "title": raw["title"],
                "quality_status": "COMPLETE",
            }

        mocks["standardizer"].standardize = AsyncMock(
            side_effect=standardize_side_effect
        )

        # Mock adapter 返回构造的列表
        mock_adapter = AsyncMock()
        mock_adapter.fetch_problem_list = AsyncMock(return_value=raw_problems)
        mock_adapter.fetch_editorial = AsyncMock(return_value=None)

        with patch(
            "crawler_service.orchestrator.engine.get_adapter",
            return_value=mock_adapter,
        ):
            await orchestrator.execute_crawl(task.id)

        # 验证：任务状态为 COMPLETED（部分失败不影响整体）
        assert task.status == "COMPLETED", (
            f"N={n}, M={m}: 任务状态应为 COMPLETED，"
            f"实际为 {task.status}"
        )

        # 验证：progress 计数正确
        assert task.progress["completed"] == n - m, (
            f"N={n}, M={m}: completed 应为 {n - m}，"
            f"实际为 {task.progress['completed']}"
        )
        assert task.progress["failed"] == m, (
            f"N={n}, M={m}: failed 应为 {m}，"
            f"实际为 {task.progress['failed']}"
        )

        # 验证：total 等于 N
        assert task.progress["total"] == n, (
            f"N={n}: total 应为 {n}，实际为 {task.progress['total']}"
        )

    @given(n=st.integers(min_value=2, max_value=20))
    @settings(max_examples=30)
    @pytest.mark.asyncio
    async def test_all_items_fail_still_completes(self, n):
        """
        **Validates: Requirements 13.1**

        Property: 即使批次中所有 item 都失败，
        任务状态仍为 COMPLETED（不是 FAILED），
        progress["failed"] == N, progress["completed"] == 0。
        """
        task = _make_task()
        orchestrator, mocks = _make_orchestrator(task)

        raw_problems = [
            {"platform_id": str(i), "title": f"Problem {i}"}
            for i in range(n)
        ]

        # 所有 item 标准化失败
        async def always_fail(raw, platform):
            raise RuntimeError("模拟全部失败")

        mocks["standardizer"].standardize = AsyncMock(side_effect=always_fail)

        mock_adapter = AsyncMock()
        mock_adapter.fetch_problem_list = AsyncMock(return_value=raw_problems)

        with patch(
            "crawler_service.orchestrator.engine.get_adapter",
            return_value=mock_adapter,
        ):
            await orchestrator.execute_crawl(task.id)

        # 任务仍为 COMPLETED（批次级别不因 item 失败而 FAILED）
        assert task.status == "COMPLETED", (
            f"N={n}: 全部 item 失败时任务状态应仍为 COMPLETED，"
            f"实际为 {task.status}"
        )
        assert task.progress["completed"] == 0
        assert task.progress["failed"] == n
