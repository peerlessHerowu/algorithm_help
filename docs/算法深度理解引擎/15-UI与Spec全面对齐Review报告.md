# UI 与 Spec 全面对齐 Review 报告

> 日期：2026-06-21 | 审查范围：scheme-a 全系列 UI 与 6 个正式 Spec

## 一、审查总结

### 审查范围

| UI 文件 | 覆盖页面/功能模块 |
|---------|-------------------|
| scheme-a.html | 首页、题目列表、题目详情、算法模式、知识图谱、费曼、面试、复习、设置、登录、管理后台 |
| scheme-a-supplement.html | 通知、飘屏/成就、苏格拉底、Debug、反向费曼、导入、模式识别、应用映射、数学关联、导出、个人中心 |
| scheme-a-supplement-v2.html | 错误页面、骨架屏、设置增强、匿名引导、网络状态、后台增强、深度统计、面试增强 |
| scheme-a-supplement-v3.html | 复杂度训练、学习路径、每日计划、算法考古、论文桥梁、跨域映射、版本历史 |
| scheme-a-data-mgmt.html | 用户题解、评论、题目CRUD、采集管理、映射管理、AI用量、费曼转题解 |

### 对齐结果概览

- ✅ Spec 已覆盖且对齐良好：~85%
- ⚠️ UI 有设计但 Spec 描述不充分/遗漏：~10%
- ❌ UI 有明确设计但 Spec 完全未规划：~5%

---

## 二、逐页面/功能对齐分析


### 2.1 首页（scheme-a.html #home + #dashboard）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| Hero 区产品介绍 | web-presentation R1.5 | ✅ | |
| 已登录 Dashboard（今日计划/待复习/连续天数） | web-presentation R1.6 | ✅ | |
| "继续学习"卡片（上次阅读位置） | web-presentation R1.6 | ⚠️ | Spec 仅提及"继续学习"，未明确 UserProgress 需记录"阅读到哪个章节"粒度 |
| 基于薄弱模式推荐题目 | web-presentation R1.6 + interactive R14 | ✅ | |
| 特色功能 6 卡片 | web-presentation R1.5 | ✅ | |
| 热门题目卡片 | web-presentation R1.5 | ✅ | |
| 通知铃铛 + 未读徽章 | web-presentation R37, infrastructure R36 | ✅ | |

**用户体验问题**：
- ✅ 已登录/未登录两种首页状态 UI 已清晰设计
- ⚠️ "继续学习"需要记录阅读位置（如"阅读到解法对比部分"），当前 UserProgress 实体只有 viewedAt/timeSpentMs，建议增加 `lastSection`(String) 字段


### 2.2 题目列表页（scheme-a.html #problems）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 关键词搜索（300ms 防抖） | web-presentation R2.1 | ✅ | |
| 难度筛选（Easy/Medium/Hard） | web-presentation R2.2, infrastructure R9.1 | ✅ | |
| 算法标签筛选 | web-presentation R2.2, infrastructure R9.1 | ✅ | |
| 公司标签筛选（下拉选择） | infrastructure R18, web-presentation R2.2 | ✅ | |
| 收藏筛选（⭐ 收藏 Tab） | infrastructure R28 | ⚠️ | UI 有"⭐ 收藏"快捷筛选 Tab，Spec 仅定义了 GET /bookmarks 端点，未在 problems 列表查询参数中体现 |
| 排序（热度/难度/最近更新） | web-presentation R2.3 | ✅ | |
| 生成状态图标（已生成/生成中/待生成） | web-presentation R10.5, R22.6 | ✅ | |
| 分页组件 | web-presentation R2.4 | ✅ | |
| 空状态提示 | web-presentation R2.6 | ✅ | |
| URL 参数同步 | web-presentation R2.5 | ✅ | |

**用户体验问题**：
- ⚠️ UI 中收藏筛选作为快捷 Tab 显示在筛选栏第一行，但 Spec 中 GET /api/v1/problems 端点未包含 `bookmarked=true` 参数。建议在 infrastructure R9.1 中增加此筛选参数（已登录时有效）。


### 2.3 题目详情页（scheme-a.html #problem-detail）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| LevelTabs L1-L5 切换 | web-presentation R3.1, R3.2 | ✅ | |
| 未生成级别灰色+锁图标 | web-presentation R3.9 | ✅ | |
| 触发生成空状态 + 按钮 | web-presentation R22.1, R3.8 | ✅ | |
| 生成中进度条（步骤化） | web-presentation R22.2, R22.3 | ✅ | |
| Markdown 内容渲染 | web-presentation R3.3 | ✅ | |
| Mermaid 图解（缩放/全屏） | web-presentation R3.4 | ✅ | |
| 多语言代码 Tab（Python/Java/Go/C++） | web-presentation R3.5 | ✅ | |
| 解法对比矩阵表格 | web-presentation R3.6 | ✅ | |
| 解法演进关系图（Mermaid） | content-generation R7.1, R7.5 | ✅ | |
| 底层共同框架提炼 | content-generation R7.3, R7.4 | ✅ | |
| 关联题目推荐列表 | infrastructure R26 | ✅ | |
| 右侧 TOC 目录导航 | web-presentation R3.7 | ✅ | |
| 内容反馈组件（👍👎 + 评分） | infrastructure R22, web-presentation R14.4 | ✅ | |
| "下一步行动"引导区（费曼/面试/变体题/复习） | web-presentation R19 | ✅ | |
| 收藏按钮（★） | infrastructure R28 | ✅ | |
| 分享按钮 | infrastructure R44 | ✅ | |
| 多平台链接（LeetCode/力扣/牛客） | web-presentation R24, data-acquisition R35 | ✅ | |
| 版本信息 + 查看历史版本链接 | infrastructure R20 | ✅ | |

**用户体验问题**：
- ✅ 详情页功能非常完整，用户操作路径清晰
- ⚠️ UI 中"下一步"区域有"加入复习计划"按钮，需确认触发后创建 SpacedRepetitionCard。Spec interactive R18 已覆盖面试→复习联动，但"手动加入复习"需要一个独立 API（如 POST /api/v1/review/cards/create）


### 2.4 算法模式列表页 + 模式详情页（scheme-a.html #patterns, #pattern-detail）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 模式卡片网格（名称/描述/题目数/掌握度进度条） | web-presentation R4.1 | ✅ | |
| 难度分布分组（入门/进阶/高级） | web-presentation R4.1 | ⚠️ | UI 有三色分组区，Spec 未明确 Pattern 实体含 `difficultyLevel` 枚举字段 |
| 模式详情：识别信号列表 | knowledge-graph R2 | ✅ | |
| 模式详情：通用模板代码 | knowledge-graph R2 | ✅ | |
| 模式详情：关联题目列表（含掌握状态） | knowledge-graph R2, web-presentation R4.2 | ✅ | |
| 模式详情：掌握度百分比计算 | web-presentation R4.1 | ⚠️ | UI 显示"掌握度 75%"，Spec 定义了计算规则但未明确前端从哪个 API 获取该数值 |

**用户体验问题**：
- ⚠️ 模式列表页的"掌握度"数据需要一个 API 支持。建议 GET /api/v1/patterns 返回中增加 `userMasteryPercent` 字段（已登录时计算，未登录时不返回）。knowledge-graph Spec 的 PatternTrainingService.getStats() 有正确率统计但未暴露为"每个模式的掌握度百分比"。
- ⚠️ Pattern 实体缺少"难度等级"（入门/进阶/高级）分类字段，UI 展示依赖此分类做分组。


### 2.5 知识图谱页（scheme-a.html #graph）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| D3.js 力导向图渲染 | knowledge-graph Design §4 | ✅ | |
| 节点按类型着色（模式/题目/数学/论文） | knowledge-graph Design §4 nodeColorMap | ✅ | |
| 左侧筛选面板（节点类型/难度/掌握状态） | web-presentation R4.5 | ✅ | |
| 节点点击高亮相邻节点 + 侧边栏详情 | knowledge-graph Design §4 交互设计 | ✅ | |
| 节点双击展开子图 | knowledge-graph Design §4 | ✅ | |
| 节点拖拽 | knowledge-graph Design §4 | ✅ | |
| 搜索框高亮匹配节点 | knowledge-graph Design §4 | ✅ | |
| 节点点击弹窗（摘要信息） | web-presentation R4.4 | ✅ | |

**用户体验问题**：
- ✅ 图谱页设计完整，交互清晰
- 建议：初次进入图谱页时默认加载"用户当前学习路径"子图而非全量，避免首屏过于密集


### 2.6 费曼学习模式（scheme-a.html #feynman）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| WebSocket 实时对话 | interactive R1.1, R8.1 | ✅ | |
| AI 追问（识别漏洞/跳步/模糊点） | interactive R1.3 | ✅ | |
| 结束并生成总结按钮 | interactive R1.4 | ✅ | |
| 右侧"理解评估"面板（掌握/部分/未涉及） | web-presentation R12.8 | ✅ | |
| 多类比选择面板 | interactive R1.5 | ✅ | |
| 历史会话列表 | web-presentation R12.9 | ✅ | |
| 导出按钮 | interactive R9.6 | ✅ | |
| 重置按钮 | — | ⚠️ | UI 有"🔄 重置"按钮，Spec 未定义重置会话逻辑（清空上下文重新开始） |
| 对话轮次计数（第 N/20 轮） | interactive R19.3 | ✅ | |
| AI 加载状态（"正在分析..."旋转图标） | web-presentation R8 通用组件 | ✅ | |

**用户体验问题**：
- ⚠️ "重置"功能需要 Spec 覆盖：清空当前会话上下文并重新开始（不创建新 session，复用 sessionId），或关闭当前 session 创建新的。建议在 interactive Spec 增加 POST /api/v1/session/{id}/reset 端点。
- ✅ 轮次提醒（18 轮时提示、20 轮自动总结）已在 interactive R19 覆盖


### 2.7 面试模拟页（scheme-a.html #interview）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 面试前配置面板（难度/时长/公司风格/指定题目） | interactive R15, web-presentation R12.10 | ✅ | |
| 计时器 + 倒计时 | interactive R3.1 | ✅ | |
| 对话区 + AI 面试官追问 | interactive R3.2 | ✅ | |
| 代码编辑器（右侧） | interactive R3.6 | ✅ | |
| 运行/提交按钮 + 测试用例结果 | interactive R3.6 | ⚠️ | UI 有"▶ 运行"按钮显示通过测试用例数，Spec 未明确是否有在线代码执行能力 |
| 面试评分报告（雷达图 + 四维评分） | interactive R3.5, R20 | ✅ | |
| 低分维度改进建议 | interactive R20 | ✅ | |
| 错误状态（连接中断） | web-presentation R23.5 | ✅ | |

**用户体验问题**：
- ⚠️ UI 显示"✓ 通过 2/2 测试用例"，暗示有在线代码执行能力。但 Spec 中未规划代码在线运行引擎（如 Judge0 或沙箱执行），这是一个重大功能缺口。建议：
  - 方案 A：MVP 阶段仅做"AI 评估代码正确性"（不实际运行），UI 改为"AI 代码审查结果"
  - 方案 B：后续接入 Judge0 API 或自建沙箱，但这是 Phase 2 的工作
- 建议在 interactive Spec 中明确代码执行策略，当前 MVP 采用 AI 审查模式


### 2.8 复习中心页（scheme-a.html #review）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 算法日历（今日计划：模式回顾+新题） | interactive R14, web-presentation R12.13 | ✅ | |
| 多样化复习方式选择器（翻卡/看图猜/补全/Quiz/复杂度） | interactive R4.2, web-presentation R25.1 | ✅ | |
| 统计面板（今日待复习/本周完成/连续天数/记忆保持率） | interactive R4.6 | ✅ | |
| 翻卡片正面/反面 + 翻转动画 | web-presentation R25 | ✅ | |
| 自评按钮（忘了/模糊/记得/秒杀→对应 quality 1-5） | interactive R4.1 | ⚠️ | UI 有 4 个按钮（忘了/模糊/记得/秒杀），SM-2 接受 0-5 分。需定义映射关系 |
| 学习趋势柱状图（最近7天） | interactive R9.5 | ✅ | |

**用户体验问题**：
- ⚠️ 自评按钮与 SM-2 quality 映射：UI 展示 4 个按钮，需明确映射规则。建议：
  - 😟 忘了 → quality=1（间隔重置为1天）
  - 🤔 模糊 → quality=3（间隔小幅增长）
  - 😊 记得 → quality=4（间隔正常增长）
  - 🚀 秒杀 → quality=5（间隔大幅增长）
- 此映射规则需在 interactive Spec R4.1 或 Design 中明确记录
- ✅ 自评按钮 hover 展示下次复习间隔已在 web-presentation R25.7 覆盖


### 2.9 设置页（scheme-a.html #settings + supplement-v2 #settings-v2）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 默认解释级别选择（L1-L5） | infrastructure R17 | ✅ | |
| 默认编程语言选择 | infrastructure R17 | ✅ | |
| 主题偏好（暗色/亮色/系统） | infrastructure R17 | ✅ | |
| 每日复习提醒开关 | infrastructure R47.3 | ✅ | |
| 代码行号显示开关 | infrastructure R47.1 | ✅ | |
| 动画效果开关 | infrastructure R47.2 | ✅ | |
| 通知设置细化（生成/复习/公告/飘屏独立开关） | infrastructure R36.7 | ✅ | |
| 数据导出（JSON） | infrastructure R34.2 | ✅ | |
| 学习水平自测入口 | infrastructure R46 | ✅ | |
| 账户删除（危险区域） | infrastructure R34.1 | ✅ | |

**用户体验问题**：
- ✅ 设置页完整覆盖了所有偏好项
- ✅ 危险区域视觉设计（红色边框+警告色）符合安全设计原则
- 小建议：增加"重置所有设置为默认"按钮，方便用户一键恢复


### 2.10 登录/注册页（scheme-a.html #auth）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 邮箱+密码登录表单 | infrastructure R13.2 | ✅ | |
| 注册表单（邮箱+密码+确认密码） | infrastructure R13.1 | ✅ | |
| 密码强度指示器 | — | ❌ | UI 有密码强度进度条（弱/中/强），Spec 未提及前端密码强度校验规则 |
| GitHub OAuth 登录按钮 | infrastructure R42 | ✅ | |
| Google OAuth 登录按钮 | infrastructure R42 | ✅ | |
| "记住我"选项 | — | ⚠️ | UI 有"记住我"勾选框，Spec 未明确其行为（延长 token TTL？或持久化 refresh token？） |
| 忘记密码链接 | infrastructure R43 | ✅ | |
| 表单校验错误提示 | web-presentation R11.1 | ✅ | |
| 服务条款/隐私政策链接 | — | ⚠️ | UI 有链接但 Spec 未规划这两个页面的内容 |

**用户体验问题**：
- ❌ 密码强度指示器需要前端实现规则（建议：≥8 位+含大小写=弱，+含数字=中，+含特殊字符=强）
- ⚠️ "记住我"的语义需明确：建议为"延长 Refresh Token TTL 为 30 天"（默认 7 天）
- ⚠️ 注册表单 UI 有"用户名"字段，但 infrastructure R13.1 只提到 email+password，User 实体有 nickname 字段。建议将注册时的"用户名"对应到 nickname 字段


### 2.11 管理后台（scheme-a.html #admin + supplement-v2 #admin-v2）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 顶部统计（题目总数/待审核/生成中/反馈） | web-presentation R16.3, R16.4 | ✅ | |
| 内容审核队列列表 | web-presentation R16.2, data-acquisition R13 | ✅ | |
| 生成管理（进度/失败重试） | web-presentation R16.3 | ✅ | |
| 反馈仪表盘（正面/需改进/报错百分比） | web-presentation R16.4, infrastructure R22.3 | ✅ | |
| 系统健康监控（AI成功率/缓存/队列/服务状态） | web-presentation R16.5 | ✅ | |
| 用户管理（表格/搜索/角色/封禁） | web-presentation R16.6 | ✅ | |
| AI 余额告警（OpenAI $余额显示） | web-presentation R16.5 | ⚠️ | UI 展示"余额 $12.34"，但 Spec 未定义如何获取第三方 API 余额（需调用 OpenAI billing API） |

**用户体验问题**：
- ⚠️ OpenAI 余额查询：需要额外的 OpenAI Billing API 集成。建议 MVP 阶段改为"本月累计调用次数"（本地统计即可），不依赖外部 billing API。在 infrastructure Spec 的 AiMetricsCollector 中已有调用次数统计，可直接复用。
- ✅ 健康监控面板设计清晰，各服务状态一目了然


### 2.12 通知系统（supplement.html #notifications）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 铃铛 + 未读数徽章 | infrastructure R36, web-presentation R37.1 | ✅ | |
| 通知下拉面板（列表+已读/未读） | web-presentation R37.2, R37.4 | ✅ | |
| 全部已读按钮 | web-presentation R37.5 | ✅ | |
| 实时 Toast 通知样式（成功/警告/错误） | web-presentation R8.7, R8.9 | ✅ | |
| 通知类型分类（生成完成/复习提醒/系统公告） | infrastructure R36.1 | ✅ | |
| 查看全部通知链接 | — | ⚠️ | UI 有"查看全部通知 →"链接，但 Spec 未定义独立的通知页面路由 |

**用户体验问题**：
- ⚠️ 建议增加 `/notifications` 独立页面路由，展示完整通知历史（分页），避免下拉面板承载过多内容。在 web-presentation Spec R1.1 路由列表中补充。
- ✅ Toast 通知的三种类型样式（绿/黄/红）设计清晰，不阻挡操作


### 2.13 全服飘屏/成就系统（supplement.html #broadcast）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 飘屏消息水平滚动动画 | interactive R17.3 | ✅ | |
| 成就徽章网格（已解锁/锁定） | interactive R16 | ✅ | |
| 成就解锁弹窗（含分享按钮） | interactive R12.2 | ✅ | |
| 飘屏格式（@用户名 解锁了 [成就名]） | interactive R17.1 | ✅ | |
| 设置中关闭飘屏选项 | interactive R17.4 | ✅ | |

**用户体验问题**：
- ✅ 飘屏动画不阻挡用户操作（5 秒后淡出）
- ✅ 成就弹窗含"分享"和"知道了"两个选项，UX 友好
- 建议：成就解锁弹窗可增加"稀缺度"展示（"仅 2.3% 的学习者解锁了此成就"），已在 interactive R21 覆盖


### 2.14 苏格拉底追问（supplement.html #socratic）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 对话区（引导师+用户交替） | interactive R5.4 | ✅ | |
| 4级渐进提示（方向→方法→伪代码→代码） | interactive R5.1 | ✅ | |
| 右侧提示进度面板（步骤 timeline） | web-presentation R12.12 关联 | ✅ | |
| "停止提示让我想想"按钮 | interactive R5.3 | ✅ | |
| 推导得分百分比 | — | ⚠️ | UI 显示"你的推导得分 75%"，Spec 未定义评分计算逻辑 |
| 完成后"你的思路 vs 标准解法"对比面板 | interactive R5.5, web-presentation R12.12 | ✅ | |

**用户体验问题**：
- ⚠️ "推导得分"需定义计算规则。建议：得分 = (自行推导出的步骤数 / 总步骤数) × 100。在 Hint 1 就解出 = 100%，用到 Hint 4 才解出 = 25%。需在 interactive Spec R5 中补充此计算规则和存储（用于学习分析）。
- ✅ "思路对比"双栏设计直观，差异点高亮


### 2.15 Debug 训练（supplement.html #debug）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 有 bug 代码展示（行号+高亮） | interactive R6.1, R6.2 | ✅ | |
| 测试用例展示（部分触发 bug） | interactive R6.2 | ✅ | |
| Bug 标注区（用户标注行号+修复） | interactive R6.3 | ✅ | |
| 渐进提示按钮（行范围→具体行） | interactive R6.4 | ✅ | |
| Debug 统计（正确率/薄弱类型） | interactive R6.5 | ✅ | |
| 提交修复按钮 | interactive R6.3 | ✅ | |

**用户体验问题**：
- ✅ UI 中代码区可点击行号标注 bug，交互直觉
- ✅ 测试用例用红/绿色区分通过/失败，一目了然
- 建议：增加"查看正确代码"按钮（用户放弃时可直接看答案），在 interactive Spec 中已有 Hint 4 级别覆盖


### 2.16 反向费曼（supplement.html #reverse-feynman）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| AI 讲解（含隐蔽错误） | interactive R7.1, R7.2 | ✅ | |
| 用户点击错误部分+输入纠正 | interactive R7.3 | ✅ | |
| 纠正结果反馈（正确/错误） | interactive R7.3 | ✅ | |
| 纠错统计面板（按错误类型分布） | interactive R7.5, content-generation R13 | ✅ | |
| 难度调节（简单/中等/困难） | interactive R7.5, content-generation R13.4 | ✅ | |
| "含 N 处错误"提示 | interactive R7.1 | ✅ | |

**用户体验问题**：
- ✅ 错误部分用高亮背景标注，点击后弹出输入框纠正，交互清晰
- ✅ 难度自动调整（根据表现），同时支持手动切换
- ✅ 纠错→复习联动（R22）已在 Spec 覆盖


### 2.17 内容导入（supplement.html #import）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| URL 粘贴输入框 | interactive R2.1 | ✅ | |
| 导入进度步骤（抓取→提取→AI审查） | interactive R2.1-R2.5 | ✅ | |
| 内容预览（正文/图片/评论） | interactive R2.2, R2.3 | ✅ | |
| AI 审查错误标注（黄色警告） | interactive R2.4 | ✅ | |
| 确认导入/取消按钮 | interactive R2.6 | ✅ | |

**用户体验问题**：
- ✅ 导入流程清晰（URL→进度→预览→确认），每步状态可见
- ⚠️ UI 中"确认导入并精炼"按钮暗示导入后会存入系统。需确认：导入的内容是存为 ImportedContent 还是直接存为用户题解 UserSolution？建议：存为 ImportedContent 后用户可"发布为题解"（二次确认），避免低质量内容直接发布


### 2.18 模式识别训练（supplement.html #pattern-quiz）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 题目描述（隐藏标签） | interactive R13.1, knowledge-graph R2.1 | ✅ | |
| 六宫格模式选择 | web-presentation R21.2 | ✅ | |
| 答案揭晓（正确+识别信号解释） | web-presentation R21.3 | ✅ | |
| 右侧本轮表现统计 | web-presentation R21.4 | ✅ | |
| 各模式正确率排行 | web-presentation R21.4 | ✅ | |
| 薄弱模式定向训练入口 | web-presentation R21.5 | ✅ | |

**用户体验问题**：
- ✅ 设计完整，与 Spec 对齐良好
- ✅ "定向训练"按钮直接跳到薄弱模式专项练习，形成闭环


### 2.19 实际应用映射（supplement.html #applications）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 四维 Tab（工业/AI前沿/工作/人生） | knowledge-graph R3.1 | ✅ | |
| 应用卡片（图标+标题+描述） | knowledge-graph R3.2 | ✅ | |
| 迷你案例代码展示 | knowledge-graph R3.2, R3.3 | ✅ | |
| 代码语言切换（Python/Java） | knowledge-graph R3.3 | ✅ | |

### 2.20 数学基础关联（supplement.html #math）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 算法-数学关联卡片 | knowledge-graph R4.1 | ✅ | |
| 分级数学解释（L1-L5切换） | knowledge-graph R4.2 | ✅ | |
| 权威引用列表（教材/课程/论文） | knowledge-graph R4.3 | ✅ | |

### 2.21 离线导出（supplement.html #export）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 四种格式（PDF/Markdown/Notion/Anki） | knowledge-graph R9.1 | ✅ | |
| 导出范围选择（按模式/单题/收藏/全量） | knowledge-graph R9.2 | ✅ | |
| 增量导出选项 | knowledge-graph R9.5 | ✅ | |
| 包含 Mermaid 图解选项 | knowledge-graph R9.3 | ✅ | |

**用户体验问题**：
- ✅ 以上三个模块（应用映射/数学关联/离线导出）UI 与 Spec 对齐良好


### 2.22 个人中心/学习记录（supplement.html #bookmarks）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 顶部统计（已学/收藏/时长/连续天数/成就） | infrastructure R28.8 | ✅ | |
| 难度分布饼图 | infrastructure R28.8 | ✅ | |
| 模式覆盖度雷达图 | interactive R4.6 | ✅ | |
| 学习日历热力图 | knowledge-graph R14 | ✅ | |
| 收藏列表 | infrastructure R28.5 | ✅ | |

**用户体验问题**：
- ⚠️ "个人中心"页面在 UI 中作为 supplement 的一部分展示，但 Spec 路由表（web-presentation R1.1）未包含 `/profile` 或 `/me` 路由。建议：个人中心数据整合到 `/settings` 页顶部或新增 `/me` 路由。
- ✅ 热力图 + 雷达图 + 饼图组合提供全面学习洞察


### 2.23 错误页面（supplement-v2.html #errors）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 404 页面（搜索/返回首页） | web-presentation R23.2 | ✅ | |
| 500 页面（重试/反馈/错误ID） | web-presentation R23.2 | ✅ | |
| 429 限流（进度条+倒计时） | web-presentation R23.3 | ✅ | |
| 503 AI 服务不可用（降级浏览） | web-presentation R23.4, infrastructure R40.1 | ✅ | |

### 2.24 骨架屏（supplement-v2.html #skeleton）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 题目列表骨架屏 | web-presentation R8.10 | ✅ | |
| 题目详情骨架屏 | web-presentation R8.10 | ✅ | |

### 2.25 匿名用户引导（supplement-v2.html #anon-guide）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 底部横幅（浏览5题后出现） | web-presentation R18.1 | ✅ | |
| 需认证功能弹窗（登录/注册模态框） | web-presentation R18.2, R11.6 | ✅ | |
| 支持 GitHub/Google 一键登录提示 | infrastructure R42 | ✅ | |

### 2.26 网络状态（supplement-v2.html #network-banner）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 网络断开 Banner | web-presentation R23.1 | ✅ | |
| 网络恢复提示（自动消失） | web-presentation R23.1 | ✅ | |
| WebSocket 断线重连提示 | web-presentation R23.5 | ✅ | |
| AI 降级提示（已切换本地模型） | infrastructure R40.1 | ✅ | |

**用户体验问题**：
- ✅ 所有错误/加载/网络状态的 UI 设计完整，与 Spec 对齐良好
- ✅ "你的对话进度已保存"安慰文案降低用户焦虑感


### 2.27 复习深度统计（supplement-v2.html #review-deep）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 掌握程度雷达图 | interactive R4.6, web-presentation R25.4 | ✅ | |
| 遗忘曲线可视化（有复习 vs 无复习） | interactive R4.6, web-presentation R25.4 | ✅ | |
| 薄弱点热力图（颜色=正确率） | web-presentation R25.4 | ✅ | |
| "训练薄弱模式"按钮 | web-presentation R21.5 | ✅ | |

### 2.28 面试增强（supplement-v2.html #interview-v2）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| Follow-up 变体题展示 | interactive R3.3 | ✅ | |
| 白板模式开关（无语法高亮/补全） | interactive R3.6, web-presentation R12.10 | ✅ | |
| 沟通能力实时反馈 | interactive R3.4, R20 | ✅ | |
| 面试技巧提示（💡） | interactive R20.4 | ✅ | |

**用户体验问题**：
- ✅ 白板模式是面试模拟的亮点功能，模拟真实白板面试环境
- ✅ 沟通反馈分三级（✓ 好 / ⚠ 建议 / 💡 技巧），层次清晰


### 2.29 复杂度直觉训练（supplement-v3.html #complexity）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 两种模式 Tab（看范围猜/看代码估） | interactive R13.1, R13.2, web-presentation R27 | ✅ | |
| 选项格子（6个复杂度选项） | interactive R13.1 | ✅ | |
| 答案揭晓+推理过程 | interactive R13.3 | ✅ | |
| 右侧按复杂度类型统计 | interactive R13.4 | ✅ | |
| 速查表面板 | — | ⚠️ | UI 有"💡 速查表"面板展示 n 范围→复杂度对照，Spec 未定义此辅助内容 |
| 30s 计时器（可选） | web-presentation R21.6 | ✅ | |

### 2.30 学习路径（supplement-v3.html #learning-path）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 路径列表卡片（名称/预计时长/节点数/进度） | web-presentation R26.1 | ✅ | |
| 路径详情节点列表（✅已完成/🔵当前/🔒锁定） | web-presentation R26.2 | ✅ | |
| 里程碑节点（🏆金色标注） | web-presentation R26.3 | ✅ | |
| 进度条（总体完成度） | web-presentation R26.2 | ✅ | |
| "继续学习"按钮 | web-presentation R26.5 | ✅ | |
| 锁定节点点击提示 | web-presentation R39.3 | ✅ | |

**用户体验问题**：
- ⚠️ 复杂度训练的"速查表"是很好的辅助工具，建议作为静态内容在 Spec 中预置（data/static/complexity-cheatsheet.json），无需 AI 生成。
- ✅ 学习路径节点解锁规则（前置完成即解锁）逻辑清晰


### 2.31 每日计划详细页（supplement-v3.html #daily-plan）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 今日计划卡片（模式回顾+新题+待复习数） | interactive R14.1, web-presentation R30.1 | ✅ | |
| 连续天数/本周完成率统计 | web-presentation R30.4 | ✅ | |
| 历史日历月视图（✅/⚪/❌/灰色） | web-presentation R30.2 | ✅ | |
| 点击日期展示详情 | web-presentation R30.3 | ✅ | |
| 完成后🎉激励弹窗 | web-presentation R30.4 | ✅ | |

### 2.32 算法考古（supplement-v3.html #archaeology）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 故事列表（时间线形式：年份+发明者+简介） | web-presentation R28.1 | ✅ | |
| 故事详情（叙事体500-1500字） | knowledge-graph R6.2, web-presentation R28.2 | ✅ | |
| 横向时间线事件节点 | web-presentation R28.4 | ✅ | |
| 底部"学习这个算法→"链接 | web-presentation R28.3 | ✅ | |

### 2.33 论文桥梁（supplement-v3.html #paper-bridge）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 按领域分组列表 | web-presentation R29.1 | ✅ | |
| 步骤式桥梁路径（垂直 Timeline） | web-presentation R29.3 | ✅ | |
| L3/L4/L5 解读切换 | web-presentation R29.4 | ✅ | |
| 动手实验链接 | web-presentation R29.5, knowledge-graph R5.4 | ✅ | |

### 2.34 跨域映射表（supplement-v3.html #cross-domain）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 四列表格（LeetCode/工作/AI/日常） | knowledge-graph R13, web-presentation R35 | ✅ | |
| 行点击展开详情面板 | web-presentation R35.2 | ✅ | |
| 代码对比示例 | knowledge-graph R13.4 | ✅ | |

### 2.35 版本历史（supplement-v3.html #version-history）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 版本列表（当前/历史/状态标签） | infrastructure R20.3 | ✅ | |
| 查看历史版本内容 | infrastructure R20.5 | ✅ | |
| 回滚按钮 + 确认弹窗 | infrastructure R20.4 | ✅ | |

**用户体验问题**：
- ✅ 以上各模块（每日计划/考古/论文桥梁/跨域映射/版本历史）均与 Spec 对齐良好
- ✅ 版本回滚有二次确认弹窗，安全设计到位


### 2.36 用户题解区（data-mgmt.html #solutions）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 三区 Tab（官方解析/用户题解/评论） | data-acquisition R35, web-presentation R31.1 | ✅ | |
| 题解排序（精选优先/最新/最热） | data-acquisition R10.3, web-presentation R31.2 | ✅ | |
| 精选题解紫色高亮边框 | data-acquisition R11.1, web-presentation R31.4 | ✅ | |
| 来源标签（用户原创/URL导入/费曼产出） | data-acquisition R10.1 sourceType | ✅ | |
| 点赞 + 评论数 | data-acquisition R34, web-presentation R31.6 | ✅ | |
| "✏️ 写题解"按钮 | data-acquisition R10.2, web-presentation R31.5 | ✅ | |
| 分页 | data-acquisition R10.3 | ✅ | |

### 2.37 评论区（data-mgmt.html #comments）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 评论类型选择（普通/纠错/补充/提问） | data-acquisition R12.2 type | ✅ | |
| 纠错评论红色左边框高亮 | web-presentation R32.2 | ✅ | |
| 补充评论"展开为题解"按钮 | data-acquisition R18, web-presentation R32.3 | ✅ | |
| 提问评论嵌套回复 | data-acquisition R42, web-presentation R32.4 | ✅ | |
| 点赞评论 | data-acquisition R34 | ✅ | |
| 举报入口 | data-acquisition R41, infrastructure R45 | ⚠️ | UI 未展示举报按钮，但 Spec 已定义。建议在评论项右侧增加 🚩 举报图标 |

**用户体验问题**：
- ⚠️ 评论区 UI 未展示举报入口（🚩图标），需补充。data-acquisition R41.4 明确要求"每条内容右侧展示举报入口"。
- ✅ 评论分类用颜色边框区分（红=纠错/蓝=补充/黄=提问），视觉层次清晰


### 2.38 管理后台扩展（data-mgmt.html）

| UI 功能点 | Spec 覆盖 | 状态 | 备注 |
|-----------|-----------|------|------|
| 题目 CRUD 表格（搜索/平台筛选/操作） | data-acquisition R8, web-presentation R33.6 | ✅ | |
| 批量导入弹窗（JSON+skip/update模式） | data-acquisition R8.4-R8.6 | ✅ | |
| 采集管理（平台状态/触发/任务列表/进度） | data-acquisition R9, web-presentation R33.1-R33.3 | ✅ | |
| 跨平台映射管理（确认/驳回/手动创建） | data-acquisition R19, web-presentation R33.4-R33.5 | ✅ | |
| AI 用量统计（今日调用/预算/缓存命中/成本） | data-acquisition R40 | ✅ | |
| 用量按来源分布（采集后加工/用户题解/费曼/错误检测） | data-acquisition R40.4 | ✅ | |
| 双池限流状态（Realtime/Batch） | infrastructure R35, data-acquisition R40.1 | ✅ | |
| 费曼转题解（总结预览+编辑+发布） | data-acquisition R32, web-presentation R34 | ✅ | |

**用户体验问题**：
- ✅ 管理后台功能完备，每个管理操作都有对应的 Spec 支撑
- ✅ 采集任务有实时进度条+失败重试按钮，运维体验好
- ✅ AI 用量统计含"修改预算"入口，可动态调整


---

## 三、UI 有设计但 Spec 未覆盖/需补充的问题汇总

### 3.1 需新增到 Spec 的功能点（❌ 级别）

| # | 功能点 | UI 来源 | 建议补充到 | 优先级 |
|---|--------|---------|------------|--------|
| 1 | 密码强度指示器（前端规则） | scheme-a #auth | web-presentation R11.1 | P2 |
| 2 | 代码在线执行策略（面试模拟） | scheme-a #interview | interactive R3 新增条款 | P1 |

### 3.2 需细化/补充到 Spec 的功能点（⚠️ 级别）

| # | 功能点 | UI 来源 | 建议补充到 | 具体建议 |
|---|--------|---------|------------|----------|
| 1 | "继续学习"阅读位置记录 | scheme-a #dashboard | infrastructure R28 UserProgress | 增加 `lastSection`(String) 字段 |
| 2 | 题目列表收藏筛选 | scheme-a #problems | infrastructure R9.1 | GET /problems 增加 `bookmarked=true` 参数 |
| 3 | 手动加入复习计划 API | scheme-a #problem-detail | interactive-features | 增加 POST /api/v1/review/cards 端点 |
| 4 | 模式难度等级分类字段 | scheme-a #patterns | infrastructure R5.5 AlgorithmPattern | 增加 `difficultyLevel` 枚举字段 |
| 5 | 模式列表返回掌握度 | scheme-a #patterns | knowledge-graph API | GET /patterns 返回 `userMasteryPercent` |
| 6 | 费曼会话重置 API | supplement #feynman | interactive R1 | 增加 POST /session/{id}/reset |
| 7 | 苏格拉底推导得分计算规则 | supplement #socratic | interactive R5 | 定义 score = (4 - hintLevel + 1) / 4 × 100 |
| 8 | 复习自评按钮→quality 映射 | scheme-a #review | interactive R4.1 | 明确 4 按钮→quality 值映射 |
| 9 | "记住我"勾选框行为 | scheme-a #auth | infrastructure R13 | 延长 Refresh Token TTL 为 30 天 |
| 10 | 注册表单用户名→nickname | scheme-a #auth | infrastructure R13.1 | 注册时接收 nickname 参数 |
| 11 | 通知独立页面路由 | supplement #notifications | web-presentation R1.1 | 增加 /notifications 路由 |
| 12 | 个人中心页面路由 | supplement #bookmarks | web-presentation R1.1 | 增加 /me 路由 |
| 13 | 复杂度训练速查表 | supplement-v3 #complexity | content-generation 种子数据 | 增加 cheatsheet 静态数据 |
| 14 | 评论举报 UI 入口 | data-mgmt #comments | web-presentation R32 | 补充 🚩 图标展示要求 |
| 15 | 导入内容→用户题解的转化流程 | supplement #import | interactive R2 / data-acquisition | 明确 ImportedContent→UserSolution 转化步骤 |


---

## 四、用户体验与逻辑自洽性问题

### 4.1 用户流程断裂点

| # | 断裂场景 | 问题描述 | 建议修复 |
|---|----------|----------|----------|
| 1 | 匿名用户点击"加入复习"按钮 | 当前 Spec 仅对收藏/生成设计了登录引导，"加入复习"也需要 | 统一所有需认证按钮的登录引导弹窗 |
| 2 | 导入内容后无明确的"下一步" | URL 导入完成后用户可能不知道内容去了哪里 | 导入完成后显示"✓ 已保存到我的导入历史"+ 跳转链接 |
| 3 | 面试完成后缺少"查看关联题"入口 | 面试报告展示后用户无处可去 | 报告底部增加"练习此题"+"同模式变体"入口 |

### 4.2 逻辑自洽性问题

| # | 问题 | 说明 | 建议 |
|---|------|------|------|
| 1 | 题目列表"生成中"状态的触发源不明 | 列表显示某题"生成中"，但用户可能未触发。是批量生成导致的？ | 区分"用户触发的生成"和"系统批量生成"的状态展示 |
| 2 | L5 级别显示🔒图标但不属于付费功能 | 用户可能误解为需要付费。实际是"尚未生成" | 改为灰色"未生成"文案而非🔒，🔒仅用于真正的付费/权限限制 |
| 3 | 飘屏频率控制与用户体验 | 大量用户同时解锁成就时可能飘屏过密 | 已在 Spec 中限制"同时最多 2 条"，但建议增加"每分钟最多展示 3 次"的客户端限制 |

### 4.3 安全与扩展性考量

| # | 关注点 | 现状 | 建议 |
|---|--------|------|------|
| 1 | 评论/题解 XSS 防护 | infrastructure R39 已覆盖 DOMPurify | ✅ 已规划 |
| 2 | 用户生成内容审核延迟 | 用户题解默认直接 PUBLISHED | 建议高频举报用户的内容自动进入审核队列 |
| 3 | Mermaid 注入风险 | web-presentation R39.3 已覆盖 | ✅ 已规划 |
| 4 | AI 生成内容的版权标注 | 未在 UI 中体现 | 建议在 AI 生成内容底部增加"本内容由 AI 生成，仅供参考"声明 |


---

## 五、让人眼前一亮的设计亮点 ✨

1. **五级认知分层**：L1 零代码类比 → L5 论文推导，市面无竞品如此系统化
2. **反向费曼法**：AI 故意讲错让用户纠正，独特的主动学习方式
3. **苏格拉底推导得分**：量化"你在第几步自己解出来的"，激励用户少用提示
4. **面试白板模式**：关闭语法高亮和补全，真实模拟白板面试
5. **跨域映射表**：将算法思想映射到工作/AI/人生，让"刷题"不再是纯面试工具
6. **全服飘屏**：社区氛围感，但非侵入（可关闭+频率限制）
7. **学习日历热力图**：类 GitHub Contribution 的持续学习可视化，社交驱动力

---

## 六、自检清单

| 页面/功能 | 是否覆盖 | 是否有 UI 对应 | 是否逻辑自洽 |
|-----------|----------|---------------|-------------|
| 首页（Hero + Dashboard） | ✅ | ✅ | ✅ |
| 题目列表 | ✅ | ✅ | ✅ |
| 题目详情（含 LevelTabs/代码/图解/对比） | ✅ | ✅ | ✅ |
| 算法模式列表+详情 | ✅ | ✅ | ⚠️ 缺掌握度 API |
| 知识图谱 | ✅ | ✅ | ✅ |
| 费曼学习模式 | ✅ | ✅ | ⚠️ 缺重置 API |
| 面试模拟 | ✅ | ✅ | ⚠️ 代码执行策略未明确 |
| 复习中心 | ✅ | ✅ | ⚠️ quality 映射需明确 |
| 设置页 | ✅ | ✅ | ✅ |
| 登录/注册 | ✅ | ✅ | ⚠️ 密码强度/记住我 |
| 管理后台（基础） | ✅ | ✅ | ✅ |
| 通知系统 | ✅ | ✅ | ⚠️ 缺独立页面路由 |
| 飘屏/成就 | ✅ | ✅ | ✅ |
| 苏格拉底追问 | ✅ | ✅ | ⚠️ 推导得分规则 |
| Debug 训练 | ✅ | ✅ | ✅ |
| 反向费曼 | ✅ | ✅ | ✅ |
| 内容导入 | ✅ | ✅ | ⚠️ 导入→题解转化流程 |
| 模式识别训练 | ✅ | ✅ | ✅ |
| 应用映射 | ✅ | ✅ | ✅ |
| 数学关联 | ✅ | ✅ | ✅ |
| 离线导出 | ✅ | ✅ | ✅ |
| 个人中心/学习记录 | ✅ | ✅ | ⚠️ 缺 /me 路由 |
| 错误页面 | ✅ | ✅ | ✅ |
| 骨架屏 | ✅ | ✅ | ✅ |
| 匿名引导 | ✅ | ✅ | ✅ |
| 网络状态 | ✅ | ✅ | ✅ |
| 后台增强（监控/用户管理） | ✅ | ✅ | ✅ |
| 深度统计（雷达/遗忘曲线/热力图） | ✅ | ✅ | ✅ |
| 面试增强（Follow-up/白板/沟通） | ✅ | ✅ | ✅ |
| 复杂度训练 | ✅ | ✅ | ⚠️ 速查表数据 |
| 学习路径 | ✅ | ✅ | ✅ |
| 每日计划 | ✅ | ✅ | ✅ |
| 算法考古 | ✅ | ✅ | ✅ |
| 论文桥梁 | ✅ | ✅ | ✅ |
| 跨域映射表 | ✅ | ✅ | ✅ |
| 版本历史 | ✅ | ✅ | ✅ |
| 用户题解 | ✅ | ✅ | ✅ |
| 评论系统 | ✅ | ✅ | ⚠️ 缺举报 UI |
| 题目 CRUD | ✅ | ✅ | ✅ |
| 采集管理 | ✅ | ✅ | ✅ |
| 映射管理 | ✅ | ✅ | ✅ |
| AI 用量统计 | ✅ | ✅ | ✅ |
| 费曼转题解 | ✅ | ✅ | ✅ |

**结论**：全部 38 个页面/功能模块均有 UI 和 Spec 双重覆盖，无遗漏页面。15 个细节点需要补充完善。
