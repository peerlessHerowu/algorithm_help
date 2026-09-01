# Requirements Document

## Introduction

本规格定义"算法深度理解引擎"项目的交互式功能层需求。该层建立在 Spec 1（基础设施层）、Spec 2（内容生成引擎）、Spec 3（Web 展示层）之上，实现产品的交互式核心能力，包括：费曼学习模式（用户思路转化与 AI 追问）、链接/图片/评论导入解析、面试模拟模式、间隔重复与遗忘曲线、苏格拉底式追问、算法 Debug 训练、以及反向费曼法。这些功能均依赖实时 AI 对话能力和 WebSocket 通信。

## Glossary

- **FeynmanSession**: 费曼学习会话，保持用户多轮对话上下文，AI 识别理解漏洞并追问
- **WebSocket**: 双向实时通信协议，用于交互式对话场景
- **SmartRouter**: Spec 1 定义的 AI 路由层，本 spec 所有 AI 调用通过它路由
- **SM-2**: SuperMemo 2 间隔重复算法，根据用户记忆反馈计算下次复习时间
- **InterviewSimulator**: 面试模拟器，AI 扮演面试官进行限时追问
- **ContentImporter**: 链接/图片/评论导入解析器，提取外部题解内容
- **SocraticGuide**: 苏格拉底式引导器，通过问题引导用户自行推导答案
- **DebugTrainer**: Debug 训练器，AI 生成有 bug 的代码让用户纠错
- **ReverseFeynman**: 反向费曼模式，AI 故意讲错让用户纠正
- **SessionContext**: 会话上下文对象，保存多轮对话历史用于连续追问
- **Readability**: 网页正文提取算法，去除导航/广告等噪音提取核心内容
- **SpacedRepetitionCard**: 间隔重复卡片，包含复习内容和调度元数据

## Requirements

### Requirement 1: 费曼学习模式（用户思路转化）

**User Story:** As a 学习者, I want 用自己的话输入解题思路并获得 AI 追问和引导, so that 我能发现理解漏洞并最终形成结构化的深度理解。

#### Acceptance Criteria

1. THE FeynmanSession SHALL 通过 WebSocket 建立实时双向通信，支持多轮对话，单次 AI 响应延迟 < 5 秒
2. THE FeynmanSession SHALL 保持完整对话上下文（最多 20 轮），AI 能基于之前的对话内容追问
3. WHEN 用户输入解题思路时, THE AI SHALL 识别理解漏洞（跳步、模糊点、逻辑断裂）并生成引导式追问
4. THE FeynmanSession SHALL 在对话结束时生成结构化输出：直觉→思路→伪代码→正式代码→复杂度分析
5. THE FeynmanSession SHALL 对同一思路生成至少 3 个不同类比，用户可选择最能理解的
6. WHEN 用户选择结束会话时, THE 系统 SHALL 保存会话记录并关联到对应题目

### Requirement 2: 链接/图片/评论导入解析

**User Story:** As a 学习者, I want 粘贴题解链接后系统自动提取正文、图片和评论并进行 AI 审查, so that 我能快速获得高质量的精炼题解。

#### Acceptance Criteria

1. THE ContentImporter SHALL 支持粘贴 URL 后自动抓取网页正文（使用 Readability 算法提取），去除导航/广告噪音
2. THE ContentImporter SHALL 解析并保留内容中的图片和 GIF 动图，下载到本地存储并标注用途
3. THE ContentImporter SHALL 提取题解下的优质评论（点赞数 > 阈值的纠错/补充/类比型评论）
4. WHEN 内容导入完成时, THE AI SHALL 对导入内容进行正确性审查，标注逻辑错误和不准确说法
5. THE ContentImporter SHALL 将审查通过的内容精炼为标准格式的解析（题目理解→思路→代码→复杂度）
6. IF 导入的 URL 不可访问或内容为空, THEN THE 系统 SHALL 返回明确的错误提示

### Requirement 3: 面试模拟模式

**User Story:** As a 面试准备者, I want AI 扮演面试官进行限时算法面试模拟, so that 我能在安全环境中训练面试技巧并获得评分反馈。

#### Acceptance Criteria

1. THE InterviewSimulator SHALL 支持限时模式（默认 45 分钟），包含计时器和倒计时提醒
2. THE InterviewSimulator SHALL 支持 AI 追问能力："如果数据量到10亿怎么办？"、"空间能优化吗？"、"时间复杂度能更好吗？"
3. THE InterviewSimulator SHALL 在主题完成后生成 Follow-up 变体题，测试举一反三能力
4. THE InterviewSimulator SHALL 支持沟通能力训练：用户练习"边想边说"，AI 实时给出沟通反馈
5. WHEN 面试结束时, THE 系统 SHALL 生成面试评分报告，包含正确性、效率、沟通、代码质量四个维度（各 1-10 分），且对每个低分维度(< 7分)附带 AI 生成的 1-2 句具体改进建议
6. THE InterviewSimulator SHALL 支持手写代码模式（无 IDE 辅助），模拟白板面试环境
7. THE Backend SHALL 提供 GET /api/v1/interview/history 端点，返回用户历史面试记录列表（含日期、题目、总分），支持查看评分趋势折线图数据

### Requirement 4: 间隔重复与遗忘曲线

**User Story:** As a 学习者, I want 系统基于遗忘曲线在最佳时间点提醒我复习, so that 我能以最高效率将算法知识转化为长期记忆。

#### Acceptance Criteria

1. THE SM-2 调度器 SHALL 根据用户每次复习的自评反馈（1-5 分）计算下次复习时间间隔
2. THE 复习系统 SHALL 提供多样化复习方式：看图猜算法、补全代码、讲解思路、模式识别 quiz
3. THE 复习系统 SHALL 支持变体题复习：给同模式但不同题面的变体题测试真正理解程度
4. THE 复杂度直觉训练 SHALL 包含两种模式：看数据范围猜算法、看代码估复杂度
5. THE 算法日历 SHALL 每日推送一个模式回顾 + 一道新题推荐，基于用户薄弱点定制
6. THE 学习数据统计 SHALL 可视化展示：掌握程度雷达图、遗忘曲线图、薄弱点热力图

### Requirement 5: 苏格拉底式追问模式

**User Story:** As a 学习者, I want AI 不直接给答案而是通过问题引导我自己推导, so that 我能培养独立解题的思维能力。

#### Acceptance Criteria

1. THE SocraticGuide SHALL 通过渐进式提示引导用户：Hint 1(方向) → Hint 2(方法) → Hint 3(伪代码) → Hint 4(代码)
2. THE SocraticGuide SHALL 根据用户的回答动态调整提示难度，用户回答接近时给予肯定并引向下一步
3. WHEN 用户在任何层级请求停止时, THE 系统 SHALL 停止继续提示，让用户自行思考
4. THE SocraticGuide SHALL 通过 WebSocket 实时对话，保持问答上下文连贯
5. WHEN 用户最终解出题目时, THE 系统 SHALL 给出总结：用户的思路回顾 + 标准解法对比 + 改进建议

### Requirement 6: 算法 Debug 训练

**User Story:** As a 学习者, I want 练习在有 bug 的代码中找错, so that 我能提升代码审查能力和对常见错误的敏感度。

#### Acceptance Criteria

1. THE DebugTrainer SHALL 基于正确代码自动生成包含 1-3 个 bug 的变体代码（常见 bug 类型：off-by-one、边界遗漏、条件判断错误、变量初始化错误）
2. THE DebugTrainer SHALL 向用户展示有 bug 的代码，并提供输入/输出示例（部分示例故意触发 bug）
3. WHEN 用户提交找到的 bug 位置和修复方案时, THE AI SHALL 评估正确性并给出详细纠错解释
4. IF 用户找不到所有 bug, THEN THE 系统 SHALL 提供渐进式提示（先指出 bug 所在行范围，再指出具体行）
5. THE DebugTrainer SHALL 记录用户的 Debug 表现，识别薄弱 bug 类型并针对性加强训练

### Requirement 7: 反向费曼法

**User Story:** As a 学习者, I want AI 故意讲错一步让我来纠正, so that 通过纠错加深对正确解法的记忆。

#### Acceptance Criteria

1. THE ReverseFeynman SHALL 在正确解释中故意植入 1-2 个错误（逻辑错误、复杂度错误、边界错误等）
2. THE ReverseFeynman SHALL 让错误足够隐蔽但可被发现（不能太明显也不能太难发现）
3. WHEN 用户指出错误并给出正确说法时, THE AI SHALL 确认纠正、给出完整正确解释、并表扬用户
4. IF 用户未能发现错误, THEN THE 系统 SHALL 逐步提示错误位置（先提示哪一段有错，再缩小范围）
5. THE ReverseFeynman SHALL 记录用户纠错成功率，自动调整错误难度

### Requirement 8: WebSocket 通信与会话管理

**User Story:** As a 系统, I want 统一的 WebSocket 通信层和会话管理机制, so that 所有交互式功能共享可靠的实时通信基础。

#### Acceptance Criteria

1. THE WebSocket 服务 SHALL 支持以下消息类型：FEYNMAN_CHAT、INTERVIEW_CHAT、SOCRATIC_CHAT、DEBUG_SUBMIT、REVERSE_FEYNMAN_CHAT
2. THE 会话管理器 SHALL 为每个交互式会话分配唯一 sessionId，并维护会话状态（ACTIVE、PAUSED、COMPLETED、EXPIRED）
3. THE 会话管理器 SHALL 在会话空闲超过 30 分钟后自动标记为 EXPIRED，释放上下文资源
4. THE WebSocket 服务 SHALL 支持断线重连，重连后恢复会话上下文（15 分钟内）
5. THE 系统 SHALL 对 WebSocket 消息进行速率限制：单用户每秒最多 5 条消息
6. THE WebSocket 服务 SHALL 在连接建立后要求客户端发送第一条认证消息（携带 JWT token），验证通过后标记会话为已认证；未在 5 秒内发送认证消息或 token 无效的连接自动断开。禁止通过 URL 查询参数传递 token（避免日志/历史泄露风险）。注：此功能的接口已在 Spec 1 的 WebSocketSecurityConfig 中预留空壳，本 Spec 负责完整实现

### Requirement 9: 交互数据持久化与学习分析

**User Story:** As a 学习者, I want 我的所有交互学习记录被持久化, so that 系统可以基于历史数据进行个性化推荐和学习分析。

#### Acceptance Criteria

1. THE 系统 SHALL 持久化所有会话记录（对话历史、用户输入、AI 响应、时间戳）到数据库
2. THE 系统 SHALL 记录面试模拟的评分报告和历史得分趋势
3. THE 系统 SHALL 记录间隔重复的每次复习结果（用户自评分、实际表现、复习时间）
4. THE 系统 SHALL 记录 Debug 训练的表现数据（正确率、耗时、薄弱 bug 类型）
5. THE 学习分析引擎 SHALL 基于历史数据生成个性化推荐：复习优先级、薄弱点训练建议、每日学习计划
6. THE 系统 SHALL 支持学习数据导出（JSON/CSV 格式）


### Requirement 10: 交互数据隐私与保留策略

**User Story:** As a 用户, I want 我的交互对话数据有明确的保留期限和删除机制, so that 我的隐私得到保护。

#### Acceptance Criteria

1. THE 系统 SHALL 定义交互数据保留策略：费曼/面试/苏格拉底会话完整记录保留 90 天，90 天后仅保留统计摘要（评分、时长、主题）
2. THE 系统 SHALL 在 90 天保留期到期后自动执行数据归档：完整对话内容删除，保留用户统计数据
3. THE 系统 SHALL 支持用户通过 DELETE /api/v1/users/me/sessions 主动删除所有会话记录（立即执行）
4. THE 面试模拟评分报告 SHALL 永久保留（除非用户主动删除），因为这是用户的学习成果
5. WHEN 用户行使数据删除权（通过 Spec 1 Req 34 的 /users/me/data 端点）时, THE 系统 SHALL 同步删除所有交互数据

### Requirement 11: 实时通知集成

**User Story:** As a 用户, I want 在交互功能中收到实时反馈和提醒, so that 我不会错过重要的学习节点。

#### Acceptance Criteria

1. WHEN 费曼模式生成结构化总结完成时, THE 系统 SHALL 通过通知系统（Spec 1 Req 36）推送 GENERATION_COMPLETE 通知
2. WHEN 间隔重复卡片到期需要复习时, THE 系统 SHALL 推送 REVIEW_REMINDER 通知（每日推送一次，包含今日待复习数量）
3. THE 前端 SHALL 在交互页面中集成通知弹窗（使用 Spec 3 Toast 组件），实时展示通知
4. THE 用户 SHALL 可在设置中关闭特定类型的通知（如关闭复习提醒）

### Requirement 12: 全服飘屏与成就系统

**User Story:** As a 学习者, I want 看到其他人的学习成就飘屏和自己的里程碑成就, so that 我有社区归属感和持续学习的动力。

#### Acceptance Criteria

1. THE 系统 SHALL 定义成就类型：模式大师（完成某模式全部题目）、连续学习（连续N天）、费曼学者（完成N次费曼讲解）、面试达人（面试模拟评分>80）、纠错专家（反向费曼正确率>90%）
2. WHEN 用户解锁成就时, THE 系统 SHALL 向该用户展示成就解锁弹窗（含成就图标、名称、描述、分享按钮）
3. WHEN 用户解锁成就时, THE 系统 SHALL 向全服在线用户推送飘屏消息（格式：「🏆 @用户名 解锁了 [成就名]！」）
4. THE 飘屏消息 SHALL 以水平滚动动画（从右到左）展示在页面顶部，持续 5 秒后淡出，不阻挡用户操作
5. THE 用户 SHALL 可在设置中关闭飘屏显示（但自己的成就仍会触发给他人）
6. THE Backend SHALL 定义 Achievement 实体，包含 id、userId、type(枚举)、unlockedAt，并提供 GET /api/v1/users/me/achievements 端点
7. THE 飘屏推送 SHALL 通过 SSE 或 WebSocket 实时推送给在线用户

### Requirement 13: 复杂度直觉训练

**User Story:** As a 面试准备者, I want 训练"看数据范围猜算法"和"看代码估复杂度"的直觉, so that 面试中能快速判断时间约束。

#### Acceptance Criteria

1. THE 系统 SHALL 提供"看范围猜算法"模式：给出数据范围（如 n ≤ 10^5），用户判断应该用什么复杂度的算法（O(n log n) / O(n²) 等）
2. THE 系统 SHALL 提供"看代码估复杂度"模式：展示一段代码，用户估算时间/空间复杂度
3. EACH 训练题 SHALL 在用户作答后给出正确答案和推理过程（如"n=10^5 → O(n log n) 约 10^6 运算 → 可在 1s 内完成"）
4. THE 系统 SHALL 记录训练结果，按复杂度类型统计正确率
5. THE Backend SHALL 提供 POST /api/v1/complexity-training/generate 端点，生成一组训练题（参数：mode=RANGE_GUESS|CODE_ESTIMATE, count=10）
6. THE Backend SHALL 提供 POST /api/v1/complexity-training/submit 端点，接收用户答案并返回正确答案+解析
7. THE Backend SHALL 提供 GET /api/v1/complexity-training/stats 端点，返回按复杂度类型的正确率统计
8. THE Backend SHALL 定义 ComplexityTrainingRecord 实体，包含 id、userId、mode、question、userAnswer、correctAnswer、isCorrect、createdAt

### Requirement 14: 算法日历

**User Story:** As a 学习者, I want 每天有一个推送的学习计划, so that 我有节奏地持续学习而不是漫无目的。

#### Acceptance Criteria

1. THE 系统 SHALL 每日生成个性化学习计划：一个模式回顾（基于薄弱点或间隔复习调度）+ 一道新题推荐（基于学习路径）
2. THE 算法日历 SHALL 在首页和复习中心展示"今日计划"卡片
3. WHEN 用户完成今日计划时, THE 系统 SHALL 更新连续学习天数并检查成就解锁条件
4. THE 日历视图 SHALL 支持查看历史日期的学习内容和完成情况
5. THE Backend SHALL 提供 GET /api/v1/daily-plan 端点，返回今日个性化学习计划（含模式回顾+新题推荐+待复习卡片数）
6. THE Backend SHALL 提供 POST /api/v1/daily-plan/complete 端点，标记今日计划已完成，触发连续天数+1和成就检查
7. THE Backend SHALL 提供 GET /api/v1/daily-plan/history?days=30 端点，返回最近N天的计划和完成情况
8. THE DailyPlan 实体 SHALL 包含 id、userId、date(Long UTC毫秒)、patternReviewId、newProblemId、completed(Boolean)、completedAt

### Requirement 15: 面试模拟配置

**User Story:** As a 面试准备者, I want 在开始面试前配置难度、时长和目标公司风格, so that 面试模拟更贴近我的真实面试场景。

#### Acceptance Criteria

1. THE Frontend SHALL 在面试开始前展示配置面板，包含：难度选择（Easy/Medium/Hard/随机）、时长选择（25/45/60分钟）、公司风格（Google/Meta/Amazon/字节/通用）
2. THE InterviewConfig 数据模型 SHALL 包含 difficulty(枚举)、timeLimitMinutes(Integer)、companyStyle(String)、problemId(可选，不指定则随机选题)
3. THE POST /api/v1/interview/start 端点 SHALL 接收 InterviewConfig 参数，根据配置选择合适的题目和面试风格
4. WHEN companyStyle 指定为具体公司时, THE AI 面试官 SHALL 模拟该公司的追问风格（如 Google 偏重系统设计延伸，Meta 偏重代码优化）
5. THE 系统 SHALL 保存用户最近的面试配置，下次自动填充

### Requirement 16: 成就系统

**User Story:** As a 学习者, I want 看到学习里程碑和成就徽章, so that 我有持续学习的动力和成就感。

#### Acceptance Criteria

1. THE Backend SHALL 定义 Achievement 实体，包含 id(UUID)、userId、type(枚举)、unlockedAt(Long UTC毫秒)、metadata(JSON)
2. THE AchievementType 枚举 SHALL 包含：PATTERN_MASTER(完成某模式全部题)、STREAK_7/STREAK_30(连续学习N天)、FEYNMAN_SCHOLAR(完成N次费曼)、INTERVIEW_PRO(面试评分>80)、BUG_HUNTER(反向费曼正确率>90%)、FIRST_PROBLEM(完成第一题)、SPEED_DEMON(面试25分钟内满分)
3. THE Backend SHALL 提供 GET /api/v1/users/me/achievements 端点，返回用户已解锁成就列表
4. THE Backend SHALL 提供内部 AchievementCheckService，在以下时机自动检查并解锁成就：完成题目时、完成每日计划时、面试结束时、复习完成时
5. WHEN 成就解锁时, THE 系统 SHALL 创建 ACHIEVEMENT_UNLOCKED 类型通知，并通过 SSE 实时推送给该用户
6. THE Backend SHALL 提供 GET /api/v1/achievements/definitions 端点（公开），返回所有成就定义（名称、描述、图标、解锁条件描述）

### Requirement 17: 全服飘屏推送

**User Story:** As a 学习者, I want 看到其他人的学习成就飘屏, so that 我感受到社区氛围和学习激励。

#### Acceptance Criteria

1. WHEN 用户解锁成就时, THE 系统 SHALL 向全服在线用户推送飘屏消息（格式：「🏆 @用户名 解锁了 [成就名]！」）
2. THE 飘屏推送 SHALL 通过已有的 SSE 通知通道（GET /api/v1/users/me/notifications/stream）发送，消息类型为 BROADCAST_ACHIEVEMENT
3. THE 前端 SHALL 以水平滚动动画（从右到左）展示飘屏，持续 5 秒后淡出，不阻挡用户操作
4. THE 用户 SHALL 可在 UserPreference.notificationSettings 中设置 `BROADCAST_ACHIEVEMENT: false` 关闭飘屏接收
5. THE 系统 SHALL 对飘屏频率限制：同一时间最多展示 2 条，新消息排队等待；单用户每小时最多触发 3 次飘屏推送
6. THE Backend SHALL 定义 BroadcastMessage 实体，包含 id、userId、achievementType、nickname、createdAt，保留最近 100 条用于新上线用户回看


### Requirement 18: 面试→复习自动关联

**User Story:** As a 面试准备者, I want 面试做过的题自动加入复习计划, so that 面试训练和长期记忆巩固无缝衔接。

#### Acceptance Criteria

1. WHEN 面试模拟结束且生成评分报告时, THE 系统 SHALL 自动为该面试题目创建 SpacedRepetitionCard（如果不存在）
2. THE 自动创建的卡片 SHALL 设置 cardType=EXPLAIN（要求用户在复习时口述思路），初始间隔为 1 天
3. IF 面试评分总分 >= 80, THEN THE 新卡片初始间隔 SHALL 设为 3 天（高分说明掌握较好，间隔可更长）
4. THE Frontend 面试评分报告底部 SHALL 展示"✅ 该题已自动加入复习计划"提示

### Requirement 19: 费曼模式对话轮次提醒

**User Story:** As a 学习者, I want 知道费曼对话还剩多少轮, so that 我能在合适时机总结而非被突然截断。

#### Acceptance Criteria

1. WHEN 费曼对话进行到第 18 轮时, THE 系统 SHALL 发送系统消息（type=SYSTEM）："💡 还剩 2 轮对话，建议点击「结束并生成总结」保存学习成果"
2. WHEN 费曼对话进行到第 20 轮时, THE 系统 SHALL 自动触发总结生成流程并通知用户"已达最大对话轮次，正在生成结构化总结..."
3. THE Frontend 费曼对话页顶部 SHALL 展示当前轮次计数（如"第 12/20 轮"），帮助用户感知进度
4. THE 轮次计数 SHALL 仅统计有效对话（user+AI 各一条为一轮），system 消息不计入

### Requirement 20: 面试评分改进建议

**User Story:** As a 面试准备者, I want 看到低分维度的具体改进建议, so that 我知道下一步该练什么。

#### Acceptance Criteria

1. THE InterviewReport 实体 SHALL 包含 `improvements`(JSON) 字段，存储各维度的改进建议（如 `{"correctness":"注意边界条件...","communication":"每种方法结尾补充复杂度分析"}`)
2. WHEN 面试评分的某维度分数 < 70 时, THE AI 评分 prompt SHALL 额外生成该维度的 1-2 句具体改进建议
3. THE Frontend 面试评分报告 SHALL 在低分维度（< 70 分）的进度条下方展示改进建议文字（黄色提示框样式）
4. THE Frontend 面试评分报告 SHALL 在低分维度旁提供"💪 训练这个维度"按钮，跳转到对应的练习入口（如沟通→费曼模式，代码→Debug训练）
5. THE Backend SHALL 提供 GET /api/v1/interview/history 端点增加 `includeTrend=true` 参数，返回最近 10 次面试的各维度分数数组，供前端绘制趋势折线图


### Requirement 21: 成就稀缺度与阶梯设计

**User Story:** As a 学习者, I want 看到成就的稀缺程度, so that 解锁后有更强的成就感和分享欲望。

#### Acceptance Criteria

1. THE Achievement 实体 SHALL 新增 `unlockRate`(Float, nullable) 字段，表示全站该成就的解锁比例（如 0.023 = 2.3%）
2. THE 系统 SHALL 通过定时任务（每日凌晨）重新计算各成就的 unlockRate = 已解锁用户数 / 总注册用户数
3. THE Frontend 成就解锁弹窗和成就列表 SHALL 展示"仅 X% 的学习者解锁了此成就"文字（unlockRate < 10% 时展示，>= 10% 时不展示避免通货膨胀感）
4. THE 成就阶梯设计 SHALL 按指数递增：连续学习系列为 STREAK_7/STREAK_30/STREAK_100/STREAK_365；费曼系列为 FEYNMAN_5/FEYNMAN_20/FEYNMAN_50/FEYNMAN_100
5. THE AchievementType 枚举 SHALL 扩展为：FIRST_PROBLEM、PATTERN_MASTER、STREAK_7、STREAK_30、STREAK_100、STREAK_365、FEYNMAN_SCHOLAR_5、FEYNMAN_SCHOLAR_20、FEYNMAN_SCHOLAR_50、INTERVIEW_PRO、BUG_HUNTER、SPEED_DEMON、COMPLEXITY_MASTER（复杂度训练正确率>90%）

### Requirement 22: 反向费曼→复习系统联动

**User Story:** As a 学习者, I want 反向费曼中成功纠正的知识点自动进入复习计划, so that 纠错后的记忆能被巩固。

#### Acceptance Criteria

1. WHEN 用户在反向费曼中成功纠正某个错误时, THE 系统 SHALL 自动为该题创建一张 SpacedRepetitionCard（cardType=EXPLAIN, patternId=该题所属模式）
2. THE 自动创建的卡片 SHALL 在 `metadata` JSON 中记录 `{"source":"reverse_feynman","errorType":"LOGIC","correctionContent":"应该是较小而非较大"}`
3. THE 复习时 SHALL 优先使用用户在反向费曼中的纠错记录作为"正面提问"（如"合并链表时，每次应该选择哪个节点接入结果？"）
4. IF 该题已有 SpacedRepetitionCard, THEN THE 系统 SHALL 不重复创建，仅更新 metadata 追加新的纠错记录


### Requirement 23: 费曼会话重置

**User Story:** As a 学习者, I want 重置当前费曼对话从头开始, so that 我可以重新整理思路而不需要退出再进入。

#### Acceptance Criteria

1. THE Backend SHALL 提供 POST /api/v1/session/{id}/reset 端点，清空当前会话的对话上下文并重置为初始状态
2. THE 重置操作 SHALL 保留同一 sessionId（不创建新会话），仅清空 Redis 中的 context 数据
3. THE 重置后 SHALL 重新发送 AI 开场白（与新建会话时相同）
4. THE Frontend 费曼模式页 SHALL 提供"🔄 重置"按钮，点击后弹出确认："确定重置对话？当前内容将清空。"

### Requirement 24: 苏格拉底推导得分计算

**User Story:** As a 学习者, I want 看到我的推导得分, so that 我知道自己独立解题的能力有多强。

#### Acceptance Criteria

1. THE SocraticGuideHandler SHALL 在用户解出题目时计算推导得分：score = (4 - usedHintLevel + 1) / 4 × 100（Hint 1 就解出=100%，用到 Hint 4=25%）
2. THE 推导得分 SHALL 记录到 InteractiveSession 的 metadata JSON 中（key: `socraticScore`）
3. THE Frontend 苏格拉底页面 SHALL 在对话区右侧展示实时得分（随提示级别递减自动更新）
4. THE 得分 SHALL 纳入学习分析统计（LearningAnalyticsService），用于识别用户独立解题能力趋势

### Requirement 25: 复习自评按钮与 SM-2 quality 映射

**User Story:** As a 学习者, I want 复习自评操作简单直观, so that 我不需要理解 SM-2 算法细节就能正确自评。

#### Acceptance Criteria

1. THE Frontend 复习卡片 SHALL 展示 4 个自评按钮，映射关系为：😟 忘了→quality=1、🤔 模糊→quality=3、😊 记得→quality=4、🚀 秒杀→quality=5
2. THE 各按钮 hover 时 SHALL 展示 tooltip 说明预计下次复习间隔（如"忘了 → 明天复习"、"秒杀 → 14天后复习"）
3. THE POST /api/v1/review/record 端点 SHALL 接受 quality 值（1/3/4/5），不接受中间值 0/2（简化用户操作）
4. THE SM-2 算法 SHALL 按标准公式处理所有 quality 值（包括映射后的 1/3/4/5），quality=1 和 quality=2 行为相同（重置间隔）

### Requirement 26: 手动创建复习卡片

**User Story:** As a 学习者, I want 将任意已学题目手动加入复习计划, so that 我认为重要的题目不会被遗忘。

#### Acceptance Criteria

1. THE Backend SHALL 提供 POST /api/v1/review/cards 端点（需认证），接受 problemId 和 cardType（默认 EXPLAIN）参数
2. THE 端点 SHALL 检查是否已存在同题同类型卡片，已存在时返回 409 Conflict（"该题已在复习计划中"）
3. THE 新创建的卡片 SHALL 使用默认初始参数：EF=2.5, interval=1, nextReviewAt=明天
4. THE 题目详情页"下一步行动"区域 SHALL 包含"📅 加入复习计划"按钮，点击后调用此端点

### Requirement 27: 面试代码执行策略

**User Story:** As a 面试准备者, I want 面试模拟中代码可以得到正确性反馈, so that 我知道自己写的代码是否正确。

#### Acceptance Criteria

1. THE 面试模拟 MVP 阶段 SHALL 采用"AI 代码审查"模式：用户提交代码后，由 AI 评估代码正确性、逻辑错误、边界遗漏，不实际执行代码
2. THE AI 审查结果 SHALL 以对话消息形式返回："你的代码在 XXX 情况下会出错"或"代码逻辑正确，时间复杂度 O(n)"
3. THE Frontend 代码区"▶ 运行"按钮 SHALL 改为"🤖 AI 审查"，避免用户误解为实际运行
4. THE 系统 SHALL 预留 `interview.code-execution.mode` 配置项（ai-review / sandbox），后续接入 Judge0 时仅需切换模式
5. WHEN 未来接入 sandbox 执行模式时, THE 系统 SHALL 在面试配置面板增加"代码执行"开关（默认 AI 审查，可选实际运行）


### Requirement 28: 费曼对话导出

**User Story:** As a 学习者, I want 将费曼对话历史导出为文件, so that 我可以离线回顾或分享给他人。

#### Acceptance Criteria

1. THE Frontend 费曼模式页 SHALL 提供"📥 导出"按钮，点击后展示格式选择：Markdown / PDF
2. THE Markdown 导出 SHALL 包含：对话双方消息（用 > 引用块区分 AI 和用户）、结构化总结（如已生成）、题目标题和链接
3. THE PDF 导出 SHALL 使用服务端渲染（通过 POST /api/v1/session/{id}/export?format=pdf 端点），返回 PDF 文件下载链接
4. THE 导出文件名 SHALL 格式为：`费曼-{题目名}-{日期}.{ext}`（如"费曼-两数之和-2026-06-21.md"）
5. THE 导出功能 SHALL 仅对已完成（COMPLETED）或活跃（ACTIVE）状态的会话可用，EXPIRED 会话提示"该会话已过期，无法导出完整内容"
6. WHEN 会话仍在进行中（ACTIVE）时, THE 导出 SHALL 包含截止当前的所有消息并标注"（对话进行中，未含总结）"

### Requirement 29: 苏格拉底追问页面 UI 规格

**User Story:** As a 学习者, I want 苏格拉底追问有独立的交互页面, so that 引导式推导体验完整且有结构化总结。

#### Acceptance Criteria

1. THE Frontend SHALL 提供苏格拉底追问页面（`/socratic?problem={id}`），含对话区 + 右侧提示级别指示器
2. THE 对话区 SHALL 展示 AI 的引导式提问和用户回答，AI 消息使用绿色左边框区分（不同于费曼的紫色）
3. THE 右侧面板 SHALL 展示"提示级别仪表"：Level 1/2/3/4 四格，当前使用的级别高亮并显示对应得分预估
4. WHEN 用户点击"需要提示"按钮时, THE AI SHALL 发送下一级提示，同时提示级别仪表更新
5. WHEN 用户解出题目时, THE Frontend SHALL 展示双栏对比总结面板：左栏="📝 你的推导路径"（按时间线展示用户的关键回答）、右栏="📖 标准思路"（高亮关键差异点用黄色背景）
6. THE 总结面板底部 SHALL 展示推导得分（百分制）和"💪 改进建议"文字


### Requirement 30: Debug 训练页面 UI 规格

**User Story:** As a 学习者, I want 有独立的 Debug 训练页面, so that 我能系统化地练习代码纠错能力。

#### Acceptance Criteria

1. THE Frontend SHALL 提供 Debug 训练页面（`/training/debug`），含代码展示区 + 操作面板 + 统计侧栏
2. THE 代码展示区 SHALL 使用 CodeBlock 组件展示有 bug 的代码，行号可点击标注"这里有 bug"
3. THE 操作面板 SHALL 包含：标注 bug 行 → 描述错误原因 → 提交修复代码，三步操作流程
4. WHEN 用户提交答案后, THE Frontend SHALL 展示结果面板：正确标注的 bug 用绿色✓标记、遗漏的 bug 用红色高亮闪烁提示
5. THE 统计侧栏 SHALL 展示：本轮正确率、按 bug 类型（off-by-one/边界/条件/初始化）的正确率分布、薄弱类型警告
6. THE 页面顶部 SHALL 提供难度选择：初级（1个 bug）/ 中级（2个 bug）/ 高级（3个 bug）
7. THE 训练完成后 SHALL 展示"🏆 本轮总结"：总题数 / 正确数 / 平均用时 / 薄弱 bug 类型建议

### Requirement 31: 反向费曼页面 UI 规格

**User Story:** As a 学习者, I want 有独立的反向费曼训练页面, so that 通过纠正 AI 的错误加深记忆。

#### Acceptance Criteria

1. THE Frontend SHALL 提供反向费曼页面（`/training/reverse-feynman?problem={id}`），布局为：AI 解释区（上方/左侧）+ 用户纠错区（下方/右侧）
2. THE AI 解释区 SHALL 以对话气泡形式逐段展示 AI 的"解释"（其中植入了 1-2 个隐蔽错误）
3. THE 用户纠错区 SHALL 提供两种操作："✓ 这段正确"按钮和"✗ 这段有错"按钮 + 文本输入框（描述正确说法）
4. WHEN 用户指出错误位置正确时, THE Frontend SHALL 展示绿色反馈："🎉 准确！"+ AI 确认消息 + 正确解释全文
5. WHEN 用户在所有段落中未发现错误时, THE Frontend SHALL 提供渐进式提示：先高亮有错的段落→再缩小到具体句子
6. THE 页面顶部 SHALL 展示纠错成功率（实时更新）和连续纠错正确次数
7. THE 训练结束后 SHALL 展示总结：纠错成功率 + 遗漏的错误类型分析 + "该题已自动加入复习计划"提示


### Requirement 32: 看图猜算法复习方式规格

**User Story:** As a 学习者, I want "看图猜算法"复习方式有清晰的交互定义, so that 这种视觉化复习方式能真正帮助记忆。

#### Acceptance Criteria

1. THE "看图猜算法"复习方式 SHALL 展示一个 Mermaid 流程图或状态转移图（从题目已有的 Mermaid 内容中提取，隐藏图标题）
2. THE 用户 SHALL 从 4-6 个候选算法模式中选择正确的模式（单选）
3. WHEN 用户选择正确时, THE Frontend SHALL 展示"✓ 正确！"+ 揭示图对应的题目名和模式名 + "查看该题详情"链接
4. WHEN 用户选择错误时, THE Frontend SHALL 展示正确答案 + 该模式的核心识别信号（2-3 条要点）
5. THE 图片数据 SHALL 来自 GET /api/v1/review/visual-quiz 端点，返回随机一道用户待复习题目的 Mermaid 图 + 候选模式列表

### Requirement 33: 补全代码复习方式规格

**User Story:** As a 学习者, I want "补全代码"复习方式有明确的交互逻辑, so that 通过动手填代码真正巩固记忆。

#### Acceptance Criteria

1. THE "补全代码"复习方式 SHALL 展示代码骨架（CodeBlock 组件），其中 1-3 行关键代码被替换为 `___________`（可编辑的输入框）
2. THE 关键行选取规则 SHALL 为：优先选算法核心逻辑行（如 DP 的状态转移方程、双指针的移动条件）
3. WHEN 用户填写完毕点击"检查"时, THE Frontend SHALL 调用 POST /api/v1/review/code-completion/check 端点，AI 判断语义正确性（不要求字符完全匹配）
4. WHEN AI 判定正确时, THE Frontend SHALL 展示绿色反馈 + 标准答案对比展示
5. WHEN AI 判定错误时, THE Frontend SHALL 展示红色反馈 + 正确代码 + 关键差异标注（高亮错误部分）
6. THE 代码补全卡片数据 SHALL 来自 GET /api/v1/review/code-completion 端点（返回代码骨架 + 空位位置 + 正确答案）

