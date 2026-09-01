# Implementation Plan

## Overview

内容解析系统 v2 的实现计划，共 35 个任务，按后端基础 → 管线实现 → API 层 → 前端组件 → 体验增强 → 安全加固的顺序排列。对齐 UI 预览（solution-list-v2.html）所有细节和 Requirements 1-33。新增骨架屏、登录引导、踩功能、管理后台审核队列、管理操作审计日志、管线输出保护、详情接口增强、recommended 手动管理等对齐项。

## Tasks

- [x] 1. 创建 enriched_solutions 数据模型和 Repository
  - 创建 `EnrichedSolution` JPA Entity，包含所有字段（含 source_votes、time_complexity、space_complexity、downvote_count、feedback_count）
  - 创建枚举 `SourceType`、`EnrichedStatus`、`VoteType`、`FeedbackErrorType`、`FeedbackStatus`
  - 创建 `EnrichedSolutionRepository` 接口
  - 创建 SQL 迁移脚本建表（含所有索引）
  - 添加 `@PrePersist`/`@PreUpdate` 生命周期方法
  - 添加业务校验：COMMUNITY 时 author/url 非空；L1 时 code=null
  - 添加 version 字段用于乐观锁并发控制
  - **Requirements:** 1.1-1.8

- [x] 2. 创建 enriched_feedback 和 enriched_votes 数据模型
  - 创建 `EnrichedFeedback` JPA Entity
  - 创建 `EnrichedVote` JPA Entity（含唯一索引 enriched_id + user_id）
  - 创建对应 Repository 接口
  - 创建 SQL 迁移脚本建表
  - **Requirements:** 22.4, 27.1

- [x] 3. 实现管线框架和步骤接口
  - 创建 `EnrichmentStep` 接口（getName、isApplicable、process、isCritical）
  - 创建 `EnrichmentContext` 上下文对象（含 timeComplexity/spaceComplexity）
  - 创建 `EnrichmentResult` 和 `EnrichmentPipelineResult`
  - 创建 `EnrichmentPipeline` 编排器 Service
  - 创建 `EnrichmentConfig` 配置类，从 YAML 读取配置
  - 在 `application.yml` 中添加 `content.enrichment` 配置节
  - **Requirements:** 2.1-2.6

- [x] 4. 实现核心管线步骤（ErrorCheck + SourceFilter + Polish）
  - 实现 `ErrorCheckStep`：AI 检查原始题解错误，isCritical=false
  - 实现 `SourceFilterStep`：按级别筛选素材子集，isCritical=true
  - 实现 `PolishStep`：基于素材+Prompt模板润色生成（输出含 timeComplexity/spaceComplexity），isCritical=true
  - 创建 L1-L5 Prompt 模板文件（resources/prompts/enrichment/）
  - 集成 SmartRouter 进行 AI 调用
  - **Requirements:** 2.2, 2.7

- [x] 5. 实现辅助管线步骤（MultiLang + Visualization）
  - 实现 `MultiLangStep`：补全缺失语言代码，L1 时跳过
  - 实现 `VisualizationStep`：按需生成 Mermaid 图/ASCII 图
  - 复用现有 `MultiLangCodeGenerator` 适配接口
  - 复用现有 `DiagramService` 适配接口
  - **Requirements:** 2.2, 2.5

- [x] 6. 实现质量评分和差异化检查步骤
  - 实现 `DiversityCheckStep`：Jaccard 标题相似度 + 余弦内容相似度检查
  - 实现 `QualityScoreStep`：5 维度加权评分，L1 特殊维度
  - 实现自动审核逻辑（score>=0.6 + 无黑名单 + 语法正确 → PUBLISHED）
  - 创建黑名单词汇配置文件
  - 实现相似度计算工具类
  - **Requirements:** 9.1-9.4, 10.1-10.4

- [x] 7. 实现异步任务管理器
  - 创建 `EnrichmentTaskManager`：createTask、executeTask、getTaskStatus、cancelTask
  - 实现 Redis 状态机（active 标记 + task 状态 Hash），包含 CANCELLED 状态
  - 实现步骤级进度更新，记录 startedAt 用于前端预估
  - 实现超时检查（3 分钟）+ 重试策略（指数退避）
  - 配置线程池（core=2, max=5, queue=20）
  - 实现取消逻辑（CANCELLED + 中断 + 清理 active key）
  - 重试失败任务时不消耗频率额度（复用原 taskId）
  - **Requirements:** 3.1-3.10, 8.7

- [x] 8. 实现统一查询服务和 API 接口
  - 创建 `UnifiedExplanationService`：enriched 优先 + legacy fallback + 标签聚合
  - 实现 Redis 缓存（列表 1h、详情 24h、标签 1h、原始题解 6h）+ 失效逻辑
  - 创建 `EnrichedSolutionController`：列表/详情/生成/进度/取消/标签
  - 创建 `RawSolutionController`：分页+排序+语言筛选+hasEnriched标记
  - 创建 `AdminEnrichedController`：批量生成/审核/删除/单条丰富
  - 列表摘要中包含 source_votes 字段
  - 详情接口包含 timeComplexity、spaceComplexity 字段
  - 添加 ETag 缓存头支持
  - 乐观锁：更新操作校验 version 字段
  - **Requirements:** 4.1-4.12, 5.1-5.4, 19.5, 1.8

- [x] 9. 实现权限控制和频率限制
  - Redis 滑动窗口频率限制（5次/小时）
  - generate 接口频率检查 + 管理员权限注解
  - 游客只读访问 + 管理员批量限制 50 题
  - Redis 异常降级放行 + 重试不消耗额度
  - 响应包含 retryAfterSeconds、usedCount、maxCount 字段
  - IP 级限流（详情接口每 IP 60 次/分）
  - **Requirements:** 8.1-8.7, 19.4

- [x] 10. 实现投票服务（点赞/踩）
  - 创建 `VoteService`：upvote、downvote、cancelVote、getUserVote
  - 投票互斥逻辑（赞踩不能同时存在）
  - quality_score 调整（+0.01/-0.02，边界 ±0.3）
  - 投票后失效列表缓存
  - 创建投票 API：POST /enriched/{id}/upvote、POST /enriched/{id}/downvote
  - 未登录返回 40403 错误码
  - 更新 upvote_count/downvote_count/view_count 字段
  - **Requirements:** 4.11, 4.12, 9.5, 27.1-27.5

- [x] 11. 实现纠错反馈服务
  - 创建 `FeedbackService`：submitFeedback、getFeedbacks、resolveFeedback
  - 纠错反馈接口：POST /api/v1/enriched/{id}/feedback（类型+描述）
  - 纠错反馈 >= 3 条自动触发 status → PENDING_REVIEW
  - 更新 enriched_solutions.feedback_count 字段
  - 管理端：GET /admin/enriched/{id}/feedbacks 查看反馈列表
  - **Requirements:** 22.1-22.5

- [x] 12. 内容安全（Prompt 约束 + 黑名单 + 双重防护）
  - Prompt 模板添加安全约束
  - 黑名单配置文件 + QualityScoreStep 集成
  - 后端入库前 HTML 清洗（双重防护）
  - 前端 DOMPurify 集成
  - 版权标注确认（COMMUNITY 来源显示作者+链接）
  - **Requirements:** 12.1-12.6

- [x] 13. 前端 CollapsibleCard 组件
  - 创建 `CollapsibleCard.tsx`：收起态/展开态完整实现
  - 展开/收起动画（350ms spring）+ 箭头 ▶/▼ 旋转动画（250ms）
  - hover shadow-md + scale(1.005)，active scale(0.98) + opacity(0.9)
  - lazy load 详情 + 会话缓存 + 骨架屏加载态
  - `SourceBadge.tsx`（紫/蓝/绿三色胶囊）+ 来源热度（★ votes）
  - 推荐金色边框 + 完整操作栏（👍/👎/💬/📋/🔗/🐛）
  - 展开态底部复杂度标注区（⏱️ 时间 / 💾 空间），为空时隐藏
  - DOMPurify sanitize + 版权标注（COMMUNITY 来源）
  - 💬 按钮跳转全局评论 Tab
  - **Requirements:** 6.1-6.14, 12.3, 12.4, 12.5, 22.1, 27.1

- [x] 14. 前端骨架屏组件（新增）
  - 创建 `SkeletonLoader.tsx`：卡片骨架屏 + 详情骨架屏
  - shimmer 动画（渐变流动），暗色/亮色主题适配
  - 列表加载时显示 2-3 张卡片骨架屏
  - 展开加载时显示详情骨架屏（文字占位+代码块占位）
  - 加载失败时替换为错误提示+重试按钮
  - **Requirements:** 25.1-25.4

- [x] 15. 前端解析列表容器和级别切换
  - 创建 `EnrichedSolutionList.tsx`：级别切换+列表管理+前端缓存
  - Apple 风格 LevelTabs 分段控制器（含副标题：直觉/入门/标准/深入/专家）
  - 级别 Tab 显示该级别解析条数气泡
  - 新用户引导气泡："不确定看哪个？建议从 L3 标准开始"（3 秒消失）
  - TagFilter 标签筛选栏（多选+联动+自动隐藏）
  - "全部展开/收起"按钮 + quality_score 排序 + recommended 置顶
  - legacy fallback 展示（灰色标记，无推荐/评分/操作栏简化）
  - **Requirements:** 5.5, 6.7, 6.9, 14.1-14.5, 21.1-21.4

- [x] 16. 前端空状态和生成进度组件
  - `EmptyState.tsx`：引导文案 + 生成按钮 + 预计时间
  - 未登录登录引导（集成 LoginGuideModal）
  - `GenerationProgress.tsx`：进度条+步骤名+剩余时间+取消按钮
  - 轮询逻辑（2s→5s→60s 停止）+ 完成自动刷新 + 失败重试
  - `useEnrichmentTask` Hook 封装全部逻辑
  - **Requirements:** 11.1-11.7, 13.1-13.4

- [x] 17. 前端原始题解 Tab
  - `RawSolutionList.tsx`：复用 CollapsibleCard
  - 收起态显示：标题、作者、发布时间、点赞数、浏览数、语言标签
  - 排序切换（点赞/时间）+ 语言筛选下拉 + 分页
  - "已 AI 丰富"标记 + 管理员"✨ AI 丰富"按钮
  - 题目详情页添加"📋 原始题解" Tab
  - **Requirements:** 7.1-7.8

- [x] 18. 前端登录引导弹窗（新增）
  - 创建 `LoginGuideModal.tsx`：操作说明+登录按钮+关闭按钮
  - 支持 intent 参数（upvote/downvote/generate/feedback）
  - 登录成功后自动执行原操作（sessionStorage 恢复 intent）
  - 全局复用（点赞/踩/生成/纠错 统一调用）
  - **Requirements:** 26.1-26.4

- [x] 19. 前端投票交互（新增）
  - 操作栏集成 👍/👎 按钮
  - 点赞/踩互斥 UI 状态（已赞态蓝色，已踩态红色，未操作灰色）
  - 踩计数仅管理员可见，普通用户只显示按钮状态
  - 调用 upvote/downvote API + 乐观更新 UI
  - 未登录触发 LoginGuideModal
  - **Requirements:** 6.6, 6.10, 27.1-27.5

- [x] 20. 前端纠错反馈弹窗（新增）
  - 创建 `FeedbackModal.tsx`：错误类型下拉 + 描述文本框
  - 表单校验（描述 10-500 字）
  - 提交成功 toast 提示
  - 未登录触发 LoginGuideModal
  - **Requirements:** 22.1-22.4

- [x] 21. 前端错误处理和统一 API 层
  - `useEnrichmentError` Hook：统一错误码处理
  - enriched API 调用函数（类型安全 fetch wrapper）
  - TypeScript 类型定义（EnrichedSolution、RawSolution、TaskStatus 等）
  - 频率超限倒计时提示组件
  - 乐观锁冲突时的 toast + 自动刷新
  - **Requirements:** 8.3, 错误处理, 40004 冲突处理

- [x] 22. 前端页面 Tab 结构与导航
  - 改造顶部 4 Tab 栏（AI解析/原始题解/用户题解/评论）
  - Tab 切换动画（蓝色指示条 250ms spring）
  - 各 Tab 数据独立缓存
  - URL query 参数直达（?tab=ai|raw|user|comment）
  - 保持用户题解和评论 Tab 不变
  - **Requirements:** 15.1-15.6

- [x] 23. 前端题目标题区与多语言切换
  - 标题区：题目标题 + 难度标签（简单绿/中等黄/困难红）+ 分类标签
  - "EN"按钮切换中/英文题目描述
  - localStorage 记住语言偏好
  - 语言切换仅影响题目描述，不影响解析内容
  - **Requirements:** 20.1-20.4

- [x] 24. 前端交互体验增强
  - 暗色模式适配（所有新组件）+ 跟随系统/手动切换/记住偏好
  - 代码语法高亮主题（亮色/暗色双主题）
  - 键盘快捷键（J/K/Enter/1-5/Esc）+ focus ring 反馈
  - 输入框获焦时禁用快捷键
  - 右侧 mini 目录（≥2 张展开卡片时，桌面 ≥1280px）
  - "回到顶部"浮动按钮 + sticky header
  - 响应式布局（Desktop XL/Desktop/Tablet/Mobile 四断点）
  - 移动端代码"全屏查看"按钮
  - **Requirements:** 16.1-16.10

- [x] 25. 分享与外链功能
  - 分享按钮：复制直达链接+toast 提示
  - 链接格式：`/problems/{id}?tab=ai&level={n}&solution={solutionId}`
  - 打开链接自动定位 Tab+级别+展开卡片+滚动到可视区域
  - 无效 solutionId 容错：fallback 到列表页 + toast 提示
  - 复制按钮：复制代码块内容
  - **Requirements:** 17.1-17.4

- [x] 26. 阅读进度与学习路径
  - localStorage 存储每题最后阅读级别（LRU 200 条）
  - 打开题目时自动切换到上次级别
  - 底部"进阶建议"引导（非 L5 时）
  - **Requirements:** 18.1-18.4

- [x] 27. 性能优化
  - LaTeX/Mermaid 懒渲染（Intersection Observer）
  - 代码高亮按需渲染（仅当前语言 Tab）
  - 图片 native lazy loading
  - 后端详情接口 IP 限流（60次/分/IP）
  - 列表接口 ETag 支持
  - **Requirements:** 19.1-19.5

- [x] 28. 底部全局信息栏
  - 前端底部信息栏："基于 Top N 高赞社区题解 + AI 丰富 · 内容持续更新"
  - 仅在有内容时显示，空状态/进度态隐藏
  - 小字号（12px）、低对比度灰色文字
  - **Requirements:** 23.1-23.3

- [x] 29. 管理后台审核队列页面（新增）
  - 创建 `/admin/review` 审核队列页面
  - 列表展示：题目名称、级别、标题、quality_score、创建时间、纠错反馈数
  - 支持按题目搜索和按 quality_score 排序
  - 内容预览 + 一键"通过发布"/"拒绝"操作
  - 拒绝时要求输入拒绝原因
  - 操作后失效对应缓存
  - **Requirements:** 28.1-28.6

- [x] 30. 管理后台批量任务总览（新增）
  - 创建 `/admin/batch` 批量总览页面
  - 显示总进度（已完成/总数）、成功/失败/进行中数量
  - 支持查看单个失败任务错误详情和重试按钮
  - 后端 batch_id 管理 + 并发度控制（默认 3）
  - **Requirements:** 24.1-24.4

- [x] 31. 综合自检与边界场景处理
  - 验证卡片操作栏"💬"按钮跳转评论 Tab 的交互（跳转前记录滚动位置 + 评论 Tab 有返回按钮）
  - 分享链接无效 ID 容错测试
  - localStorage 容量保护（阅读进度 + 语言偏好 + 主题偏好 < 100KB）
  - 并发更新 enriched 时乐观锁冲突的前端提示
  - 所有页面/功能在亮色和暗色模式下视觉一致性
  - 投票互斥状态在页面刷新后保持正确（从 API 获取用户投票状态）
  - 骨架屏在各种网络环境下的表现（快速/慢速/失败）
  - 移动端操作栏按钮布局适配（窄屏时折叠为更多菜单）
  - AI_ORIGINAL 卡片不显示 ★ 热度的验证
  - L1 卡片操作栏"📋 复制全文"替代"📋 复制"的验证
  - 频率超限倒计时刷新后从 localStorage 恢复
  - 新用户首次打开 L3 无内容时智能选择有内容的级别
  - 生成完成后用户已切走时 toast 提示而非强制刷新
  - **Requirements:** 跨需求集成验证

- [x] 32. 管理操作审计日志（新增）
  - 创建 `admin_audit_log` 表（operator/action/target/before_state/after_state）
  - 创建 `AdminAuditService`：记录所有管理操作
  - 在审核通过/拒绝/删除/批量/推荐/处理反馈操作中埋入审计记录
  - 管理后台审计日志查看页面（按操作人/时间范围筛选）
  - 日志保留策略：90 天自动清理
  - **Requirements:** 32.1-32.4

- [x] 33. 管线输出安全保护（新增）
  - 实现 `ContentLengthGuard`：L1≤5KB/L2-L3≤30KB/L4-L5≤50KB
  - 集成到 PolishStep 输出后处理（截断+警告）
  - 实现 `UrlWhitelistValidator`：source_url 域名白名单校验
  - 集成到 EnrichedSolution 入库前校验
  - 白名单配置外置（application.yml）
  - **Requirements:** 31.1-31.3

- [x] 34. Recommended 标记管理（新增）
  - 管理后台审核通过时增加"标记为推荐"复选框
  - 后端 setRecommended API + 同题同级别唯一性约束
  - recommended=true 时列表置顶展示
  - 前端金色边框 + "推荐" 标签完整实现
  - **Requirements:** 29.1-29.4

- [x] 35. 详情接口完整性增强（新增）
  - detail 接口响应补充 title/summary/tags/sourceType/sourceVotes/qualityScore/recommended 字段
  - 分享链接场景：前端同时请求 detail + list，detail 先到先渲染
  - 用户级 detail 限流（200/min/user）
  - **Requirements:** 30.1-30.3

## Task Dependency Graph

```json
{
  "waves": [
    { "tasks": [1, 2], "description": "数据模型基础" },
    { "tasks": [3], "description": "管线框架" },
    { "tasks": [4, 5, 6], "description": "管线步骤实现（可并行）" },
    { "tasks": [7], "description": "异步任务管理" },
    { "tasks": [8, 9], "description": "API 层 + 权限（可并行）" },
    { "tasks": [10, 11, 12], "description": "投票/反馈/安全（可并行）" },
    { "tasks": [13, 14, 15, 16], "description": "前端核心组件（可并行）" },
    { "tasks": [17, 18, 19, 20, 21], "description": "前端功能组件（可并行）" },
    { "tasks": [22, 23, 24, 25, 26, 27, 28], "description": "页面结构/体验增强（可并行）" },
    { "tasks": [29, 30, 31, 32, 33, 34, 35], "description": "管理后台/安全加固/自检（可并行）" }
  ]
}
```

## Notes

### 优先级划分

| 优先级 | Tasks | 说明 |
|--------|-------|------|
| P0 核心功能 | 1-8, 13, 15-17, 22 | 基本可用的 MVP |
| P1 必要保障 | 9, 10, 11, 12, 14, 21, 33, 35 | 安全/反馈/错误处理/输出保护 |
| P2 体验增强 | 18-20, 23-28 | 登录引导/交互/性能 |
| P3 完善收尾 | 29-32, 34 | 管理后台/审计/自检 |

### 关键对齐确认

**UI 预览 → Spec 对齐清单：**

| UI 元素 | 对应 Requirement | 对应 Task |
|---------|-----------------|-----------|
| 页面标题区（题名+难度+EN按钮） | R20 | T23 |
| 主 Tab 栏（4 Tab） | R15 | T22 |
| 级别选择器（Apple 风格） | R21 | T15 |
| 标签筛选栏 | R14 | T15 |
| 卡片收起态（标题/摘要/来源/★热度/箭头） | R6.1 | T13 |
| 卡片展开态（Markdown + 代码 Tab） | R6.2 | T13 |
| 来源胶囊（紫/蓝/绿） | R6.4 | T13 |
| AI_ORIGINAL 不显示 ★ 热度 | R6.15 | T13 |
| 代码多语言 Tab + 复制按钮 | R6.2, R17.3 | T13 |
| 复杂度标注区（⏱️💾） | R6.11 | T13 |
| 操作栏（👍👎💬📋🔗🐛） | R6.6, R27, R33 | T13, T19, T20 |
| L1 操作栏"📋 复制全文" | R6.16 | T13 |
| 底部信息栏 | R23 | T28 |
| 空状态 + 生成按钮 | R13 | T16 |
| 生成进度条 | R11 | T16 |
| 原始题解 Tab（排序/筛选/分页） | R7 | T17 |
| 推荐金色边框 | R6.5, R29 | T13, T34 |
| legacy 灰色标记 | R5.5 | T15 |
| hover/active 微交互 | R6.12 | T13 |
| 箭头旋转动画 | R6.13 | T13 |
| 骨架屏加载 | R25 | T14 |
| 登录引导弹窗 | R26 | T18 |
| 纠错反馈弹窗 | R22 | T20 |
| 踩按钮+互斥+计数规则 | R27, R33 | T19 |
| 管理后台审核 | R28 | T29 |
| 管理后台批量 | R24 | T30 |
| 管理操作审计日志 | R32 | T32 |
| 内容长度保护+URL白名单 | R31 | T33 |
| 详情接口完整字段 | R30 | T35 |

### 其他说明

- "用户题解" Tab 和"评论" Tab 属于现有功能，本 spec 保持不变
- 前后端可并行：后端 Task 1-12 与前端 Task 13-20 可在 API 接口定义（Task 8）后并行开发
- 暗色模式为 UI 预览的默认展示模式，亮色模式同步适配
- 卡片操作栏的"💬"按钮定义为跳转全局评论 Tab（非独立卡片评论），跳转前记录滚动位置 + 评论 Tab 有返回按钮
- 👎 踩的计数仅管理员可见，普通用户只看自己是否已踩（按钮状态），避免负面心理
- 管理后台页面为独立路由，不影响用户侧功能
- recommended 标记由管理员手动设置（非自动选 quality_score 最高），同题同级别最多 1 条
- AI_ORIGINAL 类型卡片不展示 ★ 热度（无来源题解票数）
- L1 卡片操作栏将"📋 复制"替换为"📋 复制全文"（L1 无代码）
- 生成完成时如果用户已切走当前级别，不强制刷新打断用户，改为 toast 提示
- 新用户首次访问的默认级别智能选择：L3 有内容选 L3，否则选有内容的最低级别
- 频率超限倒计时 endTime 持久化到 localStorage，刷新页面后恢复显示
- detail 接口返回完整字段，支持分享链接场景直接渲染无需列表缓存
- 管理操作审计日志覆盖所有敏感操作，保留 90 天
