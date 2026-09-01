# Technical Design: Python Crawler Service

## Overview

本设计文档定义 python-crawler-service 的技术实现方案。该服务是从原 Java 爬虫模块（algorithm-help-crawler）完整重写而来的独立 Python 微服务，部署在项目根目录 `crawler/` 下（与 `backend/`、`frontend/` 平级）。

### 核心设计决策

- **插件化适配器**：PlatformAdapter 抽象基类 + adapters/ 目录自动发现，新平台零侵入接入
- **异步优先架构**：asyncio + httpx 全链路异步，单进程高并发采集
- **自实现反爬层**：令牌桶限流 + 熔断器 + UA 轮转 + Cookie 管理，替代 Java Resilience4j
- **数据标准化管线**：HTML→Markdown、图片下载、难度/标签映射，管线各阶段独立可测
- **多项目复用**：project 维度隔离，通用管线复用，差异通过配置区分
- **HTTP API 集成**：FastAPI 暴露端点替代 Dubbo，与 Java Core 端通过 HTTP + Redis Stream 协作

### 技术栈选型

| 层次 | 技术 | 理由 |
|------|------|------|
| Web 框架 | FastAPI | 异步原生、自动 OpenAPI 文档、Pydantic 校验 |
| HTTP 客户端 | httpx (async) | 异步 HTTP/2 支持、连接池、超时控制 |
| HTML 解析 | BeautifulSoup4 + markdownify | 成熟稳定、支持多解析器 |
| 动态页面 | Playwright (async) | 牛客网等 JS 渲染页面的兜底方案 |
| 数据库 | SQLAlchemy 2.0 + asyncmy | 异步 ORM、与 Java 端共享表结构 |
| 缓存/事件 | redis-py (async) | Redis Stream 发布、Cookie 管理 |
| 对象存储 | minio-py | MinIO S3 兼容 SDK |
| 定时调度 | APScheduler 4.x | Python 原生、支持 async job |
| 监控 | prometheus_client | Prometheus 指标暴露 |
| 日志 | structlog | 结构化 JSON 日志 |
| ID 生成 | snowflake-id | 雪花算法，与 Java 端兼容 |
| 配置 | pydantic-settings + watchfiles | YAML 配置 + 文件热更新 |


## Architecture

### 系统架构总览

```mermaid
graph TB
    subgraph External["外部平台"]
        LC[LeetCode Global]
        LCN[力扣中文站]
        CF[Codeforces]
        NC[牛客网]
        AT[AtCoder]
        LG[洛谷]
    end

    subgraph Crawler["python-crawler-service (FastAPI)"]
        API[FastAPI REST API]
        SCH[APScheduler 调度器]
        ORCH[CrawlOrchestrator 编排器]
        
        subgraph Adapters["adapters/ 插件目录"]
            A1[leetcode_global.py]
            A2[leetcode_cn.py]
            A3[codeforces.py]
            A4[nowcoder.py]
            A5[atcoder.py]
            A6[luogu.py]
        end
        
        subgraph AntiCrawl["反爬策略层"]
            TB[令牌桶限流器]
            CB[熔断器]
            UA[UA 轮转]
            CK[Cookie 管理]
        end
        
        subgraph Pipeline["数据标准化管线"]
            HTML2MD[HTML→Markdown]
            IMG[图片下载→MinIO]
            DIFF[难度映射]
            TAG[标签映射]
            QC[质量检查]
        end
        
        EVT[Redis Stream Publisher]
        PROM[Prometheus Metrics]
    end

    subgraph Infra["基础设施"]
        MySQL[(MySQL 8.0)]
        Redis[(Redis 7)]
        MinIO[(MinIO)]
    end

    subgraph JavaCore["Java Core Service"]
        CoreAPI[algorithm-help-core]
    end

    subgraph AI["algorithm-ai"]
        AIService[FastAPI AI 服务]
    end

    CoreAPI -->|HTTP POST /crawl/trigger| API
    API --> ORCH
    SCH --> ORCH
    ORCH --> Adapters
    Adapters -->|httpx async| External
    Adapters --> AntiCrawl
    ORCH --> Pipeline
    Pipeline --> MySQL
    Pipeline --> MinIO
    ORCH --> EVT
    EVT --> Redis
    Redis -->|Stream 消费| CoreAPI
    ORCH -->|HTTP| AIService
```


### 项目目录结构

```
crawler/
├── Dockerfile
├── pyproject.toml                  # Poetry/PDM 依赖管理
├── README.md
├── config/
│   ├── settings.yaml              # 主配置文件
│   └── settings.local.yaml        # 本地覆盖（gitignore）
├── src/
│   └── crawler_service/
│       ├── __init__.py
│       ├── main.py                # FastAPI 应用入口
│       ├── config.py              # Pydantic Settings 配置模型
│       ├── models/                # SQLAlchemy 模型 + Pydantic DTO
│       │   ├── __init__.py
│       │   ├── entities.py        # ORM 实体（CrawlTask、RawSource）
│       │   ├── enums.py           # 枚举定义
│       │   └── schemas.py         # Pydantic 请求/响应模型
│       ├── adapters/              # 平台适配器插件目录
│       │   ├── __init__.py        # 自动发现逻辑
│       │   ├── base.py            # PlatformAdapter 抽象基类
│       │   ├── leetcode_global.py
│       │   ├── leetcode_cn.py
│       │   ├── codeforces.py
│       │   ├── nowcoder.py
│       │   ├── atcoder.py
│       │   └── luogu.py           # 骨架预留
│       ├── anticrawl/             # 反爬策略层
│       │   ├── __init__.py
│       │   ├── manager.py         # AntiCrawlManager 总入口
│       │   ├── rate_limiter.py    # 令牌桶限流器
│       │   ├── circuit_breaker.py # 熔断器
│       │   ├── ua_rotator.py      # UA 轮转
│       │   └── cookie_store.py    # Redis Cookie 管理
│       ├── pipeline/              # 数据标准化管线
│       │   ├── __init__.py
│       │   ├── standardizer.py    # DataStandardizer 主逻辑
│       │   ├── html_converter.py  # HTML→Markdown 转换
│       │   ├── image_handler.py   # 图片下载与替换
│       │   ├── difficulty_mapper.py # 难度映射
│       │   ├── tag_mapper.py      # 标签映射
│       │   └── quality_checker.py # 数据质量检查
│       ├── orchestrator/          # 采集编排
│       │   ├── __init__.py
│       │   ├── engine.py          # CrawlOrchestrator
│       │   └── dedup.py           # 去重服务
│       ├── scheduler/             # 定时任务
│       │   ├── __init__.py
│       │   └── jobs.py            # APScheduler job 定义
│       ├── events/                # Redis Stream 事件
│       │   ├── __init__.py
│       │   └── publisher.py       # 事件发布器
│       ├── storage/               # 文件存储
│       │   ├── __init__.py
│       │   └── minio_client.py    # MinIO 封装
│       ├── database/              # 数据库
│       │   ├── __init__.py
│       │   ├── session.py         # AsyncSession 工厂
│       │   └── repository.py      # 仓储实现
│       ├── api/                   # FastAPI 路由
│       │   ├── __init__.py
│       │   ├── crawl.py           # 采集相关端点
│       │   ├── config_api.py      # 配置管理端点
│       │   ├── quality.py         # 质量统计端点
│       │   └── health.py          # 健康检查 + metrics
│       └── utils/                 # 工具
│           ├── __init__.py
│           ├── snowflake.py       # 雪花 ID 生成器
│           └── trace.py           # trace_id 中间件
└── tests/
    ├── conftest.py
    ├── test_adapters/
    ├── test_anticrawl/
    ├── test_pipeline/
    └── test_orchestrator/
```


## Components and Interfaces

### Component 1: PlatformAdapter 抽象基类与插件发现

**Requirement coverage:** R1, R17, R18, R19, R21

```python
# src/crawler_service/adapters/base.py
from abc import ABC, abstractmethod
from enum import Enum
from typing import Optional

class Platform(str, Enum):
    LEETCODE_GLOBAL = "leetcode_global"
    LEETCODE_CN = "leetcode_cn"
    CODEFORCES = "codeforces"
    NOWCODER = "nowcoder"
    ATCODER = "atcoder"
    LUOGU = "luogu"

class PlatformCapability(str, Enum):
    PROBLEM_FETCH = "problem_fetch"
    SOLUTION_FETCH = "solution_fetch"
    EDITORIAL_FETCH = "editorial_fetch"
    COMMENT_FETCH = "comment_fetch"

from dataclasses import dataclass, field

@dataclass
class FetchOptions:
    """采集参数"""
    offset: int = 0
    limit: int = 50
    last_fetch_time: Optional[int] = None  # UTC 毫秒

class ProxyProvider(ABC):
    """代理池接口（预留，当前使用 NoOp 实现）"""
    @abstractmethod
    def get_proxy(self) -> Optional[str]:
        """返回代理地址，None 表示不使用代理"""
        ...

class NoOpProxyProvider(ProxyProvider):
    """默认无代理实现"""
    def get_proxy(self) -> Optional[str]:
        return None

class PlatformAdapter(ABC):
    """平台适配器抽象基类，所有适配器必须继承此类"""

    @abstractmethod
    def get_platform(self) -> Platform:
        """返回平台标识"""
        ...

    @abstractmethod
    def get_capabilities(self) -> set[PlatformCapability]:
        """返回该平台支持的功能集合"""
        ...

    @abstractmethod
    async def fetch_problem_list(self, options: FetchOptions) -> list[dict]:
        """采集题目列表（支持增量）"""
        ...

    @abstractmethod
    async def fetch_problem_detail(self, platform_problem_id: str) -> dict:
        """采集单题详情"""
        ...

    async def fetch_solutions(self, platform_problem_id: str, top_n: int = 10) -> list[dict]:
        """采集高赞题解（默认返回空，子类可覆盖）"""
        return []

    async def fetch_editorial(self, platform_problem_id: str) -> Optional[dict]:
        """采集官方 Editorial（默认返回 None）"""
        return None

    async def fetch_comments(self, solution_id: str, min_upvotes: int = 5) -> list[dict]:
        """采集优质评论（默认返回空）"""
        return []
```

**插件自动发现机制：**

```python
# src/crawler_service/adapters/__init__.py
import importlib
import pkgutil
from pathlib import Path
from .base import PlatformAdapter, Platform

_registry: dict[Platform, type[PlatformAdapter]] = {}

def discover_adapters() -> dict[Platform, type[PlatformAdapter]]:
    """扫描 adapters/ 目录下所有 .py 文件，注册 enabled=true 的 PlatformAdapter 子类"""
    from ..config import get_settings
    settings = get_settings()
    package_dir = Path(__file__).parent
    for _, module_name, _ in pkgutil.iter_modules([str(package_dir)]):
        if module_name in ("__init__", "base"):
            continue
        module = importlib.import_module(f".{module_name}", package=__package__)
        for attr_name in dir(module):
            attr = getattr(module, attr_name)
            if (isinstance(attr, type)
                and issubclass(attr, PlatformAdapter)
                and attr is not PlatformAdapter):
                instance = attr()
                platform = instance.get_platform()
                # 只注册 enabled=true 的平台
                platform_cfg = settings.platforms.get(platform.value)
                if platform_cfg and platform_cfg.enabled:
                    _registry[platform] = attr
    return _registry

def get_adapter(platform: Platform) -> PlatformAdapter:
    """获取指定平台的适配器实例"""
    if platform not in _registry:
        raise ValueError(f"未注册的平台适配器: {platform}")
    return _registry[platform]()
```


### Component 2: AntiCrawlManager 反爬管理器

**Requirement coverage:** R3, R13

```python
# src/crawler_service/anticrawl/rate_limiter.py
import asyncio
import time

class TokenBucketRateLimiter:
    """令牌桶限流器 —— 自实现，替代 Java Resilience4j RateLimiter"""

    def __init__(self, rate: int, period: float = 60.0):
        """
        :param rate: period 时间内允许的最大请求数
        :param period: 时间窗口（秒），默认 60s
        """
        self._rate = rate
        self._period = period
        self._tokens = float(rate)
        self._last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        """获取一个令牌，令牌不足时 await 等待"""
        async with self._lock:
            self._refill()
            while self._tokens < 1.0:
                wait_time = (1.0 - self._tokens) * (self._period / self._rate)
                await asyncio.sleep(wait_time)
                self._refill()
            self._tokens -= 1.0

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_refill
        self._tokens = min(self._rate, self._tokens + elapsed * (self._rate / self._period))
        self._last_refill = now

    @property
    def available_tokens(self) -> float:
        """当前可用令牌数（用于 Prometheus 指标暴露）"""
        self._refill()
        return self._tokens
```

```python
# src/crawler_service/anticrawl/circuit_breaker.py
import asyncio
import time
from enum import Enum

class CircuitState(str, Enum):
    CLOSED = "closed"       # 正常
    OPEN = "open"           # 熔断
    HALF_OPEN = "half_open" # 半开探测

class CircuitBreaker:
    """熔断器 —— 自实现，替代 Java Resilience4j CircuitBreaker"""

    def __init__(self, failure_threshold: int = 5, wait_duration_ms: int = 300000):
        self._failure_threshold = failure_threshold
        self._wait_duration = wait_duration_ms / 1000.0
        self._failure_count = 0
        self._state = CircuitState.CLOSED
        self._last_failure_time: float = 0
        self._lock = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        if self._state == CircuitState.OPEN:
            if time.monotonic() - self._last_failure_time >= self._wait_duration:
                self._state = CircuitState.HALF_OPEN
        return self._state

    async def check(self) -> None:
        """检查是否允许通过，熔断时抛出异常"""
        if self.state == CircuitState.OPEN:
            raise CircuitOpenError(f"熔断器已打开，等待恢复")

    async def record_success(self) -> None:
        async with self._lock:
            self._failure_count = 0
            self._state = CircuitState.CLOSED

    async def record_failure(self) -> None:
        async with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.monotonic()
            if self._failure_count >= self._failure_threshold:
                self._state = CircuitState.OPEN

class CircuitOpenError(Exception):
    pass
```

```python
# src/crawler_service/anticrawl/manager.py
import random
import asyncio
from .rate_limiter import TokenBucketRateLimiter
from .circuit_breaker import CircuitBreaker, CircuitOpenError
from .ua_rotator import UARotator
from .cookie_store import RedisCookieStore

class AntiCrawlManager:
    """反爬总管理器 —— 协调限流、熔断、UA、Cookie、延迟"""

    def __init__(self, config, redis_client):
        self._limiters: dict[str, TokenBucketRateLimiter] = {}
        self._breakers: dict[str, CircuitBreaker] = {}
        self._ua_rotator = UARotator(config.anti_detect.user_agents)
        self._cookie_store = RedisCookieStore(redis_client)
        self._config = config
        self._init_platform_instances()

    async def acquire_permit(self, platform: str) -> None:
        """获取采集许可：熔断检查 → 限流等待 → 随机延迟"""
        breaker = self._breakers[platform]
        await breaker.check()
        limiter = self._limiters[platform]
        await limiter.acquire()
        await self._random_delay(platform)

    def get_headers(self, platform: str) -> dict[str, str]:
        """构建带反爬策略的请求头"""
        return {
            "User-Agent": self._ua_rotator.next(),
            "Cookie": self._cookie_store.get_sync(platform),
        }

    async def record_success(self, platform: str) -> None:
        await self._breakers[platform].record_success()

    async def record_failure(self, platform: str) -> None:
        await self._breakers[platform].record_failure()

    async def _random_delay(self, platform: str) -> None:
        delay_range = self._config.get_platform(platform).request_delay_ms
        delay = random.uniform(delay_range[0] / 1000, delay_range[1] / 1000)
        await asyncio.sleep(delay)
```


### Component 3: CrawlOrchestrator 采集编排器

**Requirement coverage:** R2, R5, R6, R13

```python
# src/crawler_service/orchestrator/engine.py
import structlog
from ..adapters import get_adapter
from ..adapters.base import Platform, FetchOptions
from ..pipeline.standardizer import DataStandardizer
from ..events.publisher import EventPublisher
from ..database.repository import CrawlTaskRepository, RawSourceRepository
from .dedup import DeduplicationService

logger = structlog.get_logger()

class CrawlOrchestrator:
    """采集编排器 —— 协调适配器、反爬、标准化、事件发布"""

    def __init__(
        self,
        anti_crawl,
        standardizer: DataStandardizer,
        dedup: DeduplicationService,
        task_repo: CrawlTaskRepository,
        raw_repo: RawSourceRepository,
        event_publisher: EventPublisher,
        ai_client,
        core_client,  # HTTP client for Java Core（写入 Problem/Solution）
        config,
    ):
        self._anti_crawl = anti_crawl
        self._standardizer = standardizer
        self._dedup = dedup
        self._task_repo = task_repo
        self._raw_repo = raw_repo
        self._event_publisher = event_publisher
        self._ai_client = ai_client
        self._core_client = core_client
        self._config = config
        self._cancel_flags: dict[int, bool] = {}  # task_id → cancel flag

    async def execute_crawl(self, task_id: int) -> None:
        """执行采集任务主流程"""
        import asyncio
        task = await self._task_repo.get_by_id(task_id)
        task.status = "RUNNING"
        self._cancel_flags[task_id] = False
        await self._task_repo.save(task)

        adapter = get_adapter(Platform(task.platform))
        platform_config = self._config.platforms.get(task.platform)
        options = FetchOptions(last_fetch_time=task.last_fetch_time)

        # 每平台并发限制（默认 3）
        semaphore = asyncio.Semaphore(3)

        try:
            raw_problems = await adapter.fetch_problem_list(options)
            task.progress = {"total": len(raw_problems), "completed": 0, "failed": 0}

            async def process_with_limit(raw):
                async with semaphore:
                    if self._cancel_flags.get(task_id):
                        return
                    await self._anti_crawl.acquire_permit(task.platform)
                    await self._process_one(raw, adapter, task, platform_config)

            # 并发执行，但限制并发数
            tasks_list = [process_with_limit(raw) for raw in raw_problems]
            await asyncio.gather(*tasks_list, return_exceptions=True)

            if self._cancel_flags.get(task_id):
                task.status = "CANCELLED"
            else:
                task.status = "COMPLETED"
                task.last_fetch_time = int(time.time() * 1000)
        except Exception as e:
            task.status = "FAILED"
            task.error_message = str(e)
            logger.error("采集任务失败", task_id=task_id, error=str(e))

        self._cancel_flags.pop(task_id, None)
        await self._task_repo.save(task)
        await self._event_publisher.publish_task_status_changed(task)

    def cancel(self, task_id: int) -> None:
        """设置取消标志，正在执行的任务会在下一个循环点检查并退出"""
        self._cancel_flags[task_id] = True

    async def _process_one(self, raw: dict, adapter, task, platform_config) -> None:
        """处理单条采集数据：去重 → 标准化 → 写入 Problem → 采集题解/评论 → 事件"""
        try:
            # 1. 去重检测
            dedup_result = await self._dedup.check(raw, task.platform, task.project)
            # 2. 保存原始数据
            await self._raw_repo.save_raw(raw, task.platform, task.project)
            # 3. 标准化
            normalized = await self._standardizer.standardize(raw, task.platform)
            # 4. 质量检查通过后，写入 Problem 表（通过 HTTP 调 Java Core）
            if normalized.get("quality_status") != "INCOMPLETE":
                problem_id = await self._core_client.save_problem(normalized, task.platform, task.project)
                # 5. 采集题解（当 solution_fetch_enabled 且 task_type 允许）
                if platform_config and platform_config.solution_fetch_enabled:
                    if task.task_type in ("SOLUTION_SYNC", "SINGLE_FETCH"):
                        await self._fetch_and_save_solutions(adapter, raw, problem_id, task)
                # 6. 采集 Editorial
                editorial = await adapter.fetch_editorial(raw.get("platform_id", ""))
                if editorial:
                    await self._raw_repo.save_raw(editorial, task.platform, task.project, content_type="EDITORIAL")
            # 7. 发布事件（触发 AI 加工）
            await self._event_publisher.publish_content_standardized(
                normalized, dedup_result, task.project
            )
            task.increment_completed()
        except Exception as e:
            task.increment_failed(raw.get("platform_id", ""), str(e))
            logger.warning("单题采集失败", platform=task.platform,
                           problem_id=raw.get("platform_id"), error=str(e))
        await self._task_repo.update_progress(task)

    async def _fetch_and_save_solutions(self, adapter, raw, problem_id, task) -> None:
        """采集题解并通过 HTTP 写入 Java Core"""
        solutions = await adapter.fetch_solutions(raw.get("platform_id", ""), top_n=10)
        for sol in solutions:
            await self._raw_repo.save_raw(sol, task.platform, task.project, content_type="SOLUTION")
            # 标准化后写入 UserSolution
            sol_normalized = await self._standardizer.standardize_solution(sol)
            if sol_normalized:
                await self._core_client.save_solution(sol_normalized, problem_id, task.project)
        # 采集评论
        comments = await adapter.fetch_comments(raw.get("platform_id", ""))
        for comment in comments:
            await self._raw_repo.save_raw(comment, task.platform, task.project, content_type="COMMENT")
```


### Component 4: DataStandardizer 数据标准化管线

**Requirement coverage:** R4, R7, R16

```python
# src/crawler_service/pipeline/standardizer.py
from .html_converter import HtmlToMarkdownConverter
from .image_handler import ImageHandler
from .difficulty_mapper import DifficultyMapper
from .tag_mapper import TagMapper
from .quality_checker import QualityChecker

class DataStandardizer:
    """数据标准化管线 —— 管道模式，各阶段独立可测"""

    def __init__(self, html_converter, image_handler, diff_mapper, tag_mapper, quality_checker):
        self._html_converter = html_converter
        self._image_handler = image_handler
        self._diff_mapper = diff_mapper
        self._tag_mapper = tag_mapper
        self._quality_checker = quality_checker

    async def standardize(self, raw: dict, platform: str) -> dict:
        """执行完整标准化管线"""
        # Stage 1: HTML → Markdown
        description_md = self._html_converter.convert(raw.get("description_html", ""))
        # Stage 2: 图片下载与 URL 替换
        description_md = await self._image_handler.process(description_md, platform)
        # Stage 3: 难度映射
        difficulty = self._diff_mapper.map(raw.get("raw_difficulty", ""), platform)
        # Stage 4: 标签映射
        tags = self._tag_mapper.map(raw.get("raw_tags", []), platform)
        # Stage 5: 质量检查
        quality_result = self._quality_checker.check({
            "title": raw.get("title"),
            "description": description_md,
            "difficulty": difficulty,
        })
        return {
            "title": raw.get("title"),
            "description": description_md,
            "difficulty": difficulty,
            "tags": tags,
            "constraints": raw.get("constraints"),
            "examples": raw.get("examples"),
            "quality_status": quality_result.status,
            "quality_message": quality_result.message,
        }
```

```python
# src/crawler_service/pipeline/image_handler.py
import re
import httpx
from ..storage.minio_client import MinioStorage

class ImageHandler:
    """图片下载、URL 替换、AI 描述生成"""

    def __init__(self, minio: MinioStorage, ai_client=None):
        self._minio = minio
        self._ai_client = ai_client  # HTTP client for algorithm-ai multimodal API

    async def process(self, markdown: str, platform: str) -> str:
        """处理 Markdown 中的外部图片：下载→存储→替换 URL→AI 描述"""
        img_pattern = re.compile(r'!\[([^\]]*)\]\((https?://[^)]+)\)')
        
        async def replace_image(match) -> str:
            alt_text = match.group(1)
            url = match.group(2)
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(url, timeout=30)
                    resp.raise_for_status()
                content_type = resp.headers.get("content-type", "image/png").split(";")[0]
                internal_url = await self._minio.upload_image(resp.content, content_type)
                # AI 图片描述（R7.3）
                if self._ai_client and not alt_text:
                    alt_text = await self._generate_alt_text(resp.content, content_type)
                return f'![{alt_text}]({internal_url})'
            except Exception:
                return match.group(0)  # 保留原始外部 URL

        # 逐个替换图片
        result = markdown
        for match in img_pattern.finditer(markdown):
            replacement = await replace_image(match)
            result = result.replace(match.group(0), replacement, 1)
        return result

    async def _generate_alt_text(self, image_data: bytes, content_type: str) -> str:
        """调用 algorithm-ai 多模态接口生成图片文本描述"""
        try:
            response = await self._ai_client.post(
                "/api/v1/ai/describe-image",
                files={"image": ("image", image_data, content_type)},
                timeout=30,
            )
            if response.status_code == 200:
                return response.json().get("data", {}).get("description", "")
        except Exception:
            pass
        return ""
```
from bs4 import BeautifulSoup
from markdownify import markdownify

class HtmlToMarkdownConverter:
    """HTML → Markdown 转换器"""

    def convert(self, html: str) -> str:
        """清洗 HTML 并转换为 Markdown"""
        if not html:
            return ""
        soup = BeautifulSoup(html, "html.parser")
        # 移除脚本、样式、导航
        for tag in soup.find_all(["script", "style", "nav"]):
            tag.decompose()
        return markdownify(str(soup), heading_style="ATX", code_language="python")
```

```python
# src/crawler_service/pipeline/difficulty_mapper.py
class DifficultyMapper:
    """难度映射器 —— 各平台到统一三级难度"""

    _PLATFORM_MAPPING = {
        "leetcode_global": {"Easy": "EASY", "Medium": "MEDIUM", "Hard": "HARD"},
        "leetcode_cn": {"简单": "EASY", "中等": "MEDIUM", "困难": "HARD"},
        "codeforces": lambda rating: (
            "EASY" if rating <= 1200
            else "MEDIUM" if rating <= 1800
            else "HARD"
        ),
    }

    def map(self, raw_difficulty: str | int, platform: str) -> str:
        """映射为 EASY/MEDIUM/HARD"""
        mapping = self._PLATFORM_MAPPING.get(platform)
        if callable(mapping):
            try:
                return mapping(int(raw_difficulty)) if raw_difficulty else "MEDIUM"
            except (ValueError, TypeError):
                return "MEDIUM"
        if isinstance(mapping, dict):
            return mapping.get(str(raw_difficulty), "MEDIUM")
        return "MEDIUM"
```


### Component 5: DeduplicationService 去重服务

**Requirement coverage:** R5

```python
# src/crawler_service/orchestrator/dedup.py
from enum import Enum

class DeduResult(str, Enum):
    CREATE_NEW = "create_new"
    UPDATE_EXISTING = "update_existing"
    AUTO_MAP_CONFIRMED = "auto_map_confirmed"
    AUTO_MAP_PENDING = "auto_map_pending"

class DeduplicationService:
    """跨平台题目去重服务"""

    def __init__(self, db_session, mapping_repo, jaccard_threshold_high=0.8, jaccard_threshold_low=0.5):
        self._db = db_session
        self._mapping_repo = mapping_repo
        self._threshold_high = jaccard_threshold_high
        self._threshold_low = jaccard_threshold_low

    async def check(self, raw: dict, platform: str, project: str = "algorithm-help") -> DeduResult:
        """执行去重检测：精确匹配 → 模糊匹配 → 写入 platform_mapping"""
        platform_id = raw.get("platform_id", "")
        # 1. 精确匹配
        existing = await self._exact_match(platform, platform_id)
        if existing:
            return DeduResult.UPDATE_EXISTING
        # 2. 模糊匹配
        title = raw.get("title", "")
        confidence, matched_problem_id = await self._fuzzy_match(title, raw.get("constraints", ""))
        if confidence >= self._threshold_high:
            await self._mapping_repo.save_mapping(
                unified_problem_id=matched_problem_id,
                platform=platform, platform_problem_id=platform_id,
                platform_url=raw.get("url", ""),
                confidence=confidence, confirmed=True, project=project,
            )
            return DeduResult.AUTO_MAP_CONFIRMED
        elif confidence >= self._threshold_low:
            await self._mapping_repo.save_mapping(
                unified_problem_id=matched_problem_id,
                platform=platform, platform_problem_id=platform_id,
                platform_url=raw.get("url", ""),
                confidence=confidence, confirmed=False, project=project,
            )
            return DeduResult.AUTO_MAP_PENDING
        return DeduResult.CREATE_NEW

    async def _exact_match(self, platform: str, platform_id: str):
        """精确匹配：同平台同 ID"""
        # SQL: SELECT id FROM raw_source WHERE platform=? AND platform_id=?
        ...

    async def _fuzzy_match(self, title: str, constraints: str) -> float:
        """模糊匹配：Jaccard 相似度 + 约束比对"""
        # 对标题做分词后 Jaccard 计算
        ...

    @staticmethod
    def jaccard_similarity(set_a: set, set_b: set) -> float:
        """Jaccard 相似度计算"""
        if not set_a and not set_b:
            return 0.0
        intersection = set_a & set_b
        union = set_a | set_b
        return len(intersection) / len(union)
```

### Component 6: EventPublisher Redis Stream 事件发布

**Requirement coverage:** R11, R2.6

```python
# src/crawler_service/events/publisher.py
import json
import time
from redis.asyncio import Redis

class EventPublisher:
    """Redis Stream 事件发布器"""

    CRAWL_EVENTS = "stream:crawl-events"
    CONTENT_EVENTS = "stream:content-events"

    def __init__(self, redis: Redis):
        self._redis = redis

    async def publish_task_status_changed(self, task) -> None:
        """发布采集任务状态变更事件"""
        from ..utils.trace import get_current_trace_id
        await self._redis.xadd(self.CRAWL_EVENTS, {
            "event_type": "TASK_STATUS_CHANGED",
            "task_id": str(task.id),
            "platform": task.platform,
            "status": task.status,
            "project": task.project,
            "timestamp": str(int(time.time() * 1000)),
            "trace_id": get_current_trace_id(),
        })

    async def publish_content_standardized(self, content: dict, dedup_result, project: str) -> None:
        """发布内容标准化完成事件"""
        from ..utils.trace import get_current_trace_id
        await self._redis.xadd(self.CONTENT_EVENTS, {
            "event_type": "CONTENT_STANDARDIZED",
            "content_type": "PROBLEM",
            "content_id": str(content.get("id", "")),
            "action": "STANDARDIZED",
            "needs_ai_enrich": "true" if dedup_result == "create_new" else "false",
            "project": project,
            "timestamp": str(int(time.time() * 1000)),
            "trace_id": get_current_trace_id(),
        })
```


### Component 7: FastAPI REST API 层

**Requirement coverage:** R22, R23, R8

```python
# src/crawler_service/api/crawl.py
from fastapi import APIRouter, Depends, Query
from ..models.schemas import (
    CrawlTriggerRequest, CrawlTaskDTO, ApiResponse, PaginatedResponse
)

router = APIRouter(prefix="/api/v1/crawl", tags=["采集管理"])

@router.post("/trigger", response_model=ApiResponse[CrawlTaskDTO])
async def trigger_crawl(request: CrawlTriggerRequest):
    """触发采集任务（对应原 CrawlerFacade.triggerCrawl）"""
    ...

@router.get("/tasks", response_model=ApiResponse[PaginatedResponse[CrawlTaskDTO]])
async def list_tasks(
    platform: str | None = Query(None),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """查询采集任务列表（分页 + 筛选）"""
    ...

@router.get("/tasks/{task_id}", response_model=ApiResponse[CrawlTaskDTO])
async def get_task(task_id: int):
    """查询任务详情含实时进度"""
    ...

@router.post("/tasks/{task_id}/cancel", response_model=ApiResponse[None])
async def cancel_task(task_id: int):
    """取消采集任务"""
    ...
```

**统一响应格式（与 Java Core 端保持一致）：**

```python
# src/crawler_service/models/schemas.py
from pydantic import BaseModel
from typing import Generic, TypeVar, Optional

T = TypeVar("T")

class ApiResponse(BaseModel, Generic[T]):
    """统一 API 响应结构"""
    code: int = 200
    message: str = "success"
    data: Optional[T] = None

class CrawlTriggerRequest(BaseModel):
    platform: Optional[str] = None
    task_type: str  # PROBLEM_SYNC / SOLUTION_SYNC / SINGLE_FETCH
    platform_problem_id: Optional[str] = None
    project: str = "algorithm-help"

class CrawlTaskDTO(BaseModel):
    id: int
    platform: str
    task_type: str
    status: str
    progress: dict | None = None
    trigger_type: str
    error_message: str | None = None
    created_at: int  # UTC 毫秒
    completed_at: int | None = None
    project: str
```

### Component 8: APScheduler 定时调度

**Requirement coverage:** R9

```python
# src/crawler_service/scheduler/jobs.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

def setup_scheduler(orchestrator, config) -> AsyncIOScheduler:
    """配置定时任务调度"""
    scheduler = AsyncIOScheduler()

    # 全平台题目增量同步：每日凌晨 3:00
    scheduler.add_job(
        orchestrator.sync_all_platforms,
        trigger=CronTrigger(hour=3, minute=0),
        id="daily_problem_sync",
        name="全平台题目增量同步",
        max_instances=1,
    )

    # 单平台题解采集：每周一凌晨 4:00
    scheduler.add_job(
        orchestrator.sync_solutions,
        trigger=CronTrigger(day_of_week="mon", hour=4),
        id="weekly_solution_sync",
        name="题解增量采集",
        max_instances=1,
    )

    # 失败任务自动重试：每 4 小时
    scheduler.add_job(
        orchestrator.retry_failed_tasks,
        trigger=IntervalTrigger(hours=4),
        id="retry_failed",
        name="失败任务重试",
        max_instances=1,
    )

    return scheduler
```


### Component 9: MinIO 文件存储

**Requirement coverage:** R10, R7

```python
# src/crawler_service/storage/minio_client.py
import uuid
from datetime import datetime
from minio import Minio
from io import BytesIO

ALLOWED_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

class MinioStorage:
    """MinIO 文件存储封装"""

    def __init__(self, endpoint: str, access_key: str, secret_key: str, secure: bool = False):
        self._client = Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)

    async def upload_image(self, data: bytes, content_type: str, bucket: str = "crawler-assets") -> str:
        """上传图片并返回内部 URL（使用 run_in_executor 包装同步 minio-py 调用）"""
        import asyncio
        if content_type not in ALLOWED_TYPES:
            raise ValueError(f"不允许的文件类型: {content_type}")
        if len(data) > MAX_FILE_SIZE:
            raise ValueError(f"文件大小超出限制: {len(data)} > {MAX_FILE_SIZE}")

        ext = content_type.split("/")[-1]
        now = datetime.utcnow()
        object_name = f"{now.strftime('%Y/%m/%d')}/{uuid.uuid4().hex}.{ext}"

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self._client.put_object(
                bucket, object_name, BytesIO(data), len(data), content_type=content_type
            )
        )
        return f"/{bucket}/{object_name}"

    def ensure_buckets(self, buckets: list[str]) -> None:
        """确保 bucket 存在"""
        for bucket in buckets:
            if not self._client.bucket_exists(bucket):
                self._client.make_bucket(bucket)
```

### Component 10: Prometheus 指标暴露

**Requirement coverage:** R12

```python
# src/crawler_service/api/health.py
from fastapi import APIRouter
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

router = APIRouter(tags=["健康检查"])

# 指标定义
crawl_requests_total = Counter(
    "crawler_requests_total", "采集请求总数", ["platform", "status"]
)
crawl_duration_seconds = Histogram(
    "crawler_request_duration_seconds", "采集请求耗时", ["platform"]
)
circuit_breaker_state = Gauge(
    "crawler_circuit_breaker_state", "熔断器状态 (0=closed, 1=open, 2=half_open)", ["platform"]
)
rate_limiter_tokens = Gauge(
    "crawler_rate_limiter_available_tokens", "限流器可用令牌数", ["platform"]
)

@router.get("/health")
async def health_check():
    return {"status": "ok"}

@router.get("/metrics")
async def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
```


## Data Models

### SQLAlchemy ORM 实体

```python
# src/crawler_service/models/entities.py
from sqlalchemy import Column, BigInteger, String, Text, JSON, Index
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

class CrawlTask(Base):
    """采集任务实体"""
    __tablename__ = "crawl_task"

    id = Column(BigInteger, primary_key=True, comment="雪花ID")
    platform = Column(String(20), nullable=False, comment="来源平台")
    task_type = Column(String(30), nullable=False, comment="PROBLEM_SYNC/SOLUTION_SYNC/SINGLE_FETCH")
    status = Column(String(20), nullable=False, default="PENDING", comment="PENDING/RUNNING/COMPLETED/FAILED")
    progress = Column(JSON, comment='{"total":100,"completed":50,"failed":2,"current_item":"two-sum"}')
    trigger_type = Column(String(10), nullable=False, comment="CRON/MANUAL")
    error_message = Column(Text, comment="失败原因")
    project = Column(String(50), nullable=False, default="algorithm-help", comment="所属项目")
    last_fetch_time = Column(BigInteger, comment="上次采集时间 UTC毫秒，用于增量检测")
    created_at = Column(BigInteger, nullable=False, comment="UTC毫秒")
    completed_at = Column(BigInteger, comment="UTC毫秒")

    __table_args__ = (
        Index("idx_crawltask_platform_status", "platform", "status"),
        Index("idx_crawltask_project", "project"),
        Index("idx_crawltask_created", "created_at"),
    )

    def increment_completed(self):
        if self.progress is None:
            self.progress = {"total": 0, "completed": 0, "failed": 0}
        self.progress["completed"] = self.progress.get("completed", 0) + 1

    def increment_failed(self, item_id: str, error: str):
        if self.progress is None:
            self.progress = {"total": 0, "completed": 0, "failed": 0}
        self.progress["failed"] = self.progress.get("failed", 0) + 1
        self.progress["last_error"] = f"{item_id}: {error}"


class RawSource(Base):
    """原始采集数据实体"""
    __tablename__ = "raw_source"

    id = Column(BigInteger, primary_key=True, comment="雪花ID")
    platform = Column(String(20), nullable=False, comment="来源平台")
    platform_id = Column(String(100), nullable=False, comment="平台原始ID")
    content_type = Column(String(20), nullable=False, comment="PROBLEM/SOLUTION/EDITORIAL/COMMENT")
    raw_json = Column(Text, nullable=False, comment="原始JSON数据")
    process_status = Column(String(20), nullable=False, default="PENDING", comment="PENDING/PROCESSED/FAILED/INCOMPLETE/LOW_QUALITY")
    error_message = Column(Text, comment="处理失败原因")
    project = Column(String(50), nullable=False, default="algorithm-help", comment="所属项目")
    fetched_at = Column(BigInteger, nullable=False, comment="UTC毫秒")
    processed_at = Column(BigInteger, comment="UTC毫秒")

    __table_args__ = (
        Index("idx_rawsource_platform_id", "platform", "platform_id"),
        Index("idx_rawsource_status", "process_status"),
        Index("idx_rawsource_project", "project"),
    )
```

```python
class PlatformMapping(Base):
    """跨平台题目映射实体"""
    __tablename__ = "platform_mapping"

    id = Column(BigInteger, primary_key=True, comment="雪花ID")
    unified_problem_id = Column(BigInteger, nullable=False, comment="内部统一题目ID")
    platform = Column(String(20), nullable=False, comment="来源平台")
    platform_problem_id = Column(String(100), nullable=False, comment="平台原始题号")
    platform_url = Column(String(500), comment="平台链接")
    confidence = Column(Float, nullable=False, default=1.0, comment="映射置信度 0-1")
    confirmed = Column(Boolean, nullable=False, default=False, comment="是否人工确认")
    project = Column(String(50), nullable=False, default="algorithm-help", comment="所属项目")
    created_at = Column(BigInteger, nullable=False, comment="UTC毫秒")

    __table_args__ = (
        Index("uk_mapping_platform_problemid", "platform", "platform_problem_id", unique=True),
        Index("idx_mapping_unified", "unified_problem_id"),
        Index("idx_mapping_project", "project"),
    )
```

### 数据库表 DDL（与 Java Core 端共享）

```sql
-- crawl_task 表（新增 project + last_fetch_time 字段）
ALTER TABLE crawl_task ADD COLUMN project VARCHAR(50) NOT NULL DEFAULT 'algorithm-help' COMMENT '所属项目';
ALTER TABLE crawl_task ADD COLUMN last_fetch_time BIGINT COMMENT '上次采集时间 UTC毫秒';
CREATE INDEX idx_crawltask_project ON crawl_task(project);

-- raw_source 表（新增 project 字段）
ALTER TABLE raw_source ADD COLUMN project VARCHAR(50) NOT NULL DEFAULT 'algorithm-help' COMMENT '所属项目';
CREATE INDEX idx_rawsource_project ON raw_source(project);

-- platform_mapping 表（新增 project 字段）
ALTER TABLE platform_mapping ADD COLUMN project VARCHAR(50) NOT NULL DEFAULT 'algorithm-help' COMMENT '所属项目';
CREATE INDEX idx_mapping_project ON platform_mapping(project);
```

### 枚举定义

```python
# src/crawler_service/models/enums.py
from enum import Enum

class TaskType(str, Enum):
    PROBLEM_SYNC = "PROBLEM_SYNC"
    SOLUTION_SYNC = "SOLUTION_SYNC"
    SINGLE_FETCH = "SINGLE_FETCH"

class TaskStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class TriggerType(str, Enum):
    CRON = "CRON"
    MANUAL = "MANUAL"

class ProcessStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSED = "PROCESSED"
    FAILED = "FAILED"
    INCOMPLETE = "INCOMPLETE"
    LOW_QUALITY = "LOW_QUALITY"

class ContentType(str, Enum):
    PROBLEM = "PROBLEM"
    SOLUTION = "SOLUTION"
    EDITORIAL = "EDITORIAL"
    COMMENT = "COMMENT"

class Difficulty(str, Enum):
    EASY = "EASY"
    MEDIUM = "MEDIUM"
    HARD = "HARD"
```

### 配置模型

```python
# src/crawler_service/config.py
from pydantic_settings import BaseSettings
from pydantic import BaseModel

class PlatformConfig(BaseModel):
    enabled: bool = True
    base_url: str = ""
    api_url: str = ""
    graphql_url: str = ""
    rate_limit: int = 10  # 每分钟最大请求数
    retry_max: int = 3
    retry_delay_ms: int = 2000
    cookie_key: str = ""
    capabilities: list[str] = []
    solution_fetch_enabled: bool = False
    request_delay_ms: list[int] = [1000, 3000]

class AntiDetectConfig(BaseModel):
    user_agents: list[str] = []
    request_delay_ms: list[int] = [1500, 3500]
    circuit_breaker_failure_threshold: int = 5
    circuit_breaker_wait_duration_ms: int = 300000
    proxy_enabled: bool = False
    proxy_provider: str = "none"

class DatabaseConfig(BaseModel):
    url: str = "mysql+asyncmy://root:password@localhost:3306/algorithm_help"
    pool_size: int = 10
    max_overflow: int = 20

class RedisConfig(BaseModel):
    url: str = "redis://localhost:6379/0"

class MinioConfig(BaseModel):
    endpoint: str = "localhost:9000"
    access_key: str = "admin"
    secret_key: str = "changeme123"
    secure: bool = False

class AiConfig(BaseModel):
    base_url: str = "http://localhost:8001"
    batch_rate_limit: int = 10  # 每分钟
    daily_budget: int = 500

class Settings(BaseSettings):
    service_name: str = "python-crawler-service"
    host: str = "0.0.0.0"
    port: int = 8002
    project: str = "algorithm-help"
    platforms: dict[str, PlatformConfig] = {}
    anti_detect: AntiDetectConfig = AntiDetectConfig()
    database: DatabaseConfig = DatabaseConfig()
    redis: RedisConfig = RedisConfig()
    minio: MinioConfig = MinioConfig()
    ai: AiConfig = AiConfig()
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 令牌桶限流器不超过配额

*For any* rate（每分钟允许请求数）和 period（时间窗口），在一个 period 时间窗口内调用 acquire() 的成功次数不应超过 rate。

**Validates: Requirements 3.1**

### Property 2: 熔断器状态转换正确性

*For any* failure_threshold 和连续失败/成功序列，熔断器的状态转换应满足：
- 连续失败次数 >= failure_threshold → 状态为 OPEN
- OPEN 状态经过 wait_duration 后 → 状态为 HALF_OPEN
- HALF_OPEN 状态下成功 → 状态为 CLOSED
- CLOSED 状态下连续失败未达阈值 → 保持 CLOSED

**Validates: Requirements 3.5**

### Property 3: 指数退避延迟计算

*For any* base_delay（正整数）和重试次数 n（0 ≤ n < retry_max），第 n 次重试的等待时间应等于 base_delay * 2^n 毫秒。

**Validates: Requirements 3.4**

### Property 4: UA 轮转选择来自配置列表

*For any* 非空 UA 配置列表和任意请求次数 N，UARotator.next() 返回的每个 UA 字符串都应存在于配置列表中。

**Validates: Requirements 3.2**

### Property 5: 随机延迟在配置范围内

*For any* delay 配置范围 [min_ms, max_ms]（0 < min_ms ≤ max_ms），生成的随机延迟值 d 应满足 min_ms ≤ d ≤ max_ms。

**Validates: Requirements 3.8**

### Property 6: HTML→Markdown 清洗不变量

*For any* 包含 `<script>`、`<style>`、`<nav>` 标签的 HTML 字符串，经过 HtmlToMarkdownConverter.convert() 转换后的 Markdown 结果不应包含这些标签的内容，且原始文本内容（非标签内容）应保留在输出中。

**Validates: Requirements 4.2**

### Property 7: 图片 URL 替换为内部格式

*For any* 包含外部图片 URL（http(s)://开头）的 Markdown 文本，经过 ImageHandler.process() 处理后，所有原始外部图片 URL 应被替换为匹配 `/{bucket}/{yyyy}/{MM}/{dd}/{uuid}.{ext}` 格式的内部路径（图片下载成功时），或保留原始 URL（下载失败时）。

**Validates: Requirements 4.3, 7.2, 7.5**

### Property 8: 难度映射输出合法性

*For any* 平台标识和该平台的任意难度原始值，DifficultyMapper.map() 的返回值必须是 {"EASY", "MEDIUM", "HARD"} 三者之一。

**Validates: Requirements 4.4**

### Property 9: 标签映射闭合性

*For any* 平台标识和任意原始标签列表，TagMapper.map() 的返回结果中每个标签要么属于内部标签集合，要么被标记为"待人工确认"状态，不存在第三种情况。

**Validates: Requirements 4.5, 4.7**

### Property 10: Jaccard 相似度数学正确性

*For any* 两个有限集合 A 和 B，jaccard_similarity(A, B) 的返回值应满足：
- 值域在 [0.0, 1.0] 范围内
- A == B（非空）时返回 1.0
- A ∩ B == ∅（A、B 非空）时返回 0.0
- jaccard_similarity(A, B) == jaccard_similarity(B, A)（对称性）

**Validates: Requirements 5.1**

### Property 11: 去重阈值判断正确性

*For any* confidence 值（0.0 ≤ confidence ≤ 1.0），去重结果应满足：
- confidence >= 0.8 → AUTO_MAP_CONFIRMED
- 0.5 ≤ confidence < 0.8 → AUTO_MAP_PENDING
- confidence < 0.5 → CREATE_NEW

**Validates: Requirements 5.3, 5.4, 5.5**

### Property 12: 文件存储校验规则

*For any* 上传请求（content_type, data_size），文件存储校验应满足：
- content_type ∈ ALLOWED_TYPES 且 data_size ≤ 10MB → 存储成功，路径匹配 `{yyyy}/{MM}/{dd}/{uuid}.{ext}` 格式
- content_type ∉ ALLOWED_TYPES → 拒绝并抛出 ValueError
- data_size > 10MB → 拒绝并抛出 ValueError

**Validates: Requirements 10.3, 10.4, 10.5**

### Property 13: 事件消息格式完整性

*For any* 采集任务状态变更或内容标准化完成事件，发布到 Redis Stream 的消息必须包含以下字段：event_type（非空字符串）、timestamp（合法 UTC 毫秒值）、platform（合法平台标识），且字段值不为 None。

**Validates: Requirements 11.2, 11.3, 11.4**

### Property 14: 雪花 ID 单调递增且唯一

*For any* 连续生成的 N 个雪花 ID 序列（N ≥ 2），每个 ID 应严格大于前一个 ID（单调递增），且序列中无重复值。

**Validates: Requirements 14.5**

### Property 15: 数据质量检查正确性

*For any* 题目数据（title, description, difficulty 组合），质量检查结果应满足：
- title/description/difficulty 任一为空或 None → status 为 INCOMPLETE
- 三者均非空 → status 不为 INCOMPLETE
对于题解内容（content），若 len(content) < 100 → status 为 LOW_QUALITY

**Validates: Requirements 16.1, 16.2**

### Property 16: 批次容错不中断

*For any* 包含 N 个待采集项的批次（N ≥ 2），若其中 M 个项（M < N）采集失败，则剩余 N-M 个项应正常处理完成，最终 CrawlTask.progress.completed 应等于 N-M。

**Validates: Requirements 13.1**


## Error Handling

### 错误分类与处理策略

| 错误类型 | 处理策略 | 影响范围 |
|---------|---------|---------|
| HTTP 429 (Too Many Requests) | 读取 Retry-After 头等待后重试 | 单个请求 |
| HTTP 403 (Forbidden) | 触发 Cookie 刷新 → 重试一次 | 单个请求 |
| HTTP 5xx (Server Error) | 指数退避重试（最多 retry_max 次） | 单个请求 |
| 网络超时/连接失败 | 指数退避重试 | 单个请求 |
| 单题采集失败 | 记录错误，继续下一题 | 单个题目 |
| 图片下载失败 | 保留原始外部 URL，不中断 | 单个图片 |
| 标签映射失败 | 保留原始标签名，标记待确认 | 单个标签 |
| 平台熔断 | 暂停该平台采集，发出告警 | 单平台 |
| AI 调用失败 | process_status=FAILED，不阻塞采集 | 单条内容 |
| 数据库连接失败 | 任务标记 FAILED，等待重试 | 整个任务 |
| MinIO 不可用 | 图片保留外部 URL，记录告警 | 图片存储 |

### 异常层次设计

```python
# src/crawler_service/exceptions.py

class CrawlerBaseError(Exception):
    """爬虫服务基础异常"""
    pass

class PlatformError(CrawlerBaseError):
    """平台相关错误"""
    def __init__(self, platform: str, message: str):
        self.platform = platform
        super().__init__(f"[{platform}] {message}")

class PlatformUnavailableError(PlatformError):
    """平台不可用（熔断触发）"""
    pass

class RateLimitExceededError(PlatformError):
    """限流超出"""
    pass

class RetryExhaustedError(PlatformError):
    """重试耗尽"""
    def __init__(self, platform: str, attempts: int, last_error: Exception):
        self.attempts = attempts
        self.last_error = last_error
        super().__init__(platform, f"重试 {attempts} 次后仍失败: {last_error}")

class DataQualityError(CrawlerBaseError):
    """数据质量问题"""
    def __init__(self, quality_status: str, message: str):
        self.quality_status = quality_status
        super().__init__(message)

class StorageError(CrawlerBaseError):
    """存储错误（MinIO/数据库）"""
    pass
```

### 重试与降级流程

```mermaid
graph TD
    A[发起请求] --> B{HTTP 响应?}
    B -->|200| C[成功处理]
    B -->|429| D[读取 Retry-After]
    B -->|403| E[刷新 Cookie]
    B -->|5xx| F[指数退避]
    B -->|超时| F
    D --> G[等待指定时间]
    G --> A
    E --> H{重试一次}
    H -->|成功| C
    H -->|仍 403| I[标记失败]
    F --> J{重试次数 < retry_max?}
    J -->|是| K[等待 base_delay * 2^n]
    K --> A
    J -->|否| I
    I --> L[记录错误,继续下一题]
    L --> M{是否连续失败 >= threshold?}
    M -->|是| N[触发熔断]
    M -->|否| O[继续采集]
```


## Testing Strategy

### 测试框架与工具

| 工具 | 用途 |
|------|------|
| pytest | 测试框架 |
| pytest-asyncio | 异步测试支持 |
| hypothesis | Property-Based Testing（PBT）库 |
| httpx (MockTransport) | HTTP mock |
| fakeredis | Redis mock |
| testcontainers | 集成测试容器（MySQL、Redis、MinIO） |
| factory_boy | 测试数据工厂 |

### 测试分层

```
tests/
├── unit/                          # 单元测试（纯函数、无 I/O）
│   ├── test_rate_limiter.py       # Property 1
│   ├── test_circuit_breaker.py    # Property 2
│   ├── test_retry.py             # Property 3
│   ├── test_ua_rotator.py        # Property 4, 5
│   ├── test_html_converter.py    # Property 6
│   ├── test_image_handler.py     # Property 7
│   ├── test_difficulty_mapper.py # Property 8
│   ├── test_tag_mapper.py        # Property 9
│   ├── test_dedup.py             # Property 10, 11
│   ├── test_minio_storage.py     # Property 12
│   ├── test_event_publisher.py   # Property 13
│   ├── test_snowflake.py         # Property 14
│   ├── test_quality_checker.py   # Property 15
│   └── test_orchestrator.py      # Property 16
├── integration/                   # 集成测试（含 I/O）
│   ├── test_database.py          # MySQL 读写
│   ├── test_redis_stream.py      # Redis Stream 发布/消费
│   ├── test_minio_upload.py      # MinIO 上传
│   └── test_adapters/            # 各平台适配器（mock HTTP）
│       ├── test_leetcode.py
│       ├── test_codeforces.py
│       └── test_nowcoder.py
└── e2e/                           # 端到端测试
    └── test_crawl_flow.py        # 完整采集流程
```

### Property-Based Testing 配置

- 测试库：**hypothesis**（Python 生态最成熟的 PBT 库）
- 每个 property test 最少 **100 次迭代**
- 标记格式：`@pytest.mark.property` + 注释引用设计文档 property 编号
- 标签格式示例：

```python
# Feature: python-crawler-service, Property 1: 令牌桶限流器不超过配额
@given(rate=st.integers(min_value=1, max_value=100),
       requests=st.integers(min_value=1, max_value=200))
@settings(max_examples=100)
def test_token_bucket_rate_limit(rate, requests):
    """Property 1: 在一个 period 内 acquire 成功次数不超过 rate"""
    ...
```

### 单元测试关注点（Example-Based）

- 各平台适配器的 mock HTTP 响应解析
- API 端点请求/响应格式验证
- 定时任务注册和触发验证
- 配置加载和热更新验证
- 异常分支覆盖（429/403/5xx 处理）

### 集成测试关注点

- MySQL 表读写正确性（raw_source、crawl_task）
- Redis Stream 事件发布和消费
- MinIO 文件上传和路径生成
- 完整采集→标准化→事件发布链路

### CI 集成

```yaml
# GitHub Actions / GitLab CI 配置片段
test:
  services:
    - mysql:8.0
    - redis:7
    - minio/minio:latest
  script:
    - pytest tests/unit/ -v --tb=short
    - pytest tests/integration/ -v --tb=short
    - pytest tests/unit/ -m property --hypothesis-show-statistics
```

