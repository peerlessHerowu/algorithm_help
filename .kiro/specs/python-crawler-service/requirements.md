# Requirements Document

## Introduction

本规格定义"算法深度理解引擎"项目的 Python 爬虫微服务（python-crawler-service）需求。该服务是从原 Java 爬虫模块（algorithm-help-crawler）完整重写而来的独立 Python 微服务，保留原有全部采集功能，技术栈从 Java（Spring Boot + OkHttp + Jsoup + Dubbo）切换为 Python（FastAPI + httpx/aiohttp + BeautifulSoup/Playwright）。

### 关键变更

- **技术栈**：Java → Python（FastAPI + httpx + BeautifulSoup + Playwright）
- **服务间通信**：Dubbo RPC → HTTP REST API（FastAPI 暴露端点）+ Redis Stream 异步事件（保持不变）
- **调度方案**：XXL-JOB → APScheduler / Celery Beat（Python 原生方案）
- **设计定位**：从单项目爬虫模块升级为可复用的通用爬虫服务，支持多项目（当前 algorithm-help，未来 math-helper）
- **反爬策略**：Resilience4j → Python 原生实现（aiolimiter/令牌桶/自实现熔断器），功能完全保留

### 与已有系统的关系

- **被依赖**：Java algorithm-help-core 通过 HTTP API 调用本服务触发采集
- **依赖**：MySQL（直连写入 raw_source、crawl_task 表）、Redis（Cookie/事件/缓存）、MinIO（图片存储）
- **协作**：通过 HTTP API 调用 algorithm-ai 服务触发 AI 加工
- **事件发布**：通过 Redis Stream 发布采集状态和内容事件，Core 端消费

### 不属于本服务的功能（留在 Java Core 端）

- 题目 CRUD、用户题解 CRUD、评论系统、内容审核、点赞/排序、搜索、权限控制
- Core 端 Redis Stream Consumer、Core 端数据库迁移（user_solution、comment、platform_mapping 表）

## Glossary

- **Crawler_Service**: python-crawler-service，Python 数据采集微服务，负责从外部平台抓取数据
- **Core_Service**: Java algorithm-help-core 核心业务微服务，通过 HTTP 调用本服务
- **PlatformAdapter**: 平台适配器接口，每个外部平台实现一个适配器插件
- **CrawlTask**: 采集任务实体，记录采集类型、状态、进度
- **RawSource**: 原始采集数据实体，保留平台原始 JSON 数据
- **DataStandardizer**: 数据标准化组件，将多平台格式转换为统一内部模型
- **AntiCrawlManager**: 反爬管理器，负责限流、UA 轮转、Cookie 管理、熔断、代理池、延迟
- **MinIO**: S3 兼容的对象存储服务，用于存储采集的图片/附件
- **Redis_Stream**: Redis Stream 异步事件总线，用于服务间事件通信
- **APScheduler**: Python 定时任务调度框架，替代原 XXL-JOB
- **Project**: 项目维度，用于多项目复用隔离（如 algorithm-help、math-helper）
- **Nacos**: 注册/配置中心，用于动态配置管理（或使用独立 YAML + hot-reload 方案）

## Requirements

### Requirement 1: 平台适配器架构

**User Story:** As a 开发者, I want 采集系统采用插件化适配器模式, so that 新增平台或新项目只需添加一个 .py 文件而无需修改核心逻辑。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 定义 PlatformAdapter 抽象基类，包含方法：fetch_problem_list、fetch_problem_detail、fetch_solutions、fetch_editorial、fetch_comments
2. THE PlatformAdapter 接口 SHALL 定义 get_platform 方法返回平台标识枚举（LEETCODE_GLOBAL、LEETCODE_CN、CODEFORCES、NOWCODER、ATCODER、LUOGU）
3. THE PlatformAdapter 接口 SHALL 定义 get_capabilities 方法返回该平台支持的功能列表（PROBLEM_FETCH、SOLUTION_FETCH、EDITORIAL_FETCH、COMMENT_FETCH）
4. THE Crawler_Service SHALL 通过 Python 插件化注册机制自动发现并注册所有 PlatformAdapter 实现类（基于模块扫描或 entry_points）
5. WHEN 新增外部平台支持时, THE 开发者 SHALL 仅需在 adapters 目录下新增一个 .py 文件实现 PlatformAdapter 接口并添加对应配置，无需修改已有代码
6. THE Crawler_Service SHALL 为每个平台提供独立的 YAML 配置块，包含 enabled、base_url、rate_limit、retry_max、cookie_key、capabilities、solution_fetch_enabled 字段

### Requirement 2: 多平台数据采集

**User Story:** As a 内容管理者, I want 系统从多个算法平台自动采集题目和题解数据, so that 内容库快速丰富且覆盖面广。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 支持从以下平台采集数据：LeetCode 国际站、力扣中文站、Codeforces、牛客网、AtCoder、洛谷
2. THE Crawler_Service SHALL 采集以下内容类型：题目元信息（标题、难度、标签、描述、约束、示例）、高赞题解（当 solution_fetch_enabled=true 时）、官方 Editorial、优质评论
3. WHEN 定时采集任务触发时, THE Crawler_Service SHALL 执行增量检测，仅采集自上次采集以来的新增或更新内容
4. THE Crawler_Service SHALL 支持三种触发方式：APScheduler cron 定时同步、管理员 HTTP API 按需触发、增量检测自动触发
5. THE Crawler_Service SHALL 为每次采集创建 CrawlTask 记录，包含 platform、task_type、status、progress、trigger_type、created_at、completed_at 字段
6. WHEN 采集任务完成时, THE Crawler_Service SHALL 通过 Redis Stream 发送事件通知 Core_Service 进行后续处理
7. THE 采集编排器 SHALL 根据 task_type 决定采集范围：PROBLEM_SYNC 采集题目+Editorial，SOLUTION_SYNC 采集题解+评论，SINGLE_FETCH 采集单题全部内容
8. WHEN 平台配置 solution_fetch_enabled=false 时, THE Crawler_Service SHALL 跳过该平台的题解和评论采集
9. THE 标准化后的题目数据 SHALL 通过 HTTP API 调用 Java Core 端的 POST /api/v1/internal/problems 写入 Problem 表（Python 端不直连 Problem 表）
10. THE 标准化后的题解数据 SHALL 通过 HTTP API 调用 Java Core 端的 POST /api/v1/internal/solutions 写入 UserSolution 表（sourceType=CRAWLED）

### Requirement 3: 反爬策略管理

**User Story:** As a 系统, I want 采集请求具备完善的反爬策略, so that 采集过程不被目标平台封禁且系统稳定运行。

#### Acceptance Criteria

1. THE AntiCrawlManager SHALL 为每个平台维护独立的限流器实例（基于 aiolimiter 或自实现令牌桶），限制每分钟最大请求数（从配置动态读取）
2. THE AntiCrawlManager SHALL 实现 User-Agent 轮转池，每次请求从配置的 UA 列表中随机选取
3. THE AntiCrawlManager SHALL 通过 Redis 管理各平台的 Cookie（key 格式：`crawler:cookie:{platform}`），支持 Cookie 过期自动刷新
4. THE AntiCrawlManager SHALL 实现指数退避重试策略：首次失败等待 base_delay_ms，后续每次翻倍，最大重试 retry_max 次
5. THE AntiCrawlManager SHALL 实现熔断器：连续失败超过阈值时熔断该平台，等待配置的 wait_duration 后进入半开状态探测
6. WHEN 熔断器触发时, THE Crawler_Service SHALL 记录 WARNING 日志并暂停该平台的所有采集任务
7. THE AntiCrawlManager SHALL 预留代理池接口（proxy.enabled 配置），当前默认关闭，后续可接入代理服务
8. THE 请求间隔 SHALL 支持配置范围（如 request_delay_ms: [1000, 3000]），每次请求在范围内随机延迟

### Requirement 4: 数据标准化

**User Story:** As a 内容生产者, I want 不同平台的数据统一转换为内部标准格式, so that 后续处理逻辑无需关心数据来源差异。

#### Acceptance Criteria

1. THE DataStandardizer SHALL 将各平台的题目数据转换为统一的 Problem 内部模型
2. THE DataStandardizer SHALL 将 HTML 格式的题目描述转换为 Markdown 格式（使用 BeautifulSoup + markdownify/html2text）
3. THE DataStandardizer SHALL 将题目描述中的外部图片下载到 MinIO 并替换为内部 URL
4. THE DataStandardizer SHALL 将各平台的难度标记映射为统一的三级难度（EASY/MEDIUM/HARD）
5. THE DataStandardizer SHALL 将各平台的标签体系映射为统一的内部标签体系（维护标签映射表）
6. THE DataStandardizer SHALL 保留原始采集数据到 raw_source 表（platform、platform_id、content_type、raw_json、process_status、fetched_at）
7. WHEN 标准化过程中遇到无法映射的标签时, THE DataStandardizer SHALL 保留原始标签名称并标记为"待人工确认"

### Requirement 5: 跨平台题目去重

**User Story:** As a 内容管理者, I want 系统自动识别同一题在不同平台的对应关系, so that 避免重复采集和内容冗余。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 在采集新题目时执行去重检测，先精确匹配（platform + platform_id）再模糊匹配（标题相似度 Jaccard + 约束比对）
2. WHEN 精确匹配命中时（同平台同 platform_id 已存在）, THE Crawler_Service SHALL 更新已有记录而非创建新题目
3. WHEN 模糊匹配置信度 >= 0.8 时, THE Crawler_Service SHALL 自动建立 platform_mapping 记录并标记 confirmed=true
4. WHEN 模糊匹配置信度在 0.5-0.8 之间时, THE Crawler_Service SHALL 建立 platform_mapping 记录并标记 confirmed=false（待人工确认）
5. WHEN 模糊匹配置信度 < 0.5 时, THE Crawler_Service SHALL 视为新题目创建独立记录
6. THE Crawler_Service SHALL 直连 MySQL 写入 platform_mapping 表（id、unified_problem_id、platform、platform_problem_id、platform_url、confidence、confirmed、project、created_at），与 Java Core 端共享该表

### Requirement 6: 采集后 AI 加工触发

**User Story:** As a 内容生产者, I want 采集完成后自动触发 AI 加工流水线, so that 从采集到高质量内容产出实现全自动化。

#### Acceptance Criteria

1. WHEN 新题目采集并标准化完成时, THE Crawler_Service SHALL 通过 HTTP API 调用 algorithm-ai 服务触发 AI 加工
2. THE AI 加工流程 SHALL 包含：多源题解聚合精炼、错误检测、图片内容识别、结构化格式化
3. WHEN 同一题有多个来源的题解时, THE AI 加工流程 SHALL 融合多源题解为一份最优官方解析
4. WHEN AI 加工失败时, THE Crawler_Service SHALL 将 RawSource.process_status 标记为 FAILED 并记录失败原因，不阻塞后续采集
5. THE Crawler_Service SHALL 提供 POST /api/v1/crawl/retry-ai/{raw_source_id} 端点，支持对 FAILED 状态的 RawSource 手动重新触发 AI 加工

### Requirement 7: 图片与多媒体处理

**User Story:** As a 内容管理者, I want 采集的图片经过 AI 描述并存储到内部, so that 内容不依赖外部链接且图片含义可被文本搜索。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 将采集内容中的所有图片下载到 MinIO 对象存储（bucket: `crawler-assets`）
2. THE Crawler_Service SHALL 将 HTML/Markdown 中的外部图片 URL 替换为 MinIO 内部 URL
3. WHEN 图片下载完成时, THE Crawler_Service SHALL 通过 HTTP 调用 algorithm-ai 的多模态接口生成图片的文本描述
4. THE 图片文本描述 SHALL 作为 alt 文本保存，确保无障碍访问和图片加载失败时的降级展示
5. IF 图片下载失败, THEN THE Crawler_Service SHALL 保留原始外部 URL 并标记为"外部引用"，不阻塞整体流程
6. THE Crawler_Service SHALL 对 GIF 动图保持原格式存储，不做格式转换

### Requirement 8: 配置驱动与动态管理

**User Story:** As a 运维者, I want 所有采集参数通过配置中心动态管理, so that 调整采集策略无需重启服务。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 从 Nacos 配置中心或独立 YAML 文件读取所有平台采集参数，支持运行时动态刷新（hot-reload）
2. THE 平台配置 SHALL 包含以下字段：enabled（开关）、base_url、api_url、graphql_url（可选）、rate_limit（每分钟最大请求数）、retry_max、retry_delay_ms、cookie_key、capabilities（列表）、solution_fetch_enabled
3. THE 反爬配置 SHALL 包含：user_agents（UA 列表）、request_delay_ms（请求间隔范围）、circuit_breaker.failure_threshold、circuit_breaker.wait_duration_ms、proxy.enabled、proxy.provider
4. WHEN 配置变更时, THE Crawler_Service SHALL 在 30 秒内生效新配置（通过文件监听或 Nacos Listener）
5. THE Crawler_Service SHALL 提供 GET /api/v1/config 端点，查看当前各平台采集配置状态
6. THE Crawler_Service SHALL 提供 PUT /api/v1/config/{platform} 端点，动态修改平台配置

### Requirement 9: 定时任务调度

**User Story:** As a 运维者, I want 采集任务通过 Python 原生调度方案管理, so that 任务调度可配置、支持失败重试且无需外部 Java 调度平台。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 集成 APScheduler 或 Celery Beat 作为定时任务调度框架
2. THE Crawler_Service SHALL 配置以下定时任务：全平台题目增量同步（默认每日凌晨 3:00）、单平台题解采集（默认每周一次）、失败任务自动重试（默认每 4 小时）
3. THE 定时任务 SHALL 支持通过 API 手动触发、暂停、恢复
4. WHEN 定时任务执行失败时, THE 调度器 SHALL 自动重试最多 3 次，仍失败则标记为 FAILED 并记录告警日志
5. THE 定时任务执行日志 SHALL 包含任务开始时间、结束时间、处理数量、失败原因

### Requirement 10: 文件存储（MinIO）

**User Story:** As a 系统, I want 采集的图片和附件统一存储到对象存储, so that 不依赖外部链接且文件管理统一。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 集成 MinIO Python SDK（minio-py），配置 endpoint、access_key、secret_key 从配置读取
2. THE Crawler_Service SHALL 使用以下 bucket 规划：`crawler-assets`（采集图片）、`user-uploads`（用户上传）
3. THE Crawler_Service SHALL 使用日期分区路径存储文件：`{bucket}/{yyyy}/{MM}/{dd}/{uuid}.{ext}`
4. THE Crawler_Service SHALL 对上传文件执行类型校验：仅允许 image/png、image/jpeg、image/gif、image/webp、image/svg+xml
5. THE Crawler_Service SHALL 对单文件大小限制为 10MB，超出时拒绝存储并记录日志

### Requirement 11: 异步事件通信（Redis Stream）

**User Story:** As a 开发者, I want 服务间异步事件通过 Redis Stream 传递, so that 非实时操作不阻塞主流程。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 使用 Redis Stream 作为异步事件总线，发布到以下 Stream：`stream:crawl-events`（采集事件）、`stream:content-events`（内容处理事件）
2. WHEN 采集任务状态变更时, THE Crawler_Service SHALL 发送事件到 `stream:crawl-events`（包含 task_id、platform、status、timestamp）
3. WHEN 新内容标准化完成时, THE Crawler_Service SHALL 发送事件到 `stream:content-events`（包含 content_type、content_id、action=STANDARDIZED）
4. THE 事件消息体 SHALL 为 JSON 格式，包含 event_type、payload、timestamp、trace_id 字段

### Requirement 12: 可观测性与监控

**User Story:** As a 运维者, I want 采集系统具备完善的可观测性, so that 可以监控采集健康度、发现问题并快速定位。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 通过 Prometheus client（prometheus_client）暴露以下指标：各平台采集成功率、各平台平均响应时间、熔断器状态、限流器剩余令牌数、MinIO 存储用量
2. THE Crawler_Service SHALL 使用结构化日志（JSON 格式，基于 structlog 或 python-json-logger），每条日志包含 trace_id、platform、task_id
3. WHEN 采集任务失败率超过 50% 时, THE Crawler_Service SHALL 发出 ERROR 级别告警日志
4. WHEN 单平台连续失败超过 10 次时, THE Crawler_Service SHALL 自动暂停该平台采集并发出告警

### Requirement 13: 错误处理与容错

**User Story:** As a 系统, I want 采集过程中的错误被优雅处理且不影响整体流程, so that 单个失败不会拖垮整个系统。

#### Acceptance Criteria

1. WHEN 单个题目采集失败时, THE Crawler_Service SHALL 记录错误并继续处理下一个题目（不中断批次）
2. WHEN 平台返回 HTTP 429（Too Many Requests）时, THE Crawler_Service SHALL 按响应的 Retry-After 头等待后重试
3. WHEN 平台返回 HTTP 403（Forbidden）时, THE Crawler_Service SHALL 触发 Cookie 刷新流程并重试一次
4. WHEN 平台返回 HTTP 5xx 时, THE Crawler_Service SHALL 执行指数退避重试（最多 retry_max 次）
5. IF 重试耗尽仍失败, THEN THE Crawler_Service SHALL 将 CrawlTask 标记为 FAILED 并记录完整错误链
6. THE Crawler_Service SHALL 限制每平台最大并发采集协程数（默认 3），防止单平台故障耗尽协程池

### Requirement 14: 数据库持久化

**User Story:** As a 开发者, I want 爬虫服务直连 MySQL 写入采集数据, so that 采集结果实时落库且不依赖 Core 端中转。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 直连 MySQL 数据库，使用 SQLAlchemy 2.0 + asyncmy 作为异步 ORM/驱动
2. THE Crawler_Service SHALL 写入 raw_source 表，包含字段：id、platform、platform_id、content_type、raw_json(TEXT)、process_status、error_message、project、fetched_at、processed_at
3. THE Crawler_Service SHALL 写入 crawl_task 表，包含字段：id、platform、task_type、status、progress(JSON)、trigger_type、error_message、project、created_at、completed_at、last_fetch_time(Long UTC毫秒，记录上次采集时间用于增量检测)
4. THE Crawler_Service SHALL 写入 platform_mapping 表，包含字段：id、unified_problem_id、platform、platform_problem_id、platform_url、confidence、confirmed、project、created_at
5. THE 所有时间字段 SHALL 使用 Long 类型存储 UTC 毫秒时间戳（与 Java Core 端保持一致）
6. THE ID 生成 SHALL 使用雪花算法（与 Java 端保持兼容）

### Requirement 15: Docker 部署

**User Story:** As a 开发者, I want 爬虫服务通过 Docker 容器部署, so that 环境一致且可与 Java 服务统一编排。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 提供 Dockerfile，使用 Python 多阶段构建（builder 阶段安装依赖 + runtime 阶段最小镜像）
2. THE Dockerfile SHALL 基于 python:3.11-slim 镜像，安装 Playwright 浏览器依赖（用于动态页面采集）
3. THE docker-compose.yml SHALL 包含 python-crawler-service 服务定义，配置环境变量和依赖服务
4. THE docker-compose 配置 SHALL 确保服务启动顺序：MySQL → Redis → MinIO → python-crawler-service

### Requirement 16: 采集数据质量保证

**User Story:** As a 内容管理者, I want 采集的数据经过质量检查, so that 低质量或不完整的数据不进入正式内容库。

#### Acceptance Criteria

1. THE DataStandardizer SHALL 对采集的题目执行完整性校验：title、description、difficulty 三个字段为必填，缺失任一则标记为 INCOMPLETE
2. THE DataStandardizer SHALL 对采集的题解执行最小内容长度校验：正文内容少于 100 字符的题解标记为 LOW_QUALITY
3. WHEN 题目被标记为 INCOMPLETE 时, THE 系统 SHALL 保留 RawSource 记录但不创建 Problem 实体，等待后续补充采集
4. THE 质量检查结果 SHALL 记录到 raw_source 的 process_status 字段和 error_message 字段
5. THE Crawler_Service SHALL 提供 GET /api/v1/quality/stats 端点，返回数据质量统计（各平台采集成功率、INCOMPLETE 数量、LOW_QUALITY 数量）

### Requirement 17: LeetCode 适配器详细

**User Story:** As a 内容管理者, I want 系统能从 LeetCode 国际站和力扣中文站采集数据, so that 覆盖最主流的算法题平台。

#### Acceptance Criteria

1. THE LeetCode 国际站适配器 SHALL 通过 GraphQL API（graphql_url 配置）采集题目列表和详情
2. THE 力扣中文站适配器 SHALL 通过独立的 GraphQL API 采集中文版题目
3. THE 两个适配器 SHALL 采集以下字段：题号、标题（中英文）、难度、标签列表、描述、约束、示例、提交统计（通过率）
4. THE 适配器 SHALL 支持采集题目关联的高赞题解（前 10 条，按 vote 数降序）
5. THE 适配器 SHALL 支持采集官方 Editorial（如果存在）
6. WHEN LeetCode 返回需要登录的错误时, THE 适配器 SHALL 使用 Redis 中存储的 Cookie 进行认证请求
7. THE 适配器 SHALL 处理 LeetCode 的分页机制（每次最多 50 题），自动翻页直到采集完毕

### Requirement 18: Codeforces 适配器详细

**User Story:** As a 内容管理者, I want 系统能从 Codeforces 采集数据, so that 覆盖竞赛选手常用的国际平台。

#### Acceptance Criteria

1. THE Codeforces 适配器 SHALL 通过 Codeforces REST API（api_url 配置）采集题目列表
2. THE 适配器 SHALL 采集以下字段：contestId + index（组合为题号）、题目名称、标签列表、难度 rating
3. THE 适配器 SHALL 将 Codeforces 的 rating 映射为统一难度：<= 1200 → EASY、1201-1800 → MEDIUM、> 1800 → HARD
4. THE 适配器 SHALL 采集题目的 Editorial（通过 blog 链接，如果存在）
5. THE 适配器 SHALL 处理 Codeforces 的 HTML 格式题面，转换为 Markdown
6. WHEN Codeforces API 返回 FAILED 状态时, THE 适配器 SHALL 等待 API 建议的间隔后重试

### Requirement 19: 其他平台适配器

**User Story:** As a 内容管理者, I want 系统支持牛客网、AtCoder、洛谷等平台, so that 内容来源更加多元化。

#### Acceptance Criteria

1. THE 牛客网适配器 SHALL 通过 HTML 页面解析采集题目数据（使用 BeautifulSoup 或 Playwright 解析页面）
2. THE AtCoder 适配器 SHALL 通过 AtCoder Problems API（第三方开源 API）采集题目列表和难度信息
3. THE 洛谷适配器 SHALL 作为骨架预留，默认 enabled=false
4. EACH 平台适配器 SHALL 在 capabilities 配置中声明其支持的功能（部分平台可能不支持题解或评论采集）
5. WHEN 平台不支持某功能时, THE 对应的 fetch 方法 SHALL 返回空结果而非抛出异常
6. THE 各平台适配器 SHALL 独立配置 enabled 开关，未实现或不稳定的适配器可随时关闭

### Requirement 20: 采集成本控制

**User Story:** As a 运维者, I want 采集过程的 AI 调用成本可控, so that 不会因大量采集导致 AI 费用失控。

#### Acceptance Criteria

1. THE 采集后的 AI 加工调用 SHALL 走 batch 池限流（每分钟限制 10 次 AI 调用）
2. THE 系统 SHALL 支持配置采集后 AI 加工的优先级队列：新增热门题（高赞/高频） > 新增普通题 > 更新已有题
3. WHEN batch 池令牌耗尽时, THE 系统 SHALL 将 AI 加工任务放入 Redis 队列排队等待，不丢弃
4. THE 系统 SHALL 支持配置每日最大 AI 调用预算（次数上限），达到上限后暂停所有 batch 池任务直到次日重置
5. THE 预算配置 SHALL 通过配置文件动态管理，可实时调整无需重启

### Requirement 21: 多项目复用设计

**User Story:** As a 开发者, I want 爬虫服务支持多项目复用, so that 新项目（如 math-helper）接入时无需重建采集基础设施。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 支持项目（project）维度隔离，每个项目注册自己的平台和内容类型
2. THE 当前版本 SHALL 支持 algorithm-help 项目，架构预留 math-helper 等未来项目的扩展能力
3. THE 适配器插件化设计 SHALL 确保新项目新平台仅需添加一个 .py 文件即可接入
4. THE 通用的采集→标准化→事件发布管线 SHALL 对所有项目复用，项目差异通过配置区分
5. THE CrawlTask 和 RawSource 表 SHALL 包含 project 字段用于多项目数据隔离

### Requirement 22: 服务间通信（HTTP API）

**User Story:** As a 开发者, I want Python 爬虫服务通过 HTTP REST API 与 Java Core 端通信, so that 跨语言服务解耦且接口标准化。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 使用 FastAPI 框架暴露 REST API 端点，替代原 Dubbo RPC 接口
2. THE Crawler_Service SHALL 提供 OpenAPI/Swagger 自动文档（FastAPI 内置）
3. THE Java Core 端 SHALL 通过 Feign/RestTemplate 调用 Python 爬虫服务的 HTTP 端点
4. THE Crawler_Service SHALL 对外暴露的 API 响应格式与 Java Core 端保持统一（code/message/data 结构）
5. THE HTTP 通信 SHALL 携带 trace_id 请求头，用于跨服务链路追踪

### Requirement 23: 与 Java Core 的集成 API

**User Story:** As a 开发者, I want Python 爬虫服务的 API 端点与原 Dubbo 接口语义一致, so that Java Core 端迁移成本最小。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 提供 POST /api/v1/crawl/trigger 端点，对应原 CrawlerFacade.triggerCrawl 方法，接受 platform（可选）和 task_type 参数
2. THE Crawler_Service SHALL 提供 GET /api/v1/crawl/tasks/{id} 端点，对应原 CrawlerFacade.getTaskProgress 方法，返回任务详情含实时进度
3. THE Crawler_Service SHALL 提供 POST /api/v1/crawl/tasks/{id}/cancel 端点，对应原 CrawlerFacade.cancelTask 方法
4. THE Crawler_Service SHALL 提供 GET /api/v1/crawl/tasks 端点，返回采集任务列表（分页，支持按 platform/status 筛选）
5. WHEN 触发单题采集时, THE trigger 端点 SHALL 额外接受 platform_problem_id 参数指定要采集的目标题目
6. THE 所有 API 响应的 DTO 字段语义 SHALL 与原 Java CrawlTriggerRequest、CrawlTaskDTO 保持一致
