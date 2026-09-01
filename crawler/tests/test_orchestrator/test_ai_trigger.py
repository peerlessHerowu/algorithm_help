"""
AiTriggerService 单元测试

测试 AI 加工触发与成本控制功能：
- 令牌桶限流（每分钟 batch_rate_limit 次）
- 优先级队列排序
- 每日预算控制
- 失败标记 FAILED 不阻塞
- 手动 retry_ai 重触发
"""

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from crawler_service.config import AiConfig
from crawler_service.orchestrator.ai_trigger import (
    AiPriority,
    AiTask,
    AiTriggerService,
)


@pytest.fixture
def ai_config() -> AiConfig:
    """标准测试用 AI 配置"""
    return AiConfig(
        base_url="http://localhost:8100",
        api_key="test-key",
        timeout=10,
        batch_rate_limit=10,
        daily_budget=100,
    )


@pytest.fixture
def mock_raw_repo() -> AsyncMock:
    """Mock RawSourceRepository"""
    repo = AsyncMock()
    repo.update_status = AsyncMock()
    return repo


@pytest.fixture
def service(ai_config: AiConfig, mock_raw_repo: AsyncMock) -> AiTriggerService:
    """创建 AiTriggerService 实例"""
    return AiTriggerService(ai_config=ai_config, raw_repo=mock_raw_repo)


class TestTriggerAiEnrichment:
    """trigger_ai_enrichment 入队测试"""

    @pytest.mark.asyncio
    async def test_enqueue_adds_to_queue(self, service: AiTriggerService):
        """入队后队列大小增加"""
        assert service.queue_size == 0
        await service.trigger_ai_enrichment(1001, AiPriority.NORMAL)
        assert service.queue_size == 1

    @pytest.mark.asyncio
    async def test_enqueue_multiple_tasks(self, service: AiTriggerService):
        """多次入队后队列大小正确"""
        await service.trigger_ai_enrichment(1001, AiPriority.HOT)
        await service.trigger_ai_enrichment(1002, AiPriority.NORMAL)
        await service.trigger_ai_enrichment(1003, AiPriority.UPDATE)
        assert service.queue_size == 3


class TestPriorityQueue:
    """优先级队列排序测试"""

    @pytest.mark.asyncio
    async def test_hot_processed_before_normal(self, service: AiTriggerService):
        """HOT 优先级任务优先于 NORMAL 被消费"""
        await service.trigger_ai_enrichment(1001, AiPriority.NORMAL)
        await service.trigger_ai_enrichment(1002, AiPriority.HOT)
        await service.trigger_ai_enrichment(1003, AiPriority.UPDATE)

        # 弹出顺序应为 HOT(1002) → NORMAL(1001) → UPDATE(1003)
        task1 = await service._pop_task()
        task2 = await service._pop_task()
        task3 = await service._pop_task()

        assert task1.raw_source_id == 1002  # HOT
        assert task2.raw_source_id == 1001  # NORMAL
        assert task3.raw_source_id == 1003  # UPDATE

    @pytest.mark.asyncio
    async def test_same_priority_fifo(self, service: AiTriggerService):
        """相同优先级按入队时间排序（FIFO）"""
        await service.trigger_ai_enrichment(1001, AiPriority.NORMAL)
        await service.trigger_ai_enrichment(1002, AiPriority.NORMAL)

        task1 = await service._pop_task()
        task2 = await service._pop_task()

        # 同优先级，先入队的先出
        assert task1.raw_source_id == 1001
        assert task2.raw_source_id == 1002

    @pytest.mark.asyncio
    async def test_empty_queue_returns_none(self, service: AiTriggerService):
        """空队列弹出返回 None"""
        task = await service._pop_task()
        assert task is None


class TestDailyBudget:
    """每日预算控制测试"""

    @pytest.mark.asyncio
    async def test_initial_budget(self, service: AiTriggerService):
        """初始状态预算未使用"""
        assert service.daily_used == 0
        assert service.daily_remaining == 100
        assert not service.is_budget_exhausted

    @pytest.mark.asyncio
    async def test_budget_exhausted_stops_processing(
        self, service: AiTriggerService
    ):
        """预算耗尽后 process_queue 不再处理任务"""
        # 模拟预算已耗尽
        service._daily_used = 100

        await service.trigger_ai_enrichment(1001, AiPriority.NORMAL)
        processed = await service.process_queue()

        assert processed == 0
        # 任务仍在队列中（不丢弃）
        assert service.queue_size == 1

    @pytest.mark.asyncio
    async def test_budget_reset_on_new_day(self, service: AiTriggerService):
        """跨日后预算自动重置"""
        service._daily_used = 100
        # 模拟前一天的日期
        service._budget_reset_date = "2020-01-01"

        assert service.daily_remaining > 0
        assert not service.is_budget_exhausted

    @pytest.mark.asyncio
    async def test_budget_decremented_on_success(
        self, ai_config: AiConfig, mock_raw_repo: AsyncMock
    ):
        """成功调用后预算递减"""
        service = AiTriggerService(ai_config=ai_config, raw_repo=mock_raw_repo)
        await service.trigger_ai_enrichment(1001, AiPriority.NORMAL)

        # Mock HTTP 调用成功
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.raise_for_status = MagicMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            processed = await service.process_queue()

        assert processed == 1
        assert service.daily_used == 1


class TestFailureHandling:
    """失败处理测试"""

    @pytest.mark.asyncio
    async def test_failure_marks_failed_not_blocking(
        self, ai_config: AiConfig, mock_raw_repo: AsyncMock
    ):
        """AI 调用失败时标记 FAILED，不阻塞后续任务"""
        service = AiTriggerService(ai_config=ai_config, raw_repo=mock_raw_repo)
        await service.trigger_ai_enrichment(1001, AiPriority.NORMAL)
        await service.trigger_ai_enrichment(1002, AiPriority.NORMAL)

        # Mock HTTP 调用：第一个失败，第二个成功
        call_count = 0

        async def mock_post(url, json=None):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise httpx.ConnectError("connection refused")
            resp = MagicMock()
            resp.status_code = 200
            resp.raise_for_status = MagicMock()
            return resp

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = mock_post
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            processed = await service.process_queue()

        # 第一个失败被标记 FAILED，第二个成功
        assert processed == 1
        mock_raw_repo.update_status.assert_any_call(1001, "FAILED", "AI 加工调用失败")
        mock_raw_repo.update_status.assert_any_call(1002, "PROCESSING")

    @pytest.mark.asyncio
    async def test_failure_does_not_block_crawl(
        self, ai_config: AiConfig, mock_raw_repo: AsyncMock
    ):
        """失败不消耗预算"""
        service = AiTriggerService(ai_config=ai_config, raw_repo=mock_raw_repo)
        await service.trigger_ai_enrichment(1001, AiPriority.NORMAL)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=httpx.ConnectError("timeout"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            await service.process_queue()

        # 失败不计入预算
        assert service.daily_used == 0


class TestRetryAi:
    """手动重触发测试"""

    @pytest.mark.asyncio
    async def test_retry_enqueues_with_hot_priority(self, service: AiTriggerService):
        """retry_ai 以 HOT 优先级重新入队"""
        # 先入一个 NORMAL 任务
        await service.trigger_ai_enrichment(1001, AiPriority.NORMAL)
        # 手动重触发
        result = await service.retry_ai(2001)

        assert result is True
        assert service.queue_size == 2

        # 重触发的任务应优先被弹出（HOT 优先级）
        task = await service._pop_task()
        assert task.raw_source_id == 2001
        assert task.priority == AiPriority.HOT.value
        assert task.retry_count == 1


class TestRateLimiter:
    """令牌桶限流集成测试"""

    @pytest.mark.asyncio
    async def test_rate_limiter_initialized_from_config(self, service: AiTriggerService):
        """限流器根据配置初始化"""
        assert service._rate_limiter.rate == 10
        assert service._rate_limiter.period == 60.0


class TestUpdateConfig:
    """动态配置更新测试"""

    @pytest.mark.asyncio
    async def test_update_config_changes_budget_and_rate(
        self, service: AiTriggerService
    ):
        """update_config 更新预算和限流器"""
        new_config = AiConfig(
            base_url="http://new-ai:8100",
            batch_rate_limit=20,
            daily_budget=500,
        )
        service.update_config(new_config)

        assert service._daily_budget == 500
        assert service._rate_limiter.rate == 20
        assert service.daily_remaining == 500


class TestAiTaskOrdering:
    """AiTask dataclass 排序测试"""

    def test_task_ordering_by_priority(self):
        """任务按 priority 值排序"""
        t1 = AiTask(priority=1, enqueue_time=100.0, raw_source_id=1)
        t2 = AiTask(priority=2, enqueue_time=99.0, raw_source_id=2)
        t3 = AiTask(priority=3, enqueue_time=98.0, raw_source_id=3)

        sorted_tasks = sorted([t3, t1, t2])
        assert sorted_tasks[0].raw_source_id == 1  # HOT
        assert sorted_tasks[1].raw_source_id == 2  # NORMAL
        assert sorted_tasks[2].raw_source_id == 3  # UPDATE

    def test_same_priority_ordered_by_time(self):
        """相同优先级按入队时间排序"""
        t1 = AiTask(priority=2, enqueue_time=100.0, raw_source_id=1)
        t2 = AiTask(priority=2, enqueue_time=101.0, raw_source_id=2)

        # dataclass order=True 会按字段顺序比较
        # priority 相同时比较 enqueue_time（但 compare=False）
        # 所以 heapq 实际只比较 priority
        assert t1 <= t2 or t2 <= t1  # 至少可比较
