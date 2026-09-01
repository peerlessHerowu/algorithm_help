"""
定时任务调度配置测试

验证：
1. setup_scheduler 正确配置三个定时调度
2. 每个任务 max_running_jobs=1
3. trigger_job / pause_job / resume_job 控制函数
4. 重试逻辑和退避计算
5. 任务 job 函数的基本行为

Validates: Requirements 9.1, 9.2, 9.4, 9.5
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from crawler_service.config import PlatformConfig, Settings
from crawler_service.scheduler.jobs import (
    MAX_RETRY_COUNT,
    RETRY_BACKOFF_BASE_MS,
    SCHEDULE_FAILED_RETRY,
    SCHEDULE_FULL_PLATFORM_SYNC,
    SCHEDULE_SOLUTION_SYNC,
    SchedulerJobContext,
    _calc_backoff,
    _get_retry_count,
    _increment_retry_count,
    job_failed_retry,
    job_full_platform_sync,
    job_solution_sync,
    pause_job,
    resume_job,
    setup_scheduler,
    shutdown_scheduler,
    trigger_job,
)


# ---- Fixtures ----


@pytest.fixture
def mock_config():
    """构建测试用 Settings 配置"""
    return Settings(
        project="algorithm-help",
        platforms={
            "leetcode_global": PlatformConfig(
                enabled=True, solution_fetch_enabled=True
            ),
            "codeforces": PlatformConfig(
                enabled=True, solution_fetch_enabled=False
            ),
            "luogu": PlatformConfig(enabled=False),
        },
    )


@pytest.fixture
def mock_orchestrator():
    """模拟编排器"""
    orch = AsyncMock()
    orch.execute_crawl = AsyncMock()
    return orch


@pytest.fixture
def mock_task_repo():
    """模拟任务仓储"""
    return AsyncMock()


@pytest.fixture
async def scheduler_instance(mock_orchestrator, mock_task_repo, mock_config):
    """创建调度器实例并在测试后关闭

    APScheduler 4.x 需要进入 async context manager 后才能操作。
    """
    sched = await setup_scheduler(
        orchestrator=mock_orchestrator,
        task_repo=mock_task_repo,
        config=mock_config,
    )
    yield sched
    await shutdown_scheduler()


# ---- setup_scheduler 测试 ----


class TestSetupScheduler:
    """测试调度器初始化配置"""

    @pytest.mark.asyncio
    async def test_returns_scheduler_instance(self, scheduler_instance):
        """setup_scheduler 返回 AsyncScheduler 实例"""
        from apscheduler import AsyncScheduler
        assert isinstance(scheduler_instance, AsyncScheduler)

    @pytest.mark.asyncio
    async def test_configures_three_schedules(self, scheduler_instance):
        """配置了三个定时调度"""
        schedules = await scheduler_instance.get_schedules()
        schedule_ids = [s.id for s in schedules]
        assert SCHEDULE_FULL_PLATFORM_SYNC in schedule_ids
        assert SCHEDULE_SOLUTION_SYNC in schedule_ids
        assert SCHEDULE_FAILED_RETRY in schedule_ids
        assert len(schedules) == 3

    @pytest.mark.asyncio
    async def test_tasks_have_max_running_jobs_one(self, scheduler_instance):
        """所有任务 max_running_jobs=1 防止重复执行"""
        tasks = await scheduler_instance.get_tasks()
        for task in tasks:
            assert task.max_running_jobs == 1


# ---- 控制 API 测试 ----


class TestControlAPI:
    """测试 trigger_job / pause_job / resume_job"""

    @pytest.mark.asyncio
    async def test_pause_job_success(self, scheduler_instance):
        """暂停已存在的调度返回 True"""
        result = await pause_job(SCHEDULE_FULL_PLATFORM_SYNC)
        assert result is True

    @pytest.mark.asyncio
    async def test_resume_job_success(self, scheduler_instance):
        """恢复已暂停的调度返回 True"""
        await pause_job(SCHEDULE_FULL_PLATFORM_SYNC)
        result = await resume_job(SCHEDULE_FULL_PLATFORM_SYNC)
        assert result is True

    @pytest.mark.asyncio
    async def test_pause_nonexistent_schedule(self, scheduler_instance):
        """暂停不存在的调度返回 False"""
        result = await pause_job("nonexistent_schedule")
        assert result is False

    @pytest.mark.asyncio
    async def test_resume_nonexistent_schedule(self, scheduler_instance):
        """恢复不存在的调度返回 False"""
        result = await resume_job("nonexistent_schedule")
        assert result is False

    @pytest.mark.asyncio
    async def test_trigger_nonexistent_schedule(self, scheduler_instance):
        """触发不存在的调度返回 False"""
        result = await trigger_job("nonexistent_schedule")
        assert result is False

    @pytest.mark.asyncio
    async def test_pause_without_scheduler(self):
        """调度器未初始化时暂停返回 False"""
        import crawler_service.scheduler.jobs as jobs_module
        original = jobs_module._scheduler
        jobs_module._scheduler = None
        try:
            result = await pause_job(SCHEDULE_FULL_PLATFORM_SYNC)
            assert result is False
        finally:
            jobs_module._scheduler = original

    @pytest.mark.asyncio
    async def test_resume_without_scheduler(self):
        """调度器未初始化时恢复返回 False"""
        import crawler_service.scheduler.jobs as jobs_module
        original = jobs_module._scheduler
        jobs_module._scheduler = None
        try:
            result = await resume_job(SCHEDULE_FULL_PLATFORM_SYNC)
            assert result is False
        finally:
            jobs_module._scheduler = original

    @pytest.mark.asyncio
    async def test_trigger_without_scheduler(self):
        """调度器未初始化时触发返回 False"""
        import crawler_service.scheduler.jobs as jobs_module
        original = jobs_module._scheduler
        jobs_module._scheduler = None
        try:
            result = await trigger_job(SCHEDULE_FULL_PLATFORM_SYNC)
            assert result is False
        finally:
            jobs_module._scheduler = original


# ---- 退避计算测试 ----


class TestBackoffCalc:
    """测试指数退避计算"""

    def test_first_attempt_backoff(self):
        """第 0 次重试退避 = base * 2^0 = base"""
        assert _calc_backoff(0) == RETRY_BACKOFF_BASE_MS

    def test_second_attempt_backoff(self):
        """第 1 次重试退避 = base * 2^1"""
        assert _calc_backoff(1) == RETRY_BACKOFF_BASE_MS * 2

    def test_third_attempt_backoff(self):
        """第 2 次重试退避 = base * 2^2"""
        assert _calc_backoff(2) == RETRY_BACKOFF_BASE_MS * 4

    def test_backoff_exponential_growth(self):
        """退避时间指数增长"""
        for i in range(5):
            expected = RETRY_BACKOFF_BASE_MS * (2 ** i)
            assert _calc_backoff(i) == expected


# ---- 重试计数辅助函数测试 ----


class TestRetryCount:
    """测试重试计数辅助函数"""

    def test_get_retry_count_none_progress(self):
        """progress 为 None 时返回 0"""
        task = MagicMock()
        task.progress = None
        assert _get_retry_count(task) == 0

    def test_get_retry_count_no_field(self):
        """progress 无 retry_count 字段时返回 0"""
        task = MagicMock()
        task.progress = {"total": 10, "completed": 5}
        assert _get_retry_count(task) == 0

    def test_get_retry_count_with_value(self):
        """正确读取 retry_count"""
        task = MagicMock()
        task.progress = {"retry_count": 2}
        assert _get_retry_count(task) == 2

    def test_increment_retry_count_from_none(self):
        """从 None progress 递增"""
        task = MagicMock()
        task.progress = None
        _increment_retry_count(task)
        assert task.progress == {"retry_count": 1}

    def test_increment_retry_count_existing(self):
        """从已有值递增"""
        task = MagicMock()
        task.progress = {"retry_count": 1, "total": 10}
        _increment_retry_count(task)
        assert task.progress["retry_count"] == 2
        # 保留其他字段
        assert task.progress["total"] == 10


# ---- Job 函数行为测试 ----


class TestJobFullPlatformSync:
    """测试全平台增量同步 job"""

    @pytest.mark.asyncio
    async def test_skips_when_no_context(self):
        """上下文未初始化时跳过执行"""
        import crawler_service.scheduler.jobs as jobs_module
        original = jobs_module._job_context
        jobs_module._job_context = None
        try:
            # 不应抛异常
            await job_full_platform_sync()
        finally:
            jobs_module._job_context = original

    @pytest.mark.asyncio
    async def test_triggers_for_enabled_platforms(
        self, mock_orchestrator, mock_task_repo, mock_config
    ):
        """为每个 enabled 平台触发 PROBLEM_SYNC"""
        import crawler_service.scheduler.jobs as jobs_module

        # 模拟 task_repo.create 返回带 id 的 task
        mock_task = MagicMock()
        mock_task.id = 123
        mock_task.status = "COMPLETED"
        mock_task_repo.create = AsyncMock(return_value=mock_task)
        mock_task_repo.get_by_id = AsyncMock(return_value=mock_task)

        ctx = SchedulerJobContext(
            orchestrator=mock_orchestrator,
            task_repo=mock_task_repo,
            config=mock_config,
        )
        original = jobs_module._job_context
        jobs_module._job_context = ctx
        try:
            await job_full_platform_sync()
            # enabled 平台有 leetcode_global 和 codeforces（luogu disabled）
            assert mock_task_repo.create.call_count == 2
            # 验证 task_type 是 PROBLEM_SYNC
            for call in mock_task_repo.create.call_args_list:
                assert call.kwargs["task_type"] == "PROBLEM_SYNC"
                assert call.kwargs["trigger_type"] == "SCHEDULED"
        finally:
            jobs_module._job_context = original

    @pytest.mark.asyncio
    async def test_skips_when_no_enabled_platforms(
        self, mock_orchestrator, mock_task_repo
    ):
        """无启用平台时跳过"""
        import crawler_service.scheduler.jobs as jobs_module

        empty_config = Settings(
            project="test",
            platforms={"luogu": PlatformConfig(enabled=False)},
        )
        ctx = SchedulerJobContext(
            orchestrator=mock_orchestrator,
            task_repo=mock_task_repo,
            config=empty_config,
        )
        original = jobs_module._job_context
        jobs_module._job_context = ctx
        try:
            await job_full_platform_sync()
            mock_task_repo.create.assert_not_called()
        finally:
            jobs_module._job_context = original


class TestJobSolutionSync:
    """测试题解采集 job"""

    @pytest.mark.asyncio
    async def test_only_triggers_solution_enabled(
        self, mock_orchestrator, mock_task_repo, mock_config
    ):
        """仅对 solution_fetch_enabled=True 的平台触发"""
        import crawler_service.scheduler.jobs as jobs_module

        mock_task = MagicMock()
        mock_task.id = 456
        mock_task.status = "COMPLETED"
        mock_task_repo.create = AsyncMock(return_value=mock_task)
        mock_task_repo.get_by_id = AsyncMock(return_value=mock_task)

        ctx = SchedulerJobContext(
            orchestrator=mock_orchestrator,
            task_repo=mock_task_repo,
            config=mock_config,
        )
        original = jobs_module._job_context
        jobs_module._job_context = ctx
        try:
            await job_solution_sync()
            # 只有 leetcode_global 有 solution_fetch_enabled=True
            assert mock_task_repo.create.call_count == 1
            call = mock_task_repo.create.call_args
            assert call.kwargs["platform"] == "leetcode_global"
            assert call.kwargs["task_type"] == "SOLUTION_SYNC"
        finally:
            jobs_module._job_context = original


class TestJobFailedRetry:
    """测试失败任务重试 job"""

    @pytest.mark.asyncio
    async def test_skips_when_no_failed_tasks(
        self, mock_orchestrator, mock_task_repo, mock_config
    ):
        """无失败任务时跳过"""
        import crawler_service.scheduler.jobs as jobs_module

        mock_task_repo.list_tasks = AsyncMock(return_value=([], 0))

        ctx = SchedulerJobContext(
            orchestrator=mock_orchestrator,
            task_repo=mock_task_repo,
            config=mock_config,
        )
        original = jobs_module._job_context
        jobs_module._job_context = ctx
        try:
            await job_failed_retry()
            mock_orchestrator.execute_crawl.assert_not_called()
        finally:
            jobs_module._job_context = original

    @pytest.mark.asyncio
    async def test_retries_failed_task(
        self, mock_orchestrator, mock_task_repo, mock_config
    ):
        """重试 retry_count < MAX 的失败任务"""
        import crawler_service.scheduler.jobs as jobs_module

        failed_task = MagicMock()
        failed_task.id = 789
        failed_task.platform = "codeforces"
        failed_task.status = "FAILED"
        failed_task.progress = {"retry_count": 1}  # 还可以重试

        mock_task_repo.list_tasks = AsyncMock(return_value=([failed_task], 1))
        mock_task_repo.save = AsyncMock()

        ctx = SchedulerJobContext(
            orchestrator=mock_orchestrator,
            task_repo=mock_task_repo,
            config=mock_config,
        )
        original = jobs_module._job_context
        jobs_module._job_context = ctx
        try:
            await job_failed_retry()
            # 应该执行重试
            mock_orchestrator.execute_crawl.assert_called_once_with(789)
            # 状态应被重置为 PENDING
            assert failed_task.status == "PENDING"
        finally:
            jobs_module._job_context = original

    @pytest.mark.asyncio
    async def test_abandons_task_exceeding_max_retry(
        self, mock_orchestrator, mock_task_repo, mock_config
    ):
        """超过最大重试次数的任务不再重试"""
        import crawler_service.scheduler.jobs as jobs_module

        failed_task = MagicMock()
        failed_task.id = 999
        failed_task.platform = "leetcode_global"
        failed_task.status = "FAILED"
        failed_task.progress = {"retry_count": MAX_RETRY_COUNT}  # 已达上限

        mock_task_repo.list_tasks = AsyncMock(return_value=([failed_task], 1))

        ctx = SchedulerJobContext(
            orchestrator=mock_orchestrator,
            task_repo=mock_task_repo,
            config=mock_config,
        )
        original = jobs_module._job_context
        jobs_module._job_context = ctx
        try:
            await job_failed_retry()
            # 不应执行重试
            mock_orchestrator.execute_crawl.assert_not_called()
        finally:
            jobs_module._job_context = original
