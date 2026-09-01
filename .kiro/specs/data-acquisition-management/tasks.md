# Implementation Plan: 数据采集与内容管理

## Overview

本计划实施数据采集与内容管理层，按"公共模块→Crawler服务骨架→平台适配器→Core服务扩展→集成验证"顺序递进。每步构建在前一步之上，确保可增量验证。

## Tasks

- [x] 1. 公共模块与 Dubbo 接口定义
  - [x] 1.1 创建 algorithm-help-api 模块
    - 创建 Maven 模块 `algorithm-help-api/pom.xml`
    - 定义 `CrawlerFacade` 接口：triggerCrawl、getTaskProgress、cancelTask
    - 定义 `ProblemFacade` 接口：saveProblem、updateProblem、checkDuplicate、savePlatformMapping
    - 定义 `AiProcessFacade` 接口：enrichContent、detectErrors、describeImage、aggregateSolutions、structurizeUserInput
    - 创建跨服务 DTO：CrawlTriggerRequest、CrawlTaskDTO、ProblemSaveDTO、PlatformMappingDTO、ContentEnrichRequest 等
    - _Requirements: R25_

  - [x] 1.2 扩展 algorithm-help-common 模块
    - 新增枚举：Platform、PlatformCapability、CrawlTaskStatus、CrawlTaskType、TriggerType
    - 新增枚举：SolutionStatus、SourceType、CommentType、TargetType、ProcessStatus
    - 新增工具类：SnowflakeIdUtil（基于 MyBatis-Plus）、TraceIdUtil
    - _Requirements: R20_

- [x] 2. Crawler 服务骨架搭建
  - [x] 2.1 创建 algorithm-help-crawler Maven 模块
    - 创建 `algorithm-help-crawler/pom.xml`，引入 Spring Boot 3、Dubbo、MyBatis-Plus、OkHttp、Jsoup、flexmark、Resilience4j、Redisson、MinIO SDK、XXL-JOB
    - 创建 `CrawlerApplication.java` 启动类
    - 创建 DDD 包结构：domain/application/infrastructure/interfaces
    - _Requirements: R1_

  - [x] 2.2 配置 Nacos + Dubbo + MySQL 连接
    - 创建 `application.yml`：Nacos 注册中心、MySQL 数据源、Redis 连接、Dubbo provider 配置
    - 创建 `bootstrap.yml`：Nacos 配置中心地址、dataId 配置
    - 配置 MyBatis-Plus：雪花 ID、逻辑删除、枚举处理
    - _Requirements: R15, R25_

  - [x] 2.3 创建 Crawler 数据库迁移脚本
    - 创建 `V6_001__create_raw_source.sql`：raw_source 表 + 索引
    - 创建 `V6_002__create_crawl_task.sql`：crawl_task 表 + 索引
    - 配置 Flyway 指向 MySQL
    - _Requirements: R29_

- [x] 3. 反爬策略层实现
  - [x] 3.1 实现 AntiCrawlManager
    - 创建 `AntiCrawlManager`：整合限流/UA轮转/Cookie/熔断/延迟
    - 创建 `UserAgentRotator`：从配置列表随机选取 UA
    - 创建 `CookieStoreRedis`：Cookie 读写到 Redis（key: `crawler:cookie:{platform}`）
    - _Requirements: R3.1, R3.2, R3.3_

  - [x] 3.2 配置 Resilience4j 限流与熔断
    - 为每个平台创建独立的 RateLimiter Bean（从 Nacos 读取 rate-limit 配置）
    - 为每个平台创建独立的 CircuitBreaker Bean（failure-threshold + wait-duration）
    - 创建 Bulkhead 配置：每平台最大并发线程数 3
    - 实现指数退避重试：Retry 配置 maxAttempts + exponentialBackoff
    - _Requirements: R3.4, R3.5, R3.6, R3.8, R28.6_

  - [x] 3.3 预留代理池接口
    - 创建 `ProxyProvider` 接口 + `NoOpProxyProvider` 默认实现
    - 配置项 `proxy.enabled=false`，后续可替换实现
    - _Requirements: R3.7_

- [x] 4. PlatformAdapter 接口与基础实现
  - [x] 4.1 定义 PlatformAdapter 接口
    - 创建 `PlatformAdapter` 接口：fetchProblemList、fetchProblemDetail、fetchSolutions、fetchEditorial、fetchComments、getPlatform、getCapabilities
    - 创建原始数据模型：RawProblemData、RawSolutionData、RawEditorialData、RawCommentData
    - 创建 FetchOptions 值对象（offset/limit/lastFetchTime/incremental）
    - _Requirements: R1.1, R1.2, R1.3_

  - [x] 4.2 实现 LeetCode 国际站适配器
    - 创建 `LeetCodeGlobalAdapter`：通过 GraphQL API 采集题目列表和详情
    - 实现分页采集（每次 50 题，自动翻页）
    - 实现高赞题解采集（前 10 条）
    - 实现 Editorial 采集
    - 处理需要登录的场景（从 Redis 读取 Cookie）
    - _Requirements: R37_

  - [x] 4.3 实现力扣中文站适配器
    - 创建 `LeetCodeCnAdapter`：类似国际站但 GraphQL URL 不同
    - 复用国际站的 GraphQL query 结构，调整 endpoint
    - _Requirements: R37_

  - [x] 4.4 实现 Codeforces 适配器
    - 创建 `CodeforcesAdapter`：通过 REST API 采集题目
    - 实现 rating → 三级难度映射（<=1200 EASY, 1201-1800 MEDIUM, >1800 HARD）
    - 实现 Editorial 采集（通过 blog 链接）
    - 处理 HTML 题面 → Markdown 转换
    - _Requirements: R38_

  - [x] 4.5 实现其他平台适配器骨架
    - 创建 `NowCoderAdapter`：Jsoup 页面解析采集题目
    - 创建 `AtCoderAdapter`：通过 AtCoder Problems 第三方 API 采集
    - 创建 `LuoguAdapter`：骨架实现，默认 enabled=false
    - 各适配器在 capabilities 中声明支持的功能
    - 不支持的 fetch 方法返回空列表
    - _Requirements: R39_

- [x] 5. Checkpoint - Crawler 基础功能验证
  - ~~确保 Crawler 服务启动成功，连接 Nacos/MySQL/Redis/MinIO，Resilience4j 限流生效，LeetCode 适配器可成功采集 1 道题。~~ Python 端已验证通过。
  - **注：Java algorithm-help-crawler 模块已删除（2026-06-23），完全由 python-crawler-service 替代**

- [x] 6. 数据标准化与去重
  - [x] 6.1 实现 DataStandardizer
    - 创建 `DataStandardizer`：HTML→Markdown 转换、图片下载替换、难度映射、标签映射
    - 创建标签映射配置文件（各平台标签→内部标签对照表）
    - 实现完整性校验：title/description/difficulty 必填检查
    - 实现最小内容长度校验（题解 < 100 字符标记 LOW_QUALITY）
    - _Requirements: R4, R36_

  - [x] 6.2 实现 DeduplicationService
    - 创建 `DeduplicationService`：精确匹配（platform+platformId）+ 模糊匹配（标题相似度）
    - 模糊匹配使用 Jaccard 相似度 + 约束条件比对
    - 根据置信度自动建立 PlatformMapping（>=0.8 auto confirm, 0.5-0.8 待确认, <0.5 新题）
    - _Requirements: R5_

  - [x] 6.3 实现 MinIO 文件存储
    - 创建 `MinioFileStorage`：upload、download、getPresignedUrl、deleteFile
    - 配置 bucket 自动创建（crawler-assets、user-uploads）
    - 文件路径格式：`{bucket}/{yyyy}/{MM}/{dd}/{uuid}.{ext}`
    - 类型校验（仅 image/png、jpeg、gif、webp、svg+xml）+ 大小限制（10MB）
    - _Requirements: R24_

  - [x] 6.4 实现 RawSource 持久化
    - 创建 `RawSource` MyBatis-Plus Entity + Mapper
    - 实现 saveRawSource：保存原始 JSON 数据到 raw_source 表
    - 实现按 processStatus 查询（PENDING/PROCESSED/FAILED）
    - _Requirements: R14_

- [x] 7. 采集编排与事件发布 ~~（废弃：已由 python-crawler-service 替代）~~
  - [x] 7.1 ~~实现 CrawlOrchestrator~~ **[废弃]** 已由 Python 端 `crawler/src/crawler_service/orchestrator/engine.py` 实现
    - ~~创建 `CrawlOrchestrator`：编排完整采集流程~~
    - _替代方案: python-crawler-service spec Task 10.1_

  - [x] 7.2 ~~实现 Redis Stream 事件发布~~ **[废弃]** 已由 Python 端 `crawler/src/crawler_service/events/publisher.py` 实现
    - ~~创建 `RedisStreamEventPublisher`~~
    - _替代方案: python-crawler-service spec Task 12.1_

  - [x] 7.3 ~~实现 XXL-JOB Handler~~ **[废弃]** 已由 Python APScheduler 替代 `crawler/src/crawler_service/scheduler/jobs.py`
    - ~~创建 ProblemSyncJobHandler/SolutionSyncJobHandler/RetryFailedJobHandler~~
    - _替代方案: python-crawler-service spec Task 13.1（APScheduler 定时任务）_

  - [x] 7.4 ~~实现 Dubbo Provider（Crawler 端）~~ **[废弃]** 已由 Python FastAPI REST API 替代，Java 端通过 PythonCrawlerClient（HTTP）调用
    - ~~实现 `CrawlerFacadeImpl`~~ → Java CrawlerFacadeImpl 已标记 @Deprecated
    - _替代方案: python-crawler-service spec Task 14.1 + 18.1（FastAPI API + PythonCrawlerClient）_

- [x] 8. ~~Checkpoint - 采集全流程验证~~ **[废弃]** Python 端已通过 python-crawler-service spec Final Checkpoint 验证
  - ~~确保 XXL-JOB 定时任务可触发、LeetCode 采集→标准化→RawSource 保存→事件发布 全流程跑通。~~

- [x] 9. Core 服务扩展 - 数据模型与迁移
  - [x] 9.1 创建 Core 端数据库迁移脚本
    - 使用 JPA ddl-auto: update 自动建表，无需手写 SQL 迁移脚本
    - Comment 实体已创建（自动建表 `comments`）
    - _Requirements: R29_

  - [x] 9.2 创建 MyBatis-Plus Entity 和 Mapper
    - UserSolution 实体已增强（新增 status/rawContent/userId/viewCount/deleted 字段）
    - Comment 实体已创建（`com.algorithm.help.content.Comment`）
    - CommentRepository 已创建
    - UserSolutionRepository 已增强（新增分页/搜索方法）
    - PlatformMapping Entity + Repository 已存在（`mapping/` 包）
    - _注：项目使用 Spring Data JPA（非 MyBatis-Plus），ID 使用 UUID 手动赋值_
    - _Requirements: R20_

- [x] 10. Core 服务扩展 - 题目管理 CRUD
  - [x] 10.1 实现 ProblemAdminUseCase
    - 创建题目：POST /api/v1/admin/problems（校验必填字段、生成雪花 ID）
    - 编辑题目：PUT /api/v1/admin/problems/{id}（部分更新）
    - 软删除：DELETE /api/v1/admin/problems/{id}（设 deleted=true）
    - _Requirements: R8.1, R8.2, R8.3_

  - [x] 10.2 实现批量导入
    - POST /api/v1/admin/problems/batch-import：JSON 数组最大 100 条
    - 每条独立校验，失败跳过返回明细
    - mode=skip|update 控制去重策略
    - _Requirements: R8.4, R8.5, R8.6_

  - [x] 10.3 实现采集任务管理 API
    - POST /api/v1/admin/crawler/trigger：通过 PythonCrawlerClient（HTTP）调用 Python 爬虫服务
    - GET /api/v1/admin/crawler/tasks：分页列表（通过 HTTP 代理到 Python 端）
    - GET /api/v1/admin/crawler/tasks/{id}：单任务详情（含实时进度）
    - POST /api/v1/admin/crawler/tasks/{id}/cancel：通过 HTTP 调用 Python 端取消
    - _Requirements: R9_
    - _注：原方案通过 Dubbo 调用，现改为通过 PythonCrawlerClient HTTP 调用_

- [x] 11. Core 服务扩展 - 用户题解
  - [x] 11.1 实现 UserSolution CRUD API
    - POST /api/v1/problems/{id}/solutions：创建题解（需认证）
    - GET /api/v1/problems/{id}/solutions：题解列表（分页，排序：latest/hot/featured）
    - PUT /api/v1/solutions/{id}：编辑自己的题解
    - DELETE /api/v1/solutions/{id}：软删除自己的题解
    - _Requirements: R10.2, R10.3, R10.4, R10.5_

  - [x] 11.2 实现题解 AI 结构化处理
    - sourceType=USER_INPUT：Dubbo 调用 AiProcessFacade.structurizeUserInput → 存 content
    - sourceType=URL_IMPORT：OkHttp 抓取 → Jsoup 提取 → AI 精炼 → 存 content
    - sourceType=FEYNMAN_OUTPUT：读取 InteractiveSession 总结 → AI 结构化
    - AI 调用失败时：rawContent 照存，content 为空，标记为待处理
    - _Requirements: R10.6, R10.7, R32, R33_

  - [x] 11.3 实现题解精选与提升
    - POST /api/v1/admin/solutions/{id}/feature：标记精选
    - POST /api/v1/admin/solutions/{id}/promote：提升为官方解析（复制到 Explanation 表）
    - 自动精选候选：upvotes 达到阈值时通知管理员
    - _Requirements: R11_

- [x] 12. Core 服务扩展 - 评论系统
  - [x] 12.1 实现 Comment CRUD API
    - POST /api/v1/comments：发表评论（targetType + targetId + content + type）
    - GET /api/v1/comments：按 target 查询（分页，时间/点赞排序）
    - DELETE /api/v1/comments/{id}：软删除自己的评论
    - CORRECTION 类型自动通知作者
    - _Requirements: R12_

  - [x] 12.2 实现评论 AI 扩展
    - POST /api/v1/admin/comments/{id}/expand：AI 将评论扩展为独立题解
    - 校验：仅 SUPPLEMENT/CORRECTION 且 upvotes >= 5 的评论可扩展
    - 扩展后创建 UserSolution（sourceType=CRAWLED）+ 原评论添加系统回复
    - _Requirements: R18_

- [x] 13. Core 服务扩展 - 点赞与排序
  - [x] 13.1 实现点赞机制
    - POST /api/v1/solutions/{id}/upvote：Redis SET 存储（key: upvote:solution:{id}）+ DB 异步更新
    - DELETE /api/v1/solutions/{id}/upvote：取消点赞
    - POST /api/v1/comments/{id}/upvote：同上逻辑
    - DELETE /api/v1/comments/{id}/upvote：取消
    - 列表查询时通过 SISMEMBER 返回当前用户点赞状态
    - _Requirements: R34_

- [x] 14. Core 服务扩展 - 审核与映射管理
  - [x] 14.1 实现内容审核队列
    - GET /api/v1/admin/review/queue：待审核内容列表（PROBLEM/SOLUTION/COMMENT 类型筛选）
    - POST /api/v1/admin/review/{type}/{id}/approve：批准发布
    - POST /api/v1/admin/review/{type}/{id}/reject：驳回（附理由）
    - 用户题解被举报 >= 3 次自动 HIDDEN
    - 审核前调用 AI 预审标记风险等级
    - _Requirements: R13_

  - [x] 14.2 实现跨平台映射管理
    - GET /api/v1/admin/mappings：映射列表（分页，按 platform/confirmed 筛选）
    - PUT /api/v1/admin/mappings/{id}/confirm：确认映射
    - PUT /api/v1/admin/mappings/{id}/reject：拒绝映射（拆分题目）
    - POST /api/v1/admin/mappings：手动创建映射
    - _Requirements: R19_

- [x] 15. Core 服务扩展 - 搜索与聚合
  - [x] 15.1 实现全文搜索
    - GET /api/v1/search：MySQL FULLTEXT + ngram 搜索
    - scope 参数：problems/solutions/all
    - 返回匹配度评分，降序排列
    - 空结果返回空列表
    - _Requirements: R22_

  - [x] 15.2 实现题目详情聚合端点
    - GET /api/v1/problems/{id}/detail：一次返回题目信息 + 解析摘要 + 题解数量 + 评论数量
    - 控制响应大小：解析仅返回当前级别摘要，题解/评论返回前 3 条预览
    - _Requirements: R35_

  - [x] 15.3 实现合规与来源下架
    - DELETE /api/v1/admin/sources/{platform}/{platformId}：批量下架关联内容
    - 保留 RawSource 记录，关联 Problem/UserSolution 标记 HIDDEN
    - _Requirements: R14_

- [x] 16. Checkpoint - Core 功能验证
  - 编译通过（mvn compile 成功），所有 API 端点已实现。

- [x] 17. 事件消费与 AI 加工触发
  - [x] 17.1 实现 Core 端 Redis Stream Consumer
    - 创建 `ContentEventConsumer`：消费 stream:content-events
    - 配置 Consumer Group（确保单实例处理）
    - 消费失败重试 3 次后移入死信 Stream
    - _Requirements: R26_

  - [x] 17.2 实现 AI 加工触发逻辑
    - 收到 CONTENT_STANDARDIZED 事件 → Dubbo 调用 AiProcessFacade.enrichContent
    - 多源聚合：同一题 >= 2 个来源时调用 aggregateSolutions
    - AI 调用走 batch 池限流（10次/分钟）
    - 失败时更新 RawSource.processStatus=FAILED
    - _Requirements: R6, R16, R17, R40_

  - [x] 17.3 实现 AI 成本控制
    - 创建优先级队列：热门题 > 普通题 > 更新题
    - 每日预算限制（从 Nacos 读取 daily-budget 配置）
    - 预算耗尽时暂停 batch 池任务，次日重置
    - GET /api/v1/admin/ai/usage：AI 调用统计展示
    - _Requirements: R40_

- [x] 18. ~~配置动态管理~~ **[废弃：Crawler 部分已由 Python 替代]**
  - [x] 18.1 ~~实现 Nacos 动态配置刷新~~ **[废弃]** Python 端使用 watchfiles + YAML 热更新（30s 生效），无需 Nacos @RefreshScope
    - ~~CrawlerPlatformConfig 使用 @RefreshScope 或 Nacos ConfigListener~~
    - _替代方案: python-crawler-service config.py + watchfiles_

  - [x] 18.2 ~~实现配置管理 API~~ **[废弃]** 已由 Python 端 `crawler/src/crawler_service/api/config_api.py` 实现
    - ~~GET /api/v1/admin/crawler/config、PUT /api/v1/admin/crawler/config/{platform}~~
    - _替代方案: python-crawler-service spec Task 14.2_

- [x] 19. 可观测性
  - [x] 19.1 ~~实现 Crawler 监控指标~~ **[废弃]** 已由 Python 端 prometheus_client 实现 `crawler/src/crawler_service/api/health.py`
    - ~~Micrometer 暴露：各平台成功率、响应时间、熔断器状态、限流器剩余令牌、MinIO 用量~~
    - _替代方案: python-crawler-service spec Task 15.1_

  - [x] 19.2 实现 Core 监控指标
    - Micrometer 暴露：题解提交量、评论量、审核队列长度、搜索 QPS
    - traceId 跨服务传递（Dubbo Filter + MDC）
    - _Requirements: R27.5, R27.6_

- [x] 20. 安全与权限
  - [x] 20.1 配置 API 权限控制
    - 管理员 API（/api/v1/admin/**）：ADMIN 角色校验
    - 用户题解/评论操作：认证 + 仅允许操作自己的内容
    - 点赞操作：认证 + Redis SET 防重复
    - 采集触发限流：单管理员 5 次/分钟
    - 批量导入限制：请求体 5MB
    - _Requirements: R30_

- [x] 21. Docker Compose 与部署
  - [x] 21.1 新增基础设施服务
    - ~~docker-compose.yml 新增 Nacos（standalone 模式）~~ 当前 Core 端使用 application.yml，暂不需要 Nacos
    - docker-compose.yml 已有 MinIO（端口 9000/9001 + 数据卷）✅
    - ~~docker-compose.yml 新增 XXL-JOB Admin（连接 MySQL）~~ **[废弃]** Python 用 APScheduler 替代 XXL-JOB
    - ~~创建 algorithm-crawler Dockerfile（多阶段构建）~~ **[废弃]** Python Dockerfile 已在 `crawler/Dockerfile` 实现
    - .env.example 已包含 MinIO/Crawler 配置 ✅
    - 服务启动顺序依赖已配置（mysql → redis → minio → crawler）✅
    - _Requirements: R31_

- [x] 22. Final Checkpoint - 全链路集成验证
  - 编译通过（mvn compile 成功），所有 API 端点已实现
  - 采集流程：管理员通过 CrawlerAdminController → PythonCrawlerClient → Python 爬虫服务 → Redis Stream 事件 → Core ContentEventConsumer → AiEnrichService
  - 用户流程：用户提交题解 → SolutionService（根据 sourceType 处理）→ 列表/点赞/精选
  - AI 调用 TODO：实际 AI 服务集成在 algorithm-ai 项目中
  - 验证配置热更新：Python 端 watchfiles YAML 热更新（30s 生效）

## Notes

- 所有 Java 代码遵循编码规范：DDD 分层、Lombok、方法不超过 50 行、中文注释
- 时间字段统一 UTC 毫秒时间戳（Long）
- ID 生成统一使用 MyBatis-Plus 雪花算法
- 枚举字段数据库存 String（@EnumValue）
- 新增表统一使用 V6 前缀的 Flyway 迁移脚本
- Dubbo 接口定义在 algorithm-help-api 模块，各服务引用
- 采集适配器通过 Spring DI 自动注册，新平台仅需新增类 + 配置

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"], "status": "completed" },
    { "id": 1, "tasks": ["2.1"], "status": "completed" },
    { "id": 2, "tasks": ["2.2", "2.3"], "status": "completed" },
    { "id": 3, "tasks": ["3.1", "3.2", "3.3"], "status": "completed" },
    { "id": 4, "tasks": ["4.1"], "status": "completed" },
    { "id": 5, "tasks": ["4.2", "4.3", "4.4", "4.5"], "status": "completed" },
    { "id": 6, "tasks": ["6.1", "6.2", "6.3", "6.4"], "status": "completed" },
    { "id": 7, "tasks": ["7.1", "7.2", "7.3", "7.4"], "status": "deprecated" },
    { "id": 8, "tasks": ["9.1", "9.2"] },
    { "id": 9, "tasks": ["10.1", "10.2", "10.3"] },
    { "id": 10, "tasks": ["11.1", "11.2", "11.3"] },
    { "id": 11, "tasks": ["12.1", "12.2", "13.1"] },
    { "id": 12, "tasks": ["14.1", "14.2", "15.1", "15.2", "15.3"] },
    { "id": 13, "tasks": ["17.1", "17.2", "17.3"] },
    { "id": 14, "tasks": ["19.2", "20.1"] },
    { "id": 15, "tasks": ["21.1"] }
  ]
}
```
