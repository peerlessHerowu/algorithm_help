# Implementation Plan: 算法深度理解引擎 - 基础设施层

## Overview

本计划将系统基础设施从零搭建为可运行的全栈骨架。按照"后端骨架→数据模型→AI层→业务服务→REST API→前端→部署"的顺序递进实现，每步构建在前一步之上，确保无孤立代码。

> **与 Spec 2（content-generation-engine）的职责边界说明**：
> - 本 Spec 负责搭建 ContentGenerationService 的**框架骨架**：AI 路由调用、异步任务、进度追踪、结果持久化
> - Spec 2 负责填充**具体生成逻辑**：Prompt 模板系统、多级别生成规则、质量校验流水线、解法对比
> - 本 Spec 的 Task 10 实现的是"给定 AI 返回结果后如何存储和编排"，Spec 2 实现的是"如何构造 prompt 让 AI 返回高质量内容"

## Tasks

- [x] 1. 后端项目初始化与基础配置
  - [x] 1.1 创建 Spring Boot 3 Maven 项目骨架
    - 创建 `backend/pom.xml`，配置 Java 17 编译目标
    - 添加依赖：Spring Web、Spring Data JPA、MySQL Driver、Spring Data Redis、Spring Boot Actuator、Lombok
    - 创建 `AlgorithmHelpApplication.java` 启动类
    - 创建基础包结构：config、controller、service、ai、diagram、entity、repository、common
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 配置数据库、Redis 连接与 Actuator
    - 创建 `application.yml`，配置 MySQL 数据源（支持环境变量覆盖）
    - 配置 Spring Data Redis 连接参数
    - 配置 JPA ddl-auto=update 自动建表
    - 启用 Actuator health 端点
    - 创建 `RedisConfig.java` 配置 RedisTemplate 序列化
    - _Requirements: 1.3, 1.4, 1.5_

  - [x] 1.3 创建全局异常处理和统一响应结构
    - 创建 `ApiResponse<T>` 统一响应类（含 code、message、data、timestamp 字段）
    - 创建 `GlobalExceptionHandler`，处理 ResourceNotFoundException → 404、MethodArgumentNotValidException → 400
    - 创建 `ResourceNotFoundException` 和 `AiProviderException` 自定义异常类
    - _Requirements: 9.8, 9.9_


- [x] 2. 配置系统与枚举定义
  - [x] 2.1 创建核心枚举类
    - 创建 `Difficulty` 枚举（EASY、MEDIUM、HARD）
    - 创建 `Level` 枚举或常量（1-5 级别）
    - 创建 `RelationType` 枚举（题目关联类型）
    - 创建 `DiagramType` 枚举（13 种图表类型）
    - _Requirements: 5.1, 6.1_

  - [x] 2.2 创建 AI Provider 配置类
    - 创建 `AiProviderConfig.java`，使用 `@ConfigurationProperties` 绑定 `ai.*` 配置项
    - 包含 default-provider、provider-priority 列表、generation 默认参数
    - 包含 ollama（host、model、timeout）、openai（api-key、base-url、model、timeout）、anthropic（api-key、model、timeout）配置
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 2.3 创建异步任务配置
    - 创建 `AsyncConfig.java`，启用 `@EnableAsync`，配置线程池（用于批量生成）
    - _Requirements: 8.2_

- [x] 3. 核心数据模型（JPA Entities）
  - [x] 3.1 创建 Problem 和 PlatformMapping 实体
    - 创建 `Problem` 实体：id(String PK)、title、difficulty(枚举)、tags(JSON)、description(text)、constraints(JSON)、examples(JSON)、createdAt(Long)、updatedAt(Long)
    - 创建 `PlatformMapping` 实体/嵌入对象：platform、platformId、url、frequency、companies，关联到 Problem
    - 创建 `ProblemRepository` 接口，定义分页查询、按难度筛选、按关键词搜索方法
    - _Requirements: 5.1, 5.2, 5.8_

  - [x] 3.2 创建 Explanation 实体（Approach 内嵌 JSON）
    - 创建 `Explanation` 实体：id(UUID)、problemId、level(Integer)、sections(JSON，内嵌 Approach 数据)、createdAt、updatedAt
    - 添加复合唯一索引 (problemId, level, version)
    - 定义 `Approach` 为 POJO 类（非 JPA 实体），作为 sections JSON 的内嵌结构：name、idea、code、timeComplexity、spaceComplexity、whyThisWorks、whenToUse、limitations
    - 创建 `ExplanationRepository` 接口
    - _Requirements: 5.3, 5.4, 5.8_

  - [x] 3.3 创建 AlgorithmPattern、ProblemRelation、Diagram 实体
    - 创建 `AlgorithmPattern` 实体：id(String PK)、name、category、template(JSON)、signals(JSON)、variants(JSON)、relatedProblems(JSON)、createdAt、updatedAt
    - 创建 `ProblemRelation` 实体：id、fromProblemId、toProblemId、type(枚举)、description、confidence(Float, 默认1.0)
    - 创建 `Diagram` 实体：id、algorithmType、diagramType、mermaidCode(text)、createdAt
    - 创建 `PatternRepository` 和 `ProblemRelationRepository` 接口
    - ProblemRelationRepository 新增按 fromProblemId 查询方法（用于关联推荐 API）
    - _Requirements: 5.5, 5.6, 5.7, 5.8, 26.1_


- [x] 4. Checkpoint - 后端骨架验证
  - 确保项目编译通过，JPA 实体映射正确，Application 可启动连接数据库。如有问题请向用户提问。

- [x] 5. AIProvider 接口与模型定义
  - [x] 5.1 定义 AIProvider 接口和请求/响应模型
    - 创建 `AIProvider` 接口，定义 6 个核心方法：generateExplanation、transformUserInput、generateDiagram、interactiveChat、detectErrors、generateLeveledExplanation
    - 添加 `isAvailable()` 和 `getName()` 辅助方法
    - 创建 `AiRequest` 模型（含请求类型、题目信息、选项等）
    - 创建 `AiResponse` 模型（含内容、元数据、耗时等）
    - 创建 `GenerateOptions` 模型（level、languages、includeSteps、includeDiagrams、includeApplications）
    - 创建 `ChatMessage` 模型（role、content）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 5.2 实现 StaticProvider
    - 创建 `StaticProvider` 实现类，从 `data/static/` 目录读取预生成 JSON 文件
    - 文件命名规则：`{problemId}-L{level}.json`
    - 实现所有接口方法，无外部 API 调用
    - isAvailable() 始终返回 true
    - _Requirements: 3.1_

  - [x] 5.3 实现 OllamaProvider
    - 创建 `OllamaProvider` 实现类，使用 Spring WebClient 调用本地 Ollama API
    - POST 到 `http://{host}:11434/api/chat`
    - isAvailable() 通过 GET /api/tags 检测连通性
    - Ollama 不可用时返回明确错误信息（AiProviderException），不抛未处理异常
    - 配置超时和错误处理
    - _Requirements: 3.2, 3.5_

  - [x] 5.4 实现 OpenAIProvider
    - 创建 `OpenAIProvider` 实现类，使用 WebClient 调用 OpenAI 兼容 API
    - POST 到 `{baseUrl}/v1/chat/completions`，支持 OpenAI 和 DeepSeek 端点
    - 启动时检查 API Key 配置，未配置记录 WARN 日志
    - 调用时若 Key 缺失返回配置缺失错误
    - 配置超时和重试机制
    - _Requirements: 3.3, 3.6_

  - [x] 5.5 实现 AnthropicProvider
    - 创建 `AnthropicProvider` 实现类，使用 WebClient 调用 Anthropic API
    - POST 到 `https://api.anthropic.com/v1/messages`
    - 启动时检查 API Key 配置，未配置记录 WARN 日志
    - 调用时若 Key 缺失返回配置缺失错误
    - 配置超时和重试机制
    - _Requirements: 3.4, 3.7_


- [x] 6. SmartRouter 智能路由层
  - [x] 6.1 实现 SmartRouter 路由逻辑
    - 创建 `SmartRouter` 服务类
    - 实现三层路由：① Redis 缓存检查 → ② 按优先级遍历可用 Provider → ③ 成功后写入 Redis 缓存
    - 缓存 Key 格式：`ai:explanation:{problemId}:L{level}`（以题目+级别为核心粒度，语言从同一份内容中过滤）
    - 缓存 TTL：24 小时
    - 所有 Provider 失败时抛出 AiProviderException
    - 通过配置文件读取 Provider 优先级顺序
    - 实现全局 AI 调用频率控制：使用 Redis 双池令牌桶（realtime 池 20次/分钟 + batch 池 10次/分钟 = 合计30次/分钟），超出时排队等待而非直接失败
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x]* 6.2 编写 SmartRouter 单元测试
    - 测试缓存命中直接返回
    - 测试缓存未命中时按优先级路由
    - 测试 Provider 失败时自动切换下一个
    - 测试所有 Provider 不可用时抛异常
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 7. 图解引擎
  - [x] 7.1 实现 DiagramTypeDecider 决策器
    - 创建 `DiagramTypeDecider` 组件
    - 实现算法类型到图表类型的映射规则（array→指针动画、tree→树形图、dp→表格填充、graph→节点边图、backtracking→决策树等）
    - 无法识别的类型默认返回 FLOWCHART
    - _Requirements: 6.1, 6.2_

  - [x] 7.2 实现 MermaidGenerator 生成器
    - 创建 `MermaidGenerator` 组件
    - 实现模板生成逻辑（简单场景用预定义模板 + 数据填充）
    - 复杂场景回退到调用 AIProvider.generateDiagram
    - 确保生成的 Mermaid 代码语法合法
    - _Requirements: 6.3, 6.4_

  - [x] 7.3 创建 DiagramService 编排层
    - 创建 `DiagramService`，组合 DiagramTypeDecider + MermaidGenerator
    - 提供 `generateForProblem(Problem)` 方法，自动决策图表类型并生成 Mermaid 代码
    - _Requirements: 6.1, 6.3_


- [x] 8. 配置系统完善与 Provider 回退
  - [x] 8.1 实现 Provider 自动注册与回退机制
    - 在 `AiProviderConfig` 中根据配置创建并注册各 Provider Bean
    - 实现 Provider 不可用时回退到 StaticProvider 逻辑
    - 启动时记录错误日志提示回退
    - _Requirements: 7.5_

- [x] 9. Checkpoint - AI 层与图解引擎验证
  - 确保 SmartRouter 路由逻辑正确，StaticProvider 可正常读取文件返回内容，DiagramTypeDecider 决策正确。如有问题请向用户提问。

- [x] 10. 内容生成服务
  - [x] 10.1 实现 ContentGenerationService 单题生成
    - 创建 `ContentGenerationService`
    - 实现 `generateForProblem(problemId, options)` 方法
    - 编排流程：获取题目 → 调用 SmartRouter 生成解析 → 生成图解 → 存储到数据库 + Redis 缓存
    - 题目不存在时抛出 ResourceNotFoundException
    - _Requirements: 8.1, 8.5_

  - [x] 10.2 实现异步批量生成与进度追踪
    - 实现 `batchGenerate(batchId, problemIds, options)` 方法，标注 @Async
    - 创建 `BatchProgress` 模型（total、completed、failed、failures 列表）
    - 使用 Redis 存储批量任务状态（key: `batch:progress:{batchId}`），确保应用重启后可恢复
    - 单题失败时记录失败原因并继续处理下一题，每题完成后更新 Redis 进度
    - 实现 `getProgress(batchId)` 进度查询方法
    - 实现幂等性检查：`findActiveTask(problemId, level)` 查询是否已有进行中任务
    - _Requirements: 8.2, 8.3, 8.4, 8.6, 8.7_

- [x] 11. REST API Controllers
  - [x] 11.1 实现 ProblemController
    - GET /api/v1/problems：分页列表，支持 difficulty、tag（多标签 AND，支持 tagMode=or）、company、keyword、status(GENERATED/NOT_GENERATED/ALL) 筛选参数
    - GET /api/v1/problems/{id}：返回题目完整信息（含平台映射）
    - GET /api/v1/problems/{id}/explanation：接受 level 参数（默认3），返回指定级别解析（仅 PUBLISHED 状态）
    - GET /api/v1/problems/{id}/related：基于 ProblemRelation 返回关联题目列表（含关系类型和推荐理由，按优先级排序，最多10条）
    - POST /api/v1/problems/{id}/generate：触发解析生成任务（幂等：已有进行中任务返回已有 taskId），返回 taskId 和预估完成时间
    - GET /api/v1/tasks/{taskId}/status：查询生成任务进度
    - GET /api/v1/tasks/{taskId}/stream：SSE 实时推送生成进度事件（替代轮询）
    - 创建 `ProblemDTO`、`ExplanationDTO`、`GenerateRequest`、`TaskStatusDTO`、`RelatedProblemDTO` DTO 类
    - 所有 Controller 从一开始即使用 `/api/v1/` 前缀
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.8, 9.9, 9.10, 9.11, 9.12, 9.13, 19.1_

  - [x] 11.2 实现 PatternController 和 ContentController
    - GET /api/v1/patterns：返回算法模式列表
    - GET /api/v1/patterns/{id}：返回模式详情（含关联题目）
    - POST /api/v1/content/import-url：接收 URL 参数，解析链接内容并导入
    - 创建 `PatternDTO`、`ImportUrlRequest`、`ImportResult` DTO 类
    - _Requirements: 9.5, 9.6, 9.7_

  - [x] 11.3 实现 ProblemService 和 PatternService 业务逻辑
    - 创建 `ProblemService`：封装题目 CRUD、分页查询、按条件筛选逻辑
    - 创建 `PatternService`：封装模式查询逻辑
    - 创建 `ImportService`：URL 内容解析导入（预留实现骨架）
    - _Requirements: 9.1, 9.2, 9.5, 9.6, 9.7_

  - [x] 11.4 实现 API 版本响应头拦截器
    - 创建 `ApiVersionFilter`：自动在所有响应头添加 `API-Version: v1`
    - _Requirements: 19.2_


- [x] 12. Checkpoint - 后端 API 完整性验证
  - 确保所有 REST API 端点可正常访问，请求参数校验生效，错误响应格式正确。如有问题请向用户提问。

- [x] 13. 前端项目初始化
  - [x] 13.1 创建 Next.js 14 项目骨架
    - 使用 App Router 创建 `frontend/` 项目
    - 配置 TypeScript + TailwindCSS
    - 创建 `next.config.js` 和 `tailwind.config.ts`
    - 配置环境变量：`NEXT_PUBLIC_API_BASE_URL`
    - _Requirements: 10.1, 10.3_

  - [x] 13.2 创建 API 调用层和类型定义
    - 创建 `lib/api.ts`：封装 problems、patterns、content 三组 API 调用方法
    - 创建 `lib/types.ts`：定义 Problem、Explanation、Pattern、ApiResponse 等 TypeScript 类型
    - 封装统一的 fetch 错误处理逻辑（含 HTTP 状态码分类提示：429→"请求过快"、401→"请重新登录"、503→"服务繁忙"）
    - 安装 DOMPurify 依赖，创建 `lib/sanitize.ts` HTML 安全过滤工具
    - _Requirements: 10.2, 39.1, 40.4_

  - [x] 13.3 安装状态管理与数据缓存依赖
    - 安装 zustand + SWR (或 React Query) 依赖
    - 创建 `store/index.ts`：定义基础 store 骨架（认证状态、当前级别偏好）
    - 创建 `lib/fetcher.ts`：封装 SWR 全局 fetcher 配置（含错误拦截、401 自动跳转登录、网络断开提示）
    - _Requirements: 前端状态管理骨架，为 Spec 3 做准备_

- [x] 14. 前端基础页面与组件
  - [x] 14.1 创建题目列表页
    - 创建 `app/page.tsx` 首页/题目列表页
    - 展示题目标题、难度标签、分类标签
    - 实现搜索输入框和难度筛选下拉框
    - 创建 `ProblemCard` 和 `SearchFilter` 组件
    - _Requirements: 11.1_

  - [x] 14.2 创建题目详情页（含分级切换）
    - 创建 `app/problems/[id]/page.tsx` 详情页
    - 创建 `LevelTabs` 组件，实现 L1-L5 标签页切换
    - 切换标签时调用 API 加载对应级别解析内容
    - _Requirements: 11.2, 11.3_

  - [x] 14.3 创建 Mermaid 渲染组件
    - 创建 `components/MermaidRenderer.tsx`
    - 集成 `mermaid` 库，接收 Mermaid 代码字符串渲染为 SVG
    - 渲染前执行安全校验：拒绝含 `<script>`/`<iframe>`/`javascript:` 等可疑标签的代码
    - 处理渲染错误，显示友好错误提示
    - _Requirements: 11.4, 39.3_

  - [x] 14.4 创建 Markdown 渲染组件
    - 创建 `components/MarkdownRenderer.tsx`
    - 集成 `react-markdown` + `rehype-highlight`（代码语法高亮）+ `rehype-katex`（数学公式）+ `rehype-sanitize`（XSS 防护）
    - 创建 `CodeBlock` 组件支持多语言 Tab 切换
    - _Requirements: 11.5, 39.2_


- [x] 15. Checkpoint - 前端功能验证
  - 确保前端项目编译通过，页面路由正常，组件渲染无报错。如有问题请向用户提问。

- [x] 16. Docker Compose 部署配置
  - [x] 16.1 创建 Backend Dockerfile
    - 创建 `backend/Dockerfile`，使用多阶段构建
    - Stage 1: `maven:3.9-eclipse-temurin-17` 编译打包
    - Stage 2: `eclipse-temurin:17-jre-alpine` 最小化运行镜像
    - _Requirements: 12.4_

  - [x] 16.2 创建 Frontend Dockerfile
    - 创建 `frontend/Dockerfile`，多阶段构建 Next.js 生产版本
    - Stage 1: 安装依赖 + build
    - Stage 2: 基于 `node:18-alpine` 运行 standalone 输出
    - _Requirements: 12.5_

  - [x] 16.3 创建 Docker Compose 编排文件
    - 创建 `docker-compose.yml`，定义 backend、frontend、mysql、redis、backup 五个服务
    - 配置服务依赖关系（backend depends_on mysql+redis，frontend depends_on backend）
    - 配置 MySQL 8.0 官方镜像，启用 ngram 全文解析器
    - 配置 MySQL 持久化数据卷 `mysqldata`
    - 配置 Redis 持久化（appendonly yes）+ 数据卷 `redisdata`
    - 配置 Backend 卷挂载：`./prompts:/app/prompts`（Prompt 模板热更新）、`./data/static:/app/data/static`（StaticProvider 文件）
    - 配置环境变量注入（数据库连接、Redis、AI API Key、Ollama Host、JWT_SECRET）
    - 创建 `.env.example` 示例环境变量文件（含所有必要变量说明和示例值）
    - 创建 `docker/mysql/init.sql`（建库 + 字符集 utf8mb4 + ngram 全文索引配置）
    - _Requirements: 12.1, 12.2, 12.3, 12.6, 25.1, 25.2, 25.3, 25.4, 27.4_

- [x] 17. Final Checkpoint - 全栈集成验证
  - 确保 docker-compose up 可正常构建并启动所有服务，前后端连通，API 可访问。如有问题请向用户提问。

- [x] 18. 用户认证系统
  - [x] 18.1 创建 User 实体和认证基础
    - 创建 `User` JPA 实体：id(UUID)、email(unique)、nickname、passwordHash、role(USER/ADMIN)、tier(FREE/PRO/TEAM, 默认FREE)、createdAt、lastLoginAt
    - 创建 `UserRepository` 接口
    - 创建 `Role` 枚举（USER、ADMIN）
    - 创建 `Tier` 枚举（FREE、PRO、TEAM）— MVP 阶段所有用户均为 FREE
    - 添加 Spring Security + jjwt 依赖到 pom.xml
    - _Requirements: 13.4, 37.1_

  - [x] 18.2 实现 JWT 工具类与安全配置
    - 创建 `JwtUtils` 组件：generateAccessToken（24h）、generateRefreshToken（7d）、validateAndGetUserId
    - 启动时校验 JWT_SECRET 长度≥32字符（256位），不足时拒绝启动
    - 创建 `RefreshTokenService`：存储/验证/撤销 Refresh Token（Redis 白名单，key: `auth:refresh:{userId}:{tokenId}`）
    - 创建 `SecurityConfig.java`：配置 SecurityFilterChain，实现三级权限模型
    - 创建 `JwtAuthenticationFilter`：同时支持 Authorization Bearer 头和 httpOnly cookie 两种认证方式
    - 创建 `WebSocketSecurityConfig.java` 空壳类：预留 HandshakeInterceptor 扩展点（为 Spec 4 准备）
    - 公开 API：GET /api/v1/problems/**、GET /api/v1/patterns/**、GET /api/v1/companies、POST /api/v1/auth/**、GET /actuator/health
    - 认证 API（USER+ADMIN）：POST /api/v1/problems/*/generate、/api/v1/users/me/**、/api/v1/problems/*/feedback
    - 管理员 API（ADMIN only）：/api/v1/admin/**、POST /api/v1/batch/**、POST /api/v1/seed/**
    - _Requirements: 13.5, 13.6, 13.7, 13.9, 13.10, 13.11, 13.12, 14.9_

  - [x] 18.3 实现认证 Controller
    - 创建 `AuthController`（路由前缀 /api/v1/auth）
    - POST /api/v1/auth/register：参数校验（邮箱格式、密码长度≥8）→ BCrypt 加密密码 → 存储 → 返回用户信息
    - POST /api/v1/auth/login：验证邮箱密码 → 生成 accessToken + refreshToken → 存储 refreshToken 到 Redis 白名单 → 更新 lastLoginAt → 同时设置 httpOnly cookie 和返回 JSON body（兼容 Web 和 Mobile）
    - POST /api/v1/auth/refresh：验证 refreshToken 签名 + 检查 Redis 白名单 → 生成新 accessToken
    - POST /api/v1/auth/logout：删除 Redis 中对应 refreshToken + 清除 httpOnly cookie
    - GET /api/v1/auth/me：返回当前用户信息
    - 创建 `RegisterRequest`、`LoginRequest`、`AuthResponse` DTO
    - _Requirements: 13.1, 13.2, 13.3, 13.8, 13.10, 13.11_

- [x] 19. API 安全与限流
  - [x] 19.1 实现 Redis 滑动窗口限流
    - 创建 `RateLimitFilter` (OncePerRequestFilter)
    - 公开 API 限流：单 IP 每分钟 60 次
    - AI 生成类 API 限流：单用户每分钟 5 次
    - 全局 AI 调用限流：通过双池令牌桶实现（realtime 20次/分钟 + batch 10次/分钟 = 合计30次/分钟），复用 Task 6.1 中的 DualPoolRateLimiter
    - 超限返回 HTTP 429 + Retry-After header
    - Redis Key 格式：`rate_limit:{ip|userId}:{endpoint_group}`
    - _Requirements: 14.1, 14.2, 14.3, 14.8_

  - [x] 19.2 实现 SSRF 防护与 CORS 配置
    - 创建 `UrlValidator` 组件：校验 URL 协议（仅 HTTP/HTTPS）+ 解析目标 IP + 拦截 IPv4 内网地址段 + 拦截 IPv6 内网地址（::1、fc00::/7、fe80::/10）
    - 实现 DNS Rebinding 防护：使用自定义 DNS resolver 固定 IP，在连接时再次验证目标 IP
    - 在 ImportService 和 ContentImportService 中调用 UrlValidator
    - 在 SecurityConfig 中配置 CORS：allowedOrigins 从配置文件读取
    - 配置请求体大小限制（1MB）
    - _Requirements: 14.4, 14.5, 14.6, 14.7_

  - [x] 19.3 实现 JWT Secret 安全校验
    - 启动时检查 JWT_SECRET 环境变量长度≥32字符
    - 长度不足时记录 FATAL 日志并阻止应用启动
    - _Requirements: 14.9_

- [x] 20. 可观测性基础
  - [x] 20.1 实现结构化日志与 AI 调用指标
    - 配置 logback-spring.xml：JSON 格式输出，包含 requestId、userId、path、duration
    - 创建 `RequestIdFilter`：为每个请求生成 traceId 写入 MDC
    - 创建 `AiMetricsCollector` 组件：记录 AI 调用次数/成功率/耗时/缓存命中率
    - 在 SmartRouter 中集成指标收集
    - _Requirements: 15.1, 15.2, 15.5_

  - [x] 20.2 暴露业务指标端点
    - 添加 Micrometer 依赖
    - 暴露 /actuator/metrics 端点
    - 注册自定义指标：总题目数、已生成解析数、缓存命中率、批量生成完成率
    - _Requirements: 15.3, 15.4_

- [x] 21. 冷启动与初始化引导
  - [x] 21.1 实现种子数据自动加载与预生成
    - 在 `SeedDataLoader` 中增加 @PostConstruct 自动加载 50 题元信息（幂等）
    - 创建管理员 API POST /api/v1/admin/seed/generate：触发 15 道热门题的全部 5 级别（L1-L5）预生成 + 其余 35 题 L3 级别预生成
    - 确保首次启动后浏览器打开不是空页面，用户切换级别也有内容展示
    - 实现内容就绪判断逻辑：至少有 1 个级别解析且 status=PUBLISHED 的题目才在默认列表可见
    - GET /api/v1/problems 默认 status 参数为 GENERATED，即只展示已有解析的题目
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7_

- [x] 22. Final Checkpoint - 安全与完整性验证
  - 确保认证流程（注册→登录→携带token访问→token过期401）正确，限流生效，SSRF 防护拦截内网 URL。如有问题请向用户提问。

- [x] 23. 用户偏好管理
  - [x] 23.1 创建 UserPreference 实体和 API
    - 创建 `UserPreference` JPA 实体：userId(PK)、defaultLevel(Integer, 默认3)、defaultLanguage(String, 默认"python")、theme(枚举 LIGHT/DARK/SYSTEM)、notificationSettings(JSON, 各通知类型开关)、createdAt、updatedAt
    - 创建 `UserPreferenceRepository` 接口
    - 创建 `ThemePreference` 枚举
    - 创建 `UserPreferenceController`：GET /api/v1/users/me/preferences、PUT /api/v1/users/me/preferences、POST /api/v1/users/me/preferences/merge
    - 创建 `UserPreferenceService`：查询、更新、合并逻辑
    - 合并规则实现：服务端已有非默认值的字段保留不覆盖，服务端为默认值的字段用前端传入值覆盖
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 36.7_

- [x] 24. 公司标签搜索与全文搜索
  - [x] 24.1 增加公司标签字段和查询支持
    - Problem 实体新增 `companyTags` 字段（JSON）
    - ProblemRepository 新增按公司标签筛选的查询方法
    - ProblemController GET /api/v1/problems 新增 `company` 查询参数
    - 创建 GET /api/v1/companies 端点，返回公司标签列表及关联题目数量
    - _Requirements: 18.1, 18.2, 18.3_

  - [x] 24.2 实现 MySQL 全文搜索
    - 为 Problem 表的 title 和 description 字段创建 FULLTEXT 索引（WITH PARSER ngram）
    - 实现搜索策略开关（`search.strategy` 配置项）：
      - `mysql-fulltext` 模式：基于 MySQL FULLTEXT INDEX + ngram parser 的全文搜索
      - `meilisearch` 模式（可选升级）：基于 MeiliSearch 外部搜索引擎（内置中文分词）
    - ProblemRepository 新增搜索方法，根据配置自动选择搜索实现
    - 确保 200+ 题目时搜索响应 < 500ms
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 27.1, 27.2, 27.3_

- [x] 25. 内容版本控制与状态机
  - [x] 25.1 实现 Explanation 版本管理与内容状态机
    - Explanation 实体新增 `version`(Integer, 默认1)、`isLatest`(Boolean, 默认true)、`status`(枚举: GENERATING/PENDING_REVIEW/PUBLISHED/REJECTED/ARCHIVED) 字段
    - 创建 `ExplanationStatus` 枚举
    - ContentGenerationService 生成新版本时：旧版本 isLatest=false，新记录 version+1, isLatest=true
    - 质量校验通过 → status=PUBLISHED；校验有警告 → status=PENDING_REVIEW；校验失败 → status=REJECTED
    - ExplanationRepository 默认查询增加 `isLatest=true AND status=PUBLISHED` 过滤
    - 创建 GET /api/v1/problems/{id}/explanation/history 端点：返回该题所有版本列表
    - 创建 PUT /api/v1/admin/explanations/{id}/rollback?version={n} 端点：管理员回滚
    - 创建 POST /api/v1/admin/explanations/{id}/approve 端点：管理员批准待审核内容
    - 创建 POST /api/v1/admin/explanations/{id}/reject 端点：管理员驳回内容
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 21.1, 21.2, 21.3, 21.4, 21.5, 21.6_

- [x] 26. 用户内容反馈
  - [x] 26.1 创建 ContentFeedback 实体和 API
    - 创建 `ContentFeedback` JPA 实体：id(UUID)、userId、explanationId、rating(Integer 1-5)、comment(String, nullable)、createdAt
    - 创建 `ContentFeedbackRepository` 接口
    - 创建 POST /api/v1/problems/{id}/explanation/feedback 端点（认证用户）
    - 创建 GET /api/v1/admin/feedback/stats 端点：返回按题目/级别的反馈统计
    - _Requirements: 22.1, 22.2, 22.3_

- [x] 27. 数据备份配置
  - [x] 27.1 创建 MySQL 自动备份配置
    - 创建 `backup/backup.sh` 脚本：执行 mysqldump 并压缩
    - Docker Compose 新增 backup 服务（基于 alpine + cron），每日凌晨 3 点执行备份
    - 配置备份保留策略：每日备份保留 7 天，每周备份保留 4 周
    - 备份文件挂载到宿主机 `./backups/` 目录
    - 创建管理员 API POST /api/v1/admin/backup/trigger 手动触发备份
    - _Requirements: 24.1, 24.2, 24.3, 24.4_

- [x] 28. Final Checkpoint - 完整功能验证
  - 确保用户偏好 CRUD 正常、公司标签筛选生效、内容版本管理（生成新版本/查询历史/回滚）工作正确、内容状态机流转正常、反馈功能可用、备份脚本执行成功。如有问题请向用户提问。

- [x] 29. 关联推荐与 SSE 端点
  - [x] 29.1 实现关联题目推荐 Service
    - 创建 `RelatedProblemService`：根据 ProblemRelation 查询关联题目
    - 实现推荐排序逻辑：follow_up > variant > similar_pattern > harder_version > prerequisite，最多返回 10 条
    - 无关联数据时返回空列表
    - 创建 `RelatedProblemDTO`（含 problemId、title、difficulty、relationType、reason）
    - _Requirements: 26.1, 26.2, 26.3, 26.4_

  - [x] 29.2 实现 SSE 进度推送端点
    - 创建 `TaskStreamController`：GET /api/v1/tasks/{taskId}/stream（produces text/event-stream）
    - 使用 Spring SseEmitter 实现，超时时间 120s
    - 每 2 秒检查 Redis 中任务进度变化，推送进度事件（JSON 格式：{completed, total, failed, currentStep}）
    - 任务完成或失败时发送终止事件并关闭连接
    - _Requirements: 9.13_

- [x] 30. Checkpoint - 推荐与实时推送验证
  - 确保关联推荐 API 正常返回数据、SSE 端点可正常建立连接并接收进度事件。如有问题请向用户提问。

- [x] 31. 用户收藏与学习记录
  - [x] 31.1 创建 UserBookmark 和 UserProgress 实体与 API
    - 创建 `UserBookmark` JPA 实体：id(UUID)、userId、problemId、createdAt，复合唯一约束 (userId, problemId)
    - 创建 `UserProgress` JPA 实体：id(UUID)、userId、problemId、level、viewedAt、timeSpentMs、completedAt(nullable)
    - 创建 `UserBookmarkRepository` 和 `UserProgressRepository` 接口
    - 创建 `UserLearningController`：POST/DELETE /bookmarks/{problemId}、GET /bookmarks、POST /progress、GET /progress、GET /stats
    - 创建 `UserLearningService`：收藏 CRUD、进度记录、统计计算（已学题目数、难度分布、模式覆盖度、本周学习时长）
    - _Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6, 28.7, 28.8_

- [x] 32. 数据库迁移工具集成
  - [x] 32.1 配置 Flyway 并创建初始迁移脚本
    - 添加 Flyway 依赖到 pom.xml
    - 创建 `backend/src/main/resources/db/migration/` 目录
    - 编写初始迁移脚本 V1-V9（所有实体建表 + 索引）
    - 配置 application.yml：生产环境 ddl-auto=validate + flyway.enabled=true，开发环境可通过环境变量切换为 ddl-auto=update + flyway.enabled=false
    - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6_

- [x] 33. 冷启动静态内容打包
  - [x] 33.1 创建种子数据目录结构和 SeedDataLoader 改造
    - 创建 `data/static/problems/` 目录，编写 50 题元信息 JSON 文件
    - 创建 `data/static/explanations/` 目录，放入预生成解析文件（15 题 L1-L5 + 35 题 L3）
    - 创建 `data/static/relations/problem-relations.json`，预标注关联关系（AI 辅助生成 + 人工审核）
    - 改造 SeedDataLoader：从文件系统读取并导入数据库（幂等），不依赖 AI Provider
    - 确保 AI Provider 全部不可用时系统可正常启动和提供读取服务
    - _Requirements: 31.1, 31.2, 31.3, 31.4, 31.5, 31.6_

- [x] 34. Prompt Injection 防护
  - [x] 34.1 实现 PromptSanitizer 组件
    - 创建 `PromptSanitizer` 组件，从配置加载 blocked patterns
    - 实现 sanitize() 方法：移除/替换 prompt injection 标记
    - 在 FeynmanSession、ContentImporter、InterviewSimulator 等用户输入处集成 sanitizer
    - 设计外部导入内容的 prompt 模板：使用 BEGIN/END REFERENCE 分隔符隔离
    - 实现 AI 输出校验：检查返回内容是否包含系统提示泄露
    - _Requirements: 33.1, 33.2, 33.3, 33.4_

- [x] 35. 用户数据生命周期管理
  - [x] 35.1 实现数据删除与导出 API
    - 创建 DELETE /api/v1/users/me/data 端点：软删除用户所有数据（设 deletedAt 标记）
    - 创建 GET /api/v1/users/me/data/export 端点：导出用户所有个人数据为 JSON
    - 实现定时任务：每日检查并硬删除 30 天前软删除的数据
    - 定义数据保留策略：会话记录 90 天、学习进度永久（除非主动删除）、日志 180 天后脱敏
    - _Requirements: 34.1, 34.2, 34.3, 34.4_

- [x] 36. 批量生成资源隔离
  - [x] 36.1 实现双池限流与执行时间窗口
    - 创建 `DualPoolRateLimiter` 组件：realtime 池（20次/分钟）+ batch 池（10次/分钟）
    - SmartRouter 调用时区分 realtime/batch 来源
    - 配置批量生成执行时间窗口（application.yml）
    - ContentGenerationService 批量生成时使用 batch 池，检查系统负载并动态调节并发
    - _Requirements: 35.1, 35.2, 35.3, 35.4_

- [x] 37. 通知系统
  - [x] 37.1 创建 Notification 实体和 API
    - 创建 `Notification` JPA 实体：id(UUID)、userId、type(枚举)、title、content、read(Boolean)、createdAt
    - 创建 `NotificationType` 枚举（GENERATION_COMPLETE、REVIEW_REMINDER、SYSTEM_ANNOUNCEMENT）
    - 创建 `NotificationRepository` 接口
    - 创建 `NotificationController`：GET /notifications、PUT /{id}/read、PUT /read-all
    - 创建 `NotificationService`：通知创建、查询、已读标记
    - 通知创建前检查 UserPreference.notificationSettings，该类型已关闭则不创建
    - 在 ContentGenerationService 完成生成时自动创建 GENERATION_COMPLETE 通知
    - 创建 GET /api/v1/users/me/notifications/stream（SSE）端点实时推送新通知
    - _Requirements: 36.1, 36.2, 36.3, 36.4, 36.5, 36.6, 36.7, 36.8_

- [x] 38. Explanation 按需返回优化
  - [x] 38.1 实现 fields 查询参数与 Partial DTO
    - 创建 `ExplanationDTO.partial(explanation, fields)` 方法，按 fields 参数裁剪返回内容
    - 支持 fields 值：summary、approaches、code、diagrams、comparison、applications
    - GET /api/v1/problems/{id}/explanation 新增 `fields` 查询参数
    - 未指定 fields 时返回完整内容（向后兼容）
    - _Requirements: 32.1, 32.2, 32.3, 32.4, 32.5_

- [x] 39. Final Checkpoint - 全部新增功能验证
  - 确保收藏/学习记录 CRUD 正常、Flyway 迁移脚本可执行、种子数据从文件导入成功、PromptSanitizer 过滤有效、通知推送正常（含免打扰逻辑）、资源隔离限流生效。如有问题请向用户提问。

- [x] 40. 内容格式扩展与付费预留实施
  - [x] 40.1 Explanation sections JSON 结构升级
    - 修改 Explanation.sections JSON 规范：每个段新增 `contentType` 字段（text/code/diagram/video/audio）
    - 更新 ExplanationDTO.partial() 方法，按 contentType 分类过滤
    - SeedDataLoader 导入的预生成数据同步适配新 JSON 结构
    - 前端渲染组件根据 contentType 分发（video/audio 展示"即将支持"占位）
    - _Requirements: 38.1, 38.2, 38.3_

- [x] 41. Final Checkpoint - 完整系统验证
  - 确保 Explanation JSON 新结构可正确解析渲染、User.tier 字段正常持久化、前端 XSS 防护生效（尝试注入 `<script>` 标签验证被过滤）、错误拦截层正确展示各状态码对应提示。如有问题请向用户提问。

## Notes

- 所有 Java 代码遵循编码规范：禁止 editor-fold、使用 Lombok、方法不超过 50 行、中文注释
- 时间字段统一使用 UTC 毫秒时间戳（Long 类型）
- DAO/Service 变量名简洁化
- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation


## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "5.4", "5.5"] },
    { "id": 6, "tasks": ["6.1", "7.1"] },
    { "id": 7, "tasks": ["6.2", "7.2", "8.1"] },
    { "id": 8, "tasks": ["7.3"] },
    { "id": 9, "tasks": ["10.1", "11.3"] },
    { "id": 10, "tasks": ["10.2", "11.1", "11.2", "11.4"] },
    { "id": 11, "tasks": ["13.1"] },
    { "id": 12, "tasks": ["13.2", "13.3"] },
    { "id": 13, "tasks": ["14.1", "14.3", "14.4"] },
    { "id": 14, "tasks": ["14.2"] },
    { "id": 15, "tasks": ["16.1", "16.2"] },
    { "id": 16, "tasks": ["16.3"] },
    { "id": 17, "tasks": ["18.1"] },
    { "id": 18, "tasks": ["18.2", "18.3"] },
    { "id": 19, "tasks": ["19.1", "19.2", "19.3"] },
    { "id": 20, "tasks": ["20.1", "20.2"] },
    { "id": 21, "tasks": ["21.1"] },
    { "id": 22, "tasks": ["23.1", "24.1", "24.2"] },
    { "id": 23, "tasks": ["25.1"] },
    { "id": 24, "tasks": ["26.1", "27.1"] },
    { "id": 25, "tasks": ["29.1", "29.2"] },
    { "id": 26, "tasks": ["31.1", "32.1"] },
    { "id": 27, "tasks": ["33.1", "34.1", "36.1"] },
    { "id": 28, "tasks": ["35.1", "37.1", "38.1"] },
    { "id": 29, "tasks": ["40.1"] }
  ]
}
```
