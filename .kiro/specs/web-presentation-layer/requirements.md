# Requirements Document

## Introduction

本规格定义"算法深度理解引擎"项目的 Web 展示层需求。该层建立在 Spec 1（基础设施层）和 Spec 2（内容生成引擎）之上，实现完整的用户端 Web 交互体验，包括：页面体系（首页、题目列表、题目详情、算法模式、知识图谱）、核心交互组件（LevelTabs、MermaidRenderer、MarkdownRenderer、CodeBlock 等）、响应式布局与暗色主题、搜索筛选、性能优化策略。技术栈为 Next.js 14+ (App Router) + TypeScript + TailwindCSS + Mermaid.js + react-markdown。

## Glossary

- **LevelTabs**: L1-L5 级别切换 Tab 组件，允许用户在五种理解深度间切换
- **MermaidRenderer**: 将 Mermaid 文本代码渲染为 SVG 图表的组件，支持缩放和导出
- **MarkdownRenderer**: Markdown 渲染组件，集成代码高亮（rehype-highlight）和数学公式（rehype-katex）
- **CodeBlock**: 多语言代码展示组件，支持 Python/Java/Go/C++ Tab 切换和一键复制
- **SearchFilter**: 搜索框+多维筛选面板的组合组件
- **ProblemCard**: 题目列表中单个题目的卡片展示组件
- **PatternCard**: 算法模式列表中单个模式的卡片展示组件
- **ApproachComparison**: 解法对比可视化组件，含演进关系图和对比矩阵表格
- **SSR**: Server-Side Rendering，服务端渲染
- **SSG**: Static Site Generation，静态站点生成
- **CSR**: Client-Side Rendering，客户端渲染
- **TOC**: Table of Contents，文章目录导航

## Requirements

### Requirement 1: 页面路由与导航体系

**User Story:** As a 学习者, I want 清晰的页面导航结构, so that 我能快速找到想学的算法题或模式。

#### Acceptance Criteria

1. THE 应用 SHALL 提供以下页面路由：首页(`/`)、题目列表(`/problems`)、题目详情(`/problems/[id]`)、算法模式列表(`/patterns`)、模式详情(`/patterns/[id]`)、知识图谱(`/graph`)、费曼模式(`/feynman`)、面试模拟(`/interview`)、复习中心(`/review`)、设置(`/settings`)
2. THE 导航栏 SHALL 在所有页面顶部固定显示，包含 Logo、页面链接（首页/题目/模式/图谱）、主题切换按钮、搜索入口
3. THE 侧边栏导航 SHALL 在桌面端显示题目目录树，在移动端收起为汉堡菜单
4. WHEN 用户当前所在页面对应的导航项时, THE 导航栏 SHALL 高亮显示该项
5. THE 首页 SHALL 展示产品介绍、核心特色功能（五级理解、智能图解、模式提炼、费曼学习法、面试模拟、间隔复习）、快速入口（热门题目、推荐模式）
6. WHEN 用户已登录时, THE 首页 SHALL 在 Hero 区域下方展示个性化 Dashboard 区块：含"📅 今日计划"卡片（来源 GET /api/v1/daily-plan）、"继续学习"（上次浏览的题目+阅读位置）、"待复习 N 道"快捷入口、"🔥 连续学习天数"、"🎯 基于薄弱模式推荐"区域（来源 GET /api/v1/recommendations?type=weak_pattern），替代匿名用户看到的静态产品介绍
7. THE 导航栏 SHALL 包含通知铃铛图标（含未读数徽章，参见 R37）和用户头像（已登录态），头像点击展开下拉菜单：个人中心/设置/退出登录


### Requirement 2: 题目列表页搜索与筛选

**User Story:** As a 学习者, I want 通过关键词搜索和多维筛选快速定位题目, so that 我能高效找到适合当前学习阶段的题目。

#### Acceptance Criteria

1. THE 搜索功能 SHALL 支持按关键词匹配题目标题和描述，输入后 300ms 防抖触发搜索
2. THE 筛选面板 SHALL 支持按难度（Easy/Medium/Hard）、算法标签（动态规划/双指针/图论等）、公司标签、生成状态（已生成/未生成）进行多维组合筛选
3. THE 排序功能 SHALL 支持按热度、难度、最近更新时间三种排序方式
4. THE 题目列表 SHALL 支持分页展示，每页 20 条，支持页码跳转
5. WHEN 筛选条件变化时, THE URL 查询参数 SHALL 同步更新，支持浏览器前进/后退和链接分享
6. THE 搜索结果 SHALL 展示匹配数量，无结果时显示空状态提示和推荐题目

### Requirement 3: 题目详情页分级内容展示

**User Story:** As a 学习者, I want 在题目详情页通过 Tab 切换不同深度的解释, so that 我能选择最适合自己水平的理解方式。

#### Acceptance Criteria

1. THE LevelTabs 组件 SHALL 展示 L1-L5 五个级别 Tab，每个 Tab 标注级别名称（直觉/入门/进阶/熟练/专家）和简短描述
2. WHEN 用户切换级别时, THE 内容区域 SHALL 平滑过渡展示对应级别的解析内容，无整页刷新
3. THE MarkdownRenderer SHALL 正确渲染 Markdown 内容，包括：标题层级、代码块（带语法高亮）、KaTeX 数学公式、表格、列表
4. THE MermaidRenderer SHALL 将 Mermaid 代码渲染为 SVG 图表，支持双指/滚轮缩放和拖拽平移
5. THE CodeBlock 组件 SHALL 展示多语言代码 Tab（Python/Java/Go/C++），支持一键复制到剪贴板
6. WHEN 内容中包含 ApproachComparison 数据时, THE 组件 SHALL 渲染解法演进关系 Mermaid 图和多维对比矩阵表格
7. THE 题目详情页 SHALL 在右侧显示目录导航（TOC），高亮当前阅读位置
8. WHEN 用户切换到某级别但该级别内容尚未生成时, THE Frontend SHALL 展示"此级别解析尚未生成"空状态 + "触发生成"按钮（需认证），已有级别的 Tab 正常标注可用状态
9. THE LevelTabs SHALL 通过视觉标记区分已生成/未生成级别（如：未生成级别 Tab 显示为灰色+锁图标）
10. THE MarkdownRenderer SHALL 根据当前显示的级别应用不同的视觉样式类：L1 使用 `prose-xl` 大字体+配图优先+故事卡片风格（圆角大间距），L2 使用 `prose-lg` + 步骤卡片布局，L3 使用默认 `prose` + 代码突出，L4 使用 `prose` + 公式和证明突出，L5 使用 `prose-sm` 学术排版风格（紧凑行距+公式居多+引用格式突出）
11. THE 题目详情页右侧 TOC 下方 SHALL 展示"📖 算法故事"入口卡片（如果该题关联的算法模式有考古内容），卡片含 100 字精简摘要 + "阅读完整故事→"链接跳转到 `/archaeology/[id]`
12. THE 题目详情页 SHALL 在 L4 及以上级别内容底部自动展示"📐 数学基础"关联卡片（如果该题关联的模式有 MATH_FOUNDATION 关系），卡片含数学知识名称+一句话说明+"深入了解→"链接跳转到数学关联详情


### Requirement 4: 算法模式页与知识图谱页

**User Story:** As a 学习者, I want 浏览算法模式和可视化知识图谱, so that 我能理解题目之间的关联关系并系统化学习。

#### Acceptance Criteria

1. THE 算法模式列表页 SHALL 以卡片网格形式展示所有算法模式，每张卡片包含：模式名称、简介、关联题目数量、难度分布、掌握度百分比（计算规则：该模式下已完成复习且正确率>70%的题目占比）及对应进度条
2. THE 模式详情页 SHALL 展示：模式描述、识别信号、通用模板代码（CodeBlock）、关联题目列表（含掌握状态标记）、变体说明、底部"跨域迁移映射表"区域（参见 R35）
3. THE 知识图谱页 SHALL 以可交互的节点-边图展示题目间的关联关系（前置题→本题→进阶题）
4. WHEN 用户点击图谱中的节点时, THE 系统 SHALL 展示该题目的摘要信息弹窗，含题目标题、难度、所属模式和"查看详情"链接
5. THE 知识图谱 SHALL 支持按算法模式进行子图筛选，避免全量展示过于密集

### Requirement 5: 响应式布局与主题系统

**User Story:** As a 学习者, I want 在手机和平板上也能舒适阅读, 并能切换暗色主题减轻眼疲劳, so that 我能在任何设备和环境下学习。

#### Acceptance Criteria

1. THE 布局系统 SHALL 适配三种断点：移动端（<768px）、平板（768px-1024px）、桌面端（>1024px）
2. WHEN 屏幕宽度<768px时, THE 侧边栏 SHALL 收起为底部导航或抽屉菜单，代码块支持横向滚动
3. THE 主题系统 SHALL 支持亮色/暗色两种主题，通过 TailwindCSS `dark:` 前缀实现
4. WHEN 用户切换主题时, THE 系统 SHALL 将偏好存储到 localStorage 并立即应用，页面刷新后保持用户选择
5. THE Mermaid 图表 SHALL 根据当前主题自动调整配色方案（亮色主题/暗色主题）
6. THE 代码高亮 SHALL 根据当前主题切换 highlight.js 的亮/暗色样式

### Requirement 6: 用户交互增强

**User Story:** As a 学习者, I want 便捷的交互功能如代码复制、图解全屏、收藏和进度追踪, so that 我的学习效率更高且能追踪学习进展。

#### Acceptance Criteria

1. THE CodeBlock 组件 SHALL 在右上角提供复制按钮，点击后复制代码到剪贴板并显示"已复制"提示（2秒后消失）
2. THE MermaidRenderer SHALL 提供全屏查看按钮，点击后图表以模态框全屏展示，支持缩放和导出为 PNG
3. THE 收藏功能 SHALL 允许用户收藏/取消收藏题目，收藏状态存储到 localStorage（后续迁移至后端）
4. THE 阅读进度追踪 SHALL 记录用户已浏览过的题目和级别，在题目列表中显示已阅读标记
5. WHEN 生成任务正在进行时, THE ProgressBar 组件 SHALL 实时展示生成进度（百分比+当前步骤描述）
6. THE 图解组件 SHALL 支持导出为 SVG/PNG 文件，文件名包含题目标题


### Requirement 7: 性能优化与渲染策略

**User Story:** As a 学习者, I want 页面加载速度快、内容渲染流畅, so that 我不会因为等待而中断学习流程。

#### Acceptance Criteria

1. THE 首页和题目列表页 SHALL 使用 SSG（静态生成）策略，构建时预渲染，实现首屏加载 < 1s（LCP）
2. THE 题目详情页 SHALL 使用 SSR + 增量静态再生成（ISR），已生成内容缓存 1 小时，未命中时服务端渲染
3. THE MermaidRenderer 和 知识图谱组件 SHALL 使用动态导入（next/dynamic）懒加载，不阻塞首屏
4. THE 代码分割策略 SHALL 确保每个页面的 JavaScript Bundle < 200KB（gzipped）
5. WHEN Mermaid 图表首次渲染成功后, THE 系统 SHALL 将 SVG 结果缓存到内存，相同 Mermaid 代码不重复渲染
6. THE 图片和静态资源 SHALL 使用 Next.js Image 组件优化（自动 WebP 转换、懒加载、尺寸适配）

### Requirement 8: 组件设计规范与复用性

**User Story:** As a 开发者, I want 一套设计规范化的可复用组件库, so that 后续页面开发可以快速组装而不重复造轮子。

#### Acceptance Criteria

1. THE 组件库 SHALL 包含以下基础组件：DifficultyBadge（难度标签，按难度着色）、ProblemCard（题目卡片）、PatternCard（模式卡片）、ProgressBar（进度条）、Toast（消息提示）、ErrorBoundary（全局错误边界）、EmptyState（空状态提示）
2. EACH 组件 SHALL 定义明确的 TypeScript Props 接口，使用 React.FC 泛型约束
3. THE 组件样式 SHALL 完全基于 TailwindCSS 工具类实现，不使用自定义 CSS 文件
4. EACH 组件 SHALL 支持 `className` prop 扩展，允许父组件覆盖样式
5. THE DifficultyBadge SHALL 根据难度值（Easy/Medium/Hard）自动映射为绿色/橙色/红色标签
6. THE ProblemCard SHALL 展示：题目标题、难度标签、算法标签列表（最多3个+更多）、生成状态指示器、收藏按钮
7. THE Toast 组件 SHALL 支持 success/error/warning/info 四种类型，自动 3 秒后消失
8. THE ErrorBoundary SHALL 捕获子组件渲染异常，展示友好的错误提示和重试按钮，不影响其他页面区域
9. WHEN 请求返回 429/500/网络断开时, THE Frontend SHALL 通过 Toast 组件展示对应的用户友好提示
10. THE 组件库 SHALL 包含 Skeleton 组件（加载骨架屏），所有页面数据加载时展示统一的 Skeleton 而非空白

### Requirement 9: 前端状态管理与数据缓存

**User Story:** As a 用户, I want 页面切换和交互时状态不丢失且请求高效, so that 学习过程流畅无中断。

#### Acceptance Criteria

1. THE Frontend SHALL 使用轻量级状态管理方案（如 zustand）管理跨组件共享状态：用户认证状态、收藏列表、阅读进度、当前级别偏好
2. THE API 调用层 SHALL 使用数据缓存库（如 SWR 或 React Query），实现请求去重、后台刷新、失败自动重试
3. WHEN 用户从详情页返回列表页时, THE 列表数据 SHALL 从缓存读取，不触发重复请求
4. THE Frontend SHALL 在用户登录后将 localStorage 中的本地数据（收藏、进度）合并到服务端
5. THE WebSocket 连接管理 SHALL 封装为全局 Hook（useWebSocket），支持自动重连、心跳检测、多会话切换

### Requirement 10: 异步任务状态展示

**User Story:** As a 用户, I want 清楚知道 AI 生成任务的进度, so that 我不会误以为系统卡死或出错。

#### Acceptance Criteria

1. WHEN AI 生成任务进行中时, THE Frontend SHALL 在题目详情页展示生成进度条（百分比 + 当前步骤文字描述）
2. WHEN 用户触发生成后, THE Frontend SHALL 每 3 秒轮询进度 API，直到任务完成或失败
3. WHEN 生成任务完成时, THE Frontend SHALL 自动刷新页面内容展示新生成的解析
4. WHEN 生成任务失败时, THE Frontend SHALL 展示失败原因和"重试"按钮
5. THE Frontend SHALL 在题目列表中通过图标标注各题的生成状态：未生成（灰色）、生成中（加载动画）、已生成（绿色勾选）

### Requirement 11: 登录认证前端集成

**User Story:** As a 用户, I want 在前端完成注册登录并自动管理 token, so that 我能使用需要认证的功能。

#### Acceptance Criteria

1. THE Frontend SHALL 提供注册/登录页面（/auth/login、/auth/register），含表单校验和错误提示
2. THE Frontend SHALL 将 JWT token 存储在 httpOnly cookie 或安全的内存状态中
3. WHEN token 即将过期（剩余 5 分钟）时, THE Frontend SHALL 自动调用 refresh 接口续期
4. WHEN 收到 401 响应时, THE Frontend SHALL 清除认证状态并跳转到登录页
5. THE 导航栏 SHALL 根据登录状态展示不同内容：未登录显示"登录/注册"按钮，已登录显示用户昵称+头像下拉菜单
6. WHEN 未登录用户触发需认证的操作（如点击"触发生成"、收藏）时, THE Frontend SHALL 弹出登录提示模态框，登录成功后自动恢复并执行用户之前的操作（延迟操作恢复机制）
7. THE Frontend SHALL 在 URL 中保存来源信息（如 returnUrl 参数），登录成功后自动跳回原页面


### Requirement 12: 交互功能入口页面

**User Story:** As a 学习者, I want 从 Web UI 直接进入费曼模式、面试模拟等交互功能, so that 我不仅能阅读还能主动练习。

#### Acceptance Criteria

1. THE Frontend SHALL 在题目详情页底部提供交互功能入口区域：费曼模式按钮（"用自己的话讲解"）、面试模拟按钮（"模拟面试"）、苏格拉底追问按钮（"引导式推导"）
2. THE Frontend SHALL 提供独立的费曼模式页面(`/feynman?problem={id}`)，含实时对话界面、历史消息列表、结束并生成总结按钮
3. THE Frontend SHALL 提供独立的面试模拟页面(`/interview?problem={id}`)，含计时器、对话区域、代码编辑器（简易版）、结束面试按钮
4. THE Frontend SHALL 提供复习中心页面(`/review`)，展示今日待复习卡片列表、整体学习统计、薄弱点提示
5. WHEN 用户在题目详情页点击交互功能按钮但未登录时, THE Frontend SHALL 弹出登录提示并在登录后自动跳转到对应功能页
6. THE 导航栏 SHALL 包含"学习"下拉菜单，含费曼模式、面试模拟、复习中心三个入口
7. WHEN 费曼会话结束并生成总结时, THE Frontend SHALL 展示结构化总结面板：分段展示直觉→思路→伪代码→代码→复杂度，每段可折叠，底部提供"保存到笔记"和"导出"按钮
8. THE 费曼模式页面右侧 SHALL 展示"理解评估面板"：实时标注已掌握/部分掌握/未涉及的知识点，"未涉及"项提供"💡 引导这个话题"按钮
9. THE 费曼模式页面 SHALL 提供"历史会话"侧边列表，可恢复之前的费曼对话继续
10. THE 面试模拟页面 SHALL 在开始前展示配置面板：难度(Easy/Medium/Hard/随机)、时长(25/45/60分钟)、公司风格(Google/Meta/Amazon/字节/通用)
11. THE 面试评分报告 SHALL 在每个低分维度(< 70分)下方展示 AI 生成的具体改进建议文字，并提供"查看历史评分趋势"入口链接
12. THE 苏格拉底追问完成后 SHALL 展示双栏对比总结：左栏="你的推导路径"（按时间线展示用户回答）、右栏="标准思路"（标注关键差异点）
13. THE 复习中心页面 SHALL 在顶部展示"📅 今日计划"卡片（一个模式回顾+一道新题推荐），来源为 GET /api/v1/daily-plan

### Requirement 13: 用户偏好设置页面

**User Story:** As a 学习者, I want 自定义我的学习偏好设置, so that 系统展示最适合我水平的内容。

#### Acceptance Criteria

1. THE Frontend SHALL 提供设置页面(`/settings`)，包含以下偏好项：默认解释级别（L1-L5）、默认代码语言（Python/Java/Go/C++）、主题偏好（亮色/暗色/跟随系统）
2. THE Frontend SHALL 在题目详情页默认加载用户偏好的级别和语言，而非固定 L3/Python
3. WHEN 用户修改偏好设置时, THE Frontend SHALL 实时保存到后端（已登录）或 localStorage（未登录）
4. WHEN 未登录用户注册登录后, THE Frontend SHALL 将 localStorage 中的偏好合并到服务端存储
5. THE 设置页面 SHALL 包含"学习水平自测"入口：5道快速判断题，根据结果自动推荐默认级别

### Requirement 14: 内容状态完整展示

**User Story:** As a 用户, I want 清楚看到内容的各种状态（已生成/生成中/校验失败等）, so that 我理解为什么某些内容不可见。

#### Acceptance Criteria

1. THE Frontend SHALL 区分以下内容状态并分别展示：已生成（正常展示）、生成中（进度条）、未生成（触发按钮）、校验失败-待修正（展示"内容审核中"提示）
2. WHEN 内容处于"待修正"状态时, THE Frontend SHALL 展示降级内容（如仅展示代码和基本思路，隐藏可能有误的部分）
3. THE 管理员 SHALL 能通过 `/admin/review` 页面查看所有待修正内容列表并进行人工审核操作
4. THE Frontend SHALL 在题目解析底部展示内容反馈组件（"这个解析有帮助吗？👍👎"），支持点赞/踩和可选的 1-5 分评分
5. THE 反馈组件 SHALL 在用户首次完整阅读解析（停留 > 30s 或滚动到底部）后自动展示

### Requirement 15: 基础 SEO 支持

**User Story:** As a 产品, I want 基础的 SEO 优化, so that 算法学习者能通过搜索引擎找到本站内容。

#### Acceptance Criteria

1. THE Frontend SHALL 为每个题目详情页生成 meta title（格式："题目名称 - 深度解析 | 算法深度理解引擎"）和 meta description（题目简介+核心模式）
2. THE Frontend SHALL 为每个页面生成 Open Graph 标签（og:title、og:description、og:image），支持社交媒体分享预览
3. THE Frontend SHALL 生成 sitemap.xml，包含所有已生成内容的题目详情页 URL
4. THE 题目详情页 SHALL 使用语义化 HTML 结构（h1-h6 层级正确、article 标签包裹主体内容）


### Requirement 16: 管理后台页面

**User Story:** As a 管理员, I want 一个 Web 管理后台来审核内容、监控系统状态和管理用户, so that 我无需通过 API 工具执行管理操作。

#### Acceptance Criteria

1. THE Frontend SHALL 提供管理后台入口（`/admin`），仅 ADMIN 角色可访问，前端路由守卫校验用户角色
2. THE 管理后台 SHALL 提供内容审核列表页（`/admin/review`），展示所有 PENDING_REVIEW 状态的内容，支持逐条查看/批准/驳回
3. THE 管理后台 SHALL 提供批量生成管理页（`/admin/generation`），支持触发批量生成、查看进度、查看失败原因
4. THE 管理后台 SHALL 提供用户反馈仪表盘（`/admin/feedback`），展示按题目/级别的反馈统计、低分内容列表
5. THE 管理后台 SHALL 提供系统健康监控页（`/admin/monitor`），展示：AI 成功率%、缓存命中率%、任务队列排队数、DB/Redis/AI 各服务状态（连接数/内存/GPU用量）、API 余额告警
6. THE 管理后台 SHALL 提供用户管理页（`/admin/users`），支持查看用户列表（搜索/角色筛选）、修改角色、封禁用户
7. THE 管理后台 SHALL 提供题目管理页（`/admin/problems`），支持手动创建/编辑/删除题目、批量导入（JSON 格式，skip/update 模式）

### Requirement 17: PWA 离线支持

**User Story:** As a 学习者, I want 在没有网络的环境下也能复习已浏览过的题目, so that 我在通勤或旅途中也能利用碎片时间学习。

#### Acceptance Criteria

1. THE Frontend SHALL 配置 next-pwa（或等效方案），注册 Service Worker
2. THE Service Worker SHALL 缓存已浏览过的题目详情页（包含解析内容），离线时可正常阅读
3. THE Frontend SHALL 在离线状态下展示"离线模式"提示标识，禁用需要网络的功能（生成、交互式对话等）
4. THE Service Worker SHALL 缓存静态资源（JS/CSS/字体），确保离线时 UI 正常渲染
5. THE Frontend SHALL 提供 manifest.json 配置，支持"添加到主屏幕"功能

### Requirement 18: 匿名用户到注册的转化路径

**User Story:** As a 产品, I want 匿名用户自然地被引导注册, so that 用户转化率高且体验不中断。

#### Acceptance Criteria

1. WHEN 匿名用户浏览超过 5 道题目详情后, THE Frontend SHALL 非侵入式展示注册引导（底部 banner："注册后可收藏题目、追踪进度"）
2. WHEN 匿名用户点击需认证功能时, THE Frontend SHALL 弹出登录/注册模态框（非跳转），登录成功后自动执行之前的操作
3. THE Frontend SHALL 支持延迟操作恢复机制：记录用户触发的操作上下文（如"收藏题目 X"），登录后自动完成
4. THE 注册流程 SHALL 尽量简短：邮箱 + 密码即可，昵称可选（注册后再设置）
5. THE Frontend SHALL 在首页为匿名用户展示"快速体验"入口，直接跳转到最热门的题目详情

### Requirement 19: 学习后行动引导

**User Story:** As a 学习者, I want 读完解析后有明确的"下一步"引导, so that 我的学习有方向感而不是读完就走。

#### Acceptance Criteria

1. THE 题目详情页底部 SHALL 展示"下一步行动"引导区域：推荐同模式变体题（基于关联推荐 API）、提供"用费曼模式复述"入口
2. WHEN 用户在 L3 级别阅读完一道题时, THE Frontend SHALL 推荐"试试这道变体题"（难度相近的 similar_pattern 或 variant 关联题）
3. WHEN 用户在 L4+ 级别阅读完时, THE Frontend SHALL 推荐"来模拟面试？"入口
4. THE Frontend SHALL 在用户学习 3 道以上题目后，展示"设置复习提醒"入口（引导开启间隔重复功能）

### Requirement 20: 内容 SEO 增强

**User Story:** As a 产品, I want 搜索引擎友好的内容策略, so that 更多学习者能通过搜索找到本站。

#### Acceptance Criteria

1. THE Frontend SHALL 为题目详情页生成 Schema.org `LearningResource` 结构化数据（包含 name、description、educationalLevel、teaches）
2. THE Frontend SHALL 实现动态 OG Image 生成：基于题目标题和难度生成社交分享预览图（使用 @vercel/og 或等效方案）
3. THE 内容开放策略 SHALL 为：所有已发布的解析内容对搜索引擎和匿名用户完全可见（不设登录墙），写操作需认证
4. THE Frontend SHALL 为导航页面生成面包屑导航（BreadcrumbList schema），提升搜索结果展示效果

### Requirement 21: 模式识别训练页面

**User Story:** As a 面试准备者, I want 通过交互式训练快速提升算法模式识别能力, so that 面试时能迅速判断该用什么算法。

#### Acceptance Criteria

1. THE Frontend SHALL 提供模式识别训练页面（`/training/pattern-quiz`），包含：题目描述展示区（隐藏标签）、模式选择面板（六宫格或多选按钮）、答案揭晓区（含识别信号解释）
2. THE 模式选择面板 SHALL 支持单选和多选两种模式（部分题目可能涉及多种模式），选中态有明确高亮
3. THE Frontend SHALL 在答案揭晓后展示："为什么是这个模式"的识别信号列表 + "看看这题的完整解析"跳转链接
4. THE 训练页右侧 SHALL 展示实时统计面板：本轮正确率、各模式正确率排行、薄弱模式警告
5. THE Frontend SHALL 提供"定向训练"入口：点击薄弱模式后跳转到该模式专项 Quiz（仅出该模式相关题目）
6. THE 训练页 SHALL 支持可选"限时模式"（每题30秒计时器），训练快速判断能力

### Requirement 22: 内容生成触发与进度展示

**User Story:** As a 用户, I want 清楚地触发内容生成并看到实时进度, so that 我知道内容正在准备且不会误以为系统故障。

#### Acceptance Criteria

1. WHEN 用户访问某题目未生成的级别时, THE Frontend SHALL 展示空状态卡片：含"🚀 AI 生成解析"醒目按钮 + "预计等待30-60秒"文案 + 已有级别Tab正常可切换
2. WHEN 用户点击生成按钮后, THE Frontend SHALL 展示步骤进度条，含以下可视化步骤：分析题目(20%) → 生成思路(40%) → 编写代码(60%) → 生成图解(80%) → 质量校验(100%)
3. THE 进度条 SHALL 通过 SSE（GET /api/v1/tasks/{taskId}/stream）实时更新，非轮询
4. WHEN 生成完成时, THE Frontend SHALL 自动切换到新内容展示，带入场动画（fade-in + translateY）
5. WHEN 生成失败时, THE Frontend SHALL 展示友好错误提示 + "重试"按钮 + "先看其他级别"引导
6. THE 题目列表中 SHALL 对生成中的题目显示加载动画（脉冲圆点），避免用户重复触发

### Requirement 23: 全局错误态与降级页面

**User Story:** As a 用户, I want 系统出错时看到清晰的提示和恢复选项, so that 我不会困惑或丢失学习进度。

#### Acceptance Criteria

1. THE Frontend SHALL 提供网络断开 Banner：固定在页面顶部，黄色背景 + "网络已断开，正在重连..."文案，恢复后自动消失
2. THE Frontend SHALL 提供 500 错误页面：含友好的错误描述 + "重试"按钮 + "反馈问题"链接 + 返回首页链接
3. THE Frontend SHALL 提供 429 限流提示 Toast："请求过于频繁，请 {N} 秒后重试"（N 从 Retry-After header 获取）
4. THE Frontend SHALL 提供 AI 服务不可用降级页面：含"AI 暂时繁忙"描述 + "浏览已有内容"按钮引导到预生成内容
5. THE Frontend SHALL 对 WebSocket 断线提供重连 Banner：含重连倒计时 + 手动重连按钮 + "你的对话进度已保存"安慰文案
6. ALL 错误状态 SHALL 使用统一的 ErrorBoundary 组件包裹，确保局部错误不导致整页白屏

### Requirement 24: 题目详情页多平台链接展示

**User Story:** As a 在多个平台刷题的用户, I want 在题目详情页看到各平台链接, so that 我能快速跳转到该题在其他平台的页面。

#### Acceptance Criteria

1. THE 题目详情页信息头区域 SHALL 展示多平台链接图标组：LeetCode / 牛客 / HackerRank / Codeforces 等已映射平台，每个平台用对应品牌 icon 展示
2. WHEN 点击某平台图标时, THE Frontend SHALL 在新标签页打开该题在对应平台的 URL
3. IF 某题仅在部分平台有映射, THEN THE Frontend SHALL 仅展示已映射的平台图标，未映射的不展示
4. THE 平台链接数据 SHALL 来自 GET /api/v1/problems/{id} 返回的 platformMappings 字段
5. THE 图标组 SHALL 使用 tooltip 展示"在 LeetCode 上查看"等提示文字

### Requirement 25: 复习中心增强功能

**User Story:** As a 学习者, I want 复习中心提供多样化的复习方式和学习洞察, so that 复习不枯燥且能识别薄弱点。

#### Acceptance Criteria

1. THE 复习中心页面 SHALL 在开始复习前提供"复习方式"选择器：经典翻卡片 / 补全代码 / 看图猜模式 / 口述思路，用户可选择或随机
2. THE "补全代码"方式 SHALL 展示代码骨架（关键行留空），用户填写后 AI 判断正确性并给出反馈
3. THE "看图猜模式"方式 SHALL 展示 Mermaid 流程图或状态图，用户判断对应哪个算法模式
4. THE 复习中心 SHALL 提供"学习洞察"Tab，包含：掌握程度雷达图（按模式维度）、遗忘曲线可视化、薄弱点热力图（哪些模式正确率低）
5. THE 复习中心 SHALL 提供"⚡ 复杂度训练"入口卡片，跳转到复杂度直觉训练页面（/training/complexity）
6. THE 复习完成后 SHALL 展示正向激励弹窗："太棒了！今日复习完成 🎉"含今日数据总结（复习题数/正确率/用时）
7. THE 自评按钮 SHALL 在鼠标悬浮时展示 tooltip 说明下次复习间隔："忘了(明天) / 模糊(3天后) / 记得(7天后) / 秒杀(14天后)"

### Requirement 26: 学习路径可视化页面

**User Story:** As a 学习者, I want 可视化的学习路径展示我的进度和方向, so that 我知道下一步该学什么且有成就感。

#### Acceptance Criteria

1. THE Frontend SHALL 提供学习路径列表页（`/learning-path`），以卡片网格展示所有可选路径（如"DP从入门到精通"、"图论基础"等），每张卡片含路径名称、描述、预计时长、节点总数
2. THE Frontend SHALL 提供学习路径详情页（`/learning-path/[id]`），展示线性进度可视化：进度条（总体完成度%）+ 节点列表（已完成✅/当前🔵/锁定🔒状态图标）
3. THE 路径详情页 SHALL 高亮当前学习位置，里程碑节点用特殊样式标注（如金色边框+🏆图标）
4. WHEN 用户点击路径中的节点时, THE Frontend SHALL 跳转到对应的题目详情或模式详情页
5. THE 路径详情页 SHALL 展示"推荐下一步"按钮，跳转到路径中下一个未完成节点

### Requirement 27: 复杂度直觉训练页面

**User Story:** As a 面试准备者, I want 专项训练"看数据范围猜算法"和"看代码估复杂度"的直觉, so that 面试中能快速判断时间约束。

#### Acceptance Criteria

1. THE Frontend SHALL 提供复杂度训练页面（`/training/complexity`），含两种模式切换 Tab："看范围猜算法"和"看代码估复杂度"
2. THE "看范围猜算法"模式 SHALL 展示数据范围描述（如"n ≤ 10^5"），用户从选项中选择应该用什么复杂度的算法（O(n)/O(n log n)/O(n²)等）
3. THE "看代码估复杂度"模式 SHALL 展示一段代码片段（CodeBlock），用户选择时间/空间复杂度
4. THE 答案揭晓区 SHALL 展示正确答案 + 推理过程解释（如"n=10^5 → O(n log n) 约 10^6 运算 → 1s 内完成"）
5. THE 训练页右侧 SHALL 展示实时统计面板：本轮正确率、按复杂度类型的正确率分布

### Requirement 28: 算法考古页面

**User Story:** As a 学习者, I want 了解算法的发明故事和历史背景, so that 学习更有趣且更容易记住算法的设计动机。

#### Acceptance Criteria

1. THE Frontend SHALL 提供算法考古列表页（`/archaeology`），以时间线或卡片形式展示所有算法故事条目（发明者头像/名字+算法名+年份+一句话简介）
2. THE Frontend SHALL 提供算法考古详情页（`/archaeology/[id]`），以叙事体展示完整发明故事（500-1500字），配有横向时间线图
3. THE 考古详情页底部 SHALL 展示"学习这个算法 →"链接，跳转到关联的模式详情或题目详情
4. THE 时间线组件 SHALL 以横向可滚动方式展示关键事件节点（年份+事件描述），支持点击展开

### Requirement 29: 论文桥梁页面

**User Story:** As a 想进入 AI 领域的学习者, I want 看到从基础算法到前沿论文的桥梁路径, so that 我能平滑过渡到研究领域。

#### Acceptance Criteria

1. THE Frontend SHALL 提供论文桥梁列表页（`/paper-bridge`），按领域分组（CV/NLP/推荐/机器人/生物/量子），每组展示桥梁条目（基础算法名→论文标题+年份）
2. THE Frontend SHALL 提供论文桥梁详情页（`/paper-bridge/[id]`），展示步骤式桥梁路径（从基础到论文的 4-5 步渐进）
3. THE 桥梁步骤 SHALL 以垂直 Timeline 形式展示，每步含标题+描述+与下一步的衔接说明
4. THE 详情页 SHALL 支持 L3/L4/L5 三级解读切换（通俗版/详解版/精读版），复用 LevelTabs 组件样式
5. THE 详情页底部 SHALL 展示"动手实验"区域，含代码框架链接或 Jupyter Notebook 链接

### Requirement 30: 每日计划详细页面

**User Story:** As a 学习者, I want 查看历史学习计划和完成情况, so that 我能追溯学习轨迹并保持动力。

#### Acceptance Criteria

1. THE Frontend SHALL 提供每日计划页面（`/daily-plan`），展示今日计划（模式回顾+新题推荐+待复习数）和操作按钮
2. THE 页面 SHALL 包含"历史日历"区域，以月视图展示过去 30 天的计划完成情况（完成✅/部分⚪/未完成❌/无计划灰色）
3. WHEN 用户点击历史日期时, THE 页面 SHALL 展示该天的具体计划内容和完成详情
4. WHEN 今日计划全部完成时, THE 页面 SHALL 展示"🎉 今日计划已完成！"正向激励 + 连续天数更新
5. THE 页面 SHALL 展示"连续学习天数"和"本周完成率"统计卡片

### Requirement 31: 用户题解系统

**User Story:** As a 学习者, I want 在题目详情页查看和发布自己的题解, so that 我能学习他人思路并分享自己的理解。

#### Acceptance Criteria

1. THE 题目详情页 SHALL 包含三区 Tab 切换："📖 官方解析"（默认）/ "📝 用户题解" / "💬 评论"
2. THE 用户题解区 SHALL 支持精选优先、最新、最热三种排序方式
3. THE 题解卡片 SHALL 标注来源类型：用户原创 / URL 导入 / 费曼产出，各类型使用不同颜色标签
4. THE 管理员 SHALL 能将优质题解标记为"⭐ 精选"，精选题解卡片有紫色高亮边框
5. THE 用户 SHALL 能通过 Markdown 编辑器编写题解，支持实时预览
6. THE 题解 SHALL 支持点赞计数和评论数展示
7. WHEN 用户点击"✏️ 写题解"按钮但未登录时, THE Frontend SHALL 弹出登录提示

### Requirement 32: 评论系统

**User Story:** As a 学习者, I want 对解析内容发表分类评论（纠错/补充/提问）, so that 内容能持续改进且能交流疑惑。

#### Acceptance Criteria

1. THE 评论输入框 SHALL 支持四种评论类型选择：普通💬、纠错🐛、补充➕、提问❓
2. THE 纠错类评论 SHALL 以红色左边框高亮展示，系统自动通知解析作者/管理员
3. THE 补充类评论 SHALL 提供"📖 展开为题解"快捷操作按钮，方便将优质补充升级为独立题解
4. THE 提问类评论 SHALL 支持嵌套回复（最多 2 层），方便社区互助
5. THE 评论列表 SHALL 支持按点赞数/时间排序
6. THE 评论 SHALL 支持点赞操作，未登录时触发登录提示

### Requirement 33: 数据采集与映射管理（管理后台）

**User Story:** As a 管理员, I want 在后台管理数据采集任务和跨平台题目映射, so that 题库数据持续更新且跨平台关联准确。

#### Acceptance Criteria

1. THE 管理后台 SHALL 提供采集管理页（`/admin/crawler`），支持按平台（LeetCode/CF/牛客/AtCoder）和任务类型（题目同步/题解采集/单题采集）触发采集
2. THE 采集管理页 SHALL 展示平台状态总览卡片：正常🟢 / 已熔断🔴 / 限速⚠️，含题目数量统计
3. THE 采集任务列表 SHALL 展示运行中（进度条+百分比）/已完成/失败状态，支持取消和重试操作
4. THE 管理后台 SHALL 提供映射管理页（`/admin/mapping`），展示跨平台映射列表：已确认/待确认统计+列表
5. THE 待确认映射 SHALL 展示两平台题目信息对比，支持管理员"确认/驳回/手动修改"操作
6. THE 管理后台 SHALL 提供题目 CRUD 页（`/admin/problems`），含搜索、手动创建、编辑、删除、批量导入（JSON/skip/update 模式）

### Requirement 34: 费曼对话转用户题解

**User Story:** As a 学习者, I want 将费曼对话的精华总结一键发布为题解, so that 我的学习成果能被他人参考。

#### Acceptance Criteria

1. THE 费曼会话结束总结面板 SHALL 提供"📤 发布为题解"按钮
2. WHEN 用户点击发布时, THE Frontend SHALL 自动提取对话中的关键思路、代码和类比生成题解草稿
3. THE 用户 SHALL 能在发布前编辑题解草稿（标题、内容、标签）
4. THE 发布后的题解 SHALL 自动标记"🧠 费曼产出"来源标签
5. THE 发布后 SHALL 跳转到该题解详情页，展示 Toast 提示"题解发布成功"

### Requirement 35: 跨域迁移映射表

**User Story:** As a 学习者, I want 看到算法思想在不同领域的应用映射, so that 理解算法的普适性和实际价值。

#### Acceptance Criteria

1. THE 模式详情页底部 SHALL 展示"跨域迁移映射表"区域，表格含四列：LeetCode 场景 / 工作中场景 / AI/ML 场景 / 日常生活类比
2. WHEN 用户点击映射表某行时, THE Frontend SHALL 展开详情面板，含具体解释文字和代码对比示例
3. THE 映射数据 SHALL 与算法模式关联，不同模式展示各自的映射内容
4. THE 映射表 SHALL 在移动端支持横向滚动

### Requirement 36: 全局搜索面板（⌘K）

**User Story:** As a 用户, I want 通过键盘快捷键呼出全局搜索面板快速跳转, so that 我不需要通过导航栏逐级点击。

#### Acceptance Criteria

1. THE Frontend SHALL 支持 ⌘K (macOS) / Ctrl+K (Windows) 快捷键呼出全局搜索模态框
2. THE 搜索面板 SHALL 包含搜索输入框（自动聚焦）、快速跳转列表（题目列表/算法模式/费曼/复习中心）、最近搜索历史
3. THE 搜索 SHALL 支持模糊匹配题目标题、算法模式名、标签名，结果实时展示
4. WHEN 用户按 ESC 或点击遮罩层时, THE 搜索面板 SHALL 关闭
5. WHEN 用户按 ↵ 回车时, THE Frontend SHALL 跳转到第一条搜索结果
6. THE 最近搜索历史 SHALL 存储在 localStorage，展示最近 5 条

### Requirement 37: 通知系统

**User Story:** As a 用户, I want 收到系统通知（生成完成/复习提醒/新功能上线）, so that 我不会错过重要信息。

#### Acceptance Criteria

1. THE 导航栏 SHALL 展示通知铃铛图标，有未读通知时显示红色数字徽章
2. WHEN 用户点击铃铛时, THE Frontend SHALL 展开通知面板（下拉列表或侧边抽屉），展示通知列表
3. THE 通知类型 SHALL 包括：生成完成、复习提醒、评论/回复、系统公告
4. THE 通知列表 SHALL 区分已读/未读状态（未读项有蓝色左边框或加粗标题）
5. THE 通知面板 SHALL 提供"全部标记已读"操作
6. THE 设置页 SHALL 提供按通知类型的开关控制（生成通知/复习提醒/系统公告/评论回复）

### Requirement 38: 设置页增强功能

**User Story:** As a 用户, I want 更细致地管理我的账户设置, so that 我能控制通知偏好、导出数据、删除账户。

#### Acceptance Criteria

1. THE 设置页 SHALL 包含"🔔 通知设置"区域，按类型（生成完成/复习提醒/系统公告/全服飘屏）提供独立开关
2. THE 设置页 SHALL 包含"📥 数据管理"区域，提供"导出我的学习数据"按钮（导出 JSON：收藏、进度、复习记录）
3. THE 设置页 SHALL 包含"🎯 学习水平自测"入口，跳转到 5 题快测页面，完成后自动推荐默认级别
4. THE 设置页 SHALL 包含"⚠️ 危险区域"，提供"删除我的账户"操作（需二次确认弹窗，30天内可恢复）
5. WHEN 用户确认删除账户时, THE Frontend SHALL 清除本地数据、退出登录并跳转首页

### Requirement 39: 学习路径节点解锁规则

**User Story:** As a 学习者, I want 清楚知道学习路径中哪些节点已解锁, so that 我有明确的学习目标。

#### Acceptance Criteria

1. THE 学习路径 SHALL 采用"前置节点完成即解锁"规则：完成节点 N 后自动解锁节点 N+1
2. THE 里程碑节点 SHALL 在前置所有节点完成后解锁，标记🏆图标和金色边框
3. WHEN 用户点击锁定节点时, THE Frontend SHALL 展示 Tooltip："请先完成「xxx」后解锁"
4. THE 路径列表页卡片 SHALL 展示进度百分比和当前节点名称
5. WHEN 用户完成路径最后一个节点时, THE Frontend SHALL 展示完成🎉弹窗和路径完成徽章


### Requirement 40: 通知独立页面

**User Story:** As a 用户, I want 查看完整的通知历史列表, so that 不会因为下拉面板容量限制错过历史通知。

#### Acceptance Criteria

1. THE Frontend SHALL 提供 `/notifications` 页面路由，展示完整通知历史列表（分页，每页 20 条）
2. THE 通知列表 SHALL 支持按类型筛选（全部/生成完成/复习提醒/系统公告/评论回复）
3. THE 通知下拉面板底部 SHALL 包含"查看全部通知 →"链接跳转到此页面
4. THE 通知页面 SHALL 支持批量操作：全部已读、删除已读通知

### Requirement 41: 个人中心页面

**User Story:** As a 学习者, I want 有一个专属的个人中心页面展示学习概况, so that 我能全面了解自己的学习状态。

#### Acceptance Criteria

1. THE Frontend SHALL 提供 `/me` 页面路由，展示用户学习概况
2. THE 个人中心 SHALL 包含以下区域：顶部统计卡片（已学题目/收藏/时长/连续天数/成就数）、难度分布饼图、模式覆盖雷达图、学习日历热力图、收藏列表
3. THE 导航栏用户头像下拉菜单 SHALL 包含"个人中心"入口跳转到此页面
4. THE 热力图数据 SHALL 来自 GET /api/v1/users/me/activity-heatmap 端点（knowledge-graph Spec 已定义）

### Requirement 42: 评论举报 UI 入口

**User Story:** As a 学习者, I want 方便地举报不当评论或题解, so that 社区环境保持健康。

#### Acceptance Criteria

1. THE 每条用户题解和评论 SHALL 在右侧或操作菜单中展示 🚩 举报图标
2. WHEN 用户点击举报图标时, THE Frontend SHALL 弹出举报原因选择面板（不正确/垃圾内容/冒犯性/其他）
3. THE 举报提交成功后 SHALL 展示 Toast 提示"举报已提交，我们会尽快处理"
4. THE 举报功能 SHALL 仅对已登录用户可见，匿名用户不展示举报入口

### Requirement 43: 复杂度训练速查表

**User Story:** As a 学习者, I want 复杂度训练页有速查表辅助学习, so that 我可以快速参考数据范围与复杂度的对应关系。

#### Acceptance Criteria

1. THE 复杂度训练页右侧 SHALL 展示"💡 速查表"面板，包含 n 范围→适用复杂度的对照表
2. THE 速查表内容 SHALL 为静态数据（n≤20→O(2^n)/O(n!)、n≤1000→O(n²)、n≤10^5→O(n log n)、n≤10^7→O(n)、n≤10^18→O(log n)）
3. THE 速查表面板 SHALL 可折叠/展开，默认展开状态


### Requirement 44: 内容版本历史展示

**User Story:** As a 学习者, I want 查看题目解析的历史版本和变更记录, so that 我能了解内容的演进过程并回顾之前的版本。

#### Acceptance Criteria

1. THE 题目详情页信息头 SHALL 展示当前版本号（如"v3"）和"查看历史版本"链接
2. WHEN 用户点击"查看历史版本"时, THE Frontend SHALL 展开版本列表面板，展示所有历史版本（版本号、创建时间、状态：PUBLISHED/ARCHIVED）
3. THE 版本列表中当前版本 SHALL 以高亮样式展示（蓝色边框 + "● 最新"标记）
4. WHEN 用户点击历史版本的"查看"按钮时, THE Frontend SHALL 以只读模式展示该版本的内容（灰色提示"你正在查看历史版本 vN"）
5. THE 管理员 SHALL 在历史版本旁看到"回滚"按钮，点击后弹出确认弹窗："确认回滚到 vN？当前版本将被归档。"
6. THE 回滚操作 SHALL 调用 POST /api/v1/admin/explanations/{id}/rollback?targetVersion={n} 端点（需 ADMIN 角色）
7. THE 版本数据 SHALL 来自 GET /api/v1/explanations/{id}/versions 端点（返回版本列表含 version、createdAt、status）

### Requirement 45: 阅读位置追踪与继续阅读

**User Story:** As a 学习者, I want 系统记住我上次阅读到的位置, so that 我能快速继续上次的学习。

#### Acceptance Criteria

1. THE Frontend SHALL 在用户阅读题目详情页时，自动记录阅读位置（当前可见的章节标题 + 滚动百分比）
2. THE 阅读位置 SHALL 以 500ms 节流频率通过 POST /api/v1/reading-progress 端点保存到后端（已登录）或 localStorage（未登录）
3. THE Dashboard "继续学习"卡片 SHALL 展示：题目标题 + 当前级别 + 上次阅读到的章节名 + 距今时间
4. WHEN 用户点击"继续阅读 →"时, THE Frontend SHALL 跳转到题目详情页并自动滚动到上次阅读位置
5. THE 阅读进度 API SHALL 接受参数：problemId、level、sectionId（章节标识）、scrollPercent(Float)
6. THE 阅读进度数据 SHALL 仅保留每题每用户最近一条记录（覆盖更新）

### Requirement 46: 收藏功能后端集成

**User Story:** As a 学习者, I want 收藏的题目同步到云端, so that 我换设备后仍能看到收藏列表。

#### Acceptance Criteria

1. THE Backend SHALL 提供 POST /api/v1/favorites 端点（需认证），接受 problemId 参数，将题目添加到用户收藏
2. THE Backend SHALL 提供 DELETE /api/v1/favorites/{problemId} 端点（需认证），取消收藏
3. THE Backend SHALL 提供 GET /api/v1/favorites 端点（需认证），返回用户收藏列表（分页，按收藏时间降序）
4. THE 题目详情页 SHALL 展示收藏状态（★ 已收藏 / ☆ 收藏），点击切换状态
5. THE 题目列表筛选 SHALL 支持"⭐ 收藏"快捷筛选，仅展示用户已收藏的题目
6. WHEN 未登录用户点击收藏时, THE Frontend SHALL 存储到 localStorage；用户登录后自动调用 POST /api/v1/favorites/sync 端点批量同步本地收藏到云端
7. THE Favorite 实体 SHALL 包含：id(雪花)、userId、problemId、createdAt(Long UTC毫秒)；唯一约束 uk_favorite(userId, problemId)

### Requirement 47: 解法演进关系图交互增强

**User Story:** As a 学习者, I want 解法演进关系图中的节点可以点击跳转, so that 我能顺着演进路径探索相关题目。

#### Acceptance Criteria

1. THE 题目详情页解法演进关系图 SHALL 展示从暴力解到最优解的演进路径（垂直/横向节点+连线）
2. EACH 演进节点 SHALL 包含：解法名称、时间复杂度、推荐星级
3. THE "思路迁移"区域 SHALL 展示可点击的关联题目标签（如"三数之和"、"四数之和"），点击跳转到对应题目详情
4. THE 最优解节点 SHALL 以高亮样式（绿色边框 + ⭐ 标记）区分于其他节点
5. THE 演进连线 SHALL 标注"优化方向"说明（如"减少重复查找"、"用空间换时间"）

### Requirement 48: 底层共同框架提炼组件

**User Story:** As a 学习者, I want 在题目详情页看到"底层共同思路"提炼, so that 我能理解多种解法的统一本质。

#### Acceptance Criteria

1. THE 题目详情页 SHALL 在解法对比矩阵下方展示"💎 底层共同思路"卡片（左侧蓝色边框高亮样式）
2. THE 卡片内容 SHALL 包含：本质描述（一句话总结所有解法的共同抽象）+ 框架迁移说明（列举 2-3 个可推广的场景）
3. THE 卡片数据 SHALL 来自 Explanation 内容中 `commonFramework` 字段（AI 生成时自动提炼）
4. WHEN 框架迁移列举的场景对应平台内已有题目时, THE Frontend SHALL 渲染为可点击链接跳转到对应题目

### Requirement 49: 导航栏分组优化

**User Story:** As a 用户, I want 导航栏信息层次清晰, so that 我不会被过多入口分散注意力。

#### Acceptance Criteria

1. THE 导航栏 SHALL 将入口分为以下层级：主导航项（首页/题目/模式/图谱）直接展示 + "学习"下拉菜单（费曼/面试/复习/训练）+ 用户菜单（头像下拉：个人中心/设置/通知/退出）
2. THE "学习"下拉菜单 SHALL 包含以下入口：费曼模式🧠、面试模拟🎤、复习中心📅、复杂度训练📐、模式识别 Quiz🧩
3. WHEN 桌面端屏幕宽度 > 1024px 时, THE 导航栏 SHALL 完整展示所有主导航项
4. WHEN 屏幕宽度 768px-1024px 时, THE 导航栏 SHALL 收起"学习"下拉为图标+文字
5. WHEN 屏幕宽度 < 768px 时, THE 导航栏 SHALL 仅展示 Logo + 汉堡菜单 + 搜索 + 通知，其余收入抽屉
6. THE 管理后台入口 SHALL 仅对 ADMIN 角色用户在头像下拉菜单中展示

### Requirement 50: 设置页复习配置增强

**User Story:** As a 学习者, I want 控制每日复习数量和复习时间偏好, so that 学习计划符合我的实际安排。

#### Acceptance Criteria

1. THE 设置页 SHALL 包含"📅 复习偏好"区域，含以下配置项：每日最大复习卡片数（默认 20，可选 10/20/30/50/无限）、每日学习提醒时间（默认 09:00，可选时段）
2. THE 每日复习数量配置 SHALL 影响 GET /api/v1/review/today 端点返回的卡片数量上限
3. THE 学习提醒时间 SHALL 影响 REVIEW_REMINDER 通知的推送时间
4. THE 配置变更 SHALL 通过 PUT /api/v1/users/me/preferences 端点保存到后端
5. THE 设置页 SHALL 在"复习偏好"区域展示当前复习统计摘要：今日待复习数 / 本周已完成 / 当前记忆保持率

