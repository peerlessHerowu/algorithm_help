# Requirements Document

## Introduction

本规格定义"算法深度理解引擎"项目的知识图谱与高级功能层需求。该层建立在前四个 Spec（基础设施层、内容生成引擎、Web 展示层、交互功能层）之上，实现知识关联网络和高级学习功能，将产品从"单题学习"升级为"体系化知识网络"。核心模块包括：算法模式知识图谱（D3.js 可视化）、实际应用映射、数学基础关联、AI 前沿/论文桥梁、算法考古、学习路径推荐引擎、多平台题目统一 ID 映射、离线导出系统。技术栈为 Java Spring Boot 3 后端 + Next.js 14 前端 + D3.js 图谱可视化 + MySQL 数据库。

## Glossary

- **知识图谱**: 以算法模式和题目为节点、以关联关系为边构建的有向加权图，可视化展示知识体系结构
- **模式卡片**: 封装单个算法模式的结构化信息单元，含模板代码、适用信号、常见变体、关联题目
- **推荐引擎**: 基于用户学习历史和知识图谱拓扑关系，计算并推荐下一步学习内容的服务
- **学习路径**: 从入门到精通的有序节点序列，每个节点为模式/题目/数学知识/论文
- **多平台映射**: 将 LeetCode、牛客、HackerRank 等平台同一题目映射到统一内部 ID 的机制
- **应用映射**: 算法→工业应用、AI/ML 前沿、工作/人生哲学的多维映射关系
- **数学关联层**: 算法与其背后数学基础（递推关系、线性代数、概率论等）的关联体系
- **论文桥梁**: 从基础算法经变体推演到前沿论文的渐进式学习路径
- **算法考古**: 算法的发明故事、历史背景和设计动机
- **离线导出**: 将学习内容导出为 PDF/Markdown/Notion/Anki 卡片格式的功能

## Requirements

### Requirement 1: 算法模式知识图谱

**User Story:** As a 算法学习者, I want 可视化的算法模式知识图谱, so that 我能清晰看到题目间的关联关系并发现学习路径。

#### Acceptance Criteria

1. THE 系统 SHALL 以有向加权图结构存储算法模式和题目的关联关系，节点类型包括：模式节点（pattern）、题目节点（problem）、数学知识节点（math）、论文节点（paper）
2. THE 模式卡片 SHALL 包含以下结构化信息：模式名称、所属大类、模板代码（多语言）、适用信号列表、常见变体列表、关联题目 ID 列表、前置模式 ID 列表、进阶模式 ID 列表
3. THE 图谱可视化 SHALL 使用 D3.js force-directed layout 渲染，支持节点拖拽、缩放平移、节点点击展开详情、边 hover 显示关系描述
4. WHEN 用户点击图谱中某个题目节点时, THE 系统 SHALL 高亮显示该题的前置题、同模式题、进阶题，并在侧边栏展示题目摘要
5. THE 边关系类型 SHALL 包括：prerequisite（前置）、variant（变体）、similar_pattern（同模式）、follow_up（进阶）、harder_version（困难版本），每条边附带权重值（0-1，表示关联强度）
6. THE 系统 SHALL 提供"做了这题还应做"推荐列表，基于图谱拓扑关系（同模式 + 进阶 + 变体）计算，返回 Top 5 推荐题目及推荐理由

### Requirement 2: 模式识别训练与演进路径

**User Story:** As a 面试准备者, I want 通过模式识别训练来提升快速归类能力, so that 面试时能迅速判断该用什么算法。

#### Acceptance Criteria

1. THE 系统 SHALL 提供模式识别训练模式：给出题目描述（隐藏标签），用户判断应用哪个算法模式，系统给出正确答案和解释
2. THE 系统 SHALL 记录用户的模式识别正确率，按模式分类统计，识别薄弱模式
3. THE 模式演进路径 SHALL 定义从基础模式到高级变体的有序学习序列（如：基础二分→左边界二分→旋转数组二分→二分答案）
4. WHEN 用户完成某个基础模式的训练（正确率>80%）时, THE 系统 SHALL 自动推荐对应的进阶变体

### Requirement 3: 实际应用映射

**User Story:** As a 算法工程师, I want 看到算法在真实工程和 AI 前沿中的应用, so that 我理解学这些不只是为了面试。

#### Acceptance Criteria

1. THE 系统 SHALL 为每个算法模式维护四维应用映射：工业应用、AI/ML 前沿应用、工作映射（项目管理类比）、人生映射（哲学层类比）
2. EACH 应用映射 SHALL 附带一个"迷你案例"：简化版实际应用代码（可运行片段，50行以内），附带注释说明与原算法的对应关系
3. THE 迷你案例 SHALL 支持 Python 和 Java 双语言展示，代码可直接复制运行
4. THE 系统 SHALL 支持按领域筛选应用映射（工业/AI/工作/人生），支持按算法模式筛选
5. THE Backend SHALL 提供 GET /api/v1/patterns/{id}/applications 端点，返回该模式的四维应用映射列表（按 domain 分组）
6. THE Backend SHALL 提供 GET /api/v1/patterns/{id}/applications/{domain} 端点，返回某维度的详细案例列表（含迷你案例代码）
7. THE Backend SHALL 提供 GET /api/v1/patterns/{id}/cross-domain-table 端点，返回跨域迁移映射表（四列简短描述+可展开详情）
8. THE Backend SHALL 定义 ApplicationMapping 实体（patternId、domain枚举、title、subtitle、description、miniCaseCode、miniCaseLanguage、icon）和 CrossDomainMapping 实体（patternId、leetcodeScene、workScene、aiScene、lifeScene、detailJson）


### Requirement 4: 数学基础关联层

**User Story:** As a 深度理解追求者, I want 看到算法背后的数学原理并关联权威参考, so that 我能从根基上理解算法的正确性和边界。

#### Acceptance Criteria

1. THE 系统 SHALL 维护算法-数学关联表，将每个算法模式关联到对应数学知识（DP↔递推关系与组合数学、图论↔线性代数与概率论、排序下界↔信息论、分治↔主定理等）
2. THE 数学知识解释 SHALL 同样支持 L1-L5 分级：L1 纯直觉类比、L2 具体例子、L3 公式推导、L4 完整证明、L5 论文级严格推导
3. THE 系统 SHALL 为每个数学知识节点提供权威引用：教材精确到章节页码（如"CLRS 第15章 §15.3, p.379"）、论文（作者+年份+标题）、课程（如"MIT 6.006 Lecture 15"）
4. THE 可视化方式 SHALL 根据数学类型自动匹配：递推→递归树动画、状态转移→DP 表格填充图、概率→蒙特卡洛模拟图、自动机→状态机图

### Requirement 5: AI 前沿/论文桥梁

**User Story:** As a 想进入 AI 领域的学习者, I want 从 LeetCode 基础算法平滑过渡到前沿论文, so that 我能理解基础算法如何演变为前沿技术。

#### Acceptance Criteria

1. THE 系统 SHALL 定义"从 LeetCode 到 Paper"的桥梁路径：基础算法→变体→论文核心思想→实际应用→动手实验，每步之间有清晰的知识衔接说明
2. THE 论文解读 SHALL 分三级：L3 通俗版（核心思想+与基础算法联系，1000字以内）、L4 详解版（方法详解+代码实现+实验复现）、L5 精读版（原文逐段精读+数学推导+局限性+开放问题）
3. THE 系统 SHALL 覆盖至少 6 个前沿领域的算法桥梁：计算机视觉、NLP、机器人学、推荐系统、生物信息、量子计算
4. EACH 桥梁路径 SHALL 包含"动手实验"环节：提供简化版代码框架（Jupyter Notebook 或可运行脚本），用户可实际运行验证

### Requirement 6: 算法考古（发明故事）

**User Story:** As a 算法初学者, I want 了解算法的发明故事和历史背景, so that 我更容易记住算法的设计动机和核心思想。

#### Acceptance Criteria

1. THE 系统 SHALL 为经典算法维护发明故事内容：发明者背景、发明动机（"为什么要发明"）、发明过程、历史趣闻、对后世影响
2. THE 故事内容 SHALL 以叙事体呈现（非技术文档风格），控制在 500-1500 字，配有时间线图
3. THE 系统 SHALL 将故事与对应算法解析关联，用户在学习算法时可一键展开"算法故事"面板
4. THE 系统 SHALL 至少覆盖 20 个经典算法的发明故事（Dijkstra、Huffman、RSA、PageRank、FFT、Quicksort 等）

### Requirement 7: 学习路径推荐引擎

**User Story:** As a 学习者, I want 系统根据我的当前水平推荐下一步学习内容, so that 我不会迷失方向或重复低效学习。

#### Acceptance Criteria

1. THE 推荐引擎 SHALL 基于以下信号计算推荐：用户已完成题目列表、模式识别正确率、各模式掌握程度、知识图谱拓扑顺序
2. THE 系统 SHALL 提供学习路径可视化：进度条展示总体完成度、里程碑节点展示关键突破点、当前位置标注
3. THE 系统 SHALL 识别用户薄弱点（正确率<60%的模式），生成定向训练计划（5-10题专项练习）
4. WHEN 用户完成一个里程碑时, THE 系统 SHALL 展示成就总结和下一阶段预览


### Requirement 8: 多平台题目统一 ID 映射

**User Story:** As a 在多个平台刷题的用户, I want 统一管理各平台的做题记录, so that 我不用在多个平台间切换查找。

#### Acceptance Criteria

1. THE 系统 SHALL 维护多平台映射表：LeetCode 编号 ↔ 牛客编号 ↔ HackerRank slug ↔ Codeforces 编号 ↔ 洛谷编号 ↔ 内部统一 ID
2. THE 系统 SHALL 支持用户导入各平台做题历史：通过 CSV 上传或 API 授权获取（MVP 阶段支持 CSV 导入）
3. WHEN 用户查看某题时, THE 系统 SHALL 显示该题在所有已映射平台上的链接和编号
4. THE 映射表 SHALL 支持模糊匹配和手动关联：当自动匹配不确定时，标记为"待确认"状态供用户人工确认

### Requirement 9: 离线导出系统

**User Story:** As a 学习者, I want 将学习内容导出为多种格式, so that 我能离线复习或使用间隔重复工具加深记忆。

#### Acceptance Criteria

1. THE 系统 SHALL 支持四种导出格式：PDF（排版精美的个人算法笔记）、Markdown（纯文本，兼容任何编辑器）、Notion 格式（可直接导入 Notion）、Anki 卡片格式（.apkg，支持间隔重复）
2. THE 用户 SHALL 可选择导出范围：单题导出、按模式导出（某模式所有题）、按学习路径导出、全量导出
3. THE PDF 导出 SHALL 包含目录、代码语法高亮、Mermaid 图表渲染为图片、页眉页脚（标题+页码）
4. THE Anki 导出 SHALL 生成正反面卡片：正面为题目描述/模式信号，反面为核心思路/模板代码/关键步骤
5. THE 系统 SHALL 支持增量导出：仅导出上次导出后新增或更新的内容

### Requirement 10: 图谱数据完整性与性能

**User Story:** As a 系统维护者, I want 知识图谱数据保持一致性且查询高效, so that 用户体验流畅且数据可信。

#### Acceptance Criteria

1. THE 图谱 SHALL 保证引用完整性：边引用的节点必须存在，删除节点时级联删除或阻止删除关联边
2. THE 图谱查询 SHALL 在 1000 个节点、5000 条边规模下，任意两点间路径查询响应时间 < 500ms
3. THE 系统 SHALL 提供图谱数据导入/导出 API（JSON 格式），支持批量初始化和数据迁移
4. THE 推荐引擎计算 SHALL 支持异步预计算：用户活跃时段定时刷新推荐结果缓存，实时请求直接返回缓存


### Requirement 11: 图谱存储演进策略

**User Story:** As a 系统架构师, I want 图谱存储有清晰的演进路径, so that 数据增长后可以平滑迁移而不影响业务。

#### Acceptance Criteria

1. THE 初始实现 SHALL 使用 MySQL 递归 CTE 查询实现图遍历（适用于 < 5000 节点规模）
2. THE 系统 SHALL 抽象图谱查询接口（`GraphQueryService`），隔离底层存储实现
3. WHEN 节点数量超过 5000 时, THE 系统 SHALL 支持通过配置切换到 Neo4j 实现（接口不变，替换底层实现）
4. THE 图谱推荐结果 SHALL 使用 Redis 缓存（TTL 6 小时），避免频繁递归查询
5. THE 系统 SHALL 提供管理员 API `POST /api/v1/admin/graph/recompute` 手动触发推荐结果重新计算

### Requirement 12: 多语言（i18n）预留

**User Story:** As a 产品, I want 内容模型支持多语言扩展, so that 后续国际化不需要大幅修改数据结构。

#### Acceptance Criteria

1. THE Explanation 实体 SHALL 包含 `locale` 字段（String，默认 "zh-CN"），标识内容语言
2. THE 模式卡片、数学知识节点、论文解读 SHALL 同样包含 `locale` 字段
3. THE API 查询 SHALL 支持 `locale` 查询参数（默认 zh-CN），按语言筛选内容
4. THE 复合唯一索引 SHALL 调整为 (problemId, level, version, locale)，支持同一题目同一级别的多语言版本
5. THE 系统 SHALL 在 MVP 阶段仅生成 zh-CN 内容，但数据模型和 API 已为 en-US 等语言做好预留

### Requirement 13: 跨域迁移映射表

**User Story:** As a 深度理解追求者, I want 看到同一算法思想在不同领域的应用映射, so that 我能真正理解算法的普适性而非只会刷题。

#### Acceptance Criteria

1. THE 系统 SHALL 为每个核心算法模式维护跨域映射表，包含四列：LeetCode 场景、工作中场景、AI/ML 场景、日常生活类比
2. THE 跨域映射表 SHALL 以表格形式展示在模式详情页底部，每列含简短描述（1-2句）
3. THE 系统 SHALL 至少覆盖 15 个核心模式的跨域映射（贪心/分治/DP/BFS/DFS/二分/滑动窗口/双指针/回溯/堆/Trie/并查集/单调栈/拓扑排序/位运算）
4. EACH 映射项 SHALL 可展开查看更详细的说明（2-3段文字+代码片段）

### Requirement 14: 学习日历热力图

**User Story:** As a 学习者, I want 像 GitHub 贡献图一样可视化我的学习频率, so that 我有持续学习的外在驱动力。

#### Acceptance Criteria

1. THE 个人中心页面 SHALL 展示近 90 天的学习日历热力图（类似 GitHub Contribution Graph），颜色深度表示当日学习量
2. THE 热力图 SHALL 支持 hover 查看每天具体的学习数据（学了几题、学了多长时间）
3. THE Backend SHALL 提供 GET /api/v1/users/me/activity-heatmap?days=90 端点，返回每日学习量数据（数组格式：[{date, problemsStudied, reviewsCompleted, timeSpentMs, interactionsCount}]）
4. THE 系统 SHALL 将热力图数据纳入成就计算（如"连续学习30天"基于此数据判断）
5. THE Backend SHALL 定义 DailyActivity 实体（userId, date, problemsStudied, reviewsCompleted, timeSpentMs, interactionsCount），使用定时任务每日凌晨聚合前一天数据
6. THE Backend SHALL 提供 GET /api/v1/users/me/streak 端点，返回当前连续学习天数和历史最长连续天数
7. THE 热力图颜色映射规则 SHALL 为：0题=灰色、1-2题=浅色、3-5题=中色、6+题=深色，前端根据 problemsStudied+reviewsCompleted 计算


### Requirement 15: 算法考古内容增强

**User Story:** As a 学习者, I want 在题目详情页直接看到相关算法的精简版发明故事, so that 我不需要离开当前页面就能获得历史背景。

#### Acceptance Criteria

1. THE AlgorithmArchaeology 实体 SHALL 新增 `shortSummary`(String, 100字以内) 字段，存储精简版故事摘要
2. THE Frontend 题目详情页 SHALL 在右侧 TOC 下方展示"📖 算法故事"卡片（仅当该题关联模式有考古内容时展示）
3. THE 故事卡片 SHALL 展示 shortSummary 文字 + "阅读完整故事→"链接（跳转到 /archaeology/{id}）
4. THE Backend GET /api/v1/archaeology/{id} 响应 SHALL 包含 shortSummary 字段

### Requirement 16: 论文桥梁 MVP 策略

**User Story:** As a 产品, I want 论文桥梁功能以最小成本上线, so that 用户能体验到差异化价值而不被未完成内容劝退。

#### Acceptance Criteria

1. THE 论文桥梁 MVP 阶段 SHALL 仅提供 L3（通俗版）解读，L4/L5 Tab 展示"即将支持"占位文字
2. THE "动手实验"链接 SHALL 以 Google Colab 链接形式提供，格式为 `https://colab.research.google.com/github/{repo}/blob/main/experiments/{bridge-id}.ipynb`
3. THE 论文桥梁种子数据 SHALL 至少覆盖 3 个领域各 1 条完整路径（推荐：CV/NLP/推荐系统），其余领域标为"即将推出"
4. THE 前端论文桥梁列表页 SHALL 对"即将推出"的领域展示灰色卡片 + 🔒 标识

### Requirement 17: 跨域映射人生维度可选展示

**User Story:** As a 内容管理者, I want 跨域映射的"人生"维度仅在有高质量内容时展示, so that 不会因为牵强的类比降低产品调性。

#### Acceptance Criteria

1. THE CrossDomainMapping 实体 SHALL 允许 `lifeScene` 字段为 null（可空）
2. THE Frontend 跨域映射表 SHALL 在 `lifeScene` 为空时隐藏该列（三列模式：LeetCode/工作/AI），有值时展示四列
3. THE 种子数据 SHALL 仅对 5 个确实有好类比的核心模式（DP/回溯/贪心/BFS/分治）填充"人生映射"内容，其余模式留空
4. THE GET /api/v1/patterns/{id}/cross-domain-table API 返回中 SHALL 对空字段返回 null 而非空字符串

### Requirement 18: 迷你案例可运行保障

**User Story:** As a 学习者, I want 复制迷你案例代码到本地能直接跑通, so that 理论和实践无缝衔接。

#### Acceptance Criteria

1. EACH 迷你案例代码 SHALL 附带 `runtimeRequirements`(String) 字段，说明运行环境要求（如"Python 3.8+，无额外依赖"或"Java 17+，需 import java.util.*"）
2. THE 迷你案例 SHALL 在种子数据创作阶段经过实际运行验证（本地执行通过后方可提交）
3. THE Frontend 迷你案例代码区域 SHALL 在代码块上方展示运行环境要求的灰色提示文字
4. THE 迷你案例代码长度 SHALL 控制在 50 行以内（含注释），超出则拆分为"核心代码"+"完整版链接"
