# Requirements Document

## Introduction

本规格定义"算法深度理解引擎"项目的基础设施层需求。该层为整体产品提供后端服务框架（Java Spring Boot 3）、前端展示框架（Next.js 14）、AI Provider 统一接口、核心数据模型、图解引擎、内容生成服务及 Docker Compose 部署能力。本 spec 聚焦于从零搭建可运行的全栈骨架，使后续业务功能可在此基础上快速迭代。

## Glossary

- **Backend**: Java 17 + Spring Boot 3 后端应用
- **Frontend**: Next.js 14 + TypeScript + TailwindCSS 前端应用
- **AIProvider**: 统一的 AI 服务调用接口，屏蔽底层不同 AI 实现
- **StaticProvider**: 从预生成文件读取内容的 AIProvider 实现，零成本
- **OllamaProvider**: 调用本地 Ollama API 的 AIProvider 实现
- **OpenAIProvider**: 调用 OpenAI/DeepSeek API 的 AIProvider 实现
- **AnthropicProvider**: 调用 Anthropic API 的 AIProvider 实现
- **SmartRouter**: 智能路由层，按缓存→本地模型→云端 AI 顺序分发请求
- **DiagramTypeDecider**: 根据算法类型自动选择图表类型的决策组件
- **MermaidGenerator**: 生成 Mermaid 格式图解代码的组件
- **ContentGenerationService**: 编排完整题目解析生成流程的服务
- **Problem**: 算法题目实体
- **Explanation**: 某级别下的完整解析内容
- **Approach**: 单个解法的详细信息
- **AlgorithmPattern**: 算法模式实体（如滑动窗口、二分搜索等）
- **ProblemRelation**: 题目之间的关联关系
- **Diagram**: 图解实体，包含 Mermaid 代码
- **Level**: 解释级别，取值 1-5

## Requirements

### Requirement 1: 后端项目初始化

**User Story:** As a 开发者, I want 一个完整配置的 Spring Boot 3 后端项目, so that 我可以在此基础上快速开发业务功能。

#### Acceptance Criteria

1. THE Backend SHALL 使用 Java 17 作为编译目标版本，并使用 Maven 作为构建工具
2. THE Backend SHALL 包含 Spring Web、Spring Data JPA、MySQL Driver、Spring Data Redis 依赖
3. WHEN Backend 启动时, THE Backend SHALL 成功连接 MySQL 数据库并完成 JPA 自动建表
4. WHEN Backend 启动时, THE Backend SHALL 成功连接 Redis 实例
5. THE Backend SHALL 提供 GET /actuator/health 端点返回服务健康状态

### Requirement 2: AIProvider 统一接口定义

**User Story:** As a 开发者, I want 一个统一的 AI 服务调用接口, so that 切换不同 AI 实现时无需修改业务代码。

#### Acceptance Criteria

1. THE AIProvider SHALL 定义 generateExplanation 方法，接收题目信息和生成选项，返回解析内容
2. THE AIProvider SHALL 定义 transformUserInput 方法，接收用户输入文本，返回结构化解答
3. THE AIProvider SHALL 定义 generateDiagram 方法，接收算法类型和图表类型，返回 Mermaid 代码
4. THE AIProvider SHALL 定义 interactiveChat 方法，接收上下文和消息，返回对话回复
5. THE AIProvider SHALL 定义 detectErrors 方法，接收内容文本，返回错误检测报告
6. THE AIProvider SHALL 定义 generateLeveledExplanation 方法，接收主题和级别，返回分级内容

### Requirement 3: AIProvider 多实现

**User Story:** As a 开发者, I want 多种 AIProvider 实现可供选择, so that 我可以根据成本和场景灵活使用不同 AI 服务。

#### Acceptance Criteria

1. THE StaticProvider SHALL 从本地预生成 JSON 文件读取内容并返回，不调用任何外部 API
2. THE OllamaProvider SHALL 通过 HTTP 调用本地 Ollama API 生成内容
3. THE OpenAIProvider SHALL 通过 HTTP 调用 OpenAI 兼容 API（支持 OpenAI 和 DeepSeek 端点）生成内容
4. THE AnthropicProvider SHALL 通过 HTTP 调用 Anthropic API 生成内容
5. IF Ollama 服务不可用, THEN THE OllamaProvider SHALL 返回明确的错误信息而非抛出未处理异常
6. IF 云端 API Key 未配置, THEN THE OpenAIProvider SHALL 在启动时记录警告日志并在调用时返回配置缺失错误
7. IF 云端 API Key 未配置, THEN THE AnthropicProvider SHALL 在启动时记录警告日志并在调用时返回配置缺失错误

### Requirement 4: 智能路由层

**User Story:** As a 开发者, I want 请求自动按优先级路由到最经济的 AI 实现, so that 运行成本最低且响应最快。

#### Acceptance Criteria

1. WHEN 内容请求到达时, THE SmartRouter SHALL 先查询 Redis 缓存是否存在已生成内容
2. WHEN 缓存命中时, THE SmartRouter SHALL 直接返回缓存内容，不调用任何 AI Provider
3. WHEN 缓存未命中且本地 Ollama 可用时, THE SmartRouter SHALL 将请求路由到 OllamaProvider
4. WHEN 缓存未命中且本地 Ollama 不可用时, THE SmartRouter SHALL 将请求路由到已配置的云端 Provider
5. WHEN AI Provider 生成内容成功时, THE SmartRouter SHALL 将结果写入 Redis 缓存
6. THE SmartRouter SHALL 通过配置文件允许开发者指定默认 Provider 偏好顺序
7. THE 缓存粒度 SHALL 以"题目ID + 级别"为核心 key，语言切换从同一份缓存内容中按需过滤而非重新生成
8. THE SmartRouter SHALL 实施全局 AI 调用频率控制（双池令牌桶，合计不超过每分钟 30 次）：`realtime` 池（用户实时请求，每分钟 20 次）和 `batch` 池（批量生成，每分钟 10 次），两池独立互不影响，防止批量任务阻塞用户实时请求。双池 20+10=30 即为全局 AI 限流的具体实现，不存在额外的第三层全局限流

### Requirement 5: 核心数据模型

**User Story:** As a 开发者, I want 完善的 JPA 实体和 DTO 定义, so that 数据持久化和 API 传输有清晰的数据结构。

#### Acceptance Criteria

1. THE Backend SHALL 定义 Problem 实体，包含 id、title、difficulty、tags、description、constraints、examples 字段
2. THE Backend SHALL 定义 PlatformMapping 嵌入对象，包含 platform、platformId、url、frequency、companies 字段，关联到 Problem
3. THE Backend SHALL 定义 Explanation 实体，包含 problemId、level（1-5）、sections（JSON 存储，内嵌 Approach 数据）字段
4. THE Approach 数据结构 SHALL 作为 Explanation.sections JSON 的内嵌对象存储（而非独立 JPA 实体），包含 name、idea、code、timeComplexity、spaceComplexity、whyThisWorks、whenToUse、limitations 字段
5. THE Backend SHALL 定义 AlgorithmPattern 实体，包含 id、name、category、template、signals、variants、relatedProblems 字段
6. THE Backend SHALL 定义 ProblemRelation 实体，包含 fromProblemId、toProblemId、type、description、confidence(Float, 0-1) 字段
7. THE Backend SHALL 定义 Diagram 实体，包含 algorithmType、diagramType、mermaidCode 字段
8. THE Backend SHALL 为所有时间字段使用 UTC 毫秒时间戳（Long 类型）

### Requirement 6: 图解引擎

**User Story:** As a 用户, I want 系统根据算法类型自动选择并生成合适的图解, so that 我可以通过可视化更直观地理解算法。

#### Acceptance Criteria

1. THE DiagramTypeDecider SHALL 根据算法类型自动选择图表类型：数组类型选择指针动画图、树类型选择树形图、DP 类型选择表格填充图、图论类型选择节点边图、回溯类型选择决策树图
2. WHEN 算法类型无法识别时, THE DiagramTypeDecider SHALL 默认选择流程图类型
3. THE MermaidGenerator SHALL 接收算法类型、输入数据和图表类型，生成合法的 Mermaid 语法代码
4. THE MermaidGenerator SHALL 生成的 Mermaid 代码可被前端 Mermaid.js 库正确渲染

### Requirement 7: 配置系统

**User Story:** As a 开发者, I want 通过配置文件和环境变量管理 AI Provider 切换和参数设置, so that 无需修改代码即可调整系统行为。

#### Acceptance Criteria

1. THE Backend SHALL 通过 application.yml 配置文件支持选择默认 AI Provider（static、ollama、openai、anthropic）
2. THE Backend SHALL 通过环境变量读取各 Provider 的 API Key（OPENAI_API_KEY、ANTHROPIC_API_KEY）
3. THE Backend SHALL 通过配置文件支持设置生成参数：默认级别、默认语言列表、是否包含图解
4. THE Backend SHALL 通过配置文件支持设置 Ollama 服务地址和模型名称
5. IF 配置文件中指定的 Provider 无法使用, THEN THE Backend SHALL 记录错误日志并回退到 StaticProvider

### Requirement 8: 内容生成服务

**User Story:** As a 开发者, I want 一个统一的内容生成编排服务, so that 可以通过单次调用触发完整的题目解析生成流程。

#### Acceptance Criteria

1. THE ContentGenerationService SHALL 编排完整的单题解析生成流程：获取题目信息→调用 AIProvider 生成解析→生成图解→存储结果
2. THE ContentGenerationService SHALL 支持异步批量生成多题解析，每题独立处理互不阻塞
3. WHEN 批量生成进行中时, THE ContentGenerationService SHALL 提供进度查询能力（已完成数/总数/失败数）
4. IF 单题生成过程中 AI 调用失败, THEN THE ContentGenerationService SHALL 记录失败原因并继续处理下一题
5. WHEN 生成完成时, THE ContentGenerationService SHALL 将结果持久化到数据库和 Redis 缓存
6. THE 批量任务状态（BatchProgress）SHALL 持久化到 Redis（而非仅内存 ConcurrentHashMap），确保应用重启后可恢复未完成任务的进度
7. THE POST /api/v1/problems/{id}/generate 端点 SHALL 支持幂等性：若同一题目同一级别已有 GENERATING 状态的任务在进行中，返回已有 taskId 而非创建新任务

### Requirement 9: REST API

**User Story:** As a 前端开发者, I want 清晰的 REST API 端点, so that 前端可以获取题目、解析、模式等数据并触发内容生成。

#### Acceptance Criteria

1. THE Backend SHALL 提供 GET /api/v1/problems 端点，支持分页、按难度筛选、按标签筛选（多标签默认 AND 语义，支持 `tagMode=or` 参数切换为 OR）、按关键词搜索、按生成状态筛选（已生成/未生成/全部）
2. THE Backend SHALL 提供 GET /api/v1/problems/{id} 端点，返回题目完整信息（含平台映射）
3. THE Backend SHALL 提供 GET /api/v1/problems/{id}/explanation 端点，接受 level 查询参数（1-5），返回指定级别解析
4. THE Backend SHALL 提供 POST /api/v1/problems/{id}/generate 端点，触发指定题目的解析生成任务，返回预估完成时间
5. THE Backend SHALL 提供 GET /api/v1/patterns 端点，返回算法模式列表
6. THE Backend SHALL 提供 GET /api/v1/patterns/{id} 端点，返回模式详情（含关联题目）
7. THE Backend SHALL 提供 POST /api/v1/content/import-url 端点，接收 URL 参数，解析链接内容并导入
8. WHEN 请求的资源不存在时, THE Backend SHALL 返回 HTTP 404 状态码和结构化错误信息
9. WHEN 请求参数校验失败时, THE Backend SHALL 返回 HTTP 400 状态码和具体校验错误描述
10. THE Backend SHALL 对所有 API 统一使用 `/api/v1/` 版本前缀，从项目初始化时即确立
11. THE 单题生成 API SHALL 返回 taskId，前端可通过 GET /api/v1/tasks/{taskId}/status 轮询生成进度，生成超过 60s 未完成返回超时状态
12. THE Backend SHALL 提供 GET /api/v1/problems/{id}/related 端点，基于 ProblemRelation 数据返回关联题目列表（含关系类型和推荐理由），无需复杂推荐算法
13. THE Backend SHALL 提供 GET /api/v1/tasks/{taskId}/stream 端点（SSE Server-Sent Events），实时推送生成进度事件，作为轮询的替代方案

### Requirement 10: 前端项目初始化

**User Story:** As a 前端开发者, I want 一个完整配置的 Next.js 14 前端项目, so that 可以快速开发页面和组件。

#### Acceptance Criteria

1. THE Frontend SHALL 使用 Next.js 14+ App Router、TypeScript 和 TailwindCSS
2. THE Frontend SHALL 包含统一的 API 调用层，封装对 Backend REST API 的 HTTP 请求
3. THE Frontend SHALL 配置环境变量管理（NEXT_PUBLIC_API_BASE_URL 等）

### Requirement 11: 前端基础页面

**User Story:** As a 用户, I want 可浏览题目列表和查看题目详情的页面, so that 我可以选择题目并阅读不同级别的解析。

#### Acceptance Criteria

1. THE Frontend SHALL 提供首页/题目列表页，展示题目标题、难度和标签，支持搜索和筛选
2. THE Frontend SHALL 提供题目详情页，展示解析内容，包含分级切换 UI（L1-L5 标签页切换）
3. WHEN 用户切换级别标签时, THE Frontend SHALL 加载并展示对应级别的解析内容
4. THE Frontend SHALL 提供 Mermaid 图解渲染组件，正确渲染 Backend 返回的 Mermaid 代码
5. THE Frontend SHALL 提供 Markdown 渲染组件，支持代码语法高亮和 KaTeX 数学公式渲染

### Requirement 12: Docker Compose 部署

**User Story:** As a 开发者, I want 一键通过 Docker Compose 启动全部服务, so that 本地开发和部署环境一致且便捷。

#### Acceptance Criteria

1. THE 部署配置 SHALL 包含 Docker Compose 文件，定义 Backend、Frontend、MySQL、Redis 四个服务
2. THE 部署配置 SHALL 通过 .env 文件管理所有敏感配置（数据库密码、AI API Key 等）
3. WHEN 执行 docker-compose up 时, THE 部署配置 SHALL 使所有服务成功启动并互相连通
4. THE 部署配置 SHALL 为 Backend 提供 Dockerfile，基于多阶段构建生成最小化运行镜像
5. THE 部署配置 SHALL 为 Frontend 提供 Dockerfile，构建 Next.js 生产版本镜像
6. THE 部署配置 SHALL 为 MySQL 配置持久化数据卷，避免容器重启丢失数据

### Requirement 13: 用户认证与权限

**User Story:** As a 用户, I want 通过注册登录保存我的学习数据, so that 我在不同设备上都能继续之前的学习进度。

#### Acceptance Criteria

1. THE Backend SHALL 提供用户注册接口 POST /api/v1/auth/register，接收邮箱和密码，返回用户信息
2. THE Backend SHALL 提供用户登录接口 POST /api/v1/auth/login，验证凭证后返回 JWT access token（有效期 24h）和 refresh token（有效期 7d）
3. THE Backend SHALL 提供 token 刷新接口 POST /api/v1/auth/refresh，使用 refresh token 获取新 access token
4. THE Backend SHALL 定义 User 实体，包含 id、email、nickname、passwordHash、role（USER/ADMIN）、createdAt、lastLoginAt
5. THE 认证系统 SHALL 使用 Spring Security + JWT，所有需认证的 API 通过 Authorization Bearer 头携带 token
6. THE Backend SHALL 实行三级权限模型：公开 API（题目列表、题目详情、模式列表）、认证 API（生成触发、收藏、学习记录、交互功能）、管理员 API（批量生成、种子初始化、内容回滚、关联关系管理）
7. WHEN JWT token 过期或无效时, THE Backend SHALL 返回 HTTP 401 状态码
8. THE 密码 SHALL 使用 BCrypt 加密存储，不可逆
9. THE 认证系统 SHALL 同时支持 Cookie 模式（Web 端 httpOnly cookie）和 Bearer Token 模式（移动端/API 客户端），通过请求头自动识别
10. THE Refresh Token SHALL 存储在 Redis 白名单中（key: `auth:refresh:{userId}:{tokenId}`），用户注销或管理员踢出时删除对应 key 使 token 立即失效
11. THE Backend SHALL 提供 POST /api/v1/auth/logout 端点，删除 Redis 中的 refresh token 并清除 httpOnly cookie
12. THE SecurityConfig SHALL 预留 WebSocket 升级握手时的 JWT 校验扩展点（通过 HandshakeInterceptor），为后续 Spec 4 交互功能层做准备

### Requirement 14: API 安全与限流

**User Story:** As a 系统, I want API 具备基本安全防护, so that 防止滥用、攻击和资源浪费。

#### Acceptance Criteria

1. THE Backend SHALL 对公开 API 实施全局限流：单 IP 每分钟最多 60 次请求
2. THE Backend SHALL 对 AI 生成类 API（/generate、/batch）实施严格限流：单用户每分钟最多 5 次
3. THE Backend SHALL 实施全局 AI 调用限流（通过双池令牌桶实现，参见 Req 4.8）：realtime 池 20 次/分钟 + batch 池 10 次/分钟 = 合计每分钟最多 30 次 AI Provider 调用，防止超出第三方 API rate limit
4. THE Backend SHALL 对 URL 导入功能进行 SSRF 防护：禁止访问 IPv4 内网 IP 段（10.x、172.16-31.x、192.168.x、127.x）以及 IPv6 内网地址（::1、fc00::/7、fe80::/10）和非 HTTP/HTTPS 协议
5. THE Backend SHALL 防止 DNS Rebinding 攻击：在实际发起 HTTP 请求时再次验证目标 IP 是否为内网地址
6. THE Backend SHALL 配置 CORS 策略，仅允许指定前端域名跨域访问
7. THE Backend SHALL 对请求体大小进行限制（最大 1MB），防止恶意大报文攻击
8. WHEN 请求触发限流时, THE Backend SHALL 返回 HTTP 429 状态码和重试建议时间（Retry-After header）
9. THE JWT_SECRET 配置 SHALL 要求最小 256 位随机字符串，启动时校验长度不足则拒绝启动

### Requirement 15: 可观测性与监控基础

**User Story:** As a 运维者, I want 系统具备基本的可观测性, so that 我能监控 AI 成本、发现性能瓶颈和排查问题。

#### Acceptance Criteria

1. THE Backend SHALL 记录结构化日志（JSON 格式），包含请求 ID、用户 ID、API 路径、响应时间、AI Provider 名称
2. THE Backend SHALL 统计 AI 调用指标：每个 Provider 的调用次数、成功率、平均响应时间、token 消耗量（如适用）
3. THE Backend SHALL 提供 GET /actuator/metrics 端点，暴露关键业务指标（总题目数、已生成解析数、缓存命中率、AI 调用统计）
4. THE Backend SHALL 对异步批量生成任务记录完成时间、失败率和失败原因分布
5. WHEN AI Provider 调用连续失败超过 3 次时, THE Backend SHALL 发出告警日志（ERROR 级别）

### Requirement 16: 冷启动与初始化引导

**User Story:** As a 首次部署的用户, I want 系统启动后有基础内容可以浏览, so that 不是面对空白页面。

#### Acceptance Criteria

1. THE 系统 SHALL 在首次启动时从 `data/static/` 目录加载种子题目数据（50 题元信息）到数据库（参见 Req 31 详细规范）
2. THE 种子数据 SHALL 包含至少 15 道热门题目的全部 5 个级别（L1-L5）预生成解析内容，其余 35 题包含 L3 级别预生成解析——这些内容打包在项目中，首次启动时导入，不依赖 AI 调用
3. WHEN 用户访问未生成解析的题目时, THE Frontend SHALL 展示"解析尚未生成"提示 + "触发生成"按钮（需认证）
4. THE 系统 SHALL 提供管理员 API `POST /api/v1/admin/seed/generate` 触发剩余题目的 AI 增量生成（需 AI Provider 可用）
5. THE 首页/题目列表 SHALL 默认只展示"已生成解析"的题目，未生成的题目通过专门的筛选条件（"全部/已生成/未生成"）查看
6. THE 系统 SHALL 定义内容就绪标准：至少有 1 个级别解析且 status=PUBLISHED 的题目才对普通用户可见
7. WHEN 用户切换到某题目的某个未生成级别时, THE Frontend SHALL 展示该级别"尚未生成"的空状态 + "触发生成"按钮，已有级别的 Tab 正常标注可用/不可用状态（灰色+锁图标）
8. IF AI Provider 全部不可用, THEN THE 系统 SHALL 仍能正常启动并提供预生成内容的读取服务（降级模式）

### Requirement 17: 用户偏好管理

**User Story:** As a 学习者, I want 系统记住我的学习偏好（默认级别、语言等）, so that 每次访问时自动展示最适合我的内容。

#### Acceptance Criteria

1. THE Backend SHALL 定义 UserPreference 实体，包含 userId、defaultLevel（1-5，默认3）、defaultLanguage（默认"python"）、theme（LIGHT/DARK/SYSTEM）、createdAt、updatedAt
2. THE Backend SHALL 提供 GET /api/v1/users/me/preferences 端点，返回当前用户偏好设置
3. THE Backend SHALL 提供 PUT /api/v1/users/me/preferences 端点，更新用户偏好设置
4. THE Backend SHALL 提供 POST /api/v1/users/me/preferences/merge 端点，接收前端 localStorage 中的偏好数据，与服务端合并（登录时触发）
5. WHEN 用户未设置偏好时, THE Backend SHALL 返回系统默认值（level=3, language=python, theme=SYSTEM）
6. THE merge 接口的合并规则 SHALL 为：服务端已有非默认值的字段优先保留，服务端为默认值的字段用前端传入值覆盖（即"服务端显式设置 > 前端 localStorage > 系统默认"）

### Requirement 18: 公司标签搜索支持

**User Story:** As a 面试准备者, I want 按目标公司筛选题目, so that 我能针对性地准备特定公司的算法面试。

#### Acceptance Criteria

1. THE Problem 实体 SHALL 包含 companyTags 字段（JSON 类型），存储关联公司列表（如 ["Google", "Meta", "Amazon"]）
2. THE GET /api/problems 端点 SHALL 支持 company 查询参数，按公司标签筛选题目
3. THE Backend SHALL 提供 GET /api/companies 端点，返回所有公司标签列表（含各公司关联题目数量）

### Requirement 19: API 版本化

**User Story:** As a 开发者, I want API 有版本化策略, so that 后续迭代不会破坏已有客户端（包括未来的 Flutter App）。

#### Acceptance Criteria

1. THE Backend SHALL 从项目初始化即使用 `/api/v1/` 版本前缀（所有 Controller 的 @RequestMapping 统一加 v1）
2. THE Backend SHALL 在响应头中包含 `API-Version: v1` 标识当前版本
3. WHEN 未来需要破坏性变更时, THE Backend SHALL 创建 `/api/v2/` 新版本，旧版本保持兼容至少 6 个月

### Requirement 20: 内容版本控制

**User Story:** As a 内容管理者, I want 已生成的内容支持版本管理, so that 我能更新错误内容并支持回滚。

#### Acceptance Criteria

1. THE Explanation 实体 SHALL 包含 version 字段（Integer，从1递增）
2. WHEN 同一题目同一级别重新生成解析时, THE Backend SHALL 创建新版本（version+1），保留历史版本
3. THE Backend SHALL 提供 GET /api/v1/problems/{id}/explanation/history 端点，返回版本列表
4. THE Backend SHALL 提供 PUT /api/v1/admin/explanations/{id}/rollback?version={n} 端点，允许管理员回滚到指定版本
5. THE Backend SHALL 默认返回最新版本的解析内容

### Requirement 21: 内容生命周期状态机

**User Story:** As a 内容管理者, I want 清晰的内容状态流转, so that 各阶段的内容展示策略明确且不会暴露低质量内容。

#### Acceptance Criteria

1. THE Explanation 实体 SHALL 包含 status 字段，支持以下状态：GENERATING（生成中）、PENDING_REVIEW（待审核）、PUBLISHED（已发布）、REJECTED（已驳回）、ARCHIVED（已归档）
2. THE 状态流转规则 SHALL 为：GENERATING → PUBLISHED（校验通过）| GENERATING → PENDING_REVIEW（校验有警告）| PENDING_REVIEW → PUBLISHED（管理员批准）| PENDING_REVIEW → REJECTED（管理员驳回）| REJECTED → GENERATING（重新生成）
3. WHEN 内容状态为 PUBLISHED 时, THE Frontend SHALL 正常展示完整解析
4. WHEN 内容状态为 PENDING_REVIEW 时, THE Frontend SHALL 对普通用户展示"内容审核中"提示，管理员可查看完整内容
5. WHEN 内容状态为 GENERATING 时, THE Frontend SHALL 展示生成进度条
6. THE Backend SHALL 提供管理员审核 API：POST /api/v1/admin/explanations/{id}/approve 和 POST /api/v1/admin/explanations/{id}/reject

### Requirement 22: 用户内容反馈

**User Story:** As a 产品, I want 收集用户对生成内容的满意度反馈, so that 可以持续优化内容质量和 prompt。

#### Acceptance Criteria

1. THE Backend SHALL 提供 POST /api/v1/problems/{id}/explanation/feedback 端点，接收评分（1-5）和可选的文字反馈
2. THE Backend SHALL 定义 ContentFeedback 实体，包含 userId、explanationId、rating、comment、createdAt
3. THE Backend SHALL 提供管理员 API GET /api/v1/admin/feedback/stats 返回按题目/级别维度的反馈统计（平均分、反馈数、低分题目列表）
4. WHEN 用户首次完整阅读某题解析后, THE Frontend SHALL 展示"这个解析有帮助吗？"反馈组件（👍👎 + 可选评分）

### Requirement 23: 全文搜索

**User Story:** As a 学习者, I want 通过关键词快速找到相关题目和内容, so that 搜索效率高且结果精准。

#### Acceptance Criteria

1. THE Backend SHALL 使用 MySQL 全文索引（FULLTEXT INDEX + ngram parser）实现题目搜索，支持中英文分词；未来用户量增长后可引入 MeiliSearch 替换
2. THE 搜索范围 SHALL 覆盖题目标题、描述、标签、公司标签
3. WHEN 题目数量超过 200 时, THE Backend SHALL 确保搜索响应时间 < 500ms
4. THE Backend SHALL 为 Problem 表的 title 和 description 字段创建 FULLTEXT 索引（WITH PARSER ngram）

### Requirement 24: 数据备份策略

**User Story:** As a 运维者, I want 系统数据有定期备份, so that 异常情况下可以恢复数据避免内容丢失。

#### Acceptance Criteria

1. THE 部署配置 SHALL 包含 MySQL 自动备份脚本（mysqldump），每日执行一次
2. THE 备份文件 SHALL 保留最近 7 天，每周保留一份存档（保留 4 周）
3. THE Docker Compose 配置 SHALL 将备份文件挂载到宿主机独立目录
4. THE 系统 SHALL 提供管理员 API POST /api/v1/admin/backup/trigger 手动触发备份

### Requirement 25: Docker 卷与持久化完整性

**User Story:** As a 运维者, I want 所有有状态数据和配置文件在容器重启后不丢失, so that 系统可维护性高。

#### Acceptance Criteria

1. THE Docker Compose 配置 SHALL 为 `prompts/` 目录（Prompt 模板文件）配置独立挂载卷，确保热更新的模板在容器重启后保留
2. THE Docker Compose 配置 SHALL 为 `data/static/` 目录（StaticProvider 文件）配置挂载卷
3. THE Docker Compose 配置 SHALL 为 Redis 配置持久化（appendonly yes），避免缓存和任务状态在 Redis 重启后丢失
4. THE .env.example 文件 SHALL 包含所有必要环境变量的说明和示例值，新开发者 clone 后 copy 即可使用

### Requirement 26: 关联题目推荐接口

**User Story:** As a 学习者, I want 学完一题后看到"接下来应该学什么", so that 我有清晰的学习路径而不迷茫。

#### Acceptance Criteria

1. THE Backend SHALL 提供 GET /api/v1/problems/{id}/related 端点，基于 ProblemRelation 数据返回关联题目列表
2. THE 返回结果 SHALL 包含关系类型（prerequisite/variant/similar_pattern/follow_up/harder_version）和简短推荐理由
3. THE 返回列表 SHALL 按推荐优先级排序：follow_up > variant > similar_pattern > harder_version > prerequisite，最多返回 10 条
4. IF 当前题目无关联关系数据, THEN THE 端点 SHALL 返回空列表而非 404，前端展示"暂无推荐"占位

### Requirement 27: 全文搜索中文支持

**User Story:** As a 中文用户, I want 中文关键词搜索能准确匹配题目, so that 搜索体验不因语言而降级。

#### Acceptance Criteria

1. THE Docker Compose MySQL 服务 SHALL 使用 MySQL 8.0+ 官方镜像，内置 ngram 全文解析器支持中文分词
2. IF 全文搜索精度不满足需求, THEN THE Backend SHALL 支持通过配置切换到 MeiliSearch 外部搜索引擎
3. THE Backend SHALL 在 application.yml 中配置搜索策略开关（mysql-fulltext/meilisearch），允许按部署环境选择
4. THE Docker Compose 配置 SHALL 使用 `mysql:8.0` 官方镜像 + `docker/mysql/init.sql` 初始化脚本


### Requirement 28: 用户收藏与学习记录

**User Story:** As a 学习者, I want 收藏题目并追踪我的学习进度, so that 我能有计划地复习已学内容并快速找回感兴趣的题目。

#### Acceptance Criteria

1. THE Backend SHALL 定义 UserBookmark 实体，包含 id(UUID)、userId、problemId、createdAt，复合唯一约束 (userId, problemId)
2. THE Backend SHALL 定义 UserProgress 实体，包含 id(UUID)、userId、problemId、level(Integer)、viewedAt(Long)、timeSpentMs(Long)、completedAt(Long, nullable)
3. THE Backend SHALL 提供 POST /api/v1/users/me/bookmarks/{problemId} 端点，添加收藏
4. THE Backend SHALL 提供 DELETE /api/v1/users/me/bookmarks/{problemId} 端点，取消收藏
5. THE Backend SHALL 提供 GET /api/v1/users/me/bookmarks 端点，返回当前用户的收藏列表（分页）
6. THE Backend SHALL 提供 POST /api/v1/users/me/progress 端点，记录用户浏览某题某级别的学习进度（每次打开详情页时前端调用）
7. THE Backend SHALL 提供 GET /api/v1/users/me/progress 端点，返回用户学习历史（支持按时间范围筛选）
8. THE Backend SHALL 提供 GET /api/v1/users/me/stats 端点，返回学习统计概览（已学题目数、各难度分布、各模式覆盖度、本周学习时长）

### Requirement 29: 匿名用户体验策略

**User Story:** As a 首次访问的匿名用户, I want 无需注册即可浏览高质量内容, so that 我能先体验产品价值再决定是否注册。

#### Acceptance Criteria

1. THE 公开 API SHALL 允许匿名用户浏览题目列表、题目详情、已发布的解析内容（所有级别）、算法模式列表、公司标签列表
2. THE Frontend SHALL 对匿名用户隐藏"触发生成"按钮，仅展示已有内容
3. WHEN 匿名用户点击需认证功能（收藏、费曼模式、面试模拟等）时, THE Frontend SHALL 展示引导注册弹窗，注册成功后自动执行用户之前的操作
4. THE Frontend SHALL 在 localStorage 中为匿名用户保存浏览记录和偏好，注册登录后自动合并到服务端（复用 Req 17.4 merge 接口）
5. THE 系统 SHALL 确保至少 15 道热门题目有完整的 L1-L5 解析内容对匿名用户可见，提供足够的"试用价值"

### Requirement 30: 数据库版本化迁移

**User Story:** As a 开发者, I want 数据库 schema 变更有版本化管理, so that 生产环境的数据库升级安全可控。

#### Acceptance Criteria

1. THE Backend SHALL 集成 Flyway 作为数据库迁移工具
2. THE Backend SHALL 将 JPA ddl-auto 设置为 `validate`（生产环境）或 `none`，所有 schema 变更通过 Flyway 迁移脚本管理
3. THE 迁移脚本 SHALL 存放在 `backend/src/main/resources/db/migration/` 目录，命名规则为 `V{版本号}__{描述}.sql`
4. THE 初始迁移脚本 SHALL 包含所有 JPA 实体对应的建表语句和索引
5. WHEN Backend 启动时, Flyway SHALL 自动检查并执行未应用的迁移脚本
6. THE application.yml SHALL 支持通过配置开关 `spring.flyway.enabled` 在开发环境中关闭 Flyway（使用 ddl-auto=update 快速开发）

### Requirement 31: 冷启动静态内容打包

**User Story:** As a 首次部署的用户, I want 系统自带预生成内容而非首次启动时调用 AI 生成, so that 即使未配置 AI API Key 也能看到完整内容。

#### Acceptance Criteria

1. THE 项目 SHALL 在 `data/static/` 目录中包含 50 道种子题目的预生成解析文件（JSON 格式）
2. THE 预生成内容 SHALL 覆盖 15 道热门题的全部 L1-L5 级别，其余 35 题至少覆盖 L3 级别
3. THE SeedDataLoader SHALL 在首次启动时从 `data/static/` 读取预生成内容并导入数据库（幂等操作）
4. THE SeedDataLoader SHALL 不依赖任何 AI Provider 调用，纯粹从文件系统读取
5. THE 种子数据 SHALL 包含 50 题的完整元信息（标题、难度、标签、描述、约束、示例）和预标注的 ProblemRelation 关联关系（至少覆盖同模式、前置、进阶三种关系），关联关系数据由 AI 辅助生成后人工审核确认
6. IF AI Provider 全部不可用, THEN THE 系统 SHALL 仍能正常启动并提供预生成内容的读取服务

### Requirement 32: Explanation API 按需返回策略

**User Story:** As a 前端开发者, I want API 支持按需返回解析内容的不同部分, so that 避免一次加载过大的 JSON 影响页面性能。

#### Acceptance Criteria

1. THE GET /api/v1/problems/{id}/explanation 端点 SHALL 支持 `fields` 查询参数，可选值包括：summary、approaches、diagrams、code、comparison、applications
2. WHEN `fields` 参数未指定时, THE 端点 SHALL 返回完整内容（向后兼容）
3. WHEN `fields=summary` 时, THE 端点 SHALL 仅返回题目理解、直觉建立和模式标签（轻量预览）
4. WHEN `fields=code` 时, THE 端点 SHALL 返回所有解法的多语言代码部分
5. THE 单条 Explanation JSON 的完整内容 SHALL 控制在 200KB 以内，超出时在 ContentPipeline 生成阶段进行精简

### Requirement 33: AI Prompt Injection 防护

**User Story:** As a 系统, I want 用户输入和外部导入内容不能操控 AI 的行为, so that 系统安全且生成内容质量可控。

#### Acceptance Criteria

1. THE Backend SHALL 在用户输入内容拼接到 AI prompt 前执行 sanitize：移除可能的 prompt injection 标记（如 `<system>`、`<assistant>`、`ignore previous instructions` 等模式）
2. THE ContentImporter SHALL 将外部导入内容作为"引用数据"标记在 prompt 中（使用明确的分隔符和角色标注），而非直接作为指令拼接
3. THE Backend SHALL 对 AI 返回内容进行输出校验：检查是否包含非预期的系统提示泄露
4. THE sanitize 规则 SHALL 可配置（存放在配置文件中），新增防护规则无需修改代码

### Requirement 34: 用户数据生命周期管理

**User Story:** As a 用户, I want 能管理和删除我的个人数据, so that 我的隐私得到保护且符合数据保护法规。

#### Acceptance Criteria

1. THE Backend SHALL 提供 DELETE /api/v1/users/me/data 端点，执行用户数据完全删除（学习记录、收藏、偏好、反馈、会话记录）
2. THE Backend SHALL 提供 GET /api/v1/users/me/data/export 端点，导出用户所有个人数据（JSON 格式）
3. THE 用户删除操作 SHALL 为软删除 + 30 天后硬删除，30 天内用户可撤销
4. THE 系统 SHALL 定义数据保留策略：交互会话记录保留 90 天、学习进度数据永久保留（除非用户主动删除）、日志中的用户 ID 保留 180 天后脱敏

### Requirement 35: 批量生成资源隔离

**User Story:** As a 运维者, I want 批量生成任务不影响普通用户的实时请求, so that 系统在内容生产期间仍能正常服务。

#### Acceptance Criteria

1. THE SmartRouter SHALL 支持两个独立的 AI 调用限流池：`realtime`（用户实时请求，每分钟 20 次）和 `batch`（批量生成，每分钟 10 次）
2. WHEN 批量生成任务运行时, THE `realtime` 限流池 SHALL 不受影响，确保用户实时请求优先
3. THE 批量生成任务 SHALL 支持配置执行时间窗口（如仅在凌晨 2:00-6:00 执行），通过 application.yml 配置
4. THE ContentGenerationService SHALL 在批量生成期间每完成一题后检查系统负载（Redis 队列长度），负载过高时自动降低并发度

### Requirement 36: 通知系统基础

**User Story:** As a 用户, I want 收到生成完成、复习提醒等重要通知, so that 我不会错过关键信息。

#### Acceptance Criteria

1. THE Backend SHALL 定义 Notification 实体，包含 id(UUID)、userId、type(枚举: GENERATION_COMPLETE/REVIEW_REMINDER/SYSTEM_ANNOUNCEMENT)、title、content、read(Boolean)、createdAt
2. THE Backend SHALL 提供 GET /api/v1/users/me/notifications 端点，返回用户通知列表（分页，支持未读筛选）
3. THE Backend SHALL 提供 PUT /api/v1/users/me/notifications/{id}/read 端点，标记通知已读
4. THE Backend SHALL 提供 PUT /api/v1/users/me/notifications/read-all 端点，全部标记已读
5. WHEN 生成任务完成时, THE 系统 SHALL 自动创建 GENERATION_COMPLETE 类型通知
6. THE SSE 端点 GET /api/v1/users/me/notifications/stream SHALL 支持实时推送新通知（复用 SSE 技术）
7. THE UserPreference 实体 SHALL 包含 `notificationSettings` 字段（JSON），存储各通知类型的开关配置（如 `{"REVIEW_REMINDER": false}` 表示关闭复习提醒）
8. THE 通知创建逻辑 SHALL 在发送前检查用户的 notificationSettings，若该类型已关闭则不创建通知

### Requirement 37: 付费层级预留

**User Story:** As a 产品, I want 数据模型预留付费层级字段, so that 后续实现付费功能时无需大幅改表。

#### Acceptance Criteria

1. THE User 实体 SHALL 包含 `tier` 字段（枚举: FREE/PRO/TEAM，默认 FREE），MVP 阶段所有用户均为 FREE，但字段从一开始存在
2. THE SecurityConfig SHALL 预留基于 tier 的权限检查扩展点（MVP 阶段不启用，仅留接口注释）
3. THE API 响应 SHALL 在 User 信息中包含 tier 字段，前端可据此预留 UI 差异化入口（如 Pro 标识）
4. WHEN 后续实现付费功能时, THEN 仅需修改 tier 取值逻辑和权限检查实现，无需数据库迁移

### Requirement 38: 内容格式扩展预留

**User Story:** As a 产品, I want 内容模型支持多媒体格式扩展, so that 未来添加视频/音频解析不需要重构数据结构。

#### Acceptance Criteria

1. THE Explanation.sections JSON 内的每个内容段 SHALL 包含 `contentType` 字段（text/code/diagram/video/audio），MVP 阶段仅使用 text/code/diagram 三种类型
2. THE Frontend 渲染逻辑 SHALL 基于 contentType 分发到不同渲染组件（MVP 阶段 video/audio 类型展示"即将支持"占位）
3. THE contentType 设计 SHALL 确保未来新增类型（如 interactive/quiz）只需扩展枚举值和新建渲染组件，无需修改已有代码

### Requirement 39: 前端安全防护

**User Story:** As a 系统, I want 前端对用户生成内容和外部数据进行安全渲染, so that 不会受到 XSS 攻击。

#### Acceptance Criteria

1. THE Frontend SHALL 对所有用户输入内容（评论、反馈文字、费曼模式历史记录）在渲染前执行 HTML 转义或使用安全渲染库（如 DOMPurify）
2. THE MarkdownRenderer SHALL 使用 react-markdown 的 sanitize 模式（rehype-sanitize），禁止渲染危险 HTML 标签（script/iframe/object/embed）
3. THE Frontend SHALL 对从 API 获取的 Mermaid 代码在渲染前执行基本语法校验，拒绝渲染含可疑标签的代码
4. WHEN AI 生成内容包含可执行 HTML 时, THE Frontend SHALL 自动过滤并记录安全日志

### Requirement 40: 错误恢复与用户引导

**User Story:** As a 用户, I want 系统出错时看到清晰的提示和恢复建议, so that 我不会困惑或焦虑。

#### Acceptance Criteria

1. WHEN AI Provider 全部不可用导致生成失败时, THE Frontend SHALL 展示"AI 服务暂时繁忙，请稍后再试"提示（非技术性错误信息），并提供"查看已有内容"按钮引导用户浏览预生成内容
2. WHEN 网络断开时, THE Frontend SHALL 展示"网络连接已断开"Banner，自动检测恢复后隐藏并刷新数据
3. WHEN 服务端返回 500 时, THE Frontend SHALL 展示统一的错误页面，含"重试"按钮和"反馈问题"链接
4. THE Frontend SHALL 对所有 API 调用实现统一的错误拦截层，根据 HTTP 状态码分类展示对应的用户友好提示（429→"请求过快"、401→"请重新登录"、503→"服务维护中"）

### Requirement 41: 全局搜索面板（⌘K）

**User Story:** As a 学习者, I want 通过键盘快捷键快速唤起全局搜索, so that 我能在任何页面高效跳转到目标内容。

#### Acceptance Criteria

1. THE Frontend SHALL 提供全局搜索面板，通过 ⌘K（Mac）/ Ctrl+K（Windows）快捷键或点击导航栏搜索入口唤起
2. THE 搜索面板 SHALL 以居中模态框形式展示，包含搜索输入框、快捷导航列表（题目列表/算法模式/费曼模式/复习中心）、最近搜索历史（最多5条）
3. WHEN 用户输入搜索关键词时, THE 搜索面板 SHALL 实时展示匹配结果（题目名/模式名/标签），300ms 防抖
4. THE 搜索结果列表 SHALL 支持键盘上下箭头选择、Enter 跳转、ESC 关闭
5. THE 搜索历史 SHALL 存储在 localStorage 中，最近 10 条去重保存
6. WHEN 搜索面板打开时, THE 背景 SHALL 显示半透明遮罩，点击遮罩或按 ESC 关闭面板

### Requirement 42: 第三方 OAuth 登录

**User Story:** As a 用户, I want 通过 GitHub 或 Google 账号一键登录, so that 我不需要记住额外的密码。

#### Acceptance Criteria

1. THE Backend SHALL 支持 GitHub OAuth2 登录流程：跳转 GitHub 授权页 → 回调获取 code → 换取 access_token → 获取用户信息 → 创建/关联本地用户 → 签发 JWT
2. THE Backend SHALL 支持 Google OAuth2 登录流程：同上流程通过 Google OAuth2 API 实现
3. THE Backend SHALL 提供 GET /api/v1/auth/oauth/{provider}/authorize 端点，返回第三方授权 URL（provider: github/google）
4. THE Backend SHALL 提供 GET /api/v1/auth/oauth/{provider}/callback 端点，处理回调并签发 JWT
5. WHEN 第三方用户首次登录时, THE Backend SHALL 自动创建本地 User 记录（email 从第三方获取，nickname 从第三方 profile 获取，passwordHash 为空）
6. WHEN 已有用户通过相同 email 的第三方账号登录时, THE Backend SHALL 自动关联到已有账号而非创建新用户
7. THE OAuth 配置（client_id、client_secret、redirect_uri）SHALL 通过环境变量管理，未配置时前端隐藏对应登录按钮

### Requirement 43: 密码重置流程

**User Story:** As a 用户, I want 忘记密码后能通过邮箱重置, so that 我不会因为忘记密码而无法访问学习数据。

#### Acceptance Criteria

1. THE Backend SHALL 提供 POST /api/v1/auth/forgot-password 端点，接收邮箱参数，发送含重置链接的邮件（链接含一次性 token，有效期 30 分钟）
2. THE Backend SHALL 提供 POST /api/v1/auth/reset-password 端点，接收 token 和新密码，验证 token 有效后更新密码
3. THE 重置 token SHALL 存储在 Redis 中（key: `auth:reset:{token}`，TTL=30min），使用后立即删除确保一次性
4. THE Frontend SHALL 提供忘记密码页面（`/auth/forgot-password`），含邮箱输入 + 发送按钮 + 发送成功提示
5. THE Frontend SHALL 提供重置密码页面（`/auth/reset-password?token=xxx`），含新密码输入 + 确认密码 + 提交按钮
6. WHEN 重置 token 过期或无效时, THE Backend SHALL 返回 HTTP 400 并提示"链接已过期，请重新申请"
7. THE 系统 SHALL 对忘记密码接口限流：同一邮箱每小时最多 3 次请求，防止邮件轰炸

### Requirement 44: 题目分享功能

**User Story:** As a 学习者, I want 一键分享题目解析给朋友, so that 我能推荐好的学习内容给他人。

#### Acceptance Criteria

1. THE 题目详情页 SHALL 提供"分享"按钮，点击后展示分享面板（复制链接 / 生成海报 / 社交分享）
2. THE 分享面板"复制链接"功能 SHALL 将当前页面 URL（含级别参数）复制到剪贴板，并显示"已复制"Toast
3. THE 分享面板"生成海报"功能 SHALL 生成包含题目标题、难度、核心思路摘要的分享图片（PNG），可保存到本地
4. THE 分享 URL SHALL 保留当前级别参数（如 `/problems/two-sum?level=3`），接收者打开后直接看到分享者看到的内容
5. THE 分享功能 SHALL 对匿名用户和登录用户均可用（公开内容不设限制）


### Requirement 45: 内容举报功能

**User Story:** As a 学习者, I want 举报错误或低质量内容, so that 社区内容质量得到维护。

#### Acceptance Criteria

1. THE Backend SHALL 提供 POST /api/v1/report 端点（需认证），接收 targetType（SOLUTION/COMMENT/EXPLANATION）、targetId、reason（枚举：INCORRECT/SPAM/OFFENSIVE/OTHER）、description（可选文字说明）
2. THE Backend SHALL 定义 Report 实体，包含 id(UUID)、userId、targetType、targetId、reason、description、status(PENDING/RESOLVED/DISMISSED)、createdAt
3. THE 系统 SHALL 使用 Redis SET 防止同一用户对同一目标重复举报（key: `report:{targetType}:{targetId}:{userId}`）
4. WHEN 同一目标的举报数达到配置阈值（默认 3）时, THE 系统 SHALL 自动将目标内容标记为 HIDDEN 并通知管理员
5. THE Backend SHALL 提供 GET /api/v1/admin/reports 端点（管理员），返回举报列表（分页，支持按 status/targetType 筛选）
6. THE Backend SHALL 提供 PUT /api/v1/admin/reports/{id}/resolve 端点（管理员），处理举报（确认违规下架 或 驳回举报）

### Requirement 46: 学习水平自测

**User Story:** As a 新用户, I want 通过快速自测了解自己的水平, so that 系统能推荐最适合我的默认级别。

#### Acceptance Criteria

1. THE Backend SHALL 提供 GET /api/v1/level-test/questions 端点（公开），返回 5 道快速判断题（每题含题目描述+4个选项，覆盖 L1-L5 不同水平）
2. THE Backend SHALL 提供 POST /api/v1/level-test/submit 端点（可匿名），接收用户 5 道题的答案，返回推荐默认级别（1-5）和简短说明
3. THE 推荐算法 SHALL 基于答对题目的最高难度级别确定推荐级别：全对 L4-L5 题→推荐 L4，仅对 L2-L3 题→推荐 L3，全错→推荐 L1
4. THE Frontend SHALL 在设置页提供"学习水平自测"入口，完成后自动更新 UserPreference.defaultLevel
5. THE Frontend SHALL 在新用户首次注册后的 Dashboard 中显著展示"⚡ 快速自测推荐你的学习级别"卡片

### Requirement 47: UserPreference 扩展字段

**User Story:** As a 用户, I want 更细粒度地控制界面显示偏好, so that 学习体验完全符合我的习惯。

#### Acceptance Criteria

1. THE UserPreference 实体 SHALL 新增 `showLineNumbers`(Boolean, 默认 false) 字段，控制代码块是否显示行号
2. THE UserPreference 实体 SHALL 新增 `enableAnimations`(Boolean, 默认 true) 字段，控制页面过渡和交互动画开关
3. THE UserPreference 实体 SHALL 新增 `reviewReminderTime`(String, 默认 "09:00") 字段，控制每日复习提醒推送时间
4. THE UserPreference 实体 SHALL 新增 `supportedLanguages`(JSON 数组, 默认 ["python","java","go","cpp"]) 字段，用户可自定义显示哪些代码语言（后续扩展 TypeScript/Rust 时仅需修改此配置）
5. THE Frontend 设置页 SHALL 展示上述所有偏好设置项，含 Toggle 开关和选择器


### Requirement 48: 题目列表收藏筛选支持

**User Story:** As a 学习者, I want 在题目列表页快速筛选出我收藏的题目, so that 我不需要切换到收藏页再一个个找。

#### Acceptance Criteria

1. THE GET /api/v1/problems 端点 SHALL 支持 `bookmarked=true` 查询参数（仅已认证用户有效），返回当前用户已收藏的题目列表
2. WHEN 匿名用户传入 `bookmarked=true` 时, THE 端点 SHALL 忽略该参数并返回全量结果
3. THE 收藏筛选 SHALL 可与其他筛选条件（difficulty、tag、company、keyword）组合使用

### Requirement 49: 阅读位置记录

**User Story:** As a 学习者, I want 系统记住我上次阅读到哪个章节, so that 下次打开时能直接继续阅读。

#### Acceptance Criteria

1. THE UserProgress 实体 SHALL 新增 `lastSection`(String, nullable) 字段，记录用户最后阅读的内容段标题（如"解法对比"、"代码实现"）
2. THE POST /api/v1/users/me/progress 端点 SHALL 接受可选的 `lastSection` 参数
3. THE 首页 Dashboard "继续学习"卡片 SHALL 展示 lastSection 信息（如"上次阅读到「解法对比」部分"）
4. WHEN 用户滚动到新的章节时, THE Frontend SHALL 自动更新 lastSection（防抖 5s，避免频繁请求）

### Requirement 50: 注册时接受昵称参数

**User Story:** As a 新用户, I want 注册时可以设置我的昵称, so that 我的公开身份不是邮箱地址。

#### Acceptance Criteria

1. THE POST /api/v1/auth/register 端点 SHALL 接受可选的 `nickname` 参数（3-20 位字母、数字或中文）
2. WHEN nickname 未提供时, THE 系统 SHALL 自动生成一个随机昵称（如"学习者_7f3a"）
3. THE 用户 SHALL 可以在注册后通过 PUT /api/v1/users/me 修改昵称

### Requirement 51: "记住我"功能

**User Story:** As a 用户, I want 勾选"记住我"后长时间不用重新登录, so that 个人设备上使用更便捷。

#### Acceptance Criteria

1. THE POST /api/v1/auth/login 端点 SHALL 接受可选的 `rememberMe`(Boolean, 默认 false) 参数
2. WHEN rememberMe=true 时, THE Refresh Token TTL SHALL 延长为 30 天（默认 7 天）
3. THE Frontend "记住我"勾选框 SHALL 在用户下次访问登录页时记住上次的勾选状态（localStorage）

### Requirement 52: 密码强度前端校验规则

**User Story:** As a 新用户, I want 注册时看到密码强度提示, so that 我设置的密码足够安全。

#### Acceptance Criteria

1. THE Frontend 注册页 SHALL 展示密码强度指示器（四级进度条），实时反映密码强度
2. THE 密码强度规则 SHALL 为：弱（仅满足≥8位）、中（≥8位+含大小写或数字）、强（≥8位+含大小写+含数字）、极强（≥8位+含大小写+含数字+含特殊字符）
3. THE 系统 SHALL 允许弱密码注册但展示警告提示"建议使用更强的密码"
4. THE 密码强度逻辑 SHALL 纯前端计算，不调用后端 API

### Requirement 53: AlgorithmPattern 难度等级分类

**User Story:** As a 学习者, I want 算法模式按难度分组（入门/进阶/高级）展示, so that 我能循序渐进地学习。

#### Acceptance Criteria

1. THE AlgorithmPattern 实体 SHALL 新增 `difficultyLevel`(枚举: BEGINNER/INTERMEDIATE/ADVANCED) 字段
2. THE GET /api/v1/patterns 端点 SHALL 支持按 `difficultyLevel` 筛选
3. THE Frontend 模式列表页 SHALL 按 difficultyLevel 分组展示（入门绿色/进阶橙色/高级红色标签）
