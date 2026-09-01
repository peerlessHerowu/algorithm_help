"""
APScheduler 定时任务配置

基于 APScheduler 4.x 的 AsyncScheduler 实现。
配置三个定时任务：
- full_platform_sync: 全平台增量同步（每日 3:00）
- solution_sync: 题解采集（每周一 4:00）
- failed_retry: 失败任务自动重试（每 4 小时）

每个任务 max_running_jobs=1 防止重复执行。
任务失败自动重试最多 3 次，仍失败标记 FAILED + 告警日志。

APScheduler 4.x 使用 async context manager 模式：
  async with scheduler:
      await scheduler.add_schedule(...)
      await scheduler.run_until_stopped()

在 FastAPI lifespan 中使用 start_in_background() 启动。

Validates: Requirements 9.1, 9.2, 9.4, 9.5
"""

import asyncio
import time
from typing import Optional

import structlog
from apscheduler import AsyncScheduler, ConflictPolicy
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = structlog.get_logger()

# 全局调度器实例
_scheduler: Optional[AsyncScheduler] = None

# Schedule ID 常量
SCHEDULE_FULL_PLATFORM_SYNC = "full_platform_sync"
SCHEDULE_SOLUTION_SYNC = "solution_sync"
SCHEDULE_FAILED_RETRY = "failed_retry"

# 重试配置
MAX_RETRY_COUNT = 3
RETRY_BACKOFF_BASE_MS = 5000  # 5 秒基础退避


class SchedulerJobContext:
    """调度任务执行上下文

    持有编排器和仓储引用，供定时任务 job 函数使用。
    在 setup_scheduler 时通过依赖注入传入。
    """

    def __init__(self, orchestrator=None, task_repo=None, config=None):
        """
        :param orchestrator: CrawlOrchestrator 编排器实例
        :param task_repo: CrawlTaskRepository 仓储实例
        :param config: Settings 配置实例
        """
        self.orchestrator = orchestrator
        self.task_repo = task_repo
        self.config = config


# 全局 job 上下文（setup_scheduler 时注入）
_job_context: Optional[SchedulerJobContext] = None


async def setup_scheduler(
    orchestrator=None,
    task_repo=None,
    config=None,
) -> AsyncScheduler:
    """初始化 APScheduler 4.x AsyncScheduler 并配置定时调度

    APScheduler 4.x 需要先进入 context manager 才能调用 add_schedule。
    此函数创建 scheduler、进入 context manager、配置任务和调度，
    然后调用 start_in_background() 启动后台运行。

    配置三个定时调度：
    1. full_platform_sync - 每日 3:00，触发全平台 PROBLEM_SYNC
    2. solution_sync - 每周一 4:00，触发 SOLUTION_SYNC
    3. failed_retry - 每 4 小时，重试 FAILED 任务

    :param orchestrator: CrawlOrchestrator 编排器实例
    :param task_repo: CrawlTaskRepository 仓储实例
    :param config: Settings 全局配置
    :return: 已启动的 AsyncScheduler 实例
    """
    global _scheduler, _job_context

    _job_context = SchedulerJobContext(
        orchestrator=orchestrator,
        task_repo=task_repo,
        config=config,
    )

    scheduler = AsyncScheduler()

    # 进入 context manager 使其初始化
    await scheduler.__aenter__()

    # 配置任务（设置 max_running_jobs=1 防止重复执行）
    await scheduler.configure_task(
        "job_full_platform_sync",
        func=job_full_platform_sync,
        max_running_jobs=1,
    )
    await scheduler.configure_task(
        "job_solution_sync",
        func=job_solution_sync,
        max_running_jobs=1,
    )
    await scheduler.configure_task(
        "job_failed_retry",
        func=job_failed_retry,
        max_running_jobs=1,
    )

    # 添加调度（cron / interval 触发器）
    await scheduler.add_schedule(
        "job_full_platform_sync",
        trigger=CronTrigger(hour=3, minute=0),
        id=SCHEDULE_FULL_PLATFORM_SYNC,
        conflict_policy=ConflictPolicy.replace,
    )
    await scheduler.add_schedule(
        "job_solution_sync",
        trigger=CronTrigger(day_of_week="mon", hour=4, minute=0),
        id=SCHEDULE_SOLUTION_SYNC,
        conflict_policy=ConflictPolicy.replace,
    )
    await scheduler.add_schedule(
        "job_failed_retry",
        trigger=IntervalTrigger(hours=4),
        id=SCHEDULE_FAILED_RETRY,
        conflict_policy=ConflictPolicy.replace,
    )

    _scheduler = scheduler

    logger.info(
        "APScheduler 调度器配置完成",
        schedules=[
            SCHEDULE_FULL_PLATFORM_SYNC,
            SCHEDULE_SOLUTION_SYNC,
            SCHEDULE_FAILED_RETRY,
        ],
    )
    return scheduler


async def start_scheduler() -> None:
    """启动调度器后台运行（需先调用 setup_scheduler）"""
    global _scheduler
    if _scheduler is None:
        raise RuntimeError("调度器未初始化，请先调用 setup_scheduler()")
    await _scheduler.start_in_background()
    logger.info("APScheduler 调度器已启动（后台）")


async def shutdown_scheduler() -> None:
    """关闭调度器

    调用 stop() 停止后台任务处理。
    注意：APScheduler 4.x 的 context manager 需在同一个 task 中退出。
    在 FastAPI lifespan 中推荐直接使用 `async with scheduler:` 模式。
    """
    global _scheduler
    if _scheduler is not None:
        try:
            await _scheduler.stop()
        except Exception:
            pass
        _scheduler = None
        logger.info("APScheduler 调度器已关闭")


def get_scheduler() -> Optional[AsyncScheduler]:
    """获取调度器实例"""
    return _scheduler


# ---- 控制 API 辅助函数 ----


async def trigger_job(job_id: str) -> bool:
    """手动触发指定定时任务

    使用 run_job 立即执行关联的任务函数。

    :param job_id: Schedule ID（full_platform_sync / solution_sync / failed_retry）
    :return: 是否触发成功
    """
    if _scheduler is None:
        logger.warning("调度器未初始化", job_id=job_id)
        return False

    # 映射 schedule_id → task_id
    task_map = {
        SCHEDULE_FULL_PLATFORM_SYNC: "job_full_platform_sync",
        SCHEDULE_SOLUTION_SYNC: "job_solution_sync",
        SCHEDULE_FAILED_RETRY: "job_failed_retry",
    }
    task_id = task_map.get(job_id)
    if task_id is None:
        logger.warning("定时任务不存在", job_id=job_id)
        return False

    try:
        await _scheduler.run_job(task_id)
        logger.info("手动触发定时任务完成", job_id=job_id)
        return True
    except Exception as e:
        logger.error("手动触发定时任务失败", job_id=job_id, error=str(e))
        return False


async def pause_job(job_id: str) -> bool:
    """暂停指定定时调度

    :param job_id: Schedule ID
    :return: 是否暂停成功
    """
    if _scheduler is None:
        logger.warning("调度器未初始化", job_id=job_id)
        return False

    try:
        await _scheduler.pause_schedule(job_id)
        logger.info("定时任务已暂停", job_id=job_id)
        return True
    except Exception as e:
        logger.warning("暂停定时任务失败", job_id=job_id, error=str(e))
        return False


async def resume_job(job_id: str) -> bool:
    """恢复指定定时调度

    :param job_id: Schedule ID
    :return: 是否恢复成功
    """
    if _scheduler is None:
        logger.warning("调度器未初始化", job_id=job_id)
        return False

    try:
        await _scheduler.unpause_schedule(job_id)
        logger.info("定时任务已恢复", job_id=job_id)
        return True
    except Exception as e:
        logger.warning("恢复定时任务失败", job_id=job_id, error=str(e))
        return False


# ---- 定时任务 Job 函数 ----


async def job_full_platform_sync() -> None:
    """全平台增量同步任务

    遍历所有 enabled 平台，为每个平台创建 PROBLEM_SYNC 类型任务并执行。
    失败时自动重试最多 3 次，仍失败则标记 FAILED + ERROR 日志。

    执行时间：每日凌晨 3:00
    """
    log = logger.bind(job_id=SCHEDULE_FULL_PLATFORM_SYNC)
    log.info("全平台增量同步任务开始")
    start_time = time.time()

    ctx = _job_context
    if ctx is None or ctx.config is None:
        log.error("调度器上下文未初始化，跳过执行")
        return

    # 获取所有 enabled 平台
    enabled_platforms = [
        name for name, cfg in ctx.config.platforms.items() if cfg.enabled
    ]

    if not enabled_platforms:
        log.warning("无已启用平台，跳过同步")
        return

    success_count = 0
    fail_count = 0

    for platform in enabled_platforms:
        ok = await _execute_with_retry(
            platform=platform,
            task_type="PROBLEM_SYNC",
            log=log,
        )
        if ok:
            success_count += 1
        else:
            fail_count += 1

    elapsed = time.time() - start_time
    log.info(
        "全平台增量同步任务结束",
        elapsed_seconds=round(elapsed, 2),
        success=success_count,
        failed=fail_count,
        total=len(enabled_platforms),
    )


async def job_solution_sync() -> None:
    """题解采集任务

    遍历所有 enabled 且 solution_fetch_enabled 平台，
    为每个平台创建 SOLUTION_SYNC 类型任务并执行。

    执行时间：每周一凌晨 4:00
    """
    log = logger.bind(job_id=SCHEDULE_SOLUTION_SYNC)
    log.info("题解采集任务开始")
    start_time = time.time()

    ctx = _job_context
    if ctx is None or ctx.config is None:
        log.error("调度器上下文未初始化，跳过执行")
        return

    # 获取支持题解采集的平台
    solution_platforms = [
        name for name, cfg in ctx.config.platforms.items()
        if cfg.enabled and cfg.solution_fetch_enabled
    ]

    if not solution_platforms:
        log.warning("无题解采集平台，跳过")
        return

    success_count = 0
    fail_count = 0

    for platform in solution_platforms:
        ok = await _execute_with_retry(
            platform=platform,
            task_type="SOLUTION_SYNC",
            log=log,
        )
        if ok:
            success_count += 1
        else:
            fail_count += 1

    elapsed = time.time() - start_time
    log.info(
        "题解采集任务结束",
        elapsed_seconds=round(elapsed, 2),
        success=success_count,
        failed=fail_count,
        total=len(solution_platforms),
    )


async def job_failed_retry() -> None:
    """失败任务自动重试

    查询所有 FAILED 状态的任务，对重试次数未达 MAX_RETRY_COUNT 的任务重新执行。
    超过最大重试次数的标记为最终 FAILED + ERROR 告警。

    执行时间：每 4 小时
    """
    log = logger.bind(job_id=SCHEDULE_FAILED_RETRY)
    log.info("失败任务重试开始")
    start_time = time.time()

    ctx = _job_context
    if ctx is None or ctx.task_repo is None:
        log.error("调度器上下文未初始化，跳过执行")
        return

    # 查询所有 FAILED 状态任务
    failed_tasks, total = await ctx.task_repo.list_tasks(
        page=1, page_size=100, status="FAILED"
    )

    if not failed_tasks:
        log.info("无失败任务需要重试")
        return

    retried_count = 0
    abandoned_count = 0

    for task in failed_tasks:
        retry_count = _get_retry_count(task)

        if retry_count >= MAX_RETRY_COUNT:
            # 已达最大重试次数，不再重试，记录 ERROR 告警
            log.error(
                "任务超过最大重试次数，标记为最终失败",
                task_id=task.id,
                platform=task.platform,
                retry_count=retry_count,
            )
            abandoned_count += 1
            continue

        # 重试执行
        log.info(
            "重试失败任务",
            task_id=task.id,
            platform=task.platform,
            retry_attempt=retry_count + 1,
        )

        try:
            # 重置任务状态为 PENDING，递增重试计数
            task.status = "PENDING"
            _increment_retry_count(task)
            await ctx.task_repo.save(task)

            # 执行采集
            if ctx.orchestrator is not None:
                await ctx.orchestrator.execute_crawl(task.id)
            retried_count += 1
        except Exception as e:
            log.error(
                "重试任务执行失败",
                task_id=task.id,
                error=str(e),
            )

    elapsed = time.time() - start_time
    log.info(
        "失败任务重试结束",
        elapsed_seconds=round(elapsed, 2),
        retried=retried_count,
        abandoned=abandoned_count,
        total_failed=total,
    )


# ---- 内部辅助函数 ----


async def _execute_with_retry(
    platform: str,
    task_type: str,
    log,
) -> bool:
    """带重试的任务执行

    创建任务并执行，失败时自动重试最多 MAX_RETRY_COUNT 次。
    使用指数退避：base * 2^attempt。

    :param platform: 平台标识
    :param task_type: 任务类型
    :param log: 绑定了上下文的 logger
    :return: 是否最终成功
    """
    ctx = _job_context
    if ctx is None or ctx.orchestrator is None or ctx.task_repo is None:
        log.error("调度器上下文不完整", platform=platform)
        return False

    for attempt in range(MAX_RETRY_COUNT + 1):
        try:
            # 创建采集任务
            task = await ctx.task_repo.create(
                platform=platform,
                task_type=task_type,
                trigger_type="SCHEDULED",
                project=ctx.config.project if ctx.config else "algorithm-help",
            )
            log.info(
                "创建定时采集任务",
                task_id=task.id,
                platform=platform,
                task_type=task_type,
                attempt=attempt,
            )

            # 执行采集
            await ctx.orchestrator.execute_crawl(task.id)

            # 检查执行结果
            executed_task = await ctx.task_repo.get_by_id(task.id)
            if executed_task and executed_task.status == "COMPLETED":
                return True

            # 非 COMPLETED 视为失败，继续重试
            if attempt < MAX_RETRY_COUNT:
                backoff = _calc_backoff(attempt)
                log.warning(
                    "定时任务执行未完成，等待退避后重试",
                    platform=platform,
                    attempt=attempt,
                    backoff_ms=backoff,
                    status=executed_task.status if executed_task else "UNKNOWN",
                )
                await asyncio.sleep(backoff / 1000.0)
            else:
                log.error(
                    "定时任务重试耗尽，标记为最终失败",
                    platform=platform,
                    task_type=task_type,
                    max_retries=MAX_RETRY_COUNT,
                )
                return False

        except Exception as e:
            if attempt < MAX_RETRY_COUNT:
                backoff = _calc_backoff(attempt)
                log.warning(
                    "定时任务执行异常，等待退避后重试",
                    platform=platform,
                    attempt=attempt,
                    backoff_ms=backoff,
                    error=str(e),
                )
                await asyncio.sleep(backoff / 1000.0)
            else:
                log.error(
                    "定时任务重试耗尽（异常），标记为最终失败",
                    platform=platform,
                    task_type=task_type,
                    error=str(e),
                )
                return False

    return False


def _calc_backoff(attempt: int) -> int:
    """计算指数退避时间

    :param attempt: 第几次重试（从 0 开始）
    :return: 退避毫秒数
    """
    return RETRY_BACKOFF_BASE_MS * (2 ** attempt)


def _get_retry_count(task) -> int:
    """从任务 progress 中获取重试次数

    :param task: CrawlTask 实体
    :return: 已重试次数
    """
    if task.progress is None:
        return 0
    return task.progress.get("retry_count", 0)


def _increment_retry_count(task) -> None:
    """递增任务的重试次数

    :param task: CrawlTask 实体
    """
    if task.progress is None:
        task.progress = {}
    progress = dict(task.progress)
    progress["retry_count"] = progress.get("retry_count", 0) + 1
    task.progress = progress
