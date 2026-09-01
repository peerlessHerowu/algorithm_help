# Implementation Plan: Python Crawler Service

## Overview

将原 Java 爬虫模块（algorithm-help-crawler）完整重写为独立 Python 微服务，部署在项目根目录 `crawler/` 下。采用 FastAPI + httpx + BeautifulSoup + Playwright 技术栈，实现插件化适配器、异步采集、反爬策略、数据标准化管线、Redis Stream 事件发布等完整功能。

## Tasks

- [x] 1. 项目骨架搭建与基础配置
  - [x] 1.1 创建项目目录结构与 pyproject.toml
    - 在 `crawler/` 目录下创建完整项目结构（src/crawler_service/、tests/、config/ 等）
    - 创建 `pyproject.toml` 定义依赖：fastapi、uvicorn、httpx、beautifulsoup4、markdownify、playwright、sqlalchemy、asyncmy、redis、minio、apscheduler、prometheus-client、structlog、pydantic-settings、watchfiles、hypothesis、pytest、pytest-asyncio
    - 创建 `README.md` 说明服务用途和启动方式
    - _Requirements: 15.1, 15.2_

  - [x] 1.2 实现 Pydantic Settings 配置模型
    - 创建 `src/crawler_service/config.py`，定义 Settings、PlatformConfig、AntiDetectConfig、DatabaseConfig、RedisConfig、MinioConfig、AiConfig
    - 创建 `config/settings.yaml` 默认配置文件，包含所有平台配置块
    - 实现 YAML 配置加载 + watchfiles 热更新监听（30 秒内生效）
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 1.3 实现枚举定义与 Pydantic DTO 模型
    - 创建 `src/crawler_service/models/enums.py`：Platform、PlatformCapability、TaskType、TaskStatus、TriggerType、ProcessStatus、ContentType、Difficulty
    - 创建 `src/crawler_service/models/schemas.py`：ApiResponse[T]、CrawlTriggerRequest、CrawlTaskDTO、PaginatedResponse[T]
    - 确保 DTO 字段语义与 Java Core 端 CrawlTriggerRequest、CrawlTaskDTO 一致
    - _Requirements: 22.4, 23.6, 1.2, 1.3_

- [x] 2. 基础设施层（数据库、Redis、MinIO、雪花 ID）
  - [x] 2.1 实现数据库连接与 ORM 实体
    - 创建 `src/crawler_service/database/session.py`：AsyncSession 工厂（基于 SQLAlchemy 2.0 async engine）
    - 创建 `src/crawler_service/models/entities.py`：CrawlTask（含 last_fetch_time 字段）、RawSource、PlatformMapping ORM 实体定义
    - 包含所有字段、索引、辅助方法（increment_completed、increment_failed）
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 21.5_

  - [x] 2.2 实现数据库仓储层
    - 创建 `src/crawler_service/database/repository.py`：CrawlTaskRepository、RawSourceRepository、PlatformMappingRepository
    - 实现 CRUD 方法：create、get_by_id、update_progress、list_tasks（分页+筛选）、save_raw、save_mapping
    - 所有时间字段使用 Long 类型 UTC 毫秒时间戳
    - _Requirements: 14.1, 14.4, 2.5, 5.6, 23.2, 23.4_

  - [x] 2.3 实现 Redis 连接封装
    - 创建 `src/crawler_service/database/redis_client.py`：基于 redis-py async 的连接池管理
    - 提供 get_redis() 依赖注入函数，用于 FastAPI Depends
    - 支持连接池配置、健康检查
    - _Requirements: 3.3, 11.1_

  - [x] 2.4 实现 MinIO 文件存储封装
    - 创建 `src/crawler_service/storage/minio_client.py`：MinioStorage 类
    - 实现 upload_image（类型校验 + 大小校验 + 日期分区路径）、ensure_buckets 方法
    - 允许类型：image/png、image/jpeg、image/gif、image/webp、image/svg+xml，大小限制 10MB
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 2.5 写 Property Test：文件存储校验规则
    - **Property 12: 文件存储校验规则**
    - 使用 hypothesis 生成随机 content_type 和 data_size，验证校验逻辑正确性
    - **Validates: Requirements 10.3, 10.4, 10.5**

  - [x] 2.6 实现雪花 ID 生成器
    - 创建 `src/crawler_service/utils/snowflake.py`：SnowflakeIDGenerator 类
    - 与 Java 端雪花算法兼容（epoch、worker_id 位数、sequence 位数一致）
    - 提供 next_id() 方法，保证单调递增且唯一
    - _Requirements: 14.5_

  - [x] 2.7 写 Property Test：雪花 ID 单调递增且唯一
    - **Property 14: 雪花 ID 单调递增且唯一**
    - 使用 hypothesis 生成连续 N 个 ID，验证严格递增和无重复
    - **Validates: Requirements 14.5**

- [x] 3. Checkpoint - 确保基础设施层测试通过
  - 确保所有测试通过，ask the user if questions arise.

- [x] 4. 反爬策略层
  - [x] 4.1 实现令牌桶限流器
    - 创建 `src/crawler_service/anticrawl/rate_limiter.py`：TokenBucketRateLimiter 类
    - 实现 acquire()（异步等待令牌）、available_tokens 属性（用于 Prometheus）
    - 每个平台独立实例，rate 从配置动态读取
    - _Requirements: 3.1_

  - [x] 4.2 写 Property Test：令牌桶限流器不超过配额
    - **Property 1: 令牌桶限流器不超过配额**
    - 验证在 period 时间窗口内 acquire 成功次数不超过 rate
    - **Validates: Requirements 3.1**

  - [x] 4.3 实现熔断器
    - 创建 `src/crawler_service/anticrawl/circuit_breaker.py`：CircuitBreaker 类、CircuitState 枚举、CircuitOpenError 异常
    - 实现状态转换：CLOSED → OPEN（连续失败达阈值）→ HALF_OPEN（等待时间后）→ CLOSED（成功）
    - 提供 check()、record_success()、record_failure() 方法
    - _Requirements: 3.5, 3.6_

  - [x] 4.4 写 Property Test：熔断器状态转换正确性
    - **Property 2: 熔断器状态转换正确性**
    - 使用 hypothesis 生成连续失败/成功序列，验证状态转换逻辑
    - **Validates: Requirements 3.5**

  - [x] 4.5 实现 UA 轮转器
    - 创建 `src/crawler_service/anticrawl/ua_rotator.py`：UARotator 类
    - 实现 next() 方法，从配置的 UA 列表中随机选取
    - _Requirements: 3.2_

  - [x] 4.6 写 Property Test：UA 轮转选择来自配置列表 + 随机延迟范围
    - **Property 4: UA 轮转选择来自配置列表**
    - **Property 5: 随机延迟在配置范围内**
    - 验证 next() 返回值始终在配置列表中，延迟值在 [min, max] 范围内
    - **Validates: Requirements 3.2, 3.8**

  - [x] 4.7 实现 Redis Cookie 管理器
    - 创建 `src/crawler_service/anticrawl/cookie_store.py`：RedisCookieStore 类
    - 实现 get（从 Redis 读取 `crawler:cookie:{platform}`）、set、refresh 方法
    - 支持 Cookie 过期自动刷新
    - _Requirements: 3.3_

  - [x] 4.8 实现 AntiCrawlManager 总入口与指数退避重试
    - 创建 `src/crawler_service/anticrawl/manager.py`：AntiCrawlManager 类
    - 协调 限流 → 熔断检查 → UA 选取 → Cookie → 随机延迟
    - 实现 acquire_permit、get_headers、record_success、record_failure、retry_with_backoff
    - 指数退避：base_delay * 2^n，最多 retry_max 次
    - 预留 ProxyProvider 接口 + NoOpProxyProvider 默认实现（proxy.enabled=false）
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8_

  - [x] 4.9 写 Property Test：指数退避延迟计算
    - **Property 3: 指数退避延迟计算**
    - 验证第 n 次重试等待时间 == base_delay * 2^n
    - **Validates: Requirements 3.4**

- [x] 5. 平台适配器抽象基类与插件发现
  - [x] 5.1 实现 PlatformAdapter 抽象基类
    - 创建 `src/crawler_service/adapters/base.py`：PlatformAdapter ABC
    - 定义 get_platform、get_capabilities、fetch_problem_list、fetch_problem_detail、fetch_solutions、fetch_editorial、fetch_comments 方法
    - 非必须方法提供默认空实现（fetch_solutions 返回空列表等）
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 5.2 实现插件自动发现注册机制
    - 创建 `src/crawler_service/adapters/__init__.py`：discover_adapters() 函数
    - 基于 pkgutil.iter_modules 扫描 adapters/ 目录，自动注册 PlatformAdapter 子类
    - 根据配置中 enabled=true/false 过滤适配器（enabled=false 的平台不注册）
    - 提供 get_adapter(platform) 获取适配器实例
    - _Requirements: 1.4, 1.5, 1.6_

- [x] 6. 各平台适配器实现
  - [x] 6.1 实现 LeetCode 国际站适配器
    - 创建 `src/crawler_service/adapters/leetcode_global.py`
    - 通过 GraphQL API 采集题目列表/详情、高赞题解（前 10）、Editorial
    - 处理分页（每次 50 题）、Cookie 认证、增量检测
    - _Requirements: 17.1, 17.3, 17.4, 17.5, 17.6, 17.7_

  - [x] 6.2 实现力扣中文站适配器
    - 创建 `src/crawler_service/adapters/leetcode_cn.py`
    - 独立 GraphQL API 端点，采集中文版题目
    - 字段映射与国际站适配器类似，配置独立
    - _Requirements: 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_

  - [x] 6.3 实现 Codeforces 适配器
    - 创建 `src/crawler_service/adapters/codeforces.py`
    - 通过 REST API 采集题目列表，contestId + index 组合为题号
    - rating → 统一难度映射，HTML 题面 → Markdown
    - 处理 API FAILED 状态重试
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

  - [x] 6.4 实现牛客网适配器
    - 创建 `src/crawler_service/adapters/nowcoder.py`
    - 使用 BeautifulSoup 或 Playwright 解析 HTML 页面
    - 声明 capabilities（可能不支持题解/评论采集）
    - _Requirements: 19.1, 19.4, 19.5, 19.6_

  - [x] 6.5 实现 AtCoder 适配器
    - 创建 `src/crawler_service/adapters/atcoder.py`
    - 通过 AtCoder Problems API（第三方开源）采集题目列表和难度
    - _Requirements: 19.2, 19.4, 19.5, 19.6_

  - [x] 6.6 实现洛谷适配器骨架
    - 创建 `src/crawler_service/adapters/luogu.py`
    - 骨架预留，默认 enabled=false，实现基本接口返回空结果
    - _Requirements: 19.3, 19.6_

  - [x] 6.7 写适配器单元测试（mock HTTP 响应）
    - 对 LeetCode、Codeforces、牛客网适配器编写 mock 测试
    - 验证 GraphQL/REST/HTML 响应解析正确性
    - _Requirements: 2.1, 2.2_

- [x] 7. Checkpoint - 确保适配器和反爬层测试通过
  - 确保所有测试通过，ask the user if questions arise.

- [x] 8. 数据标准化管线
  - [x] 8.1 实现 HTML→Markdown 转换器
    - 创建 `src/crawler_service/pipeline/html_converter.py`：HtmlToMarkdownConverter 类
    - 使用 BeautifulSoup 清洗（移除 script/style/nav）+ markdownify 转换
    - _Requirements: 4.2_

  - [x] 8.2 写 Property Test：HTML→Markdown 清洗不变量
    - **Property 6: HTML→Markdown 清洗不变量**
    - 验证转换后不包含 script/style/nav 内容，原始文本保留
    - **Validates: Requirements 4.2**

  - [x] 8.3 实现图片下载与 URL 替换处理器
    - 创建 `src/crawler_service/pipeline/image_handler.py`：ImageHandler 类
    - 下载外部图片到 MinIO（使用 run_in_executor 包装同步 minio-py），替换为内部 URL
    - 下载成功后调用 algorithm-ai 多模态接口生成图片 alt 文本描述（R7.3）
    - 下载失败时保留原始 URL 标记为"外部引用"，GIF 保持原格式
    - _Requirements: 4.3, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 8.4 写 Property Test：图片 URL 替换为内部格式
    - **Property 7: 图片 URL 替换为内部格式**
    - 验证成功下载的图片 URL 匹配内部路径格式，失败的保留原始 URL
    - **Validates: Requirements 4.3, 7.2, 7.5**

  - [x] 8.5 实现难度映射器
    - 创建 `src/crawler_service/pipeline/difficulty_mapper.py`：DifficultyMapper 类
    - 各平台难度到 EASY/MEDIUM/HARD 映射：LeetCode 文本映射、Codeforces rating 区间映射
    - _Requirements: 4.4_

  - [x] 8.6 写 Property Test：难度映射输出合法性
    - **Property 8: 难度映射输出合法性**
    - 验证任意输入返回值必须是 EASY/MEDIUM/HARD 之一
    - **Validates: Requirements 4.4**

  - [x] 8.7 实现标签映射器
    - 创建 `src/crawler_service/pipeline/tag_mapper.py`：TagMapper 类
    - 维护内部标签集合 + 各平台标签映射表
    - 无法映射的标签保留原名并标记"待人工确认"
    - _Requirements: 4.5, 4.7_

  - [x] 8.8 写 Property Test：标签映射闭合性
    - **Property 9: 标签映射闭合性**
    - 验证输出标签要么属于内部集合，要么标记为"待人工确认"
    - **Validates: Requirements 4.5, 4.7**

  - [x] 8.9 实现数据质量检查器
    - 创建 `src/crawler_service/pipeline/quality_checker.py`：QualityChecker 类
    - 题目完整性校验（title/description/difficulty 必填），题解最小长度校验（< 100 字符 → LOW_QUALITY）
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [x] 8.10 写 Property Test：数据质量检查正确性
    - **Property 15: 数据质量检查正确性**
    - 验证 title/description/difficulty 缺失 → INCOMPLETE，content 长度 < 100 → LOW_QUALITY
    - **Validates: Requirements 16.1, 16.2**

  - [x] 8.11 实现 DataStandardizer 主管线
    - 创建 `src/crawler_service/pipeline/standardizer.py`：DataStandardizer 类
    - 串联 HTML 转换 → 图片处理 → 难度映射 → 标签映射 → 质量检查 五阶段管线
    - 保留原始数据到 raw_source 表
    - _Requirements: 4.1, 4.6_

- [x] 9. 去重服务
  - [x] 9.1 实现 DeduplicationService
    - 创建 `src/crawler_service/orchestrator/dedup.py`：DeduplicationService 类
    - 精确匹配（platform + platform_id）→ 模糊匹配（Jaccard 标题相似度 + 约束比对）
    - 阈值判断：>= 0.8 自动确认写入 platform_mapping（confirmed=true），0.5-0.8 待人工确认（confirmed=false），< 0.5 新建
    - 集成 PlatformMappingRepository 写入映射记录到 MySQL
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 9.2 写 Property Test：Jaccard 相似度数学正确性
    - **Property 10: Jaccard 相似度数学正确性**
    - 验证值域 [0,1]、相等集返回 1.0、不相交返回 0.0、对称性
    - **Validates: Requirements 5.1**

  - [x] 9.3 写 Property Test：去重阈值判断正确性
    - **Property 11: 去重阈值判断正确性**
    - 验证 confidence 到 DeduResult 的映射逻辑
    - **Validates: Requirements 5.3, 5.4, 5.5**

- [x] 10. 采集编排器
  - [x] 10.1 实现 CrawlOrchestrator 编排器
    - 创建 `src/crawler_service/orchestrator/engine.py`：CrawlOrchestrator 类
    - 协调适配器调用、反爬策略、标准化管线、去重、事件发布
    - execute_crawl 主流程：创建任务 → 获取题目列表 → 逐题处理（去重→标准化→写入Problem→采集题解/评论→发事件）
    - 根据 task_type 决定采集范围：PROBLEM_SYNC 采集题目+Editorial，SOLUTION_SYNC 采集题解+评论
    - 根据 solution_fetch_enabled 配置决定是否采集题解和评论
    - 标准化后通过 HTTP 调用 Java Core 的 POST /api/v1/internal/problems 写入 Problem 表
    - 题解标准化后通过 HTTP 调用 Java Core 的 POST /api/v1/internal/solutions 写入 UserSolution 表
    - 使用 asyncio.Semaphore 限制每平台最大并发协程数（默认 3）
    - 实现 cancel() 方法设置取消标志，正在执行的任务在下一循环点检查退出
    - 单题失败不中断批次
    - _Requirements: 2.3, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 13.1, 13.6_

  - [x] 10.2 写 Property Test：批次容错不中断
    - **Property 16: 批次容错不中断**
    - 验证批次中部分失败不影响剩余项处理，progress.completed == N-M
    - **Validates: Requirements 13.1**

  - [x] 10.3 实现 HTTP 错误处理策略
    - 在 CrawlOrchestrator 中集成 HTTP 错误分类处理
    - 429 → 读取 Retry-After 等待重试；403 → Cookie 刷新重试一次；5xx → 指数退避
    - 重试耗尽 → 标记 FAILED，记录完整错误链
    - _Requirements: 13.2, 13.3, 13.4, 13.5_

  - [x] 10.4 实现 AI 加工触发与成本控制
    - 在编排器中集成 AI 调用（HTTP 调用 algorithm-ai 服务）
    - batch 池限流（每分钟 10 次）、优先级队列、每日预算
    - 失败标记 FAILED 不阻塞采集，支持手动重触发
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 20.1, 20.2, 20.3, 20.4, 20.5_

- [x] 11. Checkpoint - 确保核心采集逻辑测试通过
  - 确保所有测试通过，ask the user if questions arise.

- [x] 12. Redis Stream 事件发布
  - [x] 12.1 实现 EventPublisher
    - 创建 `src/crawler_service/events/publisher.py`：EventPublisher 类
    - 发布到 `stream:crawl-events`（任务状态变更）和 `stream:content-events`（内容标准化完成）
    - 消息体 JSON 格式：event_type、payload、timestamp、trace_id
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 12.2 写 Property Test：事件消息格式完整性
    - **Property 13: 事件消息格式完整性**
    - 验证发布的消息必须包含 event_type（非空）、timestamp（合法 UTC 毫秒）、platform（合法标识）
    - **Validates: Requirements 11.2, 11.3, 11.4**

- [x] 13. APScheduler 定时任务
  - [x] 13.1 实现定时任务调度配置
    - 创建 `src/crawler_service/scheduler/jobs.py`：setup_scheduler() 函数
    - 配置三个定时任务：全平台增量同步（每日 3:00）、题解采集（每周一）、失败重试（每 4 小时）
    - 支持 max_instances=1 防止重复执行
    - 任务失败自动重试最多 3 次，仍失败标记 FAILED + 告警
    - _Requirements: 9.1, 9.2, 9.4, 9.5_

  - [x] 13.2 实现定时任务 API 控制
    - 在 scheduler 模块中提供 trigger_job、pause_job、resume_job 方法
    - 供 API 层调用，支持手动触发/暂停/恢复
    - _Requirements: 9.3_

- [x] 14. FastAPI REST API 层
  - [x] 14.1 实现采集管理 API 端点
    - 创建 `src/crawler_service/api/crawl.py`：FastAPI Router
    - POST /api/v1/crawl/trigger（触发采集）、GET /api/v1/crawl/tasks（列表分页）
    - GET /api/v1/crawl/tasks/{id}（详情进度）、POST /api/v1/crawl/tasks/{id}/cancel（取消）
    - POST /api/v1/crawl/retry-ai/{raw_source_id}（手动重触发 AI 加工）
    - 统一 ApiResponse 响应格式（code/message/data）
    - _Requirements: 22.1, 22.4, 23.1, 23.2, 23.3, 23.4, 23.5, 6.5_

  - [x] 14.2 实现配置管理 API 端点
    - 创建 `src/crawler_service/api/config_api.py`：FastAPI Router
    - GET /api/v1/config（查看各平台配置状态）
    - PUT /api/v1/config/{platform}（动态修改平台配置）
    - _Requirements: 8.5, 8.6_

  - [x] 14.3 实现质量统计 API 端点
    - 创建 `src/crawler_service/api/quality.py`：FastAPI Router
    - GET /api/v1/quality/stats（各平台采集成功率、INCOMPLETE 数量、LOW_QUALITY 数量）
    - _Requirements: 16.5_

  - [x] 14.4 实现 trace_id 中间件与健康检查
    - 创建 `src/crawler_service/utils/trace.py`：TraceMiddleware（读取/生成 trace_id 请求头）
    - 创建 `src/crawler_service/api/health.py`：GET /health 健康检查端点
    - _Requirements: 22.5, 12.2_

  - [x] 14.5 实现 FastAPI 应用入口（main.py）
    - 创建 `src/crawler_service/main.py`：FastAPI app 实例
    - 注册所有 Router、启动 APScheduler、初始化适配器发现、连接池初始化
    - 集成 structlog 结构化日志（JSON 格式，含 trace_id/platform/task_id）
    - 配置 OpenAPI/Swagger 自动文档
    - _Requirements: 22.2, 12.2_

- [x] 15. Prometheus 指标暴露
  - [x] 15.1 实现 Prometheus 指标定义与暴露
    - 在 `src/crawler_service/api/health.py` 中添加 GET /metrics 端点
    - 定义指标：crawl_requests_total（Counter）、crawl_duration_seconds（Histogram）、circuit_breaker_state（Gauge）、rate_limiter_tokens（Gauge）
    - 在反爬层和编排器中埋点更新指标
    - 实现采集失败率超 50% 告警日志、单平台连续失败超 10 次自动暂停
    - _Requirements: 12.1, 12.3, 12.4_

- [x] 16. Checkpoint - 确保 API 层和监控测试通过
  - 确保所有测试通过，ask the user if questions arise.

- [x] 17. Docker 部署配置
  - [x] 17.1 创建 Dockerfile
    - 创建 `crawler/Dockerfile`：多阶段构建
    - builder 阶段：安装 Python 依赖（poetry/pdm export → pip install）
    - runtime 阶段：python:3.11-slim 基础镜像 + Playwright 浏览器依赖
    - 最小化镜像体积，配置非 root 用户运行
    - _Requirements: 15.1, 15.2_

  - [x] 17.2 更新 docker-compose.yml
    - 在项目根目录 `docker-compose.yml` 中添加 python-crawler-service 服务定义
    - 配置环境变量（DATABASE_URL、REDIS_URL、MINIO_ENDPOINT 等）
    - 配置 depends_on 确保启动顺序：mysql → redis → minio → python-crawler-service
    - 配置健康检查和资源限制
    - _Requirements: 15.3, 15.4_

- [x] 18. Java Core 端适配（HTTP Client 替换 Dubbo）
  - [x] 18.1 Java Core 端 HTTP 调用替换
    - 在 Java algorithm-help-core 中创建 PythonCrawlerClient（基于 RestTemplate/Feign）
    - 实现方法：triggerCrawl → POST /api/v1/crawl/trigger、getTaskProgress → GET /api/v1/crawl/tasks/{id}、cancelTask → POST /api/v1/crawl/tasks/{id}/cancel
    - 配置 python-crawler-service 的服务地址（从配置读取，支持 Docker 服务发现）
    - 携带 trace_id 请求头用于跨服务链路追踪
    - _Requirements: 22.3, 22.5, 23.1, 23.2, 23.3_

  - [x] 18.2 Java Core 端新增内部写入 API
    - 在 Java algorithm-help-core 中新增 POST /api/v1/internal/problems 端点（供 Python 爬虫写入 Problem 表）
    - 在 Java algorithm-help-core 中新增 POST /api/v1/internal/solutions 端点（供 Python 爬虫写入 UserSolution 表，sourceType=CRAWLED）
    - 这些端点仅限内网访问（不通过 Gateway 暴露），通过 IP 白名单或内部 token 鉴权
    - _Requirements: 2.9, 2.10_

  - [x] 18.3 移除 Java 端 Dubbo 爬虫接口依赖
    - 将 CrawlerFacade Dubbo 接口标记为 @Deprecated
    - 在 Core 端使用新的 HTTP Client 替代 Dubbo 调用
    - 保留 Dubbo 接口一段时间用于回退，添加开关控制新旧调用方式
    - _Requirements: 22.1, 23.6_

- [x] 19. Final Checkpoint - 确保全部测试通过
  - 确保所有测试通过，ask the user if questions arise.
  - 运行 `pytest tests/ -v --tb=short` 确认完整测试套件通过
  - 运行 `docker compose build python-crawler-service` 确认镜像构建成功

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 每个任务引用了具体需求编号（R1.1 格式简化为 1.1），确保完整覆盖
- Checkpoints 确保增量验证，避免后期大面积修复
- Property Tests 使用 hypothesis 库验证设计文档中定义的 16 个正确性属性
- 单元测试验证具体示例和边界条件
- 适配器实现中牛客网可能需要 Playwright 动态渲染，其余平台优先使用 httpx 异步请求
- AI 调用部分仅实现触发接口，实际 AI 服务在 algorithm-ai 项目中

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.3", "2.4", "2.6"] },
    { "id": 2, "tasks": ["2.2", "2.5", "2.7", "4.1", "4.3", "4.5", "4.7"] },
    { "id": 3, "tasks": ["4.2", "4.4", "4.6", "4.8", "5.1"] },
    { "id": 4, "tasks": ["4.9", "5.2", "8.1", "8.5", "8.7", "8.9"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "8.2", "8.3", "8.6", "8.8", "8.10"] },
    { "id": 6, "tasks": ["6.7", "8.4", "8.11", "9.1"] },
    { "id": 7, "tasks": ["9.2", "9.3", "10.1", "12.1"] },
    { "id": 8, "tasks": ["10.2", "10.3", "10.4", "12.2", "13.1"] },
    { "id": 9, "tasks": ["13.2", "14.1", "14.2", "14.3", "14.4"] },
    { "id": 10, "tasks": ["14.5", "15.1"] },
    { "id": 11, "tasks": ["17.1", "17.2"] },
    { "id": 12, "tasks": ["18.1", "18.2", "18.3"] }
  ]
}
```
