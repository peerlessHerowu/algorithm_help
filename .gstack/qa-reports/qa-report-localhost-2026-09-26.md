# 全面体验与质量审查（2026-09-26）

## 范围与运行条件

- 按 `qa` Skill 先读全局 Steering、启动说明、Compose 拓扑、路由、现有测试。仓库内没有 `experience.config.json` 或项目级 Steering；不能声称满足其中未定义的门禁。
- 前端 Next.js 14，`pnpm exec next dev --hostname 127.0.0.1 --port 3100`；后端 Spring Boot 8080，依赖 MySQL、Redis、AI 服务与爬虫。浏览器实测地址 `http://127.0.0.1:3100`。
- 后端 `mvn spring-boot:run` 因 MySQL `Access denied for user 'root'@'localhost'` 未启动。浏览器中 API 代理出现 `ECONNREFUSED`。这阻断真实题目、账户、AI、评分、后台和爬虫的完整任务流，不能用接口状态或静态页面替代验证。

## 路由与任务流证据

| 范围 | 实际观察 | 结论 |
| --- | --- | --- |
| 首页、`/problems`、`/patterns`、`/graph`、`/training`、`/feynman`、`/interview`、`/review` | 浏览器逐个进入，检查导航、空态和错误态；首页搜索“双指针”进入 `/problems?keyword=...` 且输入保留关键词 | 路由与无后端导航可用；数据内容无法验收 |
| `/socratic`、`/learning-path`、`/settings`、`/settings/import`、`/archaeology`、`/papers`、`/achievements` | 浏览器逐个进入；设置本地保存和刷新恢复；费曼/苏格拉底游客登录门禁 | 静态入口可达；远程内容和会话不可验收 |
| `/training/debug`、`/training/reverse-feynman`、`/auth/login`、`/auth/register` | 浏览器进入；登录/注册空表单验证；训练启动失败状态 | 表单前端验证可用，训练服务依赖受阻 |
| 六个 `/admin/*` 页面 | 浏览器进入审核、批量、爬虫、映射、题目、审计路由 | 未登录时的门禁可见；管理员操作未验收 |
| `/problems/[id]`、`/patterns/[id]`、`/learning-path/[id]`、`/archaeology/[id]` | 用无效 ID 进入深入口，检查错误/空态 | 无效 ID 路径已覆盖；真实 ID 因数据服务缺失未覆盖 |
| `/missing-route` | 浏览器显示 404 | 未知路由处理正常 |
| 手机宽度 390px，首页、题目、模式、图谱、训练、面试、设置、登录 | 浏览器 viewport 覆盖后检查 AX 和 `documentElement.scrollWidth/clientWidth`，均无横向溢出；面试配置截图人工检查 | 主要路径未见横向溢出；其余页面和更窄宽度未逐页视觉验收 |

浏览器还复核了修复后 `/interview` 的游客提示和到 `/auth/login` 的实际跳转。键盘跳过导航入口、登录表单标签、移动端菜单与底部导航在 AX 树可见。没有自动化对比截图或全站 WCAG 扫描；色彩对比、读屏顺序、焦点陷阱仍需专门审查。

## 已修问题与回归

1. 费曼/苏格拉底会话启动失败仍推进到假会话；现保留错误和重试状态，并要求登录后建立 JWT WebSocket。`SessionUnavailable` 与 `LearningAuth` 定向回归通过。
2. enriched API 形状与空数据来源判断不一致，交互 API named store 调用失效，解释错误分支布尔条件错误，评论投票模型不一致；均已改并有定向回归或类型检查。
3. 首页固定搜索建议制造并不存在的题目；现进入真实题库查询，并保留 URL 关键词。浏览器验证搜索跳转与无后端错误反馈。
4. WebSocket 连接状态先前只存 ref，UI 不更新；现由 React state 发布。移除了后端没有处理器的冗余 `AUTH` 消息，握手仍用 JWT 参数。
5. 面试曾在 REST 失败时伪造会话、固定开场白及 72 分报告，且 WebSocket 永不连接。现连接、创建会话、后端校验归属并处理 `START_INTERVIEW`；仅服务端开场白推进阶段，结束只显示服务端评分。无后端时保持配置并显示失败；定向回归通过。真实多轮和评分仍待环境恢复后验证。
6. 训练启动的 `Failed to fetch` 改为可理解的暂不可用提示。面试配置按钮增加选中状态；手机无横向溢出，登录链接浏览器实测可达。

## 产品判断与重构边界

- **保留**：题目浏览、模式、知识图谱、训练与复习形成清晰主线；搜索应始终落到真实题库。
- **合并/简化**：设置页“5 题自测并自动推荐水平”实际跳到训练中心 10 题模式测验，既不测水平也不推荐。应移除该承诺或合并为真正的统一测评入口；目前不应作为已实现功能宣传。
- **延后**：公司风格面试、论文桥梁、算法考古和成就依赖内容/AI/数据质量，后端恢复后先验收核心题目与训练，再决定是否扩大这些入口。
- **重构边界**：交互式页面的会话状态分散在 React phase、REST `InteractiveSession`、Redis、WebSocket handler；应抽出共享的会话生命周期契约，明确创建、连接、启动、结束、失败、重连及报告归属。费曼、苏格拉底和面试的错误/登录门禁可复用，但不宜在缺少服务端契约验证时只抽 UI 组件。
- **重复逻辑**：面试的本地倒计时与服务端定时器同时控制结束。本轮已让 REST 结束取消计时器并拒绝重复启动，但结束评分仍需服务端幂等保护与端到端并发验证。

## 验证结果与阻塞

- `pnpm exec tsc --noEmit` 通过；`pnpm build` 通过（30 个静态/动态路由）。`mvn -q -DskipTests test-compile` 通过。`git diff --check` 通过。
- 前端完整 Jest：28 suites 中 25 通过、3 失败；197 tests 中 193 通过、4 失败。失败是既有 `MainTabBar` 旧文案/emoji 断言、`HomeClient` 空态断言、`ProblemDetailClient` 测试环境无法解析 ESM `react-markdown`。定向回归 4 suites、6 tests 全通过，仍有旧测试的 React `act(...)` 警告。
- 后端完整测试初始运行 172 个测试、110 个错误，主要为 Mockito 初始化和沙箱/数据库连接；本轮后端改动只完成编译，没有可靠的集成测试结果。
- 生产构建与开发服务共用 `.next` 导致开发态 chunk 缺失；重启开发服务后浏览器确认恢复。这是验证流程冲突，不计产品缺陷。
- 未覆盖：有数据的真实深入口、注册登录成功与管理员权限、AI 回复内容、面试完整多轮及真实报告、训练提交与复习状态、远程爬虫/论文、跨浏览器、完整键盘/读屏/对比度矩阵。恢复 MySQL/Redis/AI 后应以固定测试账户与种子题目重跑这些流，并验证服务端评分幂等和会话归属。
