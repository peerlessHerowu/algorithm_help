# Implementation Plan: Web 展示层

## Overview

本计划在 Spec 1（基础设施）和 Spec 2（内容生成引擎）基础上实现完整的 Web 展示层用户体验。按照"基础设施搭建→通用组件→页面实现→交互增强→性能优化"的顺序递进实现，确保每步可独立验证。

## Tasks

- [x] 1. 前端基础设施搭建
  - [x] 1.1 初始化 Next.js 14+ 项目配置
    - 配置 `next.config.ts`：启用 App Router、图片优化、Webpack 配置
    - 配置 `tailwind.config.ts`：品牌色、难度颜色、暗色模式（class 策略）、typography 插件
    - 配置 `globals.css`：TailwindCSS 指令、KaTeX 样式导入、代码高亮基础样式
    - 安装核心依赖：react-markdown、rehype-highlight、rehype-katex、remark-math、remark-gfm、mermaid
    - _Requirements: 5.3, 7.1, 8.3_

  - [x] 1.2 创建根布局与主题系统
    - 创建 `app/layout.tsx`：全局布局（html、body、ThemeProvider 包裹）
    - 创建 `hooks/useTheme.ts`：主题状态管理，localStorage 持久化，dark class 切换
    - 创建 `components/common/ThemeToggle.tsx`：亮色/暗色切换按钮
    - 确保页面刷新后主题偏好保持
    - _Requirements: 5.3, 5.4_

  - [x] 1.3 创建导航布局组件
    - 创建 `components/layout/Navbar.tsx`：顶部固定导航栏（Logo、页面链接、搜索入口、主题切换）
    - 创建 `components/layout/Sidebar.tsx`：桌面端左侧边栏（题目目录树）
    - 创建 `components/layout/MobileNav.tsx`：移动端底部导航 / 汉堡菜单抽屉
    - 创建 `components/layout/Footer.tsx`：页脚
    - 实现当前页面导航项高亮
    - _Requirements: 1.2, 1.3, 1.4, 5.2_

  - [x] 1.4 创建 API 客户端与类型定义
    - 创建 `lib/types.ts`：所有 TypeScript 类型接口（Problem、Explanation、Pattern、GraphNode 等）
    - 创建 `lib/api.ts`：fetch 封装（baseUrl 配置、错误处理、类型安全）
    - 创建 `lib/utils.ts`：工具函数（cn classnames 合并、格式化等）
    - _Requirements: 8.2_

- [x] 2. Checkpoint - 基础设施验证
  - Next.js 项目正常启动，根布局渲染正确，主题切换生效，导航栏正常显示，`npm run build` 通过。

- [x] 3. 通用展示组件
  - [x] 3.1 创建 DifficultyBadge 组件
    - 创建 `components/cards/DifficultyBadge.tsx`
    - Props：difficulty（Easy/Medium/Hard）、size（sm/md）、className
    - 根据难度自动映射颜色：绿/橙/红
    - 支持暗色模式适配
    - _Requirements: 8.1, 8.5_

  - [x] 3.2 创建 ProblemCard 组件
    - 创建 `components/cards/ProblemCard.tsx`
    - 展示：题目标题、DifficultyBadge、算法标签列表（最多3个+更多）、生成状态、收藏按钮
    - 支持 hover 效果和点击跳转到详情页
    - 支持已阅读标记展示
    - _Requirements: 8.1, 8.6_

  - [x] 3.3 创建 PatternCard 组件
    - 创建 `components/cards/PatternCard.tsx`
    - 展示：模式名称、简介、关联题目数量、难度分布条形图
    - 支持点击跳转到模式详情页
    - _Requirements: 4.1, 8.1_

  - [x] 3.4 创建 ProgressBar 组件
    - 创建 `components/common/ProgressBar.tsx`
    - Props：progress（0-100）、status（当前步骤描述）
    - 带动画过渡效果的进度条
    - _Requirements: 6.5, 8.1_

  - [x] 3.5 创建 EmptyState 组件
    - 创建 `components/common/EmptyState.tsx`
    - 搜索无结果、内容未生成等空状态展示
    - 支持自定义图标、标题、描述和操作按钮
    - _Requirements: 2.6_


- [x] 4. 内容渲染组件
  - [x] 4.1 创建 MarkdownRenderer 组件
    - 创建 `components/content/MarkdownRenderer.tsx`
    - 集成 react-markdown + rehype-highlight + rehype-katex + remark-math + remark-gfm
    - 自定义渲染：检测 `language-mermaid` 代码块时渲染为 MermaidRenderer
    - 普通代码块添加复制按钮
    - 表格支持横向滚动
    - 使用 TailwindCSS `prose dark:prose-invert` 排版类
    - _Requirements: 3.3_

  - [x] 4.2 创建 MermaidRenderer 组件
    - 创建 `components/content/MermaidRenderer.tsx`
    - 使用 `next/dynamic` 动态导入 Mermaid.js（ssr: false）
    - 实现 SVG 渲染 + 内存缓存（相同代码不重复渲染）
    - 实现缩放（滚轮/双指）和拖拽平移
    - 实现全屏模态框查看
    - 实现导出为 SVG/PNG
    - 根据当前主题自动切换 Mermaid theme（default/dark）
    - _Requirements: 3.4, 5.5, 6.2, 6.6, 7.5_

  - [x] 4.3 创建 CodeBlock 组件
    - 创建 `components/code/CodeBlock.tsx`
    - 多语言 Tab 切换（Python/Java/Go/C++）
    - 一键复制按钮 + "已复制"提示（2秒消失）
    - 代码语法高亮
    - 移动端支持横向滚动
    - _Requirements: 3.5, 6.1_

  - [x] 4.4 创建 LevelTabs 组件
    - 创建 `components/content/LevelTabs.tsx`
    - 展示 L1-L5 五个 Tab，含级别图标、名称、描述 tooltip
    - 未生成的级别 Tab 置灰且不可点击
    - 切换时平滑过渡动画
    - 响应式：移动端只显示级别编号
    - _Requirements: 3.1, 3.2_

  - [x] 4.5 创建 ApproachComparison 组件
    - 创建 `components/code/ApproachComparison.tsx`
    - 渲染解法演进关系图（MermaidRenderer 展示 evolutionMermaid）
    - 渲染多维对比矩阵表格（时间/空间/代码复杂度/适用场景/面试推荐度）
    - 展示底层共同框架描述和迁移路径
    - _Requirements: 3.6_

  - [x] 4.6 创建 TOC 目录导航组件
    - 创建 `components/content/TOC.tsx`
    - 从 Markdown 内容提取标题生成目录
    - 滚动监听高亮当前阅读位置
    - 点击目录项平滑滚动到对应位置
    - 桌面端固定在右侧，移动端隐藏
    - _Requirements: 3.7_

- [x] 5. Checkpoint - 组件独立验证
  - 所有内容渲染组件可独立渲染，`npm run build` 通过。

- [x] 6. 搜索筛选组件
  - [x] 6.1 创建 SearchInput 组件
    - 创建 `components/search/SearchInput.tsx`
    - 搜索输入框 + 搜索图标 + 清除按钮
    - 创建 `hooks/useDebounce.ts`：300ms 防抖 Hook
    - _Requirements: 2.1_

  - [x] 6.2 创建 FilterPanel 组件
    - 创建 `components/search/FilterPanel.tsx`
    - 难度筛选：Easy/Medium/Hard 多选标签
    - 算法标签筛选：下拉多选（动态规划/双指针/图论等）
    - 公司标签筛选：下拉多选
    - 状态筛选：已生成/未生成
    - 支持清空全部筛选
    - _Requirements: 2.2_

  - [x] 6.3 创建 SearchFilter 组合组件
    - 创建 `components/search/SearchFilter.tsx`
    - 组合 SearchInput + FilterPanel + SortSelector
    - 排序选项：热度/难度/最近更新
    - 筛选状态同步到 URL 查询参数
    - URL 参数变化时恢复筛选状态（支持链接分享）
    - _Requirements: 2.3, 2.5_


- [x] 7. 页面实现
  - [x] 7.1 实现首页 Landing Page
    - 创建 `app/page.tsx`（SSG）
    - Hero 区域：产品标题 + 副标题 + CTA 按钮（开始学习）
    - 特色功能区：五级理解、智能图解、模式提炼三大特色卡片
    - 快速入口：热门题目列表（ProblemCard）+ 推荐模式（PatternCard）
    - 响应式布局
    - _Requirements: 1.5, 7.1_

  - [x] 7.2 实现题目列表页
    - 创建 `app/problems/page.tsx`（SSG + 客户端搜索筛选）
    - 顶部：SearchFilter 组件
    - 主体：ProblemCard 网格/列表布局
    - 底部：分页组件（每页20条）
    - 结果计数展示 + 空状态处理
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

  - [x] 7.3 实现题目详情页
    - 创建 `app/problems/[id]/page.tsx`（ISR, revalidate=3600）
    - 顶部：题目标题 + DifficultyBadge + 标签 + 收藏按钮
    - LevelTabs：级别切换
    - 内容区：MarkdownRenderer 渲染解析内容
    - 代码区：CodeBlock 多语言代码展示
    - 对比区：ApproachComparison 解法对比
    - 右侧：TOC 目录导航
    - 实现级别切换时客户端数据获取
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 7.2_

  - [x] 7.4 实现算法模式列表页
    - 创建 `app/patterns/page.tsx`（SSG）
    - PatternCard 卡片网格展示所有算法模式
    - 支持按名称搜索筛选
    - _Requirements: 4.1_

  - [x] 7.5 实现算法模式详情页
    - 创建 `app/patterns/[id]/page.tsx`（ISR, revalidate=3600）
    - 展示：模式描述、识别信号列表、通用模板代码（CodeBlock）
    - 关联题目列表（ProblemCard 列表）
    - 变体说明
    - _Requirements: 4.2_

  - [x] 7.6 实现知识图谱页
    - 创建 `app/graph/page.tsx`（CSR）
    - 使用 KnowledgeGraph 组件渲染交互式图谱
    - 模式筛选下拉框（过滤子图）
    - 节点点击弹出题目摘要 Popover（标题、难度、模式、查看详情链接）
    - _Requirements: 4.3, 4.4, 4.5_

- [x] 8. Checkpoint - 页面端到端验证
  - 所有 6 个页面可正常渲染，路由跳转正确，`npm run build` 通过。

- [x] 9. 用户交互增强
  - [x] 9.1 实现收藏功能
    - 创建 `hooks/useFavorites.ts`：localStorage 管理收藏列表
    - ProblemCard 收藏按钮绑定：点击切换收藏状态
    - 题目详情页收藏按钮
    - 收藏状态在列表页和详情页同步
    - _Requirements: 6.3_

  - [x] 9.2 实现阅读进度追踪
    - 创建 `hooks/useReadingProgress.ts`：localStorage 记录已浏览的 {problemId, level}
    - 题目列表页 ProblemCard 显示已阅读标记（小圆点/勾选图标）
    - 浏览题目详情页时自动记录
    - _Requirements: 6.4_

  - [x] 9.3 实现生成进度展示
    - 在题目详情页：当内容正在生成时展示 ProgressBar
    - 轮询 `/api/problems/{id}/generate/status` 获取生成进度
    - 生成完成后自动刷新内容
    - _Requirements: 6.5_

- [x] 10. 性能优化
  - [x] 10.1 实现动态导入和代码分割
    - MermaidRenderer 使用 `next/dynamic`（ssr: false）
    - KnowledgeGraph 使用 `next/dynamic`（ssr: false）
    - 验证每页 JS Bundle < 200KB（gzipped）
    - 配置 `@next/bundle-analyzer` 监控 Bundle 大小
    - _Requirements: 7.3, 7.4_

  - [x] 10.2 实现 SSG/ISR 渲染策略
    - 首页和列表页：`export const dynamic = 'force-static'`
    - 详情页：`export const revalidate = 3600`
    - 验证首屏 LCP < 1s（本地 Lighthouse 测试）
    - _Requirements: 7.1, 7.2_

  - [x] 10.3 实现资源缓存和优化
    - Mermaid SVG 渲染结果内存缓存
    - 使用 `next/image` 组件优化图片
    - 配置合适的 Cache-Control 头
    - _Requirements: 7.5, 7.6_

- [x] 11. 响应式适配完善
  - [x] 11.1 移动端布局适配
    - 导航：底部 Tab 栏或抽屉菜单
    - 代码块：横向滚动
    - 卡片网格：单列布局
    - LevelTabs：精简为编号展示
    - TOC：隐藏（或折叠在顶部）
    - _Requirements: 5.1, 5.2_

  - [x] 11.2 平板端布局适配
    - 侧边栏：折叠为窄版
    - 卡片网格：两列
    - 题目详情页：内容占全宽，TOC 折叠
    - _Requirements: 5.1_

- [x] 12. Checkpoint - 完整功能验证
  - 确保所有功能在桌面端和移动端（Chrome DevTools 模拟）下正常工作：主题切换、搜索筛选、级别切换、代码复制、图表渲染、收藏和进度追踪。如有问题请向用户提问。

- [ ] 13. 集成测试与质量保证
  - [x] 13.1 编写组件单元测试
    - DifficultyBadge：不同难度渲染正确颜色
    - LevelTabs：点击切换、禁用状态
    - CodeBlock：语言切换、复制功能
    - SearchFilter：防抖、URL 同步
    - 使用 Jest + React Testing Library
    - _Requirements: 全部_

  - [x] 13.2 编写页面集成测试
    - 题目列表页：搜索筛选 + 分页
    - 题目详情页：级别切换 + 内容渲染
    - 主题切换：localStorage 持久化 + 全组件适配
    - 使用 Mock API 数据
    - _Requirements: 全部_

- [x] 14. Final Checkpoint - Web 展示层完整验证
  - 确保全部页面、组件、交互功能、响应式布局、暗色主题、性能指标均达标。如有问题请向用户提问。

- [x] 15. 前端状态管理与数据缓存
  - [x] 15.1 集成 zustand 状态管理
    - 安装 zustand 依赖
    - 创建 `stores/authStore.ts`：用户认证状态（token、userInfo、isLoggedIn）
    - 创建 `stores/preferencesStore.ts`：用户偏好（主题、默认级别、默认语言）
    - 创建 `stores/favoritesStore.ts`：收藏列表（本地 + 远端同步）
    - 创建 `stores/progressStore.ts`：阅读进度（已浏览题目和级别）
    - _Requirements: 9.1, 9.4_

  - [x] 15.2 集成 SWR 数据缓存
    - 安装 swr 依赖
    - 创建 `lib/fetcher.ts`：统一 fetcher（携带 token、错误处理）
    - 改造 API 调用层为 SWR hooks：useProblemList、useProblem、useExplanation、usePatterns
    - 配置 SWR 全局选项：dedupingInterval=5000、revalidateOnFocus=false
    - _Requirements: 9.2, 9.3_

  - [x] 15.3 实现 WebSocket 全局管理 Hook
    - 创建 `hooks/useWebSocket.ts`：WebSocket 连接管理
    - 实现自动重连（指数退避，最大 30s）
    - 实现心跳检测（每 30s ping）
    - 支持多种消息类型订阅和分发
    - 连接建立后发送首条认证消息（`{type:"AUTH", payload: token}`），不通过 URL 参数传递 token
    - _Requirements: 9.5_

- [x] 16. 异步任务状态展示
  - [x] 16.1 实现生成进度轮询组件
    - 创建 `components/common/GenerationStatus.tsx`
    - 在题目详情页：当解析不存在时，展示"尚未生成"+ 触发生成按钮
    - 触发后：展示 ProgressBar + 当前步骤文字 + 预计剩余时间
    - 每 3 秒轮询 GET /api/problems/{id}/generate/status
    - 完成后自动 mutate SWR 缓存刷新内容
    - 失败时展示错误原因 + 重试按钮
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 16.2 实现题目列表生成状态图标
    - 在 ProblemCard 中增加生成状态指示器
    - 未生成：灰色圆点
    - 生成中：蓝色加载动画（旋转）
    - 已生成：绿色勾选图标
    - 生成失败：红色感叹号
    - _Requirements: 10.5_

- [x] 17. 登录认证前端集成
  - [x] 17.1 创建认证页面
    - 创建 `app/auth/login/page.tsx`：邮箱+密码登录表单
    - 创建 `app/auth/register/page.tsx`：邮箱+昵称+密码注册表单
    - 表单校验：邮箱格式、密码长度≥8、确认密码一致
    - 登录/注册成功后跳转首页
    - _Requirements: 11.1_

  - [x] 17.2 实现 token 管理与自动刷新
    - 登录后将 accessToken 存入 zustand authStore（内存）
    - refreshToken 存入 httpOnly cookie（通过后端 Set-Cookie）
    - 创建 `lib/authFetcher.ts`：请求携带 Authorization Bearer token
    - token 剩余 <5min 时自动调用 refresh 续期
    - 收到 401 时清除状态跳转登录页
    - _Requirements: 11.2, 11.3, 11.4_

  - [x] 17.3 更新导航栏认证状态
    - 未登录：显示"登录"/"注册"按钮
    - 已登录：显示用户昵称 + 头像占位 + 下拉菜单（我的收藏、学习记录、退出登录）
    - _Requirements: 11.5_

- [x] 18. Final Checkpoint - 完整前端验证
  - 确保认证流程（注册→登录→自动token刷新→退出）正常，状态管理跨页面同步，生成进度展示流畅。如有问题请向用户提问。

- [x] 19. 交互功能入口页面
  - [x] 19.1 创建交互功能入口组件
    - 在题目详情页底部创建 `components/interactive/InteractiveActions.tsx`
    - 包含三个按钮：费曼模式（"用自己的话讲解"）、面试模拟（"模拟面试"）、苏格拉底追问（"引导式推导"）
    - 未登录时点击弹出登录提示，登录后跳转到对应功能页
    - _Requirements: 12.1, 12.5_

  - [x] 19.2 创建费曼模式页面
    - 创建 `app/feynman/page.tsx`：实时对话界面
    - 左侧：消息列表（用户输入 + AI 回复交替展示）
    - 底部：输入框 + 发送按钮
    - 顶部：关联题目信息 + 结束会话按钮
    - 结束时展示结构化总结
    - 集成 WebSocket Hook（useWebSocket）进行实时通信
    - _Requirements: 12.2_
    - _状态：UI 骨架已创建，WebSocket 对话未集成_

  - [x] 19.3 创建面试模拟页面
    - 创建 `app/interview/page.tsx`：面试模拟界面
    - 顶部：计时器（倒计时）+ 当前阶段提示
    - 主体：对话区域 + 简易代码编辑器（textarea with monospace font）
    - 底部：提交回答按钮 + 结束面试按钮
    - 面试结束后展示评分报告（四维雷达图）
    - _Requirements: 12.3_
    - _状态：UI 骨架已创建，WebSocket 对话和评分未集成_

  - [x] 19.4 创建复习中心页面
    - 创建 `app/review/page.tsx`：复习中心
    - 今日待复习卡片列表（卡片正面/反面翻转动画）
    - 自评按钮（1-5分）
    - 整体学习统计面板（已掌握/学习中/待复习数量）
    - 薄弱模式提示区域
    - _Requirements: 12.4_
    - _状态：UI 骨架已创建，复习卡片数据和翻转交互未集成_

  - [x] 19.5 更新导航栏添加学习入口
    - Navbar 增加"学习"下拉菜单
    - 包含：费曼模式、面试模拟、复习中心三个入口
    - _Requirements: 12.6_

- [x] 20. 用户偏好设置页面
  - [x] 20.1 创建设置页面
    - 创建 `app/settings/page.tsx`
    - 默认级别选择器（L1-L5 单选）
    - 默认代码语言选择器（Python/Java/Go/C++ 单选）
    - 主题偏好选择器（亮色/暗色/跟随系统）
    - 保存按钮（已登录调 API，未登录存 localStorage）
    - _Requirements: 13.1, 13.3_
    - _状态：UI 已完成，已登录时调 API 保存逻辑为 TODO_
    - 创建 `app/settings/page.tsx`
    - 默认级别选择器（L1-L5 单选）
    - 默认代码语言选择器（Python/Java/Go/C++ 单选）
    - 主题偏好选择器（亮色/暗色/跟随系统）
    - 保存按钮（已登录调 API，未登录存 localStorage）
    - _Requirements: 13.1, 13.3_

  - [x] 20.2 集成用户偏好到详情页
    - 题目详情页 LevelTabs 默认选中用户偏好级别（而非固定 L3）
    - CodeBlock 默认展示用户偏好语言 Tab
    - 从 preferencesStore 读取，已登录时从 API 获取
    - _Requirements: 13.2, 13.4_

- [ ] 21. 内容状态完整展示
  - [-] 21.1 实现多状态内容展示
    - 在题目详情页区分四种内容状态：已生成/生成中/未生成/待修正
    - 待修正状态展示"内容审核中"提示 + 降级内容（仅展示代码和基本思路）
    - 已生成状态正常渲染完整内容
    - _Requirements: 14.1, 14.2_

  - [-] 21.2 创建管理员审核页面
    - 创建 `app/admin/review/page.tsx`（仅 ADMIN 角色可访问）
    - 列表展示所有 PENDING_REVIEW 状态的内容
    - 每条含：题目信息 + 校验报告摘要 + 通过/驳回按钮
    - _Requirements: 14.3_

- [x] 22. 基础 SEO 支持
  - [x] 22.1 实现 Meta 标签和 Sitemap
    - 使用 Next.js Metadata API 为题目详情页生成动态 meta title 和 description
    - 为所有页面添加 Open Graph 标签
    - 创建 `app/sitemap.ts`：动态生成 sitemap.xml（含所有已生成内容的题目URL）
    - 确保题目详情页使用语义化 HTML（h1-h6、article、section 等）
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [x] 23. Final Checkpoint - 全功能最终验证
  - 确保交互功能入口可用（登录后可进入费曼/面试/复习页面），用户偏好生效，内容多状态展示正确，SEO 标签渲染正常。如有问题请向用户提问。

- [x] 24. 差异化增强：级别视觉样式差异化
  - [x] 24.1 实现 MarkdownRenderer 级别样式映射
    - 为 MarkdownRenderer 增加 `level` prop（1-5）
    - 创建 `LEVEL_STYLE_CLASSES` 映射：L1=prose-xl 大字+宽间距、L2=prose-lg、L3=prose 默认、L4=prose+公式突出、L5=prose-sm 学术排版
    - 在题目详情页传入当前级别到 MarkdownRenderer
    - 确保切换级别时样式平滑过渡
    - _Requirements: 3.10_

  - [x] 24.2 实现 AlgorithmStoryCard 组件（详情页嵌入）
    - 创建 `components/content/AlgorithmStoryCard.tsx`
    - Props：storyId、algorithmName、shortSummary(100字)、inventorName、year
    - 放置在题目详情页右侧 TOC 下方（如果该题关联模式有考古内容）
    - 琥珀色边框+半透明底色风格，hover 有阴影效果
    - 点击跳转到 `/archaeology/{storyId}`
    - 数据来源：GET /api/v1/problems/{id} 返回的 relatedArchaeology 字段
    - _Requirements: 3.11_

  - [x] 24.3 实现 MathFoundationCard 组件（L4+ 底部嵌入）
    - 创建 `components/content/MathFoundationCard.tsx`
    - Props：mathTopicName、patternName、oneSentence、mathRelationId
    - 仅在 level >= 4 时且该题模式有 MATH_FOUNDATION 关系时展示
    - 蓝色边框+半透明底色风格，放置在解析内容最底部
    - 点击跳转到数学关联详情
    - 数据来源：GET /api/v1/problems/{id} 返回的 mathFoundation 字段
    - _Requirements: 3.12_

- [x] 25. Checkpoint - 差异化增强验证
  - 确保级别切换时视觉样式有明显差异（L1 大字故事 vs L5 紧凑学术），算法故事卡片和数学基础卡片在有数据时正确展示，无数据时不展示。如有问题请向用户提问。

- [x] 26. 全局搜索面板
  - [x] 26.1 实现 ⌘K 全局搜索组件
    - 创建 `components/search/GlobalSearch.tsx`：搜索模态框
    - 实现 ⌘K / Ctrl+K 键盘快捷键监听，呼出面板
    - 搜索输入框自动聚焦，ESC 或点击遮罩关闭
    - 展示快速跳转列表（题目列表/模式/费曼/复习中心/设置）
    - 展示最近搜索历史（localStorage 存储，最多 5 条）
    - 实时模糊搜索题目标题/模式名/标签名，结果列表带键盘↑↓选择
    - 回车跳转第一条结果
    - _Requirements: 36.1-36.6_

- [x] 27. 通知系统前端
  - [x] 27.1 实现通知组件
    - 创建 `components/layout/NotificationBell.tsx`：铃铛图标+未读徽章
    - 创建 `components/layout/NotificationPanel.tsx`：点击展开的通知列表
    - 通知类型区分：生成完成（绿）/复习提醒（蓝）/评论回复（紫）/系统公告（灰）
    - 已读/未读状态区分（未读有蓝色左边框）
    - "全部标记已读"按钮
    - 通知数据通过 GET /api/v1/notifications 获取
    - _Requirements: 37.1-37.5_

- [x] 28. 用户题解与评论系统
  - [x] 28.1 实现题目详情页三区 Tab
    - 在题目详情页增加 Tab 切换：官方解析 / 用户题解 / 评论
    - 创建 `components/solutions/SolutionList.tsx`：题解列表（精选/最新/最热排序）
    - 创建 `components/solutions/SolutionCard.tsx`：题解卡片（来源标记/点赞/评论数）
    - 创建 `components/solutions/SolutionEditor.tsx`：Markdown 题解编辑器（含预览）
    - _Requirements: 31.1-31.7_
    - _状态：SolutionList/CommentList 组件已创建，但未集成到详情页 Tab 中，SolutionCard/SolutionEditor 未创建_

  - [x] 28.2 实现评论组件
    - 创建 `components/comments/CommentInput.tsx`：评论输入框+类型选择（普通/纠错/补充/提问）
    - 创建 `components/comments/CommentList.tsx`：评论列表（分类颜色边框）
    - 创建 `components/comments/CommentItem.tsx`：单条评论（支持嵌套回复）
    - 纠错评论红色高亮 + 自动通知
    - 补充评论"展开为题解"快捷按钮
    - _Requirements: 32.1-32.6_
    - _状态：CommentList 基础版已创建，CommentInput/CommentItem 未创建，类型颜色区分未实现_

- [x] 29. 数据管理后台页面
  - [x] 29.1 实现题目 CRUD 管理页
    - 创建 `app/admin/problems/page.tsx`
    - 题目列表表格（搜索/平台筛选/状态筛选）
    - 手动创建/编辑表单弹窗
    - 批量导入弹窗（JSON 粘贴/文件上传，skip/update 模式选择）
    - _Requirements: 33.6_
    - _状态：列表表格+搜索已创建，编辑/创建/导入弹窗为 alert TODO_

  - [x] 29.2 实现采集管理页
    - 创建 `app/admin/crawler/page.tsx`
    - 平台状态总览卡片（🟢🔴⚠️）
    - 触发采集表单（平台/类型/题号选择）
    - 采集任务列表（运行中进度条/已完成/失败+重试）
    - _Requirements: 33.1-33.3_
    - _状态：触发采集表单已创建，任务列表为 placeholder TODO_

  - [x] 29.3 实现映射管理页
    - 创建 `app/admin/mapping/page.tsx`
    - 映射统计（已确认/待确认/平台数）
    - 待确认列表 + 确认/驳回操作
    - 手动创建映射
    - _Requirements: 33.4-33.5_

- [x] 30. 费曼转题解功能
  - [x] 30.1 实现费曼总结→题解转化
    - 在费曼会话结束总结面板增加"📤 发布为题解"按钮
    - 创建 `components/feynman/PublishAsSolution.tsx`：草稿编辑弹窗
    - 自动提取对话精华生成草稿
    - 发布后标记"🧠 费曼产出"来源
    - _Requirements: 34.1-34.5_

- [x] 31. 跨域映射表组件
  - [x] 31.1 实现 CrossDomainTable 组件
    - 创建 `components/patterns/CrossDomainTable.tsx`
    - 四列映射表格（LeetCode/工作/AI-ML/日常）
    - 点击行展开详情面板（含代码对比）
    - 移动端横向滚动支持
    - 嵌入到模式详情页底部
    - _Requirements: 35.1-35.4_

- [x] 32. 设置页增强
  - [x] 32.1 实现设置页通知/数据/危险区域
    - 通知设置细化（生成/复习/公告/飘屏 独立开关）
    - 数据导出按钮（调用导出 API 下载 JSON）
    - 学习水平自测入口
    - 危险区域：删除账户（二次确认弹窗）
    - _Requirements: 38.1-38.5_

## Notes

- 本 spec 的前端实现依赖 Spec 1 & 2 提供的后端 API，开发阶段使用 Mock 数据
- TailwindCSS 优先：不创建自定义 CSS 文件，样式完全用工具类实现
- 组件全部使用 TypeScript 严格模式，Props 接口必须完整定义
- 客户端状态（收藏、进度、主题）暂存 localStorage，后续 Spec 迁移到后端持久化
- 代码注释使用中文，标识符保持英文
- 每个组件支持 `className` prop 扩展

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["3.1", "3.4", "3.5"] },
    { "id": 4, "tasks": ["3.2", "3.3", "4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "4.4"] },
    { "id": 6, "tasks": ["4.5", "4.6", "6.1"] },
    { "id": 7, "tasks": ["6.2", "6.3"] },
    { "id": 8, "tasks": ["7.1", "7.4"] },
    { "id": 9, "tasks": ["7.2", "7.5", "7.6"] },
    { "id": 10, "tasks": ["7.3"] },
    { "id": 11, "tasks": ["9.1", "9.2", "9.3"] },
    { "id": 12, "tasks": ["10.1", "10.2", "10.3"] },
    { "id": 13, "tasks": ["11.1", "11.2"] },
    { "id": 14, "tasks": ["13.1", "13.2"] },
    { "id": 15, "tasks": ["15.1", "15.2"] },
    { "id": 16, "tasks": ["15.3", "16.1", "16.2"] },
    { "id": 17, "tasks": ["17.1"] },
    { "id": 18, "tasks": ["17.2", "17.3"] },
    { "id": 19, "tasks": ["19.1", "19.5"] },
    { "id": 20, "tasks": ["19.2", "19.3", "19.4"] },
    { "id": 21, "tasks": ["20.1", "20.2"] },
    { "id": 22, "tasks": ["21.1", "21.2", "22.1"] },
    { "id": 23, "tasks": ["24.1", "24.2", "24.3"] },
    { "id": 24, "tasks": ["26.1", "27.1"] },
    { "id": 25, "tasks": ["28.1", "28.2", "31.1"] },
    { "id": 26, "tasks": ["29.1", "29.2", "29.3"] },
    { "id": 27, "tasks": ["30.1", "32.1"] }
  ]
}
```
