"""
CrawlOrchestrator 采集编排器

协调适配器调用、反爬策略、标准化管线、去重、事件发布的核心编排器。
主流程：加载任务 → 获取题目列表 → 逐题处理（去重→标准化→HTTP写入→采集题解→发事件）

根据 task_type 决定采集范围：
- PROBLEM_SYNC：采集题目 + Editorial
- SOLUTION_SYNC：采集题解 + 评论
- SINGLE_FETCH：采集单题全部内容

使用 asyncio.Semaphore 限制每平台最大并发协程数（默认 3），
单题失败不中断批次，支持 cancel() 方法在下一循环点检查退出。

Validates: Requirements 2.3, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 13.1, 13.6
"""

import asyncio
import time
from typing import Optional

import httpx
import structlog

from ..adapters import get_adapter
from ..adapters.base import FetchOptions, PlatformAdapter
from ..anticrawl.manager import AntiCrawlManager
from ..config import PlatformConfig, Settings
from ..database.repository import CrawlTaskRepository, RawSourceRepository
from ..events.publisher import EventPublisher
from ..metrics import (
    record_crawl_failure,
    record_crawl_success,
    track_crawl_duration,
    update_circuit_breaker_state,
    update_rate_limiter_tokens,
)
from ..models.entities import CrawlTask
from ..models.enums import Platform, TaskType
from ..orchestrator.dedup import DeduplicationService, DeduResult
from ..orchestrator.http_error_handler import HttpErrorHandler, HttpRetriesExhaustedError
from ..pipeline.standardizer import DataStandardizer

logger = structlog.get_logger()

# 默认每平台最大并发协程数
DEFAULT_MAX_CONCURRENCY = 3


class CoreServiceClient:
    """HTTP 客户端封装：调用 Java Core 端内部 API 写入 Problem/Solution

    通过 HTTP POST 调用 Java Core 的内部端点：
    - POST /api/v1/internal/problems 写入 Problem 表
    - POST /api/v1/internal/solutions 写入 UserSolution 表
    """

    def __init__(self, base_url: str, timeout: int = 30):
        """
        :param base_url: Java Core 服务基础 URL（如 http://algorithm-help-core:8080）
        :param timeout: 请求超时（秒）
        """
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    async def save_problem(
        self, normalized: dict, platform: str, project: str
    ) -> Optional[int]:
        """通过 HTTP 写入 Problem 到 Java Core

        :param normalized: 标准化后的题目数据
        :param platform: 来源平台
        :param project: 所属项目
        :return: 写入后的 problem_id，失败返回 None
        """
        url = f"{self._base_url}/api/v1/internal/problems"
        payload = {
            **normalized,
            "platform": platform,
            "project": project,
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("data", {}).get("id")

    async def save_solution(
        self, normalized: dict, problem_id: int, project: str
    ) -> Optional[int]:
        """通过 HTTP 写入 UserSolution 到 Java Core

        :param normalized: 标准化后的题解数据
        :param problem_id: 关联的题目 ID
        :param project: 所属项目
        :return: 写入后的 solution_id，失败返回 None
        """
        url = f"{self._base_url}/api/v1/internal/solutions"
        payload = {
            **normalized,
            "problem_id": problem_id,
            "project": project,
            "source_type": "CRAWLED",
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("data", {}).get("id")


class CrawlOrchestrator:
    """采集编排器 —— 协调适配器、反爬、标准化、去重、事件发布

    核心职责：
    1. 加载 CrawlTask 并管理其生命周期
    2. 根据 task_type 调用适配器获取数据
    3. 通过 AntiCrawlManager 限流/熔断保护
    4. 去重 → 标准化 → HTTP 写入 Core → 事件发布
    5. 并发控制（Semaphore）和取消支持
    """

    def __init__(
        self,
        anti_crawl: AntiCrawlManager,
        standardizer: DataStandardizer,
        dedup: DeduplicationService,
        task_repo: CrawlTaskRepository,
        raw_repo: RawSourceRepository,
        event_publisher: EventPublisher,
        core_client: CoreServiceClient,
        config: Settings,
        max_concurrency: int = DEFAULT_MAX_CONCURRENCY,
        http_error_handler: Optional[HttpErrorHandler] = None,
    ):
        """
        :param anti_crawl: 反爬管理器
        :param standardizer: 数据标准化管线
        :param dedup: 去重服务
        :param task_repo: 采集任务仓储
        :param raw_repo: 原始数据仓储
        :param event_publisher: 事件发布器
        :param core_client: Java Core HTTP 客户端
        :param config: 全局配置
        :param max_concurrency: 每平台最大并发协程数，默认 3
        :param http_error_handler: HTTP 错误处理器（可选，不传时不执行 HTTP 分类重试）
        """
        self._anti_crawl = anti_crawl
        self._standardizer = standardizer
        self._dedup = dedup
        self._task_repo = task_repo
        self._raw_repo = raw_repo
        self._event_publisher = event_publisher
        self._core_client = core_client
        self._config = config
        self._max_concurrency = max_concurrency
        self._http_error_handler = http_error_handler
        self._cancel_flags: dict[int, bool] = {}

    async def execute_crawl(self, task_id: int) -> None:
        """执行采集任务主流程

        流程：加载任务 → 状态置为 RUNNING → 获取题目列表 →
             并发处理每题（Semaphore 限流）→ 更新最终状态

        :param task_id: 采集任务 ID
        """
        task = await self._task_repo.get_by_id(task_id)
        if task is None:
            logger.error("采集任务不存在", task_id=task_id)
            return

        log = logger.bind(task_id=task_id, platform=task.platform, task_type=task.task_type)
        log.info("开始执行采集任务")

        # 初始化任务状态
        task.status = "RUNNING"
        self._cancel_flags[task_id] = False
        await self._task_repo.save(task)

        try:
            await self._run_crawl(task, log)
        except Exception as e:
            task.status = "FAILED"
            task.error_message = str(e)
            log.error("采集任务异常终止", error=str(e))
        finally:
            self._finalize_task(task)
            await self._task_repo.save(task)
            await self._event_publisher.publish_task_status_changed(task)
            self._cancel_flags.pop(task_id, None)
            log.info("采集任务结束", status=task.status)

    def cancel(self, task_id: int) -> None:
        """设置取消标志，正在执行的任务会在下一循环点检查并退出

        :param task_id: 要取消的任务 ID
        """
        self._cancel_flags[task_id] = True
        logger.info("任务取消标志已设置", task_id=task_id)

    def is_cancelled(self, task_id: int) -> bool:
        """检查任务是否已被标记取消"""
        return self._cancel_flags.get(task_id, False)

    async def _run_crawl(self, task: CrawlTask, log) -> None:
        """执行实际采集逻辑：获取列表 → 并发处理"""
        adapter = get_adapter(Platform(task.platform))
        platform_cfg = self._config.get_platform(task.platform.lower())

        # 构建采集选项（增量：使用 last_fetch_time）
        options = FetchOptions(last_fetch_time=task.last_fetch_time)

        # 获取题目列表
        raw_problems = await adapter.fetch_problem_list(options)
        total = len(raw_problems)
        task.progress = {"total": total, "completed": 0, "failed": 0}
        await self._task_repo.update_progress(task)
        log.info("获取题目列表完成", total=total)

        if total == 0:
            task.status = "COMPLETED"
            return

        # 并发控制
        semaphore = asyncio.Semaphore(self._max_concurrency)
        tasks = [
            self._process_with_semaphore(semaphore, raw, adapter, task, platform_cfg, log)
            for raw in raw_problems
        ]
        await asyncio.gather(*tasks, return_exceptions=True)

        # 更新 Prometheus 指标：熔断器状态 + 限流器令牌
        self._update_platform_metrics(task.platform)

        # 判断最终状态
        if self.is_cancelled(task.id):
            task.status = "CANCELLED"
        else:
            task.status = "COMPLETED"

    async def _process_with_semaphore(
        self,
        semaphore: asyncio.Semaphore,
        raw: dict,
        adapter: PlatformAdapter,
        task: CrawlTask,
        platform_cfg: Optional[PlatformConfig],
        log,
    ) -> None:
        """带并发限制的单题处理包装器"""
        async with semaphore:
            # 取消检查点
            if self.is_cancelled(task.id):
                return
            await self._process_one(raw, adapter, task, platform_cfg, log)

    async def _process_one(
        self,
        raw: dict,
        adapter: PlatformAdapter,
        task: CrawlTask,
        platform_cfg: Optional[PlatformConfig],
        log,
    ) -> None:
        """处理单条采集数据：反爬→去重→标准化→写入→题解→事件

        单题失败不中断批次，异常被捕获并记录到 task.progress.failed。
        集成 HTTP 错误分类处理：429/403/5xx 自动重试。

        :param raw: 原始题目数据
        :param adapter: 平台适配器
        :param task: 所属采集任务
        :param platform_cfg: 平台配置
        :param log: 绑定了上下文的 logger
        """
        platform_id = raw.get("platform_id", "unknown")
        try:
            # 1. 反爬策略：获取采集许可
            await self._anti_crawl.acquire_permit(task.platform)

            # 使用 Prometheus Histogram 追踪采集耗时
            async with track_crawl_duration(task.platform):
                # 2. 去重检测
                dedup_result = await self._dedup.check(raw, task.platform, task.project)

                # 3. 保存原始数据到 raw_source
                await self._raw_repo.save_raw(raw, task.platform, task.project, content_type="PROBLEM")

                # 4. 标准化
                normalized = await self._standardizer.standardize(raw, task.platform)

                # 5. 质量检查通过后写入 Problem（HTTP 调 Java Core，带错误处理）
                problem_id = None
                if normalized.get("quality_status") != "INCOMPLETE":
                    problem_id = await self._call_with_http_handler(
                        lambda: self._core_client.save_problem(
                            normalized, task.platform, task.project
                        ),
                        task.platform,
                    )

                # 6. 根据 task_type 和配置决定是否采集题解/评论
                await self._handle_solutions_and_editorial(
                    adapter, raw, task, platform_cfg, problem_id, platform_id
                )

                # 7. 发布内容标准化完成事件
                await self._event_publisher.publish_content_standardized(
                    normalized, dedup_result.value, task.project
                )

            # 成功：递增完成计数 + 记录指标
            task.increment_completed()
            await self._anti_crawl.record_success(task.platform)
            record_crawl_success(task.platform)

        except HttpRetriesExhaustedError as e:
            # HTTP 重试耗尽：记录完整错误链
            error_detail = f"{str(e)} | error_chain={e.error_chain}"
            task.increment_failed(platform_id, error_detail)
            await self._anti_crawl.record_failure(task.platform)
            record_crawl_failure(task.platform)
            log.error(
                "HTTP 重试耗尽",
                platform_id=platform_id,
                error=str(e),
                error_chain=e.error_chain,
            )

        except Exception as e:
            # 单题失败不中断批次
            task.increment_failed(platform_id, str(e))
            await self._anti_crawl.record_failure(task.platform)
            record_crawl_failure(task.platform)
            log.warning("单题采集失败", platform_id=platform_id, error=str(e))

        # 更新进度
        await self._task_repo.update_progress(task)

    async def _call_with_http_handler(self, func, platform: str):
        """包装 HTTP 调用，若有 http_error_handler 则使用分类重试"""
        if self._http_error_handler:
            return await self._http_error_handler.execute(func, platform)
        return await func()

    async def _handle_solutions_and_editorial(
        self,
        adapter: PlatformAdapter,
        raw: dict,
        task: CrawlTask,
        platform_cfg: Optional[PlatformConfig],
        problem_id: Optional[int],
        platform_id: str,
    ) -> None:
        """根据 task_type 和配置决定是否采集题解、评论、Editorial

        - PROBLEM_SYNC：采集 Editorial
        - SOLUTION_SYNC / SINGLE_FETCH：采集题解 + 评论（需 solution_fetch_enabled=true）

        :param adapter: 平台适配器
        :param raw: 原始题目数据
        :param task: 采集任务
        :param platform_cfg: 平台配置
        :param problem_id: 写入后的 problem_id（可能为 None）
        :param platform_id: 平台原始题号
        """
        task_type = task.task_type
        solution_enabled = platform_cfg.solution_fetch_enabled if platform_cfg else True

        # PROBLEM_SYNC：只采集 Editorial
        if task_type == TaskType.PROBLEM_SYNC.value:
            await self._fetch_editorial(adapter, task, platform_id)
            return

        # SOLUTION_SYNC / SINGLE_FETCH：采集题解 + 评论
        if task_type in (TaskType.SOLUTION_SYNC.value, TaskType.SINGLE_FETCH.value):
            if solution_enabled and problem_id is not None:
                await self._fetch_and_save_solutions(adapter, raw, problem_id, task)
            # SINGLE_FETCH 也采集 Editorial
            if task_type == TaskType.SINGLE_FETCH.value:
                await self._fetch_editorial(adapter, task, platform_id)

    async def _fetch_editorial(
        self,
        adapter: PlatformAdapter,
        task: CrawlTask,
        platform_id: str,
    ) -> None:
        """采集 Editorial 并保存到 raw_source

        :param adapter: 平台适配器
        :param task: 采集任务
        :param platform_id: 平台原始题号
        """
        editorial = await adapter.fetch_editorial(platform_id)
        if editorial:
            await self._raw_repo.save_raw(
                editorial, task.platform, task.project, content_type="EDITORIAL"
            )

    async def _fetch_and_save_solutions(
        self,
        adapter: PlatformAdapter,
        raw: dict,
        problem_id: int,
        task: CrawlTask,
    ) -> None:
        """采集题解并通过 HTTP 写入 Java Core

        流程：adapter.fetch_solutions → 保存 raw → 标准化 → save_solution
        同时采集每条题解的评论。

        :param adapter: 平台适配器
        :param raw: 原始题目数据
        :param problem_id: 关联的 problem_id
        :param task: 采集任务
        """
        platform_id = raw.get("platform_id", "")
        solutions = await adapter.fetch_solutions(platform_id, top_n=10)

        for sol in solutions:
            # 取消检查点
            if self.is_cancelled(task.id):
                return

            # 保存原始题解
            await self._raw_repo.save_raw(
                sol, task.platform, task.project, content_type="SOLUTION"
            )
            # 标准化题解
            sol_normalized = await self._standardizer.standardize_solution(sol)
            if sol_normalized:
                await self._core_client.save_solution(
                    sol_normalized, problem_id, task.project
                )

            # 采集评论
            await self._fetch_comments_for_solution(adapter, sol, task)

    async def _fetch_comments_for_solution(
        self,
        adapter: PlatformAdapter,
        solution: dict,
        task: CrawlTask,
    ) -> None:
        """采集题解关联的优质评论

        :param adapter: 平台适配器
        :param solution: 题解原始数据
        :param task: 采集任务
        """
        solution_id = str(solution.get("platform_id", solution.get("id", "")))
        if not solution_id:
            return

        comments = await adapter.fetch_comments(solution_id)
        for comment in comments:
            await self._raw_repo.save_raw(
                comment, task.platform, task.project, content_type="COMMENT"
            )

    def _finalize_task(self, task: CrawlTask) -> None:
        """最终化任务：设置完成时间和 last_fetch_time

        :param task: 采集任务
        """
        now_ms = int(time.time() * 1000)
        task.completed_at = now_ms
        # 仅成功完成时更新 last_fetch_time（用于下次增量检测）
        if task.status == "COMPLETED":
            task.last_fetch_time = now_ms

    def _update_platform_metrics(self, platform: str) -> None:
        """更新平台级 Prometheus Gauge 指标

        :param platform: 平台标识
        """
        try:
            # 熔断器状态
            breaker = self._anti_crawl.get_circuit_breaker(platform)
            update_circuit_breaker_state(platform, breaker.state.value)
            # 限流器令牌
            limiter = self._anti_crawl.get_rate_limiter(platform)
            update_rate_limiter_tokens(platform, limiter.available_tokens)
        except (AttributeError, TypeError):
            # 防御性处理：mock 对象或未初始化时跳过
            pass
