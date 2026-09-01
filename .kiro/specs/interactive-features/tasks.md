# Implementation Plan: 算法深度理解引擎 - 交互式功能层

## Overview

本计划将交互式功能从零搭建为完整的实时 AI 对话系统。按照"WebSocket 基础设施→会话管理→费曼模式→面试模拟→苏格拉底追问→Debug 训练→反向费曼→URL 导入→间隔重复→学习分析"的顺序递进实现。所有交互功能共享统一的 WebSocket 通信层和会话管理机制。

## Tasks

- [x] 1. WebSocket 基础设施
  - [x] 1.1 配置 Spring WebSocket 并创建统一消息处理器
    - 添加 `spring-boot-starter-websocket` 依赖到 `pom.xml`
    - 创建 `WebSocketConfig.java`，注册 `/ws/interactive` 端点
    - 创建 `InteractiveWebSocketHandler`，实现 `TextWebSocketHandler`
    - 创建 `WsMessage` 消息封装类（type、sessionId、payload、timestamp）
    - 创建 `WsMessageType` 枚举（FEYNMAN_CHAT、INTERVIEW_CHAT、SOCRATIC_CHAT、DEBUG_SUBMIT、REVERSE_FEYNMAN_CHAT、AI_RESPONSE、ERROR 等）
    - 实现消息路由：根据 type 分发到对应 handler
    - _Requirements: 8.1, 8.2_

  - [x] 1.2 实现 WebSocket 认证与速率限制
    - 创建 `WsAuthInterceptor`，从 URL 参数提取 JWT token 验证身份
    - 创建 `WsRateLimiter`，实现滑动窗口限流（每用户每秒最多 5 条）
    - 未认证连接自动断开并返回 ERROR 消息
    - 超限请求返回"请求过于频繁"错误
    - _Requirements: 8.5, 8.6_

  - [x] 1.3 实现 WebSocket 断线重连机制
    - 在 `afterConnectionClosed` 中标记会话为 PAUSED（而非直接删除）
    - 支持客户端携带 sessionId 重连，15 分钟内恢复上下文
    - 超过重连窗口返回 SESSION_EXPIRED 消息
    - _Requirements: 8.4_

- [x] 2. 会话管理层
  - [x] 2.1 创建 InteractiveSession 实体和 Repository
    - 创建 `InteractiveSession` JPA 实体（sessionId、userId、type、status、problemId、contextJson、createdAt、lastActiveAt、completedAt）
    - 创建 `SessionType` 枚举（FEYNMAN、INTERVIEW、SOCRATIC、DEBUG、REVERSE_FEYNMAN）
    - 创建 `SessionStatus` 枚举（ACTIVE、PAUSED、COMPLETED、EXPIRED）
    - 创建 `InteractiveSessionRepository` 接口
    - 创建 `SessionMessage` 实体用于消息持久化
    - _Requirements: 8.2, 9.1_

  - [x] 2.2 实现 SessionManager 核心逻辑
    - 创建 `SessionManager` 服务类
    - 实现 `createSession(userId, type, problemId)`: 创建新会话
    - 实现 `getContext(sessionId)`: 从 Redis 获取对话上下文
    - 实现 `appendMessage(sessionId, message)`: 追加消息，保持最多 20 轮（40 条）
    - 实现 `reconnect(sessionId)`: 断线恢复逻辑
    - Redis Key 格式：`session:context:{sessionId}`，TTL 30 分钟
    - _Requirements: 1.2, 8.2, 8.3, 8.4_

  - [x] 2.3 实现会话过期清理定时任务
    - 创建 `@Scheduled` 定时任务，每 5 分钟扫描过期会话
    - 空闲超过 30 分钟的会话标记为 EXPIRED
    - 清理 Redis 中对应的上下文数据
    - _Requirements: 8.3_

- [x] 3. Checkpoint - WebSocket 与会话管理验证
  - WebSocket 连接建立、消息收发、会话创建/恢复/过期机制均已实现，`mvn compile` 通过。


- [ ] 4. 费曼学习模式
  - [ ] 4.1 创建费曼模式 Prompt 模板
    - 创建 `prompts/interactive/feynman-chat.md`：对话追问模板（含漏洞识别、引导式追问规则）
    - 创建 `prompts/interactive/feynman-summarize.md`：结束时结构化总结模板（直觉→思路→伪代码→代码→复杂度）
    - 创建 `prompts/interactive/feynman-analogies.md`：多类比生成模板（至少 3 个不同类比）
    - _Requirements: 1.3, 1.4, 1.5_

  - [ ] 4.2 实现 FeynmanSessionHandler
    - 创建 `FeynmanSessionHandler` 组件
    - 实现 `handle(wsSession, msg)`: 接收用户输入 → 获取上下文 → 构建 prompt → 调用 SmartRouter → 返回 AI 追问
    - 实现 `generateStructuredOutput(sessionId)`: 结束时生成结构化总结
    - 实现 `generateAnalogies(sessionId)`: 生成多个不同类比供用户选择
    - 集成 SessionManager 管理上下文
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ] 4.3 创建费曼模式 REST API
    - POST `/api/feynman/start`：创建费曼会话（参数：problemId）
    - POST `/api/feynman/{sessionId}/end`：结束会话，返回结构化总结
    - GET `/api/feynman/{sessionId}/analogies`：获取多类比列表
    - GET `/api/feynman/{sessionId}/history`：获取完整对话历史
    - _Requirements: 1.4, 1.5, 1.6_

- [ ] 5. 面试模拟模式
  - [ ] 5.1 创建面试模拟 Prompt 模板
    - 创建 `prompts/interactive/interview-opening.md`：面试开场模板
    - 创建 `prompts/interactive/interview-followup.md`：追问模板（含追问方向：扩展性、优化、边界）
    - 创建 `prompts/interactive/interview-variant.md`：变体题生成模板
    - 创建 `prompts/interactive/interview-scoring.md`：评分模板（正确性/效率/沟通/代码质量 各 1-10 分）
    - 创建 `prompts/interactive/interview-communication.md`：沟通能力反馈模板
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [ ] 5.2 实现面试模拟状态机
    - 创建 `InterviewState` 枚举（IDLE、PROBLEM_SOLVING、FOLLOW_UP、CODING、VARIANT、SCORING）
    - 创建 `InterviewSimulatorHandler` 组件
    - 实现状态转移逻辑：IDLE→PROBLEM_SOLVING→FOLLOW_UP→CODING→VARIANT→SCORING
    - 使用 Redis 存储面试状态（Key: `interview:state:{sessionId}`）
    - 实现 `startInterview`: 设定计时器 + 生成开场白
    - 实现 `handleSolving`: AI 追问（"如果数据量到10亿？"、"空间能优化吗？"）
    - 实现 `handleCoding`: 评估用户代码（手写代码模式，无 IDE 辅助）
    - _Requirements: 3.1, 3.2, 3.6_

  - [ ] 5.3 实现面试评分报告
    - 创建 `InterviewReport` JPA 实体
    - 创建 `InterviewReportRepository`
    - 实现 `generateReport(sessionId)`: AI 评估全流程并生成四维评分
    - POST `/api/interview/start`：开始面试（参数：problemId、timeLimit）
    - GET `/api/interview/{sessionId}/report`：获取评分报告
    - GET `/api/interview/history`：获取历史面试报告列表
    - _Requirements: 3.5_

  - [ ] 5.4 实现面试计时与提醒
    - 使用 `ScheduledExecutorService` 调度时间提醒
    - 75% 时间时发送 INTERVIEW_TIME_WARNING 消息
    - 100% 时间时自动进入 SCORING 状态
    - _Requirements: 3.1_

- [ ] 6. Checkpoint - 费曼模式与面试模拟验证
  - 确保费曼模式多轮对话正常、上下文保持完整、面试状态机转移正确、评分报告生成。如有问题请向用户提问。


- [ ] 7. 苏格拉底式追问模式
  - [ ] 7.1 创建苏格拉底模式 Prompt 模板
    - 创建 `prompts/interactive/socratic-guide.md`：渐进式引导模板（4 级提示）
    - 创建 `prompts/interactive/socratic-summary.md`：用户解出后的总结模板
    - _Requirements: 5.1, 5.2_

  - [ ] 7.2 实现 SocraticGuideHandler
    - 创建 `SocraticGuideHandler` 组件
    - 使用 Redis 存储当前提示级别（Key: `socratic:hint_level:{sessionId}`）
    - 实现 4 级渐进式提示：Hint 1(方向) → Hint 2(方法) → Hint 3(伪代码) → Hint 4(代码)
    - 实现动态难度调整：根据用户回答接近程度决定是否升级提示
    - 用户请求停止时暂停提示
    - 用户最终解出时生成总结（思路回顾 + 标准解法对比 + 改进建议）
    - POST `/api/socratic/start`：开始苏格拉底会话
    - GET `/api/socratic/{sessionId}/hint`：请求下一级提示
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 8. 算法 Debug 训练
  - [ ] 8.1 创建 Debug 训练 Prompt 模板
    - 创建 `prompts/interactive/debug-generate.md`：生成有 bug 代码的模板（bug 类型：off-by-one、边界遗漏、条件错误、初始化错误）
    - 创建 `prompts/interactive/debug-evaluate.md`：评估用户修复的模板
    - 创建 `prompts/interactive/debug-hint.md`：渐进式提示模板（行范围→具体行）
    - _Requirements: 6.1, 6.3, 6.4_

  - [ ] 8.2 实现 DebugTrainerHandler
    - 创建 `DebugTrainerHandler` 组件
    - 创建 `BuggyCodeChallenge` 数据模型（code、actualBugs、testCases）
    - 创建 `Bug` 数据模型（lineNumber、type、description、correctCode）
    - 实现 `generateChallenge(problemId)`: AI 生成含 1-3 个 bug 的代码
    - 实现 `handle(wsSession, msg)`: 评估用户提交的修复方案
    - 实现渐进式提示：先指出行范围 → 再指出具体行
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 8.3 实现 Debug 训练数据记录
    - 创建 `DebugTrainingRecord` JPA 实体
    - 创建 `DebugTrainingRecordRepository`
    - 记录每次训练的 bug 类型、是否找到、提示次数、耗时
    - POST `/api/debug/challenge`：获取 Debug 挑战
    - GET `/api/debug/records`：获取训练记录和薄弱类型分析
    - _Requirements: 6.5_

- [ ] 9. 反向费曼法
  - [ ] 9.1 创建反向费曼 Prompt 模板
    - 创建 `prompts/interactive/reverse-feynman-generate.md`：生成含错误解释的模板（错误类型：逻辑错误、复杂度错误、边界错误）
    - 创建 `prompts/interactive/reverse-feynman-evaluate.md`：评估用户纠错的模板
    - _Requirements: 7.1, 7.2_

  - [ ] 9.2 实现 ReverseFeynmanHandler
    - 创建 `ReverseFeynmanHandler` 组件
    - 实现 `generateWithError(problemId)`: AI 生成包含 1-2 个隐蔽错误的解释
    - 实现 `handle(wsSession, msg)`: 用户指出错误时，AI 确认纠正并给出完整正确解释
    - 实现渐进式提示：先提示哪一段有错 → 缩小范围
    - 记录纠错成功率，自动调整错误难度
    - POST `/api/reverse-feynman/start`：获取含错误的解释
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 10. Checkpoint - 追问/Debug/反向费曼验证
  - 确保苏格拉底式渐进提示正常、Debug 训练生成有效 bug 代码、反向费曼错误隐蔽度合适。如有问题请向用户提问。


- [ ] 11. 链接/图片/评论导入解析
  - [ ] 11.1 实现 URL 内容抓取与 Readability 提取
    - 创建 `ContentImportService` 服务类
    - 使用 Spring WebClient 获取网页 HTML（配置超时 10s）
    - 使用 Jsoup 实现 Readability 算法：移除 script/style/nav/footer → 找到最大文本密度节点 → 提取正文
    - 创建 `Article` 数据模型（title、content、textContent）
    - 处理 URL 不可访问/内容为空的异常
    - _Requirements: 2.1, 2.6_

  - [ ] 11.2 实现图片提取与评论抓取
    - 实现图片/GIF 提取：解析 `<img>` 标签，下载到 `data/imported-images/` 目录
    - 创建 `ImportedImage` 数据模型（originalUrl、localPath、description）
    - 实现评论提取（针对主流平台：LeetCode、CSDN、知乎）：点赞数 > 阈值的纠错/补充型评论
    - _Requirements: 2.2, 2.3_

  - [ ] 11.3 实现 AI 审查与精炼
    - 创建 `prompts/interactive/import-review.md`：正确性审查模板
    - 创建 `prompts/interactive/import-refine.md`：内容精炼模板（转为标准格式）
    - 实现 `aiReview(content)`: AI 审查逻辑错误和不准确说法
    - 实现 `aiRefine(content)`: AI 精炼为标准格式（题目理解→思路→代码→复杂度）
    - _Requirements: 2.4, 2.5_

  - [ ] 11.4 创建导入内容数据模型与 API
    - 创建 `ImportedContent` JPA 实体（sourceUrl、title、rawContent、refinedContent、imagesJson、commentsJson、errorsJson）
    - 创建 `ImportedContentRepository`
    - 创建 `ImportResult` 响应模型
    - POST `/api/import/url`：导入 URL 内容
    - GET `/api/import/{id}`：获取导入结果
    - GET `/api/import/list`：获取导入历史
    - _Requirements: 2.1, 2.4, 2.5, 2.6_

- [ ] 12. 间隔重复与遗忘曲线
  - [ ] 12.1 创建间隔重复数据模型
    - 创建 `SpacedRepetitionCard` JPA 实体（userId、problemId、patternId、cardType、easeFactor、interval、repetitions、nextReviewAt、lastReviewAt）
    - 创建 `CardType` 枚举（GUESS_ALGO、COMPLETE_CODE、EXPLAIN、PATTERN_QUIZ、VARIANT、COMPLEXITY_GUESS）
    - 创建 `ReviewRecord` JPA 实体（cardId、userId、quality、reviewedAt、responseTime）
    - 创建对应 Repository 接口
    - _Requirements: 4.1, 4.2_

  - [ ] 12.2 实现 SM-2 算法核心
    - 创建 `SpacedRepetitionService` 服务类
    - 实现 `recordReview(cardId, quality)`: SM-2 核心计算（EF 更新 + 间隔计算 + 重置逻辑）
    - quality ≥ 3: 间隔递增（1→6→interval×EF）
    - quality < 3: 间隔重置为 1，repetitions 清零
    - EF 更新公式: EF' = EF + (0.1 - (5-q)×(0.08 + (5-q)×0.02))，最小值 1.3
    - 实现 `createCard(userId, problemId, type)`: 创建新卡片（初始 EF=2.5）
    - _Requirements: 4.1_

  - [ ] 12.3 实现复习调度与每日推荐
    - 实现 `getTodayReviews(userId)`: 获取今日到期的待复习卡片
    - 实现 `getDailyRecommendation(userId)`: 基于薄弱模式推荐（一个模式回顾 + 一道新题）
    - 实现 `findWeakestPattern(userId)`: 分析用户最薄弱的算法模式
    - _Requirements: 4.5_

  - [ ] 12.4 创建复习方式生成器
    - 实现"看图猜算法"题目生成
    - 实现"补全代码"题目生成（关键行留空）
    - 实现"模式识别 quiz"生成（给题目描述，选择算法模式）
    - 实现"复杂度直觉训练"：看数据范围猜算法 / 看代码估复杂度
    - 创建对应 Prompt 模板
    - _Requirements: 4.2, 4.3, 4.4_

  - [ ] 12.5 创建间隔重复 REST API
    - GET `/api/review/today`：获取今日待复习列表
    - POST `/api/review/record`：记录复习结果（参数：cardId、quality 0-5）
    - GET `/api/review/daily`：获取每日推荐（算法日历）
    - GET `/api/review/schedule`：获取未来一周复习日程
    - _Requirements: 4.1, 4.5_

- [ ] 13. Checkpoint - 导入解析与间隔重复验证
  - 确保 URL 导入流程完整（抓取→提取→审查→精炼）、SM-2 算法计算正确、复习调度逻辑无误。如有问题请向用户提问。


- [ ] 14. 学习数据统计与分析
  - [ ] 14.1 实现 LearningAnalyticsService
    - 创建 `LearningAnalyticsService` 服务类
    - 实现 `getOverallStats(userId)`: 计算总学习统计（题目数、掌握度、连续学习天数）
    - 实现 `getWeakPoints(userId)`: 识别薄弱算法模式（基于 Debug 正确率 + 复习自评分）
    - 实现 `getForgettingCurve(userId)`: 生成遗忘曲线数据（各模式的记忆衰减趋势）
    - 实现 `getMasteryRadar(userId)`: 生成掌握程度雷达图数据（各算法类别得分）
    - _Requirements: 4.6, 9.5_

  - [ ] 14.2 创建学习分析 REST API
    - GET `/api/analytics/stats`：获取整体学习统计
    - GET `/api/analytics/weak-points`：获取薄弱点分析
    - GET `/api/analytics/forgetting-curve`：获取遗忘曲线数据
    - GET `/api/analytics/mastery`：获取掌握程度雷达图数据
    - GET `/api/analytics/export`：导出学习数据（JSON/CSV）
    - _Requirements: 4.6, 9.5, 9.6_

  - [ ] 14.3 实现面试模拟历史趋势
    - 实现面试评分历史趋势查询（按时间线展示四维得分变化）
    - 实现面试薄弱环节分析（哪个维度得分最低）
    - GET `/api/analytics/interview-trend`：获取面试得分趋势
    - _Requirements: 9.2_

- [ ] 15. 交互式 Prompt 模板全集
  - [ ] 15.1 创建完整的 Prompt 模板目录
    - 确保 `prompts/interactive/` 目录下所有模板文件就绪
    - 费曼模式：feynman-chat.md、feynman-summarize.md、feynman-analogies.md
    - 面试模拟：interview-opening.md、interview-followup.md、interview-variant.md、interview-scoring.md、interview-communication.md
    - 苏格拉底：socratic-guide.md、socratic-summary.md
    - Debug：debug-generate.md、debug-evaluate.md、debug-hint.md
    - 反向费曼：reverse-feynman-generate.md、reverse-feynman-evaluate.md
    - 导入：import-review.md、import-refine.md
    - 复习：review-guess-algo.md、review-complete-code.md、review-pattern-quiz.md、review-complexity.md
    - _Requirements: 1.3, 3.2, 5.1, 6.1, 7.1, 2.4, 4.2_

- [ ] 16. 集成测试
  - [ ] 16.1 WebSocket 集成测试
    - 测试 WebSocket 连接建立与认证
    - 测试消息收发和路由分发
    - 测试断线重连恢复上下文
    - 测试速率限制生效
    - _Requirements: 8.1, 8.4, 8.5, 8.6_

  - [ ] 16.2 SM-2 算法单元测试
    - 测试连续正确（quality=5）时间隔递增：1→6→15→...
    - 测试回答错误（quality<3）时间隔重置为 1
    - 测试 EF 最小值不低于 1.3
    - 测试边界值：quality=0、quality=5、初次复习
    - _Requirements: 4.1_

  - [ ] 16.3 面试状态机测试
    - 测试正常流程：IDLE→PROBLEM_SOLVING→FOLLOW_UP→CODING→VARIANT→SCORING
    - 测试非法状态跳转被拒绝
    - 测试超时自动进入 SCORING
    - 测试评分报告生成四维得分格式正确
    - _Requirements: 3.1, 3.5_

- [ ] 17. Final Checkpoint - 全功能集成验证
  - 确保所有交互式功能可通过 WebSocket/REST API 正常使用，会话管理稳定，SM-2 算法计算正确，面试模拟状态机无异常。如有问题请向用户提问。

- [ ] 18. 成就系统稀缺度与阶梯设计
  - [ ] 18.1 扩展 Achievement 实体和枚举
    - Achievement 实体新增 `unlockRate`(Float, nullable) 字段
    - AchievementType 枚举扩展为：FIRST_PROBLEM、PATTERN_MASTER、STREAK_7、STREAK_30、STREAK_100、STREAK_365、FEYNMAN_SCHOLAR_5、FEYNMAN_SCHOLAR_20、FEYNMAN_SCHOLAR_50、FEYNMAN_SCHOLAR_100、INTERVIEW_PRO、BUG_HUNTER、SPEED_DEMON、COMPLEXITY_MASTER
    - 创建数据库 migration 脚本添加 `unlock_rate` 列
    - _Requirements: 21.1, 21.4, 21.5_

  - [ ] 18.2 实现 unlockRate 定时计算
    - 创建 `AchievementStatsScheduler` @Scheduled 定时任务（每日凌晨 2:00）
    - 对每种成就类型计算 unlockRate = 已解锁用户数 / 总注册用户数
    - 批量更新 Achievement 表的 unlockRate 字段
    - _Requirements: 21.2_

  - [ ] 18.3 更新 AchievementCheckService 支持阶梯成就
    - 连续学习检查：STREAK_7(7天)→STREAK_30(30天)→STREAK_100(100天)→STREAK_365(365天)
    - 费曼检查：FEYNMAN_SCHOLAR_5(5次)→FEYNMAN_SCHOLAR_20(20次)→FEYNMAN_SCHOLAR_50(50次)→FEYNMAN_SCHOLAR_100(100次)
    - 复杂度训练检查：COMPLEXITY_MASTER（正确率 > 90% 且训练次数 > 50）
    - GET /api/v1/achievements/definitions 更新返回全部新成就定义
    - _Requirements: 21.4, 21.5_

  - [ ] 18.4 前端展示稀缺度信息
    - 成就解锁弹窗和成就列表中展示"仅 X% 的学习者解锁了此成就"（仅 unlockRate < 10% 时展示）
    - GET /api/v1/users/me/achievements 返回 unlockRate 字段
    - _Requirements: 21.3_

- [ ] 19. 反向费曼→复习系统联动
  - [ ] 19.1 实现纠错后自动创建复习卡片
    - 在 ReverseFeynmanHandler 纠错成功回调中调用 SpacedRepetitionService
    - 创建 SpacedRepetitionCard（cardType=EXPLAIN, patternId=题目所属模式, 初始间隔=1天）
    - 卡片 metadata JSON 记录：source=reverse_feynman、errorType、correctionContent
    - 若该题已有 EXPLAIN 类型卡片则不重复创建，仅更新 metadata 追加纠错记录
    - _Requirements: 22.1, 22.2, 22.4_

  - [ ] 19.2 实现基于纠错记录的复习内容生成
    - 创建 `prompts/interactive/review-from-correction.md`：基于纠错记录生成复习提问的模板
    - 复习时从 metadata.correctionContent 提取用户曾经纠错的知识点作为提问方向
    - 如"合并链表时，每次应该选择哪个节点？"
    - _Requirements: 22.3_

- [ ] 20. Checkpoint - 差异化增强功能验证
  - 验证成就 unlockRate 定时计算正确，阶梯成就按指数递增解锁
  - 验证反向费曼纠错成功后自动创建复习卡片（不重复创建）
  - 验证复习时能基于纠错记录生成针对性复习题
  - 如有问题请向用户提问

## Notes

### UI 设计参考（严格遵循方案A · Geist 极简暗色风格）

前端实现 **必须** 严格参考 `ui-preview/scheme-a.html`、`scheme-a-data-mgmt.html`、`scheme-a-supplement.html`、`scheme-a-supplement-v2.html`、`scheme-a-supplement-v3.html` 中定义的页面和交互风格。以下是与本 Spec 交互式功能相关的完整 UI 页面清单：

#### 1. 费曼学习模式页（scheme-a.html #feynman）
- 双栏布局：左侧对话区 + 右侧面板
- 对话区：AI 开场白（紫色头像"AI"）→ 用户回答（蓝色气泡右对齐）→ AI 追问（灰色背景左对齐）
- 对话区顶部：题目名 + "费曼对话"标签 + 操作按钮（📥 导出 / 🔄 重置 / ✅ 结束并生成总结）
- 底部输入框：placeholder "继续用你的话解释..." + 发送按钮
- 右侧面板包含：📋 理解评估（各知识点掌握/部分/未涉及状态）、💡 切换类比视角（多个类比选项卡片）、加载状态（spinner + "AI 正在分析你的回答..."）、📜 历史会话列表
- 轮次计数器展示在对话区顶部（如"第 12/20 轮"）
- _对应 Requirement: 1, 19, 23, 28_

#### 2. 面试模拟页（scheme-a.html #interview）
- 面试配置面板（面试前）：2×2 网格布局，含难度/时长/公司风格/指定题目 4 项 select/input，底部"🎤 开始面试"全宽按钮
- 面试中：双栏布局，左侧对话区 + 右侧代码编辑区
- 左侧对话区顶部：题目名 + badge + 倒计时器（monospace 字体，黄色 `12:34 / 25:00`）
- 面试官头像"面"（橙色背景），用户头像"你"（蓝色背景）
- 底部操作：回答输入框 + "回答"按钮 + "提示"按钮
- 右侧代码编辑区：顶部语言标签（Python 3）、monospace 代码区、底部"▶ 运行"+"提交"按钮 + 测试用例通过状态
- 评分报告：双栏 — 左侧雷达图 SVG（6 维：思路清晰度/代码质量/复杂度分析/沟通表达/边界处理/优化意识）、右侧详细评分进度条（每项 x/100 + 颜色条）+ 底部总分评级（如"78/100 · 评级 B+"）
- 错误状态：红色虚线边框卡片，⚠️ 图标 + "连接中断" + "重新连接"按钮
- _对应 Requirement: 3, 15, 20, 27_

#### 3. 苏格拉底追问页（scheme-a-supplement.html #socratic）
- 双栏布局：左侧对话区 + 右侧提示级别面板（280px 宽）
- 对话区：AI 引导提问（绿色左边框）+ 用户回答，底部"回答"+"需要提示"两个按钮
- 右侧面板：提示级别仪表（Level 1/2/3/4 四格，当前级别高亮 + 分数预估）、"当前得分预估"动态显示
- 用户解出后展示双栏对比总结："📝 你的推导路径"（时间线）vs "📖 标准思路"（黄色高亮差异）
- 总结底部：推导得分（百分制）+ "💪 改进建议"
- _对应 Requirement: 5, 24, 29_

#### 4. Debug 训练页（scheme-a-supplement.html #debug）
- 双栏布局：左侧代码展示区 + 右侧操作/统计面板
- 代码区用 CodeBlock 组件（monospace、行号、暗色背景），可点击行号标注 bug
- 右侧操作面板：三步流程（标注 bug 行 → 描述原因 → 提交修复）
- 顶部难度选择：初级(1 bug) / 中级(2 bug) / 高级(3 bug) Tab
- 统计侧栏：本轮正确率、按 bug 类型的正确率分布条形图、薄弱类型警告（红色标签）
- 结果面板：正确标注用 ✓ 绿色标记、遗漏 bug 用红色高亮闪烁
- 训练完成总结：🏆 总题数/正确数/平均用时/薄弱 bug 类型建议
- _对应 Requirement: 6, 30_

#### 5. 反向费曼页（scheme-a-supplement.html #reverse-feynman）
- 双栏布局：左侧 AI 解释区（对话气泡逐段展示）+ 右侧纠错操作区（260px）
- AI 解释区：逐段展示 AI 的"解释"，每段底部"✓ 这段正确"/"✗ 这段有错"按钮
- 用户点击"✗ 有错"后展开文本输入框，描述正确说法
- 纠错成功：绿色反馈"🎉 准确！"+ AI 确认消息 + 正确解释全文
- 未发现错误时：渐进式提示（先高亮有错段落 → 再缩小到具体句子）
- 顶部实时展示：纠错成功率 + 连续正确次数
- 训练结束总结：纠错成功率 + 遗漏错误类型分析 + "该题已自动加入复习计划"
- _对应 Requirement: 7, 22, 31_

#### 6. 复习中心页（scheme-a.html #review）
- 今日学习计划卡片（蓝色边框高亮）：📅 图标 + 模式回顾 + 新题推荐 + "开始今日计划"按钮
- 多样化复习方式选择 Tab 栏：🃏 经典翻卡 / 🖼 看图猜算法 / ✏️ 补全代码 / 🧩 模式识别 Quiz / ⚡ 复杂度训练
- 4 格统计面板：今日待复习 / 本周已完成 / 连续学习天数 / 记忆保持率
- 翻卡复习：正面（题目名 + 问题 + 上次复习间隔信息），背面（答案 + 4 个自评按钮：😟 忘了 / 🤔 模糊 / 😊 记得 / 🚀 秒杀）
- 翻转动画效果预览
- 学习趋势图（7 天柱状图）+ 底部统计文字
- _对应 Requirement: 4, 14, 25, 26_

#### 7. 内容导入页（scheme-a-supplement.html #import）
- 单栏布局（max-width 720px）
- URL 输入框 + "解析"按钮，支持粘贴链接
- 解析进度：步骤指示器（抓取网页 → 提取正文 → AI 审查 → 精炼格式化），每步含 spinner/✓ 状态
- 提取结果预览卡片：标题、正文摘要、提取的图片缩略图网格、优质评论列表
- AI 审查标注：红色高亮错误、黄色高亮可疑、底部"查看精炼后内容"按钮
- 错误状态：URL 不可访问时显示红色错误提示
- _对应 Requirement: 2_

#### 8. 复杂度直觉训练页（scheme-a-supplement-v3.html #complexity）
- 模式切换 Tab："看范围猜算法" / "看代码估复杂度"
- 看范围猜算法：展示数据范围描述（如 n ≤ 10^5）+ 4-6 个复杂度选项（单选按钮）
- 看代码估复杂度：CodeBlock 展示代码 + 复杂度选项
- 作答后展示：正确答案 + 推理过程卡片（绿色/红色边框区分对错）
- 右侧统计面板：按复杂度类型的正确率条形图
- _对应 Requirement: 13_

#### 9. 通知系统（scheme-a-supplement.html #notifications）
- 导航栏通知铃铛（🔔）+ 红色未读数角标
- 下拉面板：分 Tab（全部 / 学习 / 系统），每条通知含图标 + 标题 + 描述 + 时间 + 未读蓝色圆点
- 通知类型：GENERATION_COMPLETE（绿色 ✓）、REVIEW_REMINDER（橙色 🔄）、ACHIEVEMENT_UNLOCKED（紫色 🏆）
- 底部"全部标为已读"按钮
- _对应 Requirement: 11_

#### 10. 全服飘屏与成就系统（scheme-a-supplement.html #broadcast）
- 飘屏效果：页面顶部水平滚动动画（从右到左），格式「🏆 @用户名 解锁了 [成就名]！」，5 秒后淡出
- 成就解锁弹窗：居中模态，含成就图标 + 名称 + 描述 + "仅 X% 的学习者解锁了此成就"稀缺度文字 + 分享按钮
- 成就列表页：网格卡片布局，已解锁高亮 + 未解锁灰色锁定
- _对应 Requirement: 12, 16, 17, 21_

#### 11. 用户题解区（scheme-a-data-mgmt.html #solutions）
- 题目详情页内嵌三 Tab 切换：📖 官方解析 / 📝 用户题解(数量) / 💬 评论(数量)
- 题解操作栏：排序（精选优先/最新/最热）+ "✏️ 写题解"按钮
- 精选题解卡片：紫色边框 + ⭐ 精选 badge + 用户头像 + 点赞/评论数
- 费曼产出题解：🧠 绿色头像 + "费曼产出"标签
- URL 导入题解：蓝色"URL 导入"标签 + 来源链接
- _对应 Requirement: 2（导入结果展示）_

#### 12. 评论区（scheme-a-data-mgmt.html #comments）
- 评论输入框：左侧头像 + textarea + 评论类型选择（💬 普通 / 🐛 纠错 / ➕ 补充 / ❓ 提问）+ 发表按钮
- 评论列表：不同类型用左边框颜色区分（纠错=红色、补充=蓝色、提问=黄色）
- 每条评论：用户头像 + 昵称 + 类型标签 + 时间 + 正文 + 点赞/回复操作
- 纠错评论底部：✓ 已通知作者（绿色文字）
- _对应 Requirement: 2（评论抓取的展示形态）_

#### 13. 费曼转题解（scheme-a-data-mgmt.html #feynman-convert）
- 费曼会话结束弹窗：🎉 + "费曼学习完成！"+ AI 结构化摘要预览 + "📝 转为我的题解" / "仅保存记录"按钮
- 转化后编辑页：标题输入框 + 内容 textarea（AI 已结构化，可编辑）+ 标签选择
- 底部操作："存为草稿" / "发布题解"按钮 + 来源标注（费曼学习 · Session ID）
- _对应 Requirement: 1（费曼输出转化）_

#### 14. 模式识别训练（scheme-a-supplement.html #pattern-quiz）
- 双栏：左侧题目描述卡片 + 右侧选项面板（300px）
- 题目描述：隐藏题目名，仅展示题目条件和要求
- 选项面板：4-6 个算法模式选项（单选卡片）+ "确认"按钮
- 作答后反馈：正确显示绿色边框 + ✓，错误显示红色 + 正确答案高亮 + 核心识别信号列表
- _对应 Requirement: 4（复习方式之一）, 32_

#### 15. 看图猜算法复习（Requirement 32 对应 UI）
- 展示 Mermaid 流程图/状态图（隐藏标题）
- 4-6 个候选算法模式选项卡片（单选）
- 正确时：✓ + 揭示题目名和模式名 + "查看该题详情"链接
- 错误时：正确答案 + 核心识别信号 2-3 条
- _对应 Requirement: 32_

#### 16. 补全代码复习（Requirement 33 对应 UI）
- CodeBlock 组件展示代码骨架，关键行替换为可编辑输入框 `___________`
- "检查"按钮提交 → AI 判断语义正确性
- 正确：绿色反馈 + 标准答案对比展示
- 错误：红色反馈 + 正确代码 + 差异高亮
- _对应 Requirement: 33_

#### 17. 面试增强 UI（scheme-a-supplement-v2.html #interview-v2）
- Follow-up 变体题展示区：面试结束后展示关联变体题卡片列表
- 白板模式：纯文本编辑区（无语法高亮、无自动补全），模拟白板面试
- 沟通反馈气泡：AI 实时给出沟通建议（浅黄色提示框嵌入对话流中）
- _对应 Requirement: 3（追问/变体/手写代码/沟通训练）_

#### 18. 学习洞察/深度统计（scheme-a-supplement-v2.html #review-deep）
- 掌握程度雷达图（SVG，各算法模式为轴）
- 遗忘曲线图（折线图，按模式分色）
- 薄弱点热力图（网格色块，深色=薄弱）
- 学习时间分布图（按时段/按天的柱状图）
- _对应 Requirement: 4（学习数据可视化）, 9_

#### 19. 全局设计风格规范
- 色板：暗色系（bg-root: hsl(0 0% 4%)、accent: hsl(220 70% 55%)、easy: 绿 / medium: 橙 / hard: 红）
- 字体：Inter（正文）+ JetBrains Mono（代码）
- 圆角：sm=6px / md=8px / lg=12px / xl=16px
- 组件：.card（bg-primary + border-subtle + radius-lg）、.btn-primary（accent 蓝）/ .btn-ghost（透明+边框）、.badge-easy/medium/hard（对应色 pill）
- 动画：pulse（loading 指示）、spin（spinner）、flip（卡片翻转）
- 空状态：虚线边框 + 大图标 + 描述文字 + CTA 按钮
- 加载状态：骨架屏（灰色矩形 pulse 动画）
- 错误状态：红色虚线边框 + ⚠️ 图标 + 操作按钮

#### 20. 关键交互模式
- WebSocket 对话类页面（费曼/面试/苏格拉底）统一使用：左右气泡对话布局 + 底部输入框 + 右侧辅助面板
- 训练类页面（Debug/反向费曼/复杂度）统一使用：题目展示 + 操作面板 + 结果反馈 + 统计侧栏
- 复习类页面统一使用：卡片翻转 + 自评按钮 + 进度统计
- 所有实时通信页面必须包含：连接状态指示器、断线重连提示、加载 spinner

- 所有 Java 代码遵循编码规范：禁止 editor-fold、使用 Lombok、方法不超过 50 行、中文注释
- 时间字段统一使用 UTC 毫秒时间戳（Long 类型）
- DAO/Service 变量名简洁化
- 所有 AI 调用通过 SmartRouter（Spec 1），不直接调用 Provider
- WebSocket 消息格式统一使用 JSON
- 会话上下文存储在 Redis（快速读写），会话元数据持久化在 MySQL（持久存储）
- Prompt 模板统一存放在 `prompts/interactive/` 目录

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["4.1", "5.1", "7.1", "8.1", "9.1"] },
    { "id": 4, "tasks": ["4.2", "5.2", "7.2", "8.2", "9.2"] },
    { "id": 5, "tasks": ["4.3", "5.3", "5.4"] },
    { "id": 6, "tasks": ["11.1"] },
    { "id": 7, "tasks": ["11.2", "11.3"] },
    { "id": 8, "tasks": ["11.4", "12.1"] },
    { "id": 9, "tasks": ["12.2"] },
    { "id": 10, "tasks": ["12.3", "12.4"] },
    { "id": 11, "tasks": ["12.5", "8.3"] },
    { "id": 12, "tasks": ["14.1", "14.3"] },
    { "id": 13, "tasks": ["14.2", "15.1"] },
    { "id": 14, "tasks": ["16.1", "16.2", "16.3"] },
    { "id": 15, "tasks": ["18.1"] },
    { "id": 16, "tasks": ["18.2", "18.3", "19.1"] },
    { "id": 17, "tasks": ["18.4", "19.2"] }
  ]
}
```
