# Requirements Document

## Introduction

本规格定义"算法深度理解引擎"项目的数据采集与内容管理层需求（Spec 6）。该层负责从外部平台（LeetCode、力扣、Codeforces、牛客网、AtCoder、洛谷）采集题目数据，管理题目 CRUD 操作，以及构建用户贡献内容体系（用户题解 + 评论系统）。

### 与已有 Spec 的关系

- **依赖 Spec 1** (algorithm-engine-infrastructure): 数据模型基础（Problem、Explanation）、认证鉴权（JWT/Spring Security）、Redis 缓存
- **依赖 Spec 2** (content-generation-engine): AI 加工管线（ContentPipeline）、质量校验（QualityValidator）
- **被依赖于 Spec 3** (web-presentation-layer): 展示本 spec 产出的题目、题解、评论内容
- **平级协作 Spec 4** (interactive-features): 费曼模式对话总结可转为用户题解

### 微服务架构

本 spec 涉及两个微服务：
- **algorithm-core**: 题目 CRUD、用户题解、评论、内容审核 API
- **algorithm-crawler**: 多平台数据采集、数据标准化、反爬策略、MinIO 文件存储

服务间通过 Apache Dubbo 3.x RPC 通信，注册/配置中心为 Nacos。

## Glossary

- **Crawler_Service**: algorithm-crawler 数据采集微服务，负责从外部平台抓取数据
- **Core_Service**: algorithm-core 核心业务微服务，负责题目 CRUD、题解、评论管理
- **PlatformAdapter**: 平台适配器接口，每个外部平台实现一个适配器
- **CrawlTask**: 采集任务实体，记录采集类型、状态、进度
- **RawSource**: 原始采集数据实体，保留平台原始 JSON 数据
- **PlatformMapping**: 跨平台题目映射实体，记录同一题在不同平台的对应关系
- **UserSolution**: 用户题解实体，用户提交的独立解题思路
- **Comment**: 评论实体，可挂在官方解析或用户题解下
- **DataStandardizer**: 数据标准化组件，将多平台格式转换为统一内部模型
- **AntiCrawlManager**: 反爬管理器，负责 UA 轮转、Cookie 管理、限流、熔断
- **SmartRouter**: Spec 1 定义的智能路由层（缓存→Ollama→云端），本 spec 复用
- **ContentPipeline**: Spec 2 定义的内容生成流水线，采集后触发 AI 加工
- **MinIO**: S3 兼容的对象存储服务，用于存储采集的图片/附件
- **XXL_JOB**: 分布式定时任务调度平台，用于定时触发采集任务
- **Nacos**: 注册/配置中心，用于服务发现和动态配置管理

## Requirements

### Requirement 1: 平台适配器架构

**User Story:** As a 开发者, I want 采集系统采用适配器模式, so that 新增平台只需实现一个适配器类而无需修改核心逻辑。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 定义 PlatformAdapter 接口，包含方法：fetchProblemList、fetchProblemDetail、fetchSolutions、fetchEditorial、fetchComments
2. THE PlatformAdapter 接口 SHALL 定义 getPlatform 方法返回平台标识枚举（LEETCODE_GLOBAL、LEETCODE_CN、CODEFORCES、NOWCODER、ATCODER、LUOGU）
3. THE PlatformAdapter 接口 SHALL 定义 getCapabilities 方法返回该平台支持的功能列表（PROBLEM_FETCH、SOLUTION_FETCH、EDITORIAL_FETCH、COMMENT_FETCH）
4. THE Crawler_Service SHALL 通过 Spring 依赖注入自动发现并注册所有 PlatformAdapter 实现类
5. WHEN 新增外部平台支持时, THE 开发者 SHALL 仅需实现 PlatformAdapter 接口的新类并添加对应配置，无需修改已有代码
6. THE Crawler_Service SHALL 为每个平台提供独立的 YAML 配置块，包含 enabled、base-url、rate-limit、retry-max、cookie-key、capabilities、solution-fetch-enabled 字段

### Requirement 2: 多平台数据采集

**User Story:** As a 内容管理者, I want 系统从多个算法平台自动采集题目和题解数据, so that 内容库快速丰富且覆盖面广。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 支持从以下平台采集数据：LeetCode 国际站、力扣中文站、Codeforces、牛客网、AtCoder、洛谷
2. THE Crawler_Service SHALL 采集以下内容类型：题目元信息（标题、难度、标签、描述、约束、示例）、高赞题解、官方 Editorial、优质评论
3. WHEN 定时采集任务触发时, THE Crawler_Service SHALL 执行增量检测，仅采集自上次采集以来的新增或更新内容
4. THE Crawler_Service SHALL 支持三种触发方式：XXL_JOB cron 定时同步、管理员 API 按需触发、增量检测自动触发
5. THE Crawler_Service SHALL 为每次采集创建 CrawlTask 记录，包含 platform、taskType、status、progress、triggerType、createdAt、completedAt 字段
6. WHEN 采集任务完成时, THE Crawler_Service SHALL 通过 Redis Stream 发送事件通知 Core_Service 进行后续处理

### Requirement 3: 反爬策略管理

**User Story:** As a 系统, I want 采集请求具备完善的反爬策略, so that 采集过程不被目标平台封禁且系统稳定运行。

#### Acceptance Criteria

1. THE AntiCrawlManager SHALL 为每个平台维护独立的 Resilience4j RateLimiter 实例，限制每分钟最大请求数（从 Nacos 动态配置读取）
2. THE AntiCrawlManager SHALL 实现 User-Agent 轮转池，每次请求从配置的 UA 列表中随机选取
3. THE AntiCrawlManager SHALL 通过 Redis 管理各平台的 Cookie（key 格式：`crawler:cookie:{platform}`），支持 Cookie 过期自动刷新
4. THE AntiCrawlManager SHALL 实现指数退避重试策略：首次失败等待 base-delay-ms，后续每次翻倍，最大重试 retry-max 次
5. THE AntiCrawlManager SHALL 配置 Resilience4j CircuitBreaker：连续失败超过阈值时熔断，等待配置的 wait-duration 后进入半开状态探测
6. WHEN 熔断器触发时, THE Crawler_Service SHALL 记录 WARN 日志并暂停该平台的所有采集任务
7. THE AntiCrawlManager SHALL 预留代理池接口（proxy.enabled 配置），当前默认关闭，后续可接入代理服务
8. THE 请求间隔 SHALL 支持配置范围（如 request-delay-ms: 1000-3000），每次请求在范围内随机延迟

### Requirement 4: 数据标准化

**User Story:** As a 内容生产者, I want 不同平台的数据统一转换为内部标准格式, so that 后续处理逻辑无需关心数据来源差异。

#### Acceptance Criteria

1. THE DataStandardizer SHALL 将各平台的题目数据转换为统一的 Problem 内部模型（复用 Spec 1 定义的 Problem 实体结构）
2. THE DataStandardizer SHALL 将 HTML 格式的题目描述转换为 Markdown 格式（使用 Jsoup + Readability4J 提取正文 + flexmark-java 转换）
3. THE DataStandardizer SHALL 将题目描述中的外部图片下载到 MinIO 并替换为内部 URL
4. THE DataStandardizer SHALL 将各平台的难度标记映射为统一的三级难度（EASY/MEDIUM/HARD）
5. THE DataStandardizer SHALL 将各平台的标签体系映射为统一的内部标签体系（维护标签映射表）
6. THE DataStandardizer SHALL 保留原始采集数据到 RawSource 表（platform、platformId、contentType、rawJson、processStatus、fetchedAt）
7. WHEN 标准化过程中遇到无法映射的标签时, THE DataStandardizer SHALL 保留原始标签名称并标记为"待人工确认"

### Requirement 5: 跨平台题目去重

**User Story:** As a 内容管理者, I want 系统自动识别同一题在不同平台的对应关系, so that 避免重复采集和内容冗余。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 在采集新题目时执行去重检测，先精确匹配（平台ID+平台）再模糊匹配（标题相似度+约束比对）
2. THE PlatformMapping 实体 SHALL 包含字段：id(雪花)、unifiedProblemId、platform、platformProblemId、platformUrl、confidence(Float)、confirmed(Boolean)、createdAt
3. WHEN 精确匹配命中时（同平台同 platformId 已存在）, THE Crawler_Service SHALL 更新已有记录而非创建新题目
4. WHEN 模糊匹配置信度 >= 0.8 时, THE Crawler_Service SHALL 自动建立 PlatformMapping 并标记 confirmed=true
5. WHEN 模糊匹配置信度在 0.5-0.8 之间时, THE Crawler_Service SHALL 建立 PlatformMapping 并标记 confirmed=false（待人工确认）
6. WHEN 模糊匹配置信度 < 0.5 时, THE Crawler_Service SHALL 视为新题目创建独立记录
7. THE Core_Service SHALL 提供管理员 API 查看、确认、修正自动映射结果

### Requirement 6: 采集后 AI 加工触发

**User Story:** As a 内容生产者, I want 采集完成后自动触发 AI 加工流水线, so that 从采集到高质量内容产出实现全自动化。

#### Acceptance Criteria

1. WHEN 新题目采集并标准化完成时, THE Crawler_Service SHALL 通过 Dubbo RPC 调用 algorithm-ai 服务触发 AI 加工
2. THE AI 加工流程 SHALL 包含：多源题解聚合精炼、错误检测、图片内容识别、结构化格式化
3. WHEN 同一题有多个来源的题解时, THE AI 加工流程 SHALL 融合多源题解为一份最优官方解析（写入 Explanation 表）
4. THE AI 调用 SHALL 复用 SmartRouter 三层路由（缓存→本地 Ollama→云端），遵循双池限流策略
5. WHEN AI 加工失败时, THE Crawler_Service SHALL 将 RawSource.processStatus 标记为 FAILED 并记录失败原因，不阻塞后续采集
6. THE 系统 SHALL 支持对 FAILED 状态的 RawSource 手动重新触发 AI 加工

### Requirement 7: 图片与多媒体处理

**User Story:** As a 内容管理者, I want 采集的图片经过 AI 描述并存储到内部, so that 内容不依赖外部链接且图片含义可被文本搜索。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 将采集内容中的所有图片下载到 MinIO 对象存储（bucket: `crawler-assets`）
2. THE Crawler_Service SHALL 将 HTML/Markdown 中的外部图片 URL 替换为 MinIO 内部 URL
3. WHEN 图片下载完成时, THE Crawler_Service SHALL 通过 Dubbo 调用 algorithm-ai 的多模态接口生成图片的文本描述
4. THE 图片文本描述 SHALL 作为 alt 文本保存，同时保留原图链接，确保无障碍访问和图片加载失败时的降级展示
5. IF 图片下载失败, THEN THE Crawler_Service SHALL 保留原始外部 URL 并标记为"外部引用"，不阻塞整体流程
6. THE Crawler_Service SHALL 对 GIF 动图保持原格式存储，不做格式转换

### Requirement 8: 题目管理 CRUD

**User Story:** As a 管理员, I want 完整的题目创建/编辑/删除/批量导入功能, so that 除采集外还能手动管理题目内容。

#### Acceptance Criteria

1. THE Core_Service SHALL 提供 POST /api/v1/admin/problems 端点，支持管理员手动创建题目（需 ADMIN 角色）
2. THE Core_Service SHALL 提供 PUT /api/v1/admin/problems/{id} 端点，支持编辑题目所有字段
3. THE Core_Service SHALL 提供 DELETE /api/v1/admin/problems/{id} 端点，执行软删除（标记 deleted=true，不物理删除）
4. THE Core_Service SHALL 提供 POST /api/v1/admin/problems/batch-import 端点，接受 JSON 数组批量导入题目（单次最大 100 条）
5. WHEN 批量导入时, THE Core_Service SHALL 对每条数据独立校验，校验失败的记录跳过并返回失败明细
6. THE 批量导入 SHALL 支持去重检测：已存在相同 platform+platformId 的题目自动跳过或更新（由参数 `mode=skip|update` 控制）

### Requirement 9: 采集任务管理 API

**User Story:** As a 管理员, I want 手动触发采集任务并查看任务进度, so that 可以按需补充内容并监控采集状态。

#### Acceptance Criteria

1. THE Core_Service SHALL 提供 POST /api/v1/admin/crawler/trigger 端点，接受参数 platform（可选，不传则全平台）和 taskType（PROBLEM_SYNC/SOLUTION_SYNC/SINGLE_FETCH）
2. WHEN 触发单题采集时, THE 端点 SHALL 额外接受 platformProblemId 参数指定要采集的目标题目
3. THE Core_Service SHALL 提供 GET /api/v1/admin/crawler/tasks 端点，返回采集任务列表（分页，支持按平台和状态筛选）
4. THE Core_Service SHALL 提供 GET /api/v1/admin/crawler/tasks/{id} 端点，返回单个任务详情（含实时进度 JSON：total、completed、failed、currentItem）
5. WHEN 采集任务状态变更时, THE 系统 SHALL 通过 Redis Stream 事件通知前端（供管理后台 SSE 推送使用）
6. THE Core_Service SHALL 提供 POST /api/v1/admin/crawler/tasks/{id}/cancel 端点，取消运行中的采集任务

### Requirement 10: 用户题解体系

**User Story:** As a 学习者, I want 提交我的解题思路并分享给社区, so that 我可以记录学习成果并帮助其他人。

#### Acceptance Criteria

1. THE Core_Service SHALL 定义 UserSolution 实体，包含字段：id(雪花)、problemId、userId、title、content(JSON 结构化内容)、rawContent(用户原始输入)、sourceType(USER_INPUT/URL_IMPORT/FEYNMAN_OUTPUT/CRAWLED)、sourceUrl、status(DRAFT/PUBLISHED/FEATURED/HIDDEN)、upvotes、featured(Boolean)、createdAt、updatedAt
2. THE Core_Service SHALL 提供 POST /api/v1/problems/{problemId}/solutions 端点，用户提交题解（需认证）
3. THE Core_Service SHALL 提供 GET /api/v1/problems/{problemId}/solutions 端点，获取某题的用户题解列表（分页，支持按 upvotes/createdAt 排序）
4. THE Core_Service SHALL 提供 PUT /api/v1/solutions/{id} 端点，用户编辑自己的题解
5. THE Core_Service SHALL 提供 DELETE /api/v1/solutions/{id} 端点，用户删除自己的题解（软删除）
6. WHEN 用户提交 sourceType=USER_INPUT 的题解时, THE Core_Service SHALL 通过 Dubbo 调用 algorithm-ai 对原始输入进行结构化处理后存储到 content 字段
7. WHEN 用户提交 sourceType=URL_IMPORT 的题解时, THE Core_Service SHALL 抓取 URL 内容并通过 AI 精炼后存储
8. THE Core_Service SHALL 提供 POST /api/v1/solutions/{id}/upvote 端点，用户点赞题解（每用户每题解只能点赞一次）

### Requirement 11: 题解精选与提升机制

**User Story:** As a 内容管理者, I want 优质用户题解可以被标记为精选或提升为官方解析, so that 社区贡献的高质量内容得到充分利用。

#### Acceptance Criteria

1. THE Core_Service SHALL 提供 POST /api/v1/admin/solutions/{id}/feature 端点，管理员标记题解为精选（设置 featured=true, status=FEATURED）
2. WHEN 用户题解的 upvotes 达到配置阈值（默认 20）时, THE Core_Service SHALL 自动将其标记为精选候选并通知管理员审核
3. THE Core_Service SHALL 提供 POST /api/v1/admin/solutions/{id}/promote 端点，将精选题解"提升"为官方解析（复制内容到 Explanation 表并标注来源）
4. WHEN 题解被提升为官方解析时, THE Core_Service SHALL 在原 UserSolution 中标注"已被采纳为官方解析"并保留原始引用关系
5. THE 精选题解 SHALL 在题解列表中优先展示（排在非精选题解前面）

### Requirement 12: 评论系统

**User Story:** As a 学习者, I want 在官方解析和用户题解下发表评论, so that 我可以提问、纠错或补充细节。

#### Acceptance Criteria

1. THE Core_Service SHALL 定义 Comment 实体，包含字段：id(雪花)、userId、targetType(EXPLANATION/USER_SOLUTION)、targetId、content(文本)、type(NORMAL/CORRECTION/SUPPLEMENT/QUESTION)、upvotes、createdAt
2. THE Core_Service SHALL 提供 POST /api/v1/comments 端点，用户发表评论（需认证），请求体包含 targetType、targetId、content、type
3. THE Core_Service SHALL 提供 GET /api/v1/comments 端点，按 targetType+targetId 查询评论列表（分页，默认按 createdAt 降序）
4. THE Core_Service SHALL 提供 DELETE /api/v1/comments/{id} 端点，用户删除自己的评论（软删除）
5. THE Core_Service SHALL 提供 POST /api/v1/comments/{id}/upvote 端点，用户点赞评论
6. WHEN 评论 type 为 CORRECTION 时, THE Core_Service SHALL 通知对应内容的作者（题解作者或管理员）
7. THE Core_Service SHALL 提供 POST /api/v1/admin/comments/{id}/expand 端点，管理员触发 AI 将优质评论扩展为独立题解（调用 algorithm-ai 服务）

### Requirement 13: 内容审核流程

**User Story:** As a 内容管理者, I want 采集和用户提交的内容经过审核流程, so that 低质量或违规内容不会暴露给用户。

#### Acceptance Criteria

1. WHEN 新采集的内容标准化完成时, THE Core_Service SHALL 将内容状态设为 PENDING_REVIEW（待审核）
2. WHEN 用户提交新题解时, THE Core_Service SHALL 将题解状态设为 PUBLISHED（用户题解默认直接发布，异步审核）
3. THE Core_Service SHALL 提供 GET /api/v1/admin/review/queue 端点，返回待审核内容列表（支持按类型筛选：PROBLEM/SOLUTION/COMMENT）
4. THE Core_Service SHALL 提供 POST /api/v1/admin/review/{contentType}/{id}/approve 端点，批准内容发布
5. THE Core_Service SHALL 提供 POST /api/v1/admin/review/{contentType}/{id}/reject 端点，驳回内容并附带驳回理由
6. WHEN 用户题解被举报超过配置阈值（默认 3 次）时, THE Core_Service SHALL 自动将其状态变更为 HIDDEN 并进入审核队列
7. THE Core_Service SHALL 在内容审核前调用 algorithm-ai 进行 AI 预审（检查逻辑错误、违规内容），AI 预审通过的内容标记为低风险

### Requirement 14: 合规与来源追溯

**User Story:** As a 系统, I want 所有采集内容保留完整的来源追溯链, so that 合规风险可控且可随时下架争议内容。

#### Acceptance Criteria

1. THE RawSource 实体 SHALL 包含字段：id(雪花)、platform、platformId、contentType(PROBLEM/SOLUTION/EDITORIAL/COMMENT)、rawJson(TEXT 类型存储原始数据)、processStatus(PENDING/PROCESSED/FAILED)、fetchedAt、processedAt
2. THE 系统 SHALL 在所有展示内容中标注出处链接（如"来源：LeetCode #1 Two Sum"）
3. THE AI 加工后的内容 SHALL 经过 AI 重新组织表达，不直接复制原文
4. THE 系统 SHALL 支持按平台独立关闭题解采集功能（配置 solution-fetch-enabled=false），仅采集题目元信息
5. THE Core_Service SHALL 提供 DELETE /api/v1/admin/sources/{platform}/{platformId} 端点，按来源批量下架所有相关内容
6. WHEN 内容被下架时, THE 系统 SHALL 保留 RawSource 记录但将关联的 Problem/UserSolution 标记为 HIDDEN

### Requirement 15: 配置驱动与动态管理

**User Story:** As a 运维者, I want 所有采集参数通过配置中心动态管理, so that 调整采集策略无需重启服务。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 从 Nacos 配置中心读取所有平台采集参数，支持运行时动态刷新
2. THE 平台配置 SHALL 包含以下字段：enabled(开关)、base-url、api-url、graphql-url(可选)、rate-limit(每分钟最大请求数)、retry-max、retry-delay-ms、cookie-key、capabilities(列表)、solution-fetch-enabled
3. THE 反爬配置 SHALL 包含：user-agents(UA 列表)、request-delay-ms(请求间隔范围)、circuit-breaker.failure-threshold、circuit-breaker.wait-duration-ms、proxy.enabled、proxy.provider
4. WHEN Nacos 配置变更时, THE Crawler_Service SHALL 在 30 秒内生效新配置（通过 @RefreshScope 或 Nacos Listener）
5. THE Core_Service SHALL 提供 GET /api/v1/admin/crawler/config 端点，查看当前各平台采集配置状态
6. THE Core_Service SHALL 提供 PUT /api/v1/admin/crawler/config/{platform} 端点，动态修改平台配置（写入 Nacos）

### Requirement 16: 多源题解聚合精炼

**User Story:** As a 内容管理者, I want 同一题的多个来源题解被 AI 融合为最优官方解析, so that 用户看到的是综合最佳的内容而非零散片段。

#### Acceptance Criteria

1. WHEN 同一题目存在多个来源的题解（采集的 + 用户贡献的精选）时, THE AI 加工流程 SHALL 将多源题解作为参考素材传递给 AI 生成融合解析
2. THE 融合解析 SHALL 包含各来源的优点：最清晰的解释 + 最优的代码实现 + 最完整的边界分析
3. THE 融合过程 SHALL 保留各素材的来源标注，在输出中注明"综合自 N 个来源"
4. THE 融合结果 SHALL 写入 Explanation 表作为官方解析，sourceType 标记为 AGGREGATED
5. WHEN 融合素材不足 2 个来源时, THE 系统 SHALL 直接使用单源内容作为基础，通过 AI 增强和结构化后产出
6. THE 融合过程 SHALL 复用 SmartRouter 路由策略和双池限流，归属 batch 池

### Requirement 17: AI 错误检测

**User Story:** As a 内容管理者, I want AI 自动审查导入内容中的逻辑错误, so that 发布的内容准确无误。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 在数据标准化完成后调用 algorithm-ai 的 detectErrors 接口对内容执行逻辑错误检测
2. THE 错误检测 SHALL 覆盖：代码逻辑错误、复杂度分析错误、边界条件遗漏、解释与代码不匹配
3. WHEN 检测到致命错误时, THE 系统 SHALL 将内容标记为 PENDING_REVIEW 并在审核队列中高亮显示错误信息
4. WHEN 检测到非致命警告时, THE 系统 SHALL 在内容中添加警告标注但不阻塞发布流程
5. THE 错误检测结果 SHALL 结构化存储（错误类型、位置、严重程度、建议修复方式），供管理员审核参考
6. THE 错误检测 SHALL 复用 SmartRouter 三层路由，调用归属 batch 池限流

### Requirement 18: 评论精华提取与 AI 扩展

**User Story:** As a 内容管理者, I want 优质评论可被 AI 扩展为独立的用户题解, so that 评论区的知识碎片不被浪费。

#### Acceptance Criteria

1. THE Core_Service SHALL 提供 POST /api/v1/admin/comments/{id}/expand 端点，触发 AI 将评论扩展为结构化题解
2. THE AI 扩展流程 SHALL 保留评论原文作为核心观点，围绕其补充完整的解释、代码、复杂度分析
3. THE 扩展后的题解 SHALL 创建为 UserSolution 记录，sourceType 设为 CRAWLED（系统生成），标注原始评论 ID 作为来源
4. THE 扩展操作 SHALL 仅对 type 为 SUPPLEMENT 或 CORRECTION 且 upvotes >= 5 的评论生效（其他评论返回 400 错误）
5. WHEN 扩展完成时, THE 系统 SHALL 在原评论下自动添加系统回复："该评论已被扩展为独立题解"并附带链接

### Requirement 19: 跨平台映射管理

**User Story:** As a 管理员, I want 查看和管理跨平台题目映射关系, so that 确保去重逻辑准确且可人工修正错误映射。

#### Acceptance Criteria

1. THE Core_Service SHALL 提供 GET /api/v1/admin/mappings 端点，返回跨平台映射列表（分页，支持按 platform、confirmed 状态筛选）
2. THE Core_Service SHALL 提供 PUT /api/v1/admin/mappings/{id}/confirm 端点，管理员确认自动映射结果（设置 confirmed=true）
3. THE Core_Service SHALL 提供 PUT /api/v1/admin/mappings/{id}/reject 端点，管理员拒绝错误映射（删除映射关系）
4. THE Core_Service SHALL 提供 POST /api/v1/admin/mappings 端点，管理员手动创建映射关系（指定 unifiedProblemId、platform、platformProblemId）
5. THE 映射列表 SHALL 展示置信度分数、来源平台、平台题号、平台 URL，便于管理员判断准确性
6. WHEN 管理员拒绝映射后, THE 系统 SHALL 将被错误合并的题目重新拆分为独立记录

### Requirement 20: 数据模型定义

**User Story:** As a 开发者, I want 本 spec 新增的数据实体有清晰的定义, so that 开发和存储结构明确。

#### Acceptance Criteria

1. THE Core_Service SHALL 定义 UserSolution 实体，使用雪花算法 ID（MyBatis-Plus ASSIGN_ID），包含字段：id、problemId、userId、title、content(JSON)、rawContent(TEXT)、sourceType(枚举)、sourceUrl、status(枚举)、upvotes(Integer默认0)、featured(Boolean默认false)、deleted(Boolean默认false)、createdAt(Long UTC毫秒)、updatedAt(Long UTC毫秒)
2. THE Core_Service SHALL 定义 Comment 实体，使用雪花算法 ID，包含字段：id、userId、targetType(枚举)、targetId、content(TEXT)、type(枚举)、upvotes(Integer默认0)、deleted(Boolean默认false)、createdAt(Long UTC毫秒)
3. THE Crawler_Service SHALL 定义 RawSource 实体，使用雪花算法 ID，包含字段：id、platform(枚举)、platformId(String)、contentType(枚举)、rawJson(TEXT)、processStatus(枚举)、errorMessage(TEXT nullable)、fetchedAt(Long UTC毫秒)、processedAt(Long UTC毫秒 nullable)
4. THE Crawler_Service SHALL 定义 CrawlTask 实体，使用雪花算法 ID，包含字段：id、platform(枚举)、taskType(枚举)、status(枚举)、progress(JSON: total/completed/failed/currentItem)、triggerType(枚举)、errorMessage(TEXT nullable)、createdAt(Long UTC毫秒)、completedAt(Long UTC毫秒 nullable)
5. THE Core_Service SHALL 定义 PlatformMapping 实体，使用雪花算法 ID，包含字段：id、unifiedProblemId(Long)、platform(枚举)、platformProblemId(String)、platformUrl(String)、confidence(Float)、confirmed(Boolean默认false)、createdAt(Long UTC毫秒)
6. THE 所有时间字段 SHALL 使用 Long 类型存储 UTC 毫秒时间戳（与 Spec 1 保持一致）
7. THE 所有枚举字段 SHALL 在数据库中以 String 类型存储（MyBatis-Plus @EnumValue 注解）

### Requirement 21: 数据库索引与性能

**User Story:** As a 系统, I want 关键查询路径有合适的数据库索引, so that 高频查询响应时间可控。

#### Acceptance Criteria

1. THE UserSolution 表 SHALL 创建索引：idx_solution_problem_id(problemId)、idx_solution_user_id(userId)、idx_solution_status(status)
2. THE Comment 表 SHALL 创建索引：idx_comment_target(targetType, targetId)、idx_comment_user_id(userId)
3. THE RawSource 表 SHALL 创建索引：idx_rawsource_platform_id(platform, platformId)、idx_rawsource_status(processStatus)
4. THE CrawlTask 表 SHALL 创建索引：idx_crawltask_platform_status(platform, status)、idx_crawltask_created(createdAt)
5. THE PlatformMapping 表 SHALL 创建唯一索引：uk_mapping_platform_problemid(platform, platformProblemId)
6. THE PlatformMapping 表 SHALL 创建索引：idx_mapping_unified(unifiedProblemId)
7. THE 用户题解列表查询（按 problemId + status + 排序）SHALL 确保响应时间 < 200ms（题解数 < 1000 条/题的场景）

### Requirement 22: MySQL 全文搜索支持

**User Story:** As a 学习者, I want 通过关键词搜索题目和题解, so that 快速找到相关内容。

#### Acceptance Criteria

1. THE Core_Service SHALL 使用 MySQL 8.0 FULLTEXT INDEX + ngram 解析器实现中文全文搜索
2. THE Problem 表 SHALL 创建 FULLTEXT INDEX（title, description）使用 ngram 解析器（ngram_token_size=2）
3. THE UserSolution 表 SHALL 创建 FULLTEXT INDEX（title, rawContent）使用 ngram 解析器
4. THE Core_Service SHALL 提供 GET /api/v1/search 统一搜索端点，支持 scope 参数（problems/solutions/all）
5. WHEN 搜索结果为空时, THE Core_Service SHALL 返回空列表而非 404，前端展示"无匹配结果"提示
6. THE 搜索结果 SHALL 包含匹配度评分，按评分降序排列

### Requirement 23: 定时任务调度

**User Story:** As a 运维者, I want 采集任务通过分布式调度平台管理, so that 任务调度可视化、可配置、支持失败重试。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 集成 XXL_JOB 作为定时任务调度框架，注册为 XXL_JOB Executor
2. THE Crawler_Service SHALL 注册以下定时任务：全平台题目增量同步（默认每日凌晨 3:00）、单平台题解采集（默认每周一次）、失败任务自动重试（默认每 4 小时）
3. THE XXL_JOB 任务 SHALL 支持通过管理后台手动触发、暂停、恢复
4. WHEN 定时任务执行失败时, THE XXL_JOB SHALL 自动重试最多 3 次，仍失败则标记为 FAILED 并发送告警日志
5. THE 定时任务执行日志 SHALL 记录到 XXL_JOB 控制台，包含任务开始时间、结束时间、处理数量、失败原因
6. THE Crawler_Service SHALL 在 XXL_JOB Handler 中实现分片广播模式，支持多实例并行采集不同平台

### Requirement 24: 文件存储（MinIO）

**User Story:** As a 系统, I want 采集的图片和附件统一存储到对象存储, so that 不依赖外部链接且文件管理统一。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 集成 MinIO Java SDK，配置 endpoint、accessKey、secretKey 从 Nacos 读取
2. THE Crawler_Service SHALL 使用以下 bucket 规划：`crawler-assets`（采集图片）、`user-uploads`（用户上传）
3. THE Crawler_Service SHALL 使用日期分区路径存储文件：`{bucket}/{yyyy}/{MM}/{dd}/{uuid}.{ext}`
4. THE Crawler_Service SHALL 对上传文件执行类型校验：仅允许 image/png、image/jpeg、image/gif、image/webp、image/svg+xml
5. THE Crawler_Service SHALL 对单文件大小限制为 10MB，超出时拒绝存储并记录日志
6. THE Core_Service SHALL 提供 GET /api/v1/files/{fileId} 端点，返回文件访问 URL（预签名 URL，有效期 24 小时）

### Requirement 25: 服务间通信

**User Story:** As a 开发者, I want 微服务间通过 Dubbo RPC 高效通信, so that 服务解耦且调用性能优于 HTTP。

#### Acceptance Criteria

1. THE Crawler_Service 与 Core_Service SHALL 通过 Apache Dubbo 3.x 进行 RPC 通信，注册中心为 Nacos
2. THE 系统 SHALL 定义以下 Dubbo 接口：CrawlerFacade（Core→Crawler 触发采集）、ProblemFacade（Crawler→Core 写入题目）、AiProcessFacade（Crawler→AI 触发加工）
3. THE Dubbo 接口 SHALL 定义在独立的 API 模块（algorithm-api），被各服务引用
4. THE Dubbo 调用 SHALL 配置超时时间：普通操作 5s、AI 加工操作 60s、批量操作 120s
5. IF Dubbo 调用超时或失败, THEN THE 调用方 SHALL 记录错误并执行降级逻辑（返回错误状态而非抛异常）
6. THE Dubbo 接口 SHALL 使用 Protobuf 或 Hessian2 序列化协议（默认 Hessian2）

### Requirement 26: 异步事件通信

**User Story:** As a 开发者, I want 服务间异步事件通过 Redis Stream 传递, so that 非实时操作不阻塞主流程。

#### Acceptance Criteria

1. THE 系统 SHALL 使用 Redis Stream 作为异步事件总线，定义以下 Stream：`stream:crawl-events`（采集事件）、`stream:content-events`（内容处理事件）
2. WHEN 采集任务状态变更时, THE Crawler_Service SHALL 发送事件到 `stream:crawl-events`（包含 taskId、platform、status、timestamp）
3. WHEN 新内容标准化完成时, THE Crawler_Service SHALL 发送事件到 `stream:content-events`（包含 contentType、contentId、action=STANDARDIZED）
4. THE Core_Service SHALL 通过 Redis Stream Consumer Group 消费事件，确保每条事件仅被一个实例处理
5. IF 事件消费失败, THEN THE Consumer SHALL 将事件移入 Pending 队列，定时重试最多 3 次后移入死信 Stream
6. THE 事件消息体 SHALL 为 JSON 格式，包含 eventType、payload、timestamp、traceId 字段

### Requirement 27: 可观测性与监控

**User Story:** As a 运维者, I want 采集系统具备完善的可观测性, so that 可以监控采集健康度、发现问题并快速定位。

#### Acceptance Criteria

1. THE Crawler_Service SHALL 通过 Micrometer 暴露以下指标：各平台采集成功率、各平台平均响应时间、熔断器状态、RateLimiter 剩余令牌数、MinIO 存储用量
2. THE Crawler_Service SHALL 使用结构化日志（JSON 格式 + SLF4J/Logback），每条日志包含 traceId、platform、taskId
3. WHEN 采集任务失败率超过 50% 时, THE Crawler_Service SHALL 发出 ERROR 级别告警日志
4. WHEN 单平台连续失败超过 10 次时, THE Crawler_Service SHALL 自动暂停该平台采集并发出告警
5. THE Core_Service SHALL 通过 Micrometer 暴露以下指标：题解提交量（按类型）、评论量、审核队列长度、搜索 QPS
6. THE 所有 HTTP 请求 SHALL 携带 traceId（通过 MDC 传递），跨服务调用保持 traceId 一致

### Requirement 28: 错误处理与容错

**User Story:** As a 系统, I want 采集过程中的错误被优雅处理且不影响整体流程, so that 单个失败不会拖垮整个系统。

#### Acceptance Criteria

1. WHEN 单个题目采集失败时, THE Crawler_Service SHALL 记录错误并继续处理下一个题目（不中断批次）
2. WHEN 平台返回 HTTP 429（Too Many Requests）时, THE Crawler_Service SHALL 按响应的 Retry-After 头等待后重试
3. WHEN 平台返回 HTTP 403（Forbidden）时, THE Crawler_Service SHALL 触发 Cookie 刷新流程并重试一次
4. WHEN 平台返回 HTTP 5xx 时, THE Crawler_Service SHALL 执行指数退避重试（最多 retry-max 次）
5. IF 重试耗尽仍失败, THEN THE Crawler_Service SHALL 将 CrawlTask 标记为 FAILED 并记录完整错误链
6. THE Crawler_Service SHALL 使用 Resilience4j Bulkhead 限制每平台最大并发采集线程数（默认 3），防止单平台故障耗尽线程池

### Requirement 29: 数据库迁移脚本

**User Story:** As a 开发者, I want 本 spec 新增的表通过 Flyway 迁移脚本管理, so that 数据库变更版本化可追溯。

#### Acceptance Criteria

1. THE Core_Service SHALL 提供 Flyway 迁移脚本创建 user_solution 表（含所有字段和索引）
2. THE Core_Service SHALL 提供 Flyway 迁移脚本创建 comment 表（含所有字段和索引）
3. THE Core_Service SHALL 提供 Flyway 迁移脚本创建 platform_mapping 表（含所有字段和索引）
4. THE Crawler_Service SHALL 提供 Flyway 迁移脚本创建 raw_source 表（含所有字段和索引）
5. THE Crawler_Service SHALL 提供 Flyway 迁移脚本创建 crawl_task 表（含所有字段和索引）
6. THE 迁移脚本 SHALL 使用 MySQL 8.0 语法，包含 FULLTEXT INDEX 和 ngram 解析器配置
7. THE 迁移脚本命名 SHALL 遵循 `V{大版本}_{序号}__{描述}.sql` 格式（如 V6_001__create_user_solution.sql）

### Requirement 30: 安全与权限控制

**User Story:** As a 系统, I want 数据采集管理的 API 有明确的权限控制, so that 敏感操作仅限授权角色执行。

#### Acceptance Criteria

1. THE 管理员 API（/api/v1/admin/**）SHALL 要求 ADMIN 角色的 JWT token
2. THE 用户题解操作（创建/编辑/删除）SHALL 要求认证且仅允许操作自己的内容
3. THE 用户评论操作（创建/删除）SHALL 要求认证且仅允许删除自己的评论
4. THE 点赞操作 SHALL 要求认证，使用 Redis SET 防止重复点赞（key: `upvote:{targetType}:{targetId}:{userId}`）
5. THE 采集触发 API SHALL 限制调用频率：单管理员每分钟最多 5 次触发请求
6. THE 批量导入 API SHALL 对请求体大小限制为 5MB（考虑批量数据量）
7. WHEN 非管理员尝试访问管理员 API 时, THE Core_Service SHALL 返回 HTTP 403 状态码和"权限不足"错误信息

### Requirement 31: Docker Compose 服务编排

**User Story:** As a 开发者, I want 本 spec 新增的基础设施服务通过 Docker Compose 管理, so that 本地开发环境一键启动。

#### Acceptance Criteria

1. THE Docker Compose 配置 SHALL 包含 MinIO 服务（端口 9000/9001），配置持久化数据卷和默认 access-key/secret-key
2. THE Docker Compose 配置 SHALL 包含 XXL_JOB Admin 服务（端口 8080），配置连接到项目 MySQL 实例
3. THE Docker Compose 配置 SHALL 包含 Nacos 服务（端口 8848），配置为 standalone 模式
4. THE Docker Compose 配置 SHALL 为 algorithm-crawler 服务提供 Dockerfile（多阶段构建）
5. THE Docker Compose 配置 SHALL 确保服务启动顺序：MySQL → Redis → Nacos → MinIO → XXL_JOB → algorithm-core → algorithm-crawler
6. THE .env.example 文件 SHALL 包含所有新增服务的配置变量（MinIO 密钥、Nacos 地址、XXL_JOB 配置等）

### Requirement 32: 费曼模式题解转化

**User Story:** As a 学习者, I want 费曼模式的对话总结可以转化为我的题解, so that 我的学习过程自动产出可分享的内容。

#### Acceptance Criteria

1. THE Core_Service SHALL 提供 POST /api/v1/solutions/from-feynman 端点，接受 feynmanSessionId 参数，将费曼模式对话总结转化为 UserSolution
2. THE 转化后的题解 SHALL 设置 sourceType=FEYNMAN_OUTPUT，保留原始 session ID 作为来源引用
3. THE 转化流程 SHALL 调用 algorithm-ai 对对话摘要进行结构化处理（提取核心思路、补充代码、格式化）
4. WHEN 转化完成时, THE 题解状态 SHALL 设为 DRAFT，用户确认后手动发布
5. THE 用户 SHALL 可以在发布前编辑 AI 结构化后的内容
6. IF 费曼 session 不存在或不属于当前用户, THEN THE 端点 SHALL 返回 HTTP 404 或 403 错误

### Requirement 33: URL 导入与 AI 精炼

**User Story:** As a 学习者, I want 通过贴一个外部链接快速导入题解, so that 不需要手动抄写外部平台的好文章。

#### Acceptance Criteria

1. THE Core_Service SHALL 提供 POST /api/v1/solutions/import-url 端点，接受 url 和 problemId 参数
2. THE Core_Service SHALL 对 URL 执行 SSRF 防护检查（禁止内网 IP、仅允许 HTTP/HTTPS 协议）
3. THE Core_Service SHALL 使用 OkHttp 抓取 URL 内容，通过 Jsoup + Readability4J 提取正文
4. THE 提取的正文 SHALL 通过 Dubbo 调用 algorithm-ai 进行 AI 精炼：结构化处理、错误审查、格式美化
5. THE AI 精炼后的内容 SHALL 创建为 UserSolution，sourceType=URL_IMPORT，sourceUrl 保留原始链接
6. WHEN URL 无法访问或内容提取失败时, THE Core_Service SHALL 返回 HTTP 422 错误并说明失败原因
7. THE URL 导入 SHALL 限制频率：单用户每分钟最多 3 次

### Requirement 34: 点赞与排序机制

**User Story:** As a 学习者, I want 题解和评论支持点赞且高赞内容排在前面, so that 优质内容更容易被发现。

#### Acceptance Criteria

1. THE 点赞操作 SHALL 使用 Redis SET 存储点赞关系（key: `upvote:{targetType}:{targetId}`, member: userId），确保幂等性
2. THE 点赞计数 SHALL 同时更新数据库 upvotes 字段（异步更新，Redis 为准）和 Redis 缓存
3. THE 用户题解列表 SHALL 支持按以下方式排序：最新(createdAt DESC)、最热(upvotes DESC)、精选优先(featured DESC, upvotes DESC)
4. THE 评论列表 SHALL 默认按时间降序排列，支持切换为按点赞数降序
5. THE Core_Service SHALL 提供 DELETE /api/v1/solutions/{id}/upvote 端点，用户取消点赞
6. THE Core_Service SHALL 提供 DELETE /api/v1/comments/{id}/upvote 端点，用户取消评论点赞
7. THE 点赞状态 SHALL 在列表查询时返回当前用户是否已点赞（通过 Redis SISMEMBER 查询）

### Requirement 35: 题目详情页三区模型

**User Story:** As a 学习者, I want 题目详情页有清晰的三个内容区域（官方解析、用户题解、评论）, so that 不同类型内容互不混淆且各有侧重。

#### Acceptance Criteria

1. THE Core_Service SHALL 提供 GET /api/v1/problems/{id}/detail 聚合端点，一次返回题目基本信息 + 官方解析摘要 + 用户题解数量 + 评论数量
2. THE 官方解析区 SHALL 展示 Explanation 表中的 L1-L5 标准解析（复用 Spec 1 已有接口）
3. THE 用户题解区 SHALL 展示 UserSolution 表中 status=PUBLISHED 或 FEATURED 的题解
4. THE 评论区 SHALL 支持挂在官方解析下（targetType=EXPLANATION）或用户题解下（targetType=USER_SOLUTION）
5. THE 聚合端点 SHALL 控制响应大小：官方解析仅返回当前级别摘要，题解和评论返回计数+前 3 条预览
6. THE 前端 SHALL 通过独立的分页接口加载完整的题解列表和评论列表（懒加载）

### Requirement 36: 采集数据质量保证

**User Story:** As a 内容管理者, I want 采集的数据经过质量检查, so that 低质量或不完整的数据不进入正式内容库。

#### Acceptance Criteria

1. THE DataStandardizer SHALL 对采集的题目执行完整性校验：title、description、difficulty 三个字段为必填，缺失任一则标记为 INCOMPLETE
2. THE DataStandardizer SHALL 对采集的题解执行最小内容长度校验：正文内容少于 100 字符的题解标记为 LOW_QUALITY
3. WHEN 题目被标记为 INCOMPLETE 时, THE 系统 SHALL 保留 RawSource 记录但不创建 Problem 实体，等待后续补充采集
4. THE DataStandardizer SHALL 检测并过滤纯广告/推广内容（通过关键词黑名单 + AI 辅助判断）
5. THE 质量检查结果 SHALL 记录到 RawSource 的 processStatus 字段和 errorMessage 字段
6. THE Core_Service SHALL 提供 GET /api/v1/admin/quality/stats 端点，返回数据质量统计（各平台采集成功率、INCOMPLETE 数量、LOW_QUALITY 数量）

### Requirement 37: LeetCode 平台适配器

**User Story:** As a 内容管理者, I want 系统能从 LeetCode 国际站和力扣中文站采集数据, so that 覆盖最主流的算法题平台。

#### Acceptance Criteria

1. THE LeetCode 国际站适配器 SHALL 通过 GraphQL API（graphql-url 配置）采集题目列表和详情
2. THE 力扣中文站适配器 SHALL 通过独立的 GraphQL API 采集中文版题目
3. THE 两个适配器 SHALL 采集以下字段：题号、标题（中英文）、难度、标签列表、描述、约束、示例、提交统计（通过率）
4. THE 适配器 SHALL 支持采集题目关联的高赞题解（前 10 条，按 vote 数降序）
5. THE 适配器 SHALL 支持采集官方 Editorial（如果存在）
6. WHEN LeetCode 返回需要登录的错误时, THE 适配器 SHALL 使用 Redis 中存储的 Cookie 进行认证请求
7. THE 适配器 SHALL 处理 LeetCode 的分页机制（每次最多 50 题），自动翻页直到采集完毕

### Requirement 38: Codeforces 平台适配器

**User Story:** As a 内容管理者, I want 系统能从 Codeforces 采集数据, so that 覆盖竞赛选手常用的国际平台。

#### Acceptance Criteria

1. THE Codeforces 适配器 SHALL 通过 Codeforces REST API（api-url 配置）采集题目列表
2. THE 适配器 SHALL 采集以下字段：contestId + index（组合为题号）、题目名称、标签列表、难度 rating
3. THE 适配器 SHALL 将 Codeforces 的 rating 映射为统一难度：<= 1200 → EASY、1201-1800 → MEDIUM、> 1800 → HARD
4. THE 适配器 SHALL 采集题目的 Editorial（通过 blog 链接，如果存在）
5. THE 适配器 SHALL 处理 Codeforces 的 HTML 格式题面，转换为 Markdown
6. WHEN Codeforces API 返回 FAILED 状态时, THE 适配器 SHALL 等待 API 建议的间隔后重试

### Requirement 39: 其他平台适配器

**User Story:** As a 内容管理者, I want 系统支持牛客网、AtCoder、洛谷等平台, so that 内容来源更加多元化。

#### Acceptance Criteria

1. THE 牛客网适配器 SHALL 通过 HTTP API 或 HTML 解析采集题目数据（牛客网无公开 API，使用 Jsoup 解析页面）
2. THE AtCoder 适配器 SHALL 通过 AtCoder Problems API（第三方开源 API）采集题目列表和难度信息
3. THE 洛谷适配器 SHALL 通过 HTTP 采集公开题目数据（遵守洛谷 robots.txt 规则）
4. EACH 平台适配器 SHALL 在 capabilities 配置中声明其支持的功能（部分平台可能不支持题解或评论采集）
5. WHEN 平台不支持某功能时, THE 对应的 fetch 方法 SHALL 返回空结果而非抛出异常
6. THE 各平台适配器 SHALL 独立配置 enabled 开关，未实现或不稳定的适配器可随时关闭

### Requirement 40: 采集成本控制

**User Story:** As a 运维者, I want 采集过程的 AI 调用成本可控, so that 不会因大量采集导致 AI 费用失控。

#### Acceptance Criteria

1. THE 采集后的 AI 加工 SHALL 全部走 SmartRouter 的 batch 池（每分钟限制 10 次 AI 调用）
2. THE 系统 SHALL 支持配置采集后 AI 加工的优先级队列：新增热门题（高赞/高频） > 新增普通题 > 更新已有题
3. WHEN batch 池令牌耗尽时, THE 系统 SHALL 将 AI 加工任务放入 Redis 队列排队等待，不丢弃
4. THE Core_Service SHALL 提供 GET /api/v1/admin/ai/usage 端点，展示 AI 调用统计（按小时/天/平台维度）
5. THE 系统 SHALL 支持配置每日最大 AI 调用预算（次数上限），达到上限后暂停所有 batch 池任务直到次日重置
6. THE 预算配置 SHALL 通过 Nacos 动态管理，可实时调整无需重启


### Requirement 41: 举报 API

**User Story:** As a 学习者, I want 举报不当内容, so that 社区内容质量有保障。

#### Acceptance Criteria

1. THE Core_Service SHALL 复用 Spec 1 R45 定义的 POST /api/v1/report 端点（举报能力由基础设施层统一提供）
2. WHEN 用户题解累计被举报达到阈值（默认 3 次）时, THE Core_Service SHALL 自动将 UserSolution.status 变更为 HIDDEN 并加入审核队列
3. WHEN 评论累计被举报达到阈值时, THE Core_Service SHALL 自动将 Comment.deleted 设为 true 并通知管理员
4. THE 用户端题解列表和评论列表 SHALL 在每条内容右侧展示举报入口（🚩 图标），点击后弹出举报原因选择面板
5. THE 举报功能 SHALL 仅对已认证用户可用，匿名用户无法举报

### Requirement 42: 评论嵌套回复

**User Story:** As a 学习者, I want 回复别人的评论形成对话, so that 讨论更加连贯。

#### Acceptance Criteria

1. THE Comment 实体 SHALL 新增 `parentId`(Long, nullable) 字段，支持一级嵌套回复（即回复的回复不再嵌套，扁平展示）
2. THE POST /api/v1/comments 端点 SHALL 新增可选 `parentId` 参数，指定回复哪条评论
3. THE GET /api/v1/comments 端点 SHALL 支持 `includeReplies=true` 参数，返回时将子回复内嵌到父评论的 `replies[]` 字段中
4. THE Frontend 评论区 SHALL 对有回复的评论展示"回复(N)"展开按钮，点击后展示子评论列表（缩进 + 淡化边框）
5. THE 回复列表 SHALL 按时间升序排列（对话从早到晚阅读更自然）

### Requirement 43: 用户端题解自操作

**User Story:** As a 学习者, I want 编辑和删除自己发布的题解, so that 我能修正错误或移除不想公开的内容。

#### Acceptance Criteria

1. THE 用户题解列表中 SHALL 对属于当前用户的题解展示"✏️ 编辑"和"🗑️ 删除"操作按钮
2. THE "编辑"操作 SHALL 跳转到题解编辑页面（复用提交题解的表单，预填已有内容）
3. THE "删除"操作 SHALL 弹出确认弹窗："确定删除这篇题解？此操作不可恢复。"确认后执行软删除
4. THE 编辑/删除操作 SHALL 仅对 status=DRAFT 或 status=PUBLISHED 的自己题解生效，FEATURED 状态题解不可删除（需联系管理员）
