# Requirements Document

## Introduction

内容解析系统 v2 将当前"AI 凭空生成解析"模式重构为"基于真实题解 + AI 丰富"模式。系统从 LeetCode 爬取 top N 高赞社区题解作为 AI 输入素材，通过可插拔管线对原始题解进行纠错、润色、多语言补全、分级筛选和可视化增强，生成高质量的结构化解析内容。生成结果存入新表 `enriched_solutions`，支持一题一级别多条解析。前端展示为列表 + 展开/收起卡片交互，新增"原始题解" Tab 直接展示爬取数据。生成过程为异步模式，用户触发后返回 taskId 并通过轮询查询进度。系统与 v1 并存，优先读取 enriched 数据，无数据时 fallback 到 legacy explanations。

## Glossary

- **Enrichment_Pipeline**: v2 AI 处理管线，负责将原始题解经过多步骤处理转化为结构化的 enriched 解析内容
- **Enriched_Solution**: AI 丰富后的解析记录，存储在 `enriched_solutions` 表中，包含标题、摘要、完整 Markdown 内容、多语言代码实现
- **Crawled_Solution**: 从 LeetCode 等平台爬取的原始社区题解，存储在 `crawled_solutions` 表中
- **Enrichment_Step**: 管线中的单个可插拔处理步骤（如纠错、润色、多语言补全等）
- **Task_Manager**: 异步任务管理器，负责任务创建、状态追踪、进度更新和失败重试
- **Quality_Scorer**: 质量评分组件，对 enriched 内容进行自动打分（0-1 分）
- **Diversity_Checker**: 差异化检查组件，确保同题同级别的多条解析之间有足够差异
- **Unified_Service**: 统一解析查询服务，封装 enriched 优先、legacy fallback 的路由逻辑
- **CollapsibleCard**: 前端展开/收起卡片组件，列表默认收起只展示摘要，点击展开加载完整内容
- **Source_Type**: 解析来源类型枚举，包括 COMMUNITY（社区题解）、AI_ORIGINAL（纯 AI）、OFFICIAL（官方 Editorial）、LEGACY_V1（v1 迁移）
- **TagFilter**: 解法标签筛选组件，基于 enriched_solutions.tags 字段聚合，用户可按标签过滤解析列表
- **LevelTabs**: 级别选择器组件，L1-L5 横向 Tab 切换，Apple 风格分段控制器
- **GenerationProgress**: 生成进度组件，展示管线步骤进度、预估剩余时间和取消/重试操作
- **ThemeMode**: 主题模式，支持亮色/暗色/跟随系统三种模式切换
- **ComplexityInfo**: 复杂度标注信息，展示算法的时间复杂度和空间复杂度
- **SkeletonLoader**: 骨架屏加载组件，卡片展开加载详情时展示内容占位动画
- **AdminDashboard**: 管理后台仪表盘，提供批量操作、审核队列和数据统计

## Requirements

### Requirement 1: Enriched Solutions 数据模型

**User Story:** As a 开发者, I want 系统具备独立的 enriched_solutions 数据表, so that 能够存储一题一级别多条 AI 丰富后的解析内容并支持版本管理和状态审核。

#### Acceptance Criteria

1. THE Enriched_Solution SHALL 包含字段：id、problem_id、level(1-5)、source_solution_id、source_type、title、summary、content(Markdown)、code_implementations(JSON)、tags(JSON)、ai_provider、processing_steps(JSON)、quality_score(0-1)、version、is_latest、sort_order、recommended、status、view_count、upvote_count、created_at、updated_at
2. THE Enriched_Solution SHALL 支持 status 状态枚举：DRAFT、PUBLISHED、REJECTED、PENDING_REVIEW
3. THE Enriched_Solution SHALL 支持 source_type 枚举：COMMUNITY、AI_ORIGINAL、OFFICIAL、LEGACY_V1
4. WHEN source_type 为 COMMUNITY 时, THE Enriched_Solution SHALL 记录 source_author、source_url 和 source_votes 字段用于版权追溯和热度展示
5. WHEN level 为 1 时, THE Enriched_Solution SHALL 将 code_implementations 设为 null（L1 禁止代码）
6. THE Enriched_Solution SHALL 通过 (problem_id, level, status) 联合索引支持按题目和级别的高效查询
7. THE Enriched_Solution SHALL 包含 time_complexity 和 space_complexity 字段，用于展开态底部复杂度标注展示
8. THE Enriched_Solution SHALL 包含 version 字段支持乐观锁并发控制，每次更新 version + 1

### Requirement 2: AI Enrichment Pipeline（可插拔管线）

**User Story:** As a 开发者, I want AI 处理管线具备可插拔的步骤架构, so that 能够灵活配置和扩展内容丰富的处理流程。

#### Acceptance Criteria

1. THE Enrichment_Pipeline SHALL 接受题目信息和 top N 原始题解作为输入，产出 Enriched_Solution 对象
2. THE Enrichment_Pipeline SHALL 按顺序执行以下步骤：ErrorCheck → SourceFilter → Polish → MultiLang → Visualization → DiversityCheck → QualityScore
3. WHEN 某个非核心步骤执行失败时, THE Enrichment_Pipeline SHALL 降级跳过该步骤并记录警告，继续执行后续步骤
4. THE Enrichment_Step SHALL 实现统一接口，包含 getName()、isApplicable(context) 和 process(context) 方法
5. WHEN 目标级别为 L1 时, THE Enrichment_Pipeline SHALL 跳过 MultiLang 步骤（L1 不含代码）
6. THE Enrichment_Pipeline SHALL 通过 YAML 配置文件控制各步骤的开关状态
7. WHEN SourceFilter 步骤执行时, THE Enrichment_Pipeline SHALL 根据目标级别从 top N 原始题解中筛选最匹配的素材子集

### Requirement 3: 异步任务管理

**User Story:** As a 用户, I want AI 生成过程为异步模式, so that 不需要等待长时间的 AI 处理过程阻塞页面操作。

#### Acceptance Criteria

1. WHEN 用户触发 AI 生成请求时, THE Task_Manager SHALL 返回 HTTP 202 响应，包含 taskId 和预估耗时
2. WHILE 任务正在执行时, THE Task_Manager SHALL 在 Redis 中维护任务状态（PENDING → PROCESSING → COMPLETED/FAILED/CANCELLED）和步骤级进度信息
3. WHEN 同一题目同一级别已有活跃任务时, THE Task_Manager SHALL 返回已有 taskId 实现幂等性，不重复创建任务
4. IF AI 调用超时, THEN THE Task_Manager SHALL 自动重试最多 2 次，间隔 5 秒和 15 秒（指数退避）
5. IF AI 返回格式错误, THEN THE Task_Manager SHALL 自动重试 1 次
6. IF 单个任务执行时间超过 3 分钟, THEN THE Task_Manager SHALL 自动标记为 FAILED 并清理活跃任务标记
7. THE Task_Manager SHALL 使用 Redis key `gen:active:{problemId}:L{level}` 标记活跃任务，TTL 为 5 分钟
8. WHEN 任务完成或失败时, THE Task_Manager SHALL 清理对应的 Redis 活跃任务标记
9. WHEN 用户请求取消任务时, THE Task_Manager SHALL 标记任务为 CANCELLED 状态并尽最大努力中断正在进行的 AI 调用
10. THE Task_Manager SHALL 在任务状态 Hash 中记录 startedAt 字段，用于前端计算预估剩余时间

### Requirement 4: API 接口设计

**User Story:** As a 前端开发者, I want 系统提供完整的 RESTful API, so that 前端能够查询解析列表、触发生成、查询进度和展示原始题解。

#### Acceptance Criteria

1. WHEN 前端请求 GET /api/v1/enriched/{problemId}/level/{level} 时, THE Unified_Service SHALL 返回该题该级别的 enriched 解析摘要列表（不含 content 和 codeImplementations 完整内容）
2. WHEN 前端请求 GET /api/v1/enriched/{id}/detail 时, THE Unified_Service SHALL 返回单条解析的完整内容（含 Markdown content、codeImplementations、timeComplexity、spaceComplexity）
3. WHEN 前端请求 POST /api/v1/enriched/{problemId}/generate 时, THE Task_Manager SHALL 创建异步生成任务并返回 taskId
4. WHEN 前端请求 GET /api/v1/enriched/tasks/{taskId} 时, THE Task_Manager SHALL 返回任务当前状态和步骤级进度
5. WHEN 前端请求 GET /api/v1/raw-solutions/{problemId} 时, THE Unified_Service SHALL 返回该题的原始题解列表，支持按点赞数或时间排序、按语言筛选和分页
6. THE Unified_Service SHALL 对列表接口结果缓存到 Redis，enriched 列表 TTL 为 1 小时，详情 TTL 为 24 小时，原始题解列表 TTL 为 6 小时
7. WHEN 新增或修改 enriched 记录时, THE Unified_Service SHALL 失效对应的缓存 key
8. WHEN 前端请求 DELETE /api/v1/enriched/tasks/{taskId} 时, THE Task_Manager SHALL 取消正在执行的任务
9. WHEN 前端请求 GET /api/v1/enriched/{problemId}/level/{level}/tags 时, THE Unified_Service SHALL 返回该级别下所有解析的标签聚合列表，用于前端筛选
10. THE 列表接口摘要中 SHALL 包含 source_votes 字段（来源题解的原始点赞数），用于前端展示"★ {votes}"热度
11. WHEN 前端请求 POST /api/v1/enriched/{id}/upvote 时, THE 后端 SHALL 增加点赞计数并调整 quality_score（+0.01）
12. WHEN 前端请求 POST /api/v1/enriched/{id}/downvote 时, THE 后端 SHALL 增加踩计数并调整 quality_score（-0.02）

### Requirement 5: v1/v2 并存与 Fallback 机制

**User Story:** As a 用户, I want 新旧系统平滑过渡, so that 在 v2 数据尚未覆盖所有题目时仍能看到 v1 的解析内容。

#### Acceptance Criteria

1. WHEN 查询某题某级别的解析时, THE Unified_Service SHALL 优先查询 enriched_solutions 表中状态为 PUBLISHED 的记录
2. IF enriched_solutions 中无数据, THEN THE Unified_Service SHALL fallback 查询 explanations 表中 is_latest=true 的记录
3. THE Unified_Service SHALL 在响应中标记数据来源（source 字段：enriched 或 legacy），供前端区分展示逻辑
4. THE Unified_Service SHALL 保持现有 explanations 表和 ContentPipeline 不做修改，确保 v1 功能正常运行
5. WHEN source 为 legacy 时, THE 前端 SHALL 以单条卡片展示，显示灰色"v1 解析"标记，不显示推荐标签和质量评分

### Requirement 6: 前端解析列表与展开交互

**User Story:** As a 用户, I want 解析内容以列表卡片形式展示并支持展开/收起, so that 能够快速浏览多条解析摘要并按需查看详情。

#### Acceptance Criteria

1. THE CollapsibleCard SHALL 默认收起状态显示：标题、摘要（最多 2 行）、来源标记胶囊、标签列表、来源热度（★ {votes}）和质量评分
2. WHEN 用户点击卡片时, THE CollapsibleCard SHALL 展开显示完整 Markdown 内容和多语言代码 Tab，展开动画为 350ms spring 缓动
3. WHEN 卡片展开时, THE CollapsibleCard SHALL 通过 lazy load 请求详情 API 获取完整内容，展示骨架屏加载动画
4. THE CollapsibleCard SHALL 根据 source_type 显示对应颜色的来源标记胶囊（COMMUNITY=紫色、AI_ORIGINAL=蓝色、OFFICIAL=绿色）
5. WHEN 某条解析的 recommended 为 true 时, THE CollapsibleCard SHALL 显示金色边框和"推荐"标签
6. THE CollapsibleCard SHALL 在展开状态底部显示操作栏：点赞👍、踩👎、评论💬（跳转评论Tab）、复制📋、分享🔗、纠错🐛
7. WHEN 用户切换级别 Tab 时, THE CollapsibleCard SHALL 缓存已加载级别的数据，切回时命中缓存不重复请求；切回时通过 ETag 校验缓存新鲜度，304 命中用缓存，否则刷新
8. THE CollapsibleCard SHALL 在单次会话内缓存已加载的详情数据，收起再展开时不重复请求
9. THE 前端 SHALL 提供"全部展开/全部收起"操作按钮，一键控制当前级别所有卡片
10. WHEN 用户未登录时点击操作栏中的点赞或踩按钮, THE 前端 SHALL 弹出登录引导弹窗
11. THE CollapsibleCard SHALL 在展开态底部操作栏上方显示复杂度标注区（⏱️ 时间复杂度 / 💾 空间复杂度），字段为空时隐藏
12. THE CollapsibleCard SHALL 在 hover 时显示 shadow-md + scale(1.005) 微交互，按下时 scale(0.98) + opacity(0.9) 反馈
13. THE CollapsibleCard SHALL 支持展开/收起时箭头 ▶/▼ 的 250ms 旋转动画
14. THE CollapsibleCard SHALL 在操作栏"💬"按钮点击时跳转到全局评论 Tab 并定位到评论区，跳转前记录当前滚动位置，评论 Tab 提供"返回解析"按钮可快速回到原位置
15. WHEN source_type 为 AI_ORIGINAL 时, THE CollapsibleCard SHALL 不显示 ★ 热度（AI 原创无来源题解票数）
16. WHEN level 为 1 时, THE CollapsibleCard 操作栏 SHALL 隐藏"📋 复制"按钮（L1 无代码可复制），改为"📋 复制全文"复制完整 Markdown 文本

### Requirement 7: 原始题解展示

**User Story:** As a 用户, I want 查看爬取的原始社区题解, so that 能够对照 AI 丰富前后的内容差异并直接阅读高赞题解原文。

#### Acceptance Criteria

1. THE Unified_Service SHALL 在题目详情页新增"原始题解" Tab，展示 crawled_solutions 数据
2. THE Unified_Service SHALL 支持按点赞数降序（默认）和按时间降序两种排序方式
3. THE Unified_Service SHALL 支持按编程语言筛选（Python/Java/Go/C++ 等）
4. THE CollapsibleCard SHALL 对原始题解同样采用展开/收起交互，展开后显示原始 Markdown 内容
5. WHEN 某条原始题解已有对应的 enriched 记录时, THE CollapsibleCard SHALL 显示"已 AI 丰富"标记（通过 enriched_solutions.source_solution_id 反查）
6. THE Unified_Service SHALL 对原始题解列表支持分页，默认每页 10 条，最大 50 条
7. WHEN 管理员查看原始题解时, THE 前端 SHALL 在每条原始题解卡片显示"✨ AI 丰富"操作按钮，触发单条丰富
8. THE 原始题解卡片收起态 SHALL 显示：标题、作者（@author）、发布时间、点赞数（★）、浏览数、包含的编程语言标签

### Requirement 8: 权限与频率控制

**User Story:** As a 系统管理员, I want 对生成操作进行权限和频率控制, so that 防止资源滥用并区分普通用户和管理员的操作范围。

#### Acceptance Criteria

1. THE Unified_Service SHALL 允许游客查看已发布的 enriched 解析和原始题解（只读）
2. THE Unified_Service SHALL 允许登录用户触发 AI 生成，但限制为每用户每小时最多 5 次
3. IF 用户触发生成超过频率限制, THEN THE Unified_Service SHALL 返回 40002 错误码和"请稍后再试"提示，同时返回剩余等待秒数和已用/上限次数
4. THE Unified_Service SHALL 仅允许管理员执行批量生成、单条 AI 丰富、审核状态修改和删除操作
5. WHEN 管理员执行批量生成时, THE Task_Manager SHALL 限制每批最多 50 题
6. THE Unified_Service SHALL 使用 Redis 滑动窗口记录用户的生成频率
7. WHEN 用户重试失败的任务时, THE Unified_Service SHALL 不额外消耗频率额度（复用原 taskId）
8. WHEN generate 接口未指定 level 时（生成全部级别），该操作 SHALL 仅管理员可用，普通用户必须指定单个 level
9. THE 前端 SHALL 将频率超限的倒计时 endTime 存储到 localStorage，刷新页面后继续显示剩余等待时间

### Requirement 9: 质量评分与自动审核

**User Story:** As a 系统管理员, I want 生成内容经过自动质量评分和审核, so that 只有达标的内容才自动发布，不达标的内容进入人工审核队列。

#### Acceptance Criteria

1. THE Quality_Scorer SHALL 对每条 enriched 内容按以下维度评分：结构完整性(25%)、代码正确性(25%)、内容丰富度(20%)、无跳步检查(15%)、多语言覆盖(15%)
2. WHEN level 为 1 时, THE Quality_Scorer SHALL 使用调整后的评分维度，不含"代码正确性"和"多语言覆盖"
3. WHEN quality_score >= 0.6 且不含黑名单词汇且代码语法正确且非首次生成的题目时, THE Quality_Scorer SHALL 自动将 status 设为 PUBLISHED
4. IF 自动审核未通过, THEN THE Quality_Scorer SHALL 将 status 设为 PENDING_REVIEW 等待人工审核
5. THE Quality_Scorer SHALL 支持用户反馈修正评分：每次 upvote 加 0.01（上限 +0.3），每次 downvote 减 0.02（下限 -0.3）

### Requirement 10: 差异化检查

**User Story:** As a 用户, I want 同一题目同一级别的多条解析之间有足够差异, so that 每条解析都提供独特的视角和价值而非重复内容。

#### Acceptance Criteria

1. THE Diversity_Checker SHALL 在 QualityScore 步骤之前执行，将新生成内容与已有 enriched 记录对比
2. WHEN 标题相似度 >= 0.7（Jaccard 分词对比）时, THE Diversity_Checker SHALL 拒绝该解析并标记原因
3. WHEN 核心思路段落相似度 >= 0.6（余弦相似度）时, THE Diversity_Checker SHALL 拒绝该解析并标记原因
4. WHEN 检查不通过时, THE Diversity_Checker SHALL 将状态设为 REJECTED 并记录"与已有解析 {id} 相似度过高"

### Requirement 11: 前端生成进度展示

**User Story:** As a 用户, I want 实时看到 AI 生成的进度, so that 了解当前处于哪个步骤以及预计还需等待多久。

#### Acceptance Criteria

1. WHEN 用户触发生成后, THE GenerationProgress SHALL 显示进度条 UI，展示当前步骤名称、总步骤数和已完成步骤数
2. THE GenerationProgress SHALL 在前 10 秒每 2 秒轮询一次任务状态，10-60 秒内每 5 秒轮询一次
3. IF 轮询超过 60 秒未完成, THEN THE GenerationProgress SHALL 切换为"仍在生成中，页面将自动刷新"提示并降低轮询频率到每 30 秒一次（不停止轮询）
4. WHEN 任务状态变为 COMPLETED 时, IF 用户仍在当前级别 Tab THEN THE GenerationProgress SHALL 自动刷新列表; IF 用户已切走 THEN 显示 toast "L{n} 解析已生成" 且切回时自动展示新内容
5. WHEN 任务状态变为 FAILED 时, THE GenerationProgress SHALL 展示错误信息和"重试"按钮
6. THE GenerationProgress SHALL 显示"取消生成"按钮，点击后调用取消 API 并恢复到空状态/列表状态
7. THE GenerationProgress SHALL 基于已完成步骤数和平均步骤耗时计算并展示"预计剩余 X 秒"

### Requirement 12: 内容安全与版权标注

**User Story:** As a 系统管理员, I want 生成内容经过安全检查并标注版权来源, so that 防止不当内容发布并尊重原作者的知识产权。

#### Acceptance Criteria

1. THE Enrichment_Pipeline SHALL 在 Prompt 模板中约束 AI 禁止生成非法或不当内容
2. THE Quality_Scorer SHALL 在自动审核时检查是否包含黑名单词汇（脏话、广告、政治敏感）
3. WHEN 前端渲染 Markdown 内容时, THE CollapsibleCard SHALL 使用 DOMPurify 进行 HTML sanitize
4. WHEN source_type 为 COMMUNITY 时, THE CollapsibleCard SHALL 在卡片底部显示"基于 @{author} 的题解丰富"和原始链接
5. THE Enriched_Solution SHALL 在来源标记胶囊中展示 source_type 对应的标签作为版权声明的一部分
6. THE 后端 SHALL 在 enriched 内容入库前进行基础 HTML 清洗（去除 script 标签等），实现双重防护

### Requirement 13: 空状态与生成入口

**User Story:** As a 用户, I want 在没有内容时看到清晰的引导, so that 了解可以触发 AI 生成并知道预期等待时间。

#### Acceptance Criteria

1. WHEN 某题某级别无 enriched 数据且无 legacy 数据时, THE 前端 SHALL 展示空状态 UI，包含引导文案和"AI 生成解析"按钮
2. THE 前端 SHALL 在空状态 UI 中提示预计等待时间（30-60 秒）
3. WHEN 用户点击"AI 生成解析"按钮时, THE 前端 SHALL 触发 POST /generate 请求并切换到进度展示状态
4. WHEN 用户未登录时, THE 前端 SHALL 显示"登录后可使用 AI 生成"提示并跳转登录

### Requirement 14: 解法标签筛选

**User Story:** As a 用户, I want 在 AI 深度解析列表中按算法标签筛选, so that 能快速找到特定解法类型的解析。

#### Acceptance Criteria

1. THE 前端 SHALL 在级别选择器下方显示解法标签筛选栏，标签来自当前级别所有 enriched_solutions.tags 字段的聚合
2. WHEN 用户点击某个标签时, THE 前端 SHALL 只展示包含该标签的卡片，支持多选
3. THE 前端 SHALL 提供"全部"按钮用于清除标签筛选
4. THE 标签筛选 SHALL 与级别切换联动：切换级别后标签栏自动更新为对应级别的标签集合
5. WHEN 某级别下只有 1 条或 0 条解析时, THE 前端 SHALL 隐藏标签筛选栏（无需筛选）

### Requirement 15: 页面 Tab 结构与导航

**User Story:** As a 用户, I want 题目详情页有清晰的 Tab 结构, so that 能在 AI 解析、原始题解、用户题解和评论之间流畅切换。

#### Acceptance Criteria

1. THE 前端 SHALL 在题目详情页顶部显示 4 个主 Tab：📖 AI深度解析、📋 原始题解、📝 用户题解、💬 评论
2. THE Tab 切换 SHALL 使用蓝色底部指示条动画（250ms spring 滑动）
3. THE 前端 SHALL 缓存各 Tab 已加载数据，Tab 切换时不重复请求已加载的数据
4. WHEN URL 中包含 tab 参数时, THE 前端 SHALL 自动切换到对应 Tab（支持分享直达）
5. THE "用户题解" Tab SHALL 保持现有功能不变
6. THE "评论" Tab SHALL 保持现有功能不变

### Requirement 16: 前端交互体验增强

**User Story:** As a 用户, I want 页面交互流畅且有良好的视觉反馈, so that 使用起来愉悦且高效。

#### Acceptance Criteria

1. THE 前端 SHALL 支持暗色模式（dark mode），所有组件适配暗色和亮色两套主题，支持跟随系统/手动切换/记住偏好
2. THE 前端 SHALL 支持键盘快捷键：J/K 切换聚焦卡片、Enter 展开/收起、数字 1-5 切换级别
3. WHEN 展开多条卡片后, THE 前端 SHALL 在右侧浮动显示 mini 目录（各卡片标题锚点）
4. WHEN 页面滚动超过 600px 时, THE 前端 SHALL 显示"回到顶部"浮动按钮
5. THE 前端 SHALL 使用 sticky header 在滚动时固定显示当前级别标签
6. THE 前端 SHALL 支持移动端响应式布局：手机端标签缩略为图标、代码区横向滚动
7. WHEN 移动端用户查看代码时, THE 前端 SHALL 提供"全屏查看"按钮以获得更好的阅读体验
8. THE 代码块 SHALL 支持语法高亮主题配色，暗色模式使用暗色高亮主题，亮色模式使用亮色高亮主题
9. THE 前端 SHALL 在键盘快捷键激活时，聚焦的卡片显示明显的 focus ring 视觉反馈
10. THE 前端 SHALL 在输入框（搜索/评论）获焦时自动禁用键盘快捷键，避免冲突

### Requirement 17: 分享与外链

**User Story:** As a 用户, I want 分享某条解析给朋友, so that 他们能直接看到我推荐的内容。

#### Acceptance Criteria

1. WHEN 用户点击分享按钮时, THE 前端 SHALL 复制该条解析的直达链接到剪贴板并显示 toast 提示
2. THE 分享链接 SHALL 包含 problemId、level 和 solutionId 参数，打开后自动定位并展开对应卡片
3. WHEN 用户点击复制按钮时, THE 前端 SHALL 将当前展开的代码块内容复制到剪贴板
4. WHEN 分享链接中的 solutionId 无效或已被删除时, THE 前端 SHALL graceful fallback 到该级别列表页并展示 toast 提示"该解析已不存在"

### Requirement 18: 阅读进度与学习路径

**User Story:** As a 用户, I want 系统记住我的阅读进度并推荐下一步学习方向, so that 回访时能快速继续且得到进阶引导。

#### Acceptance Criteria

1. THE 前端 SHALL 使用 localStorage 记录用户在每题的最后阅读级别，再次打开时自动切换到该级别
2. WHEN 用户在某级别"阅读完"（所有卡片都至少展开过一次）后, THE 前端 SHALL 在底部显示"进阶建议：查看 L{n+1} 了解更深层次内容"引导
3. THE 阅读进度 SHALL 仅存储在本地，不需要登录（后续版本考虑登录态跨端同步）
4. THE 阅读进度 SHALL 使用 LRU 策略，最多存储 200 条记录，超出时淘汰最早的记录
5. THE 前端 SHALL 控制 localStorage 总存储量（阅读进度 + 语言偏好 + 主题偏好）不超过 100KB

### Requirement 19: 性能优化

**User Story:** As a 用户, I want 页面加载快速且滚动流畅, so that 学习过程不被卡顿打断。

#### Acceptance Criteria

1. THE 前端 SHALL 使用 Intersection Observer 对 LaTeX 公式和 Mermaid 图进行懒渲染（进入视口才渲染）
2. THE 前端 SHALL 对代码高亮只渲染当前选中语言 Tab，切换时才渲染其他语言
3. THE 前端 SHALL 对图片使用 native lazy loading（`loading="lazy"`）
4. THE 前端 SHALL 对详情接口加 IP 级限流保护（每 IP 每分钟 60 次），防止恶意爬取
5. THE 列表接口 SHALL 支持 HTTP ETag 缓存头，客户端 304 Not Modified 减少带宽

### Requirement 20: 题目标题区与多语言切换

**User Story:** As a 用户, I want 在题目详情页顶部看到题目标题、难度标签和中英文切换按钮, so that 能快速了解题目基本信息并切换语言查看。

#### Acceptance Criteria

1. THE 前端 SHALL 在题目标题区显示：题目标题、难度标签（简单=绿色/中等=黄色/困难=红色）、题目分类标签
2. THE 前端 SHALL 在标题区右侧提供"EN"切换按钮，点击后题目描述在中/英文之间切换
3. THE 前端 SHALL 记住用户的语言偏好到 localStorage，下次打开自动使用上次选择的语言
4. THE 语言切换 SHALL 仅影响题目描述区域，不影响解析内容（解析始终为中文）

### Requirement 21: 级别选择器体验

**User Story:** As a 用户, I want 级别选择器直观清晰, so that 能快速理解各级别含义并选择适合自己的深度。

#### Acceptance Criteria

1. THE LevelTabs SHALL 以 Apple 风格分段控制器呈现，每个级别显示编号和副标题（L1 直觉/L2 入门/L3 标准/L4 深入/L5 专家）
2. THE LevelTabs SHALL 选中态为蓝色背景滑块，切换时有 spring 滑动动画
3. WHEN 新用户首次访问且无阅读历史时, THE 前端 SHALL 智能选择默认级别：如果 L3 有内容则默认 L3 并显示引导气泡"建议从 L3 标准开始"（3 秒消失）；如果 L3 无内容则默认选有内容的最低级别
4. THE LevelTabs SHALL 在每个级别 Tab 上显示该级别已有的解析条数（气泡数字），0 条时不显示

### Requirement 22: 用户纠错反馈

**User Story:** As a 用户, I want 发现解析内容有错误时能快速反馈, so that 帮助改进内容质量。

#### Acceptance Criteria

1. THE CollapsibleCard SHALL 在展开态操作栏中提供"🐛 纠错"按钮
2. WHEN 用户点击纠错按钮时, THE 前端 SHALL 弹出轻量反馈表单（错误类型下拉 + 错误描述文本框）
3. THE 错误类型 SHALL 包含：代码错误、逻辑错误、表述不清、内容过时、其他
4. THE 纠错反馈 SHALL 提交到后端存储，管理员可在管理后台查看和处理
5. WHEN 某条解析收到 >= 3 条纠错反馈时, THE 后端 SHALL 自动将其 status 改为 PENDING_REVIEW 等待人工复核

### Requirement 23: 底部全局信息栏

**User Story:** As a 用户, I want 了解解析内容的生成来源和更新频率, so that 建立对内容的信任感。

#### Acceptance Criteria

1. THE 前端 SHALL 在解析列表底部显示全局信息栏："基于 Top N 高赞社区题解 + AI 丰富 · 内容持续更新"
2. THE 信息栏 SHALL 使用小字号（12px）、低对比度灰色文字，不抢夺注意力
3. THE 信息栏 SHALL 在空状态和生成进度状态下隐藏，仅在有内容时显示

### Requirement 24: 管理员批量操作总览

**User Story:** As a 管理员, I want 批量生成时看到整体进度和各题状态, so that 了解批量任务的整体完成情况。

#### Acceptance Criteria

1. WHEN 管理员触发批量生成时, THE 后端 SHALL 返回一个 batch_id 和包含所有子 taskId 的列表
2. THE 管理后台 SHALL 提供批量任务总览页面，显示总进度（已完成/总数）、成功/失败/进行中数量
3. THE 管理后台 SHALL 支持查看单个失败任务的错误详情和重试按钮
4. THE 批量生成 SHALL 支持设置并发度（默认同时执行 3 个），避免 AI 服务过载

### Requirement 25: 骨架屏与加载态（新增 — 对齐 UI 体验）

**User Story:** As a 用户, I want 在内容加载时看到优雅的占位动画, so that 感知到页面正在响应而非卡死。

#### Acceptance Criteria

1. WHEN 卡片展开触发详情加载时, THE CollapsibleCard SHALL 显示骨架屏动画（3 行文字占位 + 代码块占位），持续至数据返回
2. WHEN 切换级别触发列表加载时, THE 前端 SHALL 显示 2-3 张卡片骨架屏占位
3. THE 骨架屏 SHALL 使用 shimmer 动画（从左到右的渐变流动），与暗色/亮色主题适配
4. WHEN 加载失败时, THE 骨架屏 SHALL 替换为错误提示和重试按钮

### Requirement 26: 登录引导弹窗（新增 — 对齐 UI 流程）

**User Story:** As a 未登录用户, I want 在需要登录时看到友好的引导弹窗, so that 能快速完成登录并继续操作。

#### Acceptance Criteria

1. WHEN 未登录用户点击点赞/踩/纠错/生成按钮时, THE 前端 SHALL 弹出登录引导弹窗
2. THE 登录引导弹窗 SHALL 展示操作说明（如"登录后即可点赞"）和登录按钮
3. THE 弹窗 SHALL 记录用户的操作意图，登录成功后自动执行原操作（如自动点赞）
4. THE 弹窗 SHALL 支持关闭不登录，关闭后回到原页面状态

### Requirement 27: 踩（Downvote）交互设计（新增 — 对齐评分机制）

**User Story:** As a 用户, I want 对质量不佳的解析表达不满, so that 帮助系统识别低质量内容并降低其排序。

#### Acceptance Criteria

1. THE CollapsibleCard 操作栏 SHALL 包含"👎"踩按钮，位于点赞按钮右侧
2. WHEN 用户点击踩按钮时, THE 前端 SHALL 调用 POST /api/v1/enriched/{id}/downvote 接口
3. THE 踩按钮 SHALL 与点赞互斥：已点赞时点踩会取消点赞再踩，反之亦然
4. THE 前端 SHALL 显示踩的计数（可选：仅管理员可见完整计数，普通用户只看是否已踩）
5. WHEN 用户已踩某条解析时, THE 踩按钮 SHALL 显示已激活状态（红色/深色），再次点击取消

### Requirement 28: 管理后台审核队列 UI（新增 — 补充管理功能）

**User Story:** As a 管理员, I want 在管理后台看到待审核内容的队列, so that 能高效处理 AI 生成的内容审核。

#### Acceptance Criteria

1. THE 管理后台 SHALL 提供审核队列页面，按创建时间倒序展示所有 PENDING_REVIEW 状态的 enriched 内容
2. THE 审核队列 SHALL 显示：题目名称、级别、标题、quality_score、创建时间、纠错反馈数
3. THE 管理员 SHALL 可以在审核页面内预览完整内容并一键"通过发布"或"拒绝"
4. WHEN 管理员通过审核时, THE 后端 SHALL 将 status 改为 PUBLISHED 并失效对应缓存
5. WHEN 管理员拒绝时, THE 后端 SHALL 将 status 改为 REJECTED 并记录拒绝原因
6. THE 审核队列 SHALL 支持按题目搜索和按 quality_score 排序筛选

### Requirement 29: Recommended 标记规则（新增 — 逻辑完善）

**User Story:** As a 管理员, I want recommended 标记由人工控制, so that 推荐内容是经过验证的高质量解析而非仅靠自动评分。

#### Acceptance Criteria

1. THE recommended 标记 SHALL 由管理员在审核队列或管理后台手动设置，不自动根据 quality_score 最高值设定
2. THE 前端 SHALL 将 recommended=true 的卡片置顶显示（金色边框），其余按 quality_score 降序排列
3. WHEN 管理员标记 recommended 时, THE 后端 SHALL 确保同题同级别最多有 1 条 recommended 记录
4. THE 管理后台 SHALL 在审核通过时提供"标记为推荐"复选框

### Requirement 30: 详情接口完整性（新增 — 对齐分享场景）

**User Story:** As a 用户通过分享链接访问, I want 详情接口返回完整信息, so that 即使没有列表缓存也能正确渲染卡片。

#### Acceptance Criteria

1. THE detail 接口 SHALL 返回完整字段，包含 title、summary、tags、sourceType、sourceAuthor、sourceUrl、sourceVotes、qualityScore、recommended、timeComplexity、spaceComplexity，除了 content 和 codeImplementations
2. THE 前端 SHALL 支持从分享链接直接请求 detail 接口渲染单卡片，不强依赖列表缓存
3. WHEN 分享链接打开时, THE 前端 SHALL 同时请求列表接口和 detail 接口，detail 先返回则先渲染目标卡片

### Requirement 31: 管线输出长度保护（新增 — 安全加固）

**User Story:** As a 开发者, I want AI 输出长度有上限保护, so that 防止异常输出占满存储或影响前端渲染性能。

#### Acceptance Criteria

1. THE PolishStep SHALL 校验 AI 输出长度：L1 内容不超过 5KB，L2-L3 不超过 30KB，L4-L5 不超过 50KB
2. IF AI 输出超过长度限制, THEN THE PolishStep SHALL 截断并标记警告，不直接失败
3. THE source_url 字段入库前 SHALL 校验域名白名单（leetcode.com/github.com/leetcode-cn.com 等），非白名单域名拒绝存入

### Requirement 32: 管理操作审计日志（新增 — 安全规范）

**User Story:** As a 系统管理员, I want 所有管理操作有审计日志, so that 能追溯谁在什么时候做了什么操作。

#### Acceptance Criteria

1. THE 后端 SHALL 记录所有管理操作的审计日志，包含：操作人、操作时间、操作类型、操作目标、操作前后状态
2. THE 审计日志 SHALL 覆盖：审核通过/拒绝、删除 enriched、批量生成、标记推荐、处理纠错反馈
3. THE 管理后台 SHALL 提供审计日志查看页面，支持按操作人和时间范围筛选
4. THE 审计日志 SHALL 保留至少 90 天

### Requirement 33: 踩计数展示规则（新增 — 完善交互细节）

**User Story:** As a 用户, I want 踩的反馈不产生负面心理暗示, so that 浏览解析时不因看到高踩数而产生偏见。

#### Acceptance Criteria

1. THE 前端 SHALL 对普通用户只展示踩按钮状态（灰色/已踩红色），不显示踩的数字
2. THE 前端 SHALL 对管理员展示完整踩计数（`👎 3`）用于判断内容质量
3. THE 前端 SHALL 对所有用户展示点赞计数（`👍 128`）作为正向引导
4. WHEN 用户投票状态变更时, THE 前端 SHALL 使用乐观更新立即反馈 UI 状态，API 失败时回滚
