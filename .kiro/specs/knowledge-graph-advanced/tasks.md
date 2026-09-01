# Implementation Plan: 知识图谱与高级功能

## Overview

本计划实现知识图谱数据模型、D3.js 可视化、推荐引擎、模式训练、多平台映射、离线导出等高级功能。按照"数据模型→图谱服务→推荐引擎→训练系统→映射系统→导出系统→前端可视化→内容填充"的顺序递进实现。

## Tasks

- [x] 1. 图谱数据模型与基础设施
  - [x] 1.1 创建图谱节点和边的 JPA 实体
    - 创建 `GraphNode` 实体：id(String PK)、type(NodeType 枚举)、name、category、description、metadata(JSON)、difficulty(Integer)、createdAt(Long)、updatedAt(Long)
    - 创建 `GraphEdge` 实体：id(UUID)、sourceId、targetId、relationType(RelationType 枚举)、weight(Double)、description、metadata(JSON)、createdAt(Long)
    - 添加索引：idx_edge_source(sourceId)、idx_edge_target(targetId)、idx_edge_type(relationType)
    - 创建 `NodeType` 枚举（PATTERN, PROBLEM, MATH, PAPER, APPLICATION）
    - 创建 `RelationType` 枚举（PREREQUISITE, VARIANT, SIMILAR_PATTERN, FOLLOW_UP, HARDER_VERSION, MATH_FOUNDATION, PAPER_REFERENCE, APPLICATION_OF）
    - _Requirements: 1.1, 1.5, 10.1_

  - [x] 1.2 创建学习路径和用户进度实体
    - 创建 `LearningPath` 实体：id(String PK)、name、description、category、estimatedHours、totalNodes、nodes(JSON List<PathNode>)、createdAt、updatedAt
    - 创建 `PathNode` 嵌入对象：nodeId、nodeType、order、optional、unlockCondition、milestone
    - 创建 `UserProgress` 实体：id(UUID)、userId、problemId、patternId、status(CompletionStatus 枚举)、attempts、correctCount、lastPracticeAt、completedAt
    - 创建 `CompletionStatus` 枚举（NOT_STARTED, IN_PROGRESS, COMPLETED, MASTERED）
    - 创建对应 Repository 接口
    - _Requirements: 7.1, 7.2_

  - [x] 1.3 创建多平台映射实体
    - 创建 `PlatformMapping` 实体：id(UUID)、unifiedProblemId、platform(Platform 枚举)、platformId、platformUrl、platformTitle、status(MappingStatus 枚举)、createdAt、updatedAt
    - 添加唯一约束 (platform, platformId)
    - 创建 `Platform` 枚举（LEETCODE, NOWCODER, HACKERRANK, CODEFORCES, LUOGU, ATCODER）
    - 创建 `MappingStatus` 枚举（CONFIRMED, PENDING, REJECTED）
    - 创建 `PlatformMappingRepository` 接口
    - _Requirements: 8.1, 8.4_

  - [x] 1.4 创建算法考古和论文桥梁实体
    - 创建 `AlgorithmArchaeology` 实体：id、algorithmName、inventorName、inventionYear、inventionPlace、story(text)、motivation(text)、impact(text)、timeline(JSON)、relatedPatternId、createdAt
    - 创建 `TimelineEvent` 嵌入对象：year、event、significance
    - 创建 `PaperBridge` 实体：id、baseAlgorithm、paperTitle、paperAuthors、paperYear、paperUrl、domain(FrontierDomain 枚举)、bridgePath(JSON)、leveledInterpretation(JSON)、experimentUrl、createdAt
    - 创建 `FrontierDomain` 枚举（CV, NLP, ROBOTICS, RECOMMENDATION, BIOINFORMATICS, QUANTUM）
    - 创建 `BridgeStep` 嵌入对象：order、title、description、connectionToNext
    - 创建对应 Repository 接口
    - _Requirements: 5.1, 5.3, 6.1_

- [x] 2. Checkpoint - 数据模型验证
  - 确保所有实体编译通过，JPA 映射正确，Application 启动后表结构自动创建无报错。如有问题请向用户提问。

- [x] 3. 图谱核心服务
  - [x] 3.1 实现 GraphService 图谱查询服务
    - 创建 `GraphService`，注入 GraphNodeRepository、GraphEdgeRepository、RedisTemplate
    - 实现 `querySubgraph(nodeId, depth)` 方法：BFS 向外扩展 depth 层，收集节点和边，结果缓存到 Redis（TTL=1h）
    - 实现 `recommendNext(problemId)` 方法：查找同模式/进阶/变体题目，按权重排序返回 Top 5
    - 实现 `shortestPath(fromId, toId)` 方法：BFS 求最短路径并缓存
    - 子图查询限制：max-depth=5，max-nodes=200
    - _Requirements: 1.3, 1.4, 1.6, 10.2_

  - [x] 3.2 实现图谱数据导入/导出 API
    - 创建 `GraphController`
    - GET /api/graph/subgraph?nodeId=xxx&depth=2：查询子图
    - GET /api/graph/shortest-path?from=xxx&to=xxx：最短路径
    - POST /api/graph/import：JSON 批量导入（节点 + 边）
    - GET /api/graph/export：JSON 导出完整图谱
    - POST /api/graph/nodes：批量创建节点
    - POST /api/graph/edges：批量创建边
    - 导入时校验引用完整性：边引用的节点必须存在
    - _Requirements: 1.1, 1.5, 10.1, 10.3_

  - [x] 3.3 实现数学关联服务
    - 创建 `MathRelationService`：查询算法模式的数学基础关联（通过 graph_edge 的 MATH_FOUNDATION 类型）
    - 创建 `MathRelationController`
    - GET /api/math-relation/{patternId}：返回数学关联节点列表 + 权威引用 + 可视化类型建议
    - 数学知识分级查询支持 level 参数
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 4. 推荐引擎
  - [x] 4.1 实现 RecommendationEngine 推荐服务
    - 创建 `RecommendationEngine`，注入 GraphService、UserProgressRepository、RedisTemplate
    - 实现 `recommend(userId)` 方法：基于用户完成历史 + 薄弱模式 + 图谱拓扑计算推荐
    - 实现 `identifyWeakPatterns(userId)` 方法：正确率<60% 的模式
    - 推荐结果缓存到 Redis（TTL=6h）
    - 推荐列表去重：排除已完成题目
    - _Requirements: 7.1, 7.3_

  - [x] 4.2 实现学习路径与进度追踪
    - 创建 `LearningPathService`
    - GET /api/learning-path：获取学习路径列表
    - GET /api/learning-path/{id}：获取路径详情（含节点列表）
    - GET /api/learning-path/{id}/progress/{userId}：计算用户在路径上的进度百分比 + 里程碑完成状态
    - 创建 `RecommendController`
    - GET /api/recommend/{userId}：获取个性化推荐（Top 10）
    - GET /api/recommend/{userId}/weak-patterns：获取薄弱模式列表
    - _Requirements: 7.2, 7.4_

- [x] 5. Checkpoint - 图谱服务与推荐引擎验证
  - 确保图谱 CRUD API 正常工作，子图查询响应时间合理，推荐逻辑正确排除已完成题目。如有问题请向用户提问。

- [x] 6. 模式训练系统
  - [x] 6.1 实现 PatternTrainingService
    - 创建 `PatternTrainingService`
    - 实现 `generateQuiz(userId, questionCount)` 方法：基于薄弱模式选题，隐藏标签，生成 4 选项（1正确+3干扰）
    - 实现 `submitAnswer(userId, questionId, answer)` 方法：记录结果，更新正确率
    - 实现 `getStats(userId)` 方法：按模式分类统计正确率
    - 创建 `TrainingRecord` 实体：userId、problemId、selectedAnswer、correctAnswer、isCorrect、createdAt
    - _Requirements: 2.1, 2.2_

  - [x] 6.2 实现模式演进路径 API
    - 创建 `TrainingController`
    - POST /api/training/quiz：生成测验
    - POST /api/training/submit：提交答案
    - GET /api/training/stats/{userId}：获取统计
    - 演进路径通过 graph_edge 的 FOLLOW_UP 类型查询（从基础模式到高级变体的有序序列）
    - 正确率>80% 时自动推荐进阶变体
    - _Requirements: 2.3, 2.4_


- [x] 7. 多平台映射系统
  - [x] 7.1 实现 MappingService
    - 创建 `MappingService`
    - 实现 `resolve(platform, platformId)` 方法：查询映射表返回统一 ID
    - 实现 `importFromCsv(file)` 方法：逐行解析 CSV（格式：platform,platformId,platformUrl,unifiedProblemId），校验格式，跳过错误行，返回导入报告
    - 实现 `getLinks(unifiedProblemId)` 方法：返回该题在所有平台上的链接
    - 模糊匹配逻辑：基于标题相似度（Jaccard/余弦），置信度<0.85 标记为 PENDING
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 7.2 实现 MappingController
    - 创建 `MappingController`
    - GET /api/mapping/resolve?platform=LEETCODE&platformId=1：解析映射
    - POST /api/mapping/import：CSV 文件上传导入（MultipartFile）
    - GET /api/mapping/problem/{id}/links：获取某题所有平台链接
    - PUT /api/mapping/{id}/confirm：人工确认 PENDING 状态映射
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 8. 离线导出系统
  - [x] 8.1 实现导出服务框架
    - 创建 `ExportService`：统一导出入口，路由到对应 Exporter 实现
    - 创建 `Exporter` 接口：`export(List<ExportableContent> contents, ExportOptions options): ExportResult`
    - 创建 `ExportRequest` DTO：format(PDF/MARKDOWN/NOTION/ANKI)、scope(SINGLE_PROBLEM/BY_PATTERN/BY_LEARNING_PATH/ALL)、problemId、patternId、pathId、options
    - 创建 `ExportResult` DTO：fileName、fileData(byte[])、contentType、fileSizeBytes
    - 内容收集逻辑：根据 scope 从 ExplanationRepository 加载对应内容
    - _Requirements: 9.1, 9.2_

  - [x] 8.2 实现 MarkdownExporter
    - 创建 `MarkdownExporter` 实现 Exporter 接口
    - 输出格式：标题 + 题目描述 + 思路分析 + 代码（按语言分节）+ 复杂度 + 图解 Mermaid 源码
    - 多题目时生成目录索引（TOC）
    - 支持增量导出：通过 lastExportedAt 时间戳筛选
    - _Requirements: 9.1, 9.5_

  - [x] 8.3 实现 PdfExporter
    - 创建 `PdfExporter` 实现 Exporter 接口
    - 使用 iText 或 OpenPDF 库生成 PDF
    - 包含：封面页、目录页、正文（代码语法高亮、Mermaid 渲染为图片）、页眉页脚（标题+页码）
    - 支持中文字体
    - 最大 500 页限制
    - _Requirements: 9.1, 9.3_

  - [x] 8.4 实现 AnkiExporter
    - 创建 `AnkiExporter` 实现 Exporter 接口
    - 生成 .apkg 格式（SQLite collection.anki2 + media 文件打包为 zip）
    - 卡片类型：题目→思路、信号→模式、代码补全、复杂度选择
    - 每张卡片含标签（模式名、难度级别）
    - 牌组命名：ADUE-{模式名}
    - _Requirements: 9.1, 9.4_

  - [x] 8.5 实现 NotionExporter 和 ExportController
    - 创建 `NotionExporter`：输出 Notion 兼容的 Markdown（含 toggle block、callout 语法）
    - 创建 `ExportController`
    - POST /api/export：触发导出任务，返回 taskId
    - GET /api/export/{taskId}/download：下载导出文件（文件流）
    - 文件大小限制校验（>100MB 拒绝）
    - _Requirements: 9.1, 9.5_

- [x] 9. Checkpoint - 后端服务完整性验证
  - 确保映射导入、导出生成、训练测验等核心流程正常工作，API 端点可访问。如有问题请向用户提问。

- [x] 10. 算法考古与论文桥梁 API
  - [x] 10.1 实现 ArchaeologyService 和 Controller
    - 创建 `ArchaeologyService`：CRUD 算法故事
    - 创建 `ArchaeologyController`
    - GET /api/archaeology/{algorithmId}：获取算法发明故事（含时间线）
    - GET /api/archaeology/list：获取所有算法故事列表（分页）
    - 故事内容与算法模式关联（通过 relatedPatternId）
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 10.2 实现 PaperBridgeService 和 Controller
    - 创建 `PaperBridgeService`：论文桥梁路径管理
    - 创建 `PaperBridgeController`
    - GET /api/paper-bridge/{domain}：按领域获取论文桥梁列表
    - GET /api/paper-bridge/{id}：获取桥梁详情（含分级解读和动手实验链接）
    - 分级解读查询支持 level 参数（3/4/5）
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 10.3 实现实际应用映射 API
    - 创建 `ApplicationMappingService`：通过 graph_edge 的 APPLICATION_OF 类型查询应用映射
    - GET /api/applications/{patternId}：获取某模式的四维应用映射
    - GET /api/applications/{patternId}/mini-cases：获取迷你案例列表
    - 支持按领域筛选（工业/AI/工作/人生）
    - _Requirements: 3.1, 3.2, 3.3, 3.4_


- [x] 11. 前端 D3.js 知识图谱可视化
  - [x] 11.1 创建 KnowledgeGraph 组件
    - 创建 `components/KnowledgeGraph.tsx`
    - 集成 D3.js force-directed layout（forceLink + forceManyBody + forceCollide + forceCenter）
    - 节点按类型着色：PATTERN(靛蓝)、PROBLEM(翠绿)、MATH(琥珀)、PAPER(红色)、APPLICATION(紫色)
    - 节点大小根据连接数和难度动态计算
    - 边线粗细根据 weight 值映射
    - 边线样式根据类型区分（实线=前置/进阶，虚线=变体/同模式）
    - _Requirements: 1.3_

  - [x] 11.2 实现图谱交互功能
    - 节点点击：高亮相邻节点和边，右侧面板展示详情
    - 节点双击：以该节点为中心请求 API 加载更多关联
    - 节点拖拽：D3 drag behavior，释放后固定位置
    - 边 hover：tooltip 显示关系类型和描述
    - 滚轮缩放：D3 zoom behavior + minimap 导航
    - 搜索框：输入关键词高亮匹配节点，画布平移居中
    - _Requirements: 1.3, 1.4_

  - [x] 11.3 创建图谱页面和侧边栏
    - 创建 `app/graph/page.tsx` 知识图谱页面
    - 左侧：全屏 D3 画布
    - 右侧：可收起侧边栏（节点详情、推荐列表、快捷操作）
    - 顶部工具栏：搜索框、节点类型筛选按钮、布局切换（force/tree/radial）、全屏按钮
    - _Requirements: 1.3, 1.4_

- [x] 12. 前端学习路径与推荐面板
  - [x] 12.1 创建学习路径页面
    - 创建 `app/learning-path/page.tsx`：路径列表页
    - 创建 `app/learning-path/[id]/page.tsx`：路径详情页
    - 路径详情页展示：进度条（总体完成度）、节点列表（已完成/当前/锁定状态图标）、里程碑标注
    - 当前位置高亮，点击节点跳转到对应题目/模式详情
    - _Requirements: 7.2, 7.4_

  - [x] 12.2 创建推荐面板组件
    - 创建 `components/RecommendPanel.tsx`
    - 展示 Top 10 推荐项：题目名称、所属模式、难度标签、推荐理由
    - 薄弱模式提示区域：列出薄弱模式 + "开始专项训练"按钮
    - 嵌入题目详情页侧边栏和首页
    - _Requirements: 7.1, 7.3_

  - [x] 12.3 创建模式训练页面
    - 创建 `app/training/page.tsx`：模式识别训练页
    - 展示题目描述（隐藏标签）+ 4 个选项按钮
    - 提交后展示正确/错误 + 解释
    - 训练结束后展示统计：正确率、薄弱模式、进步趋势
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 13. 前端导出与映射页面
  - [x] 13.1 创建导出面板
    - 创建 `components/ExportPanel.tsx`
    - 表单：选择格式（PDF/Markdown/Notion/Anki）、选择范围（单题/按模式/按路径/全量）、高级选项（语言、级别、是否含图解）
    - 点击导出后显示进度，完成后提供下载按钮
    - 嵌入题目详情页和模式详情页
    - _Requirements: 9.1, 9.2_

  - [x] 13.2 创建多平台映射展示
    - 在题目详情页添加"其他平台"区域：展示该题在各平台的链接和编号
    - 点击链接新窗口打开对应平台
    - 创建 `app/settings/import/page.tsx`：CSV 导入页面（拖拽上传 + 导入结果报告）
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 14. Checkpoint - 前端功能验证
  - 确保 D3.js 图谱渲染正常、交互流畅，学习路径和推荐面板数据加载正确，导出功能端到端可用。如有问题请向用户提问。

- [x] 15. 种子数据填充
  - [x] 15.1 创建图谱种子数据
    - 创建 `data/seed/graph-nodes.json`：至少 50 个节点（20 模式 + 20 题目 + 5 数学 + 5 论文）
    - 创建 `data/seed/graph-edges.json`：至少 100 条边（覆盖所有 RelationType）
    - 创建 `data/seed/learning-paths.json`：至少 3 条学习路径（DP入门、图论基础、双指针精通）
    - _Requirements: 1.1, 1.5, 7.2_

  - [x] 15.2 创建算法考古和论文桥梁种子数据
    - 创建 `data/seed/archaeology.json`：至少 10 个算法发明故事（Dijkstra、Huffman、RSA、PageRank、FFT、Quicksort、Knuth-Morris-Pratt、A*、MapReduce、Bellman-Ford）
    - 创建 `data/seed/paper-bridges.json`：至少 6 条论文桥梁（每个 FrontierDomain 1条）
    - 创建种子数据加载器 `GraphSeedDataLoader`，启动时幂等写入
    - _Requirements: 5.3, 6.4_

  - [x] 15.3 创建多平台映射种子数据
    - 创建 `data/seed/platform-mappings.csv`：至少 50 题的 LeetCode ↔ 牛客映射
    - 提供示例 CSV 格式和导入说明文档
    - _Requirements: 8.1_

- [x] 16. 单元测试与集成测试
  - [x] 16.1 GraphService 单元测试
    - 测试 querySubgraph：depth=1 和 depth=2 正确返回节点/边
    - 测试 recommendNext：排除已完成题目，按权重排序
    - 测试 shortestPath：正确路径和不可达情况
    - 测试引用完整性校验：导入边引用不存在节点时报错
    - _Requirements: 10.1, 10.2_

  - [x] 16.2 RecommendationEngine 和 ExportService 测试
    - 测试推荐不包含已完成题目
    - 测试薄弱模式识别（正确率<60%）
    - 测试 MarkdownExporter 输出格式正确
    - 测试 AnkiExporter 卡片 front/back 非空
    - 测试映射唯一性约束
    - _Requirements: 7.1, 7.3, 9.3, 9.4, 8.1_

- [x] 17. Final Checkpoint - 全功能集成验证
  - 确保图谱数据导入后 D3.js 可视化正常渲染，推荐引擎输出合理，导出功能生成有效文件，模式训练流程完整。如有问题请向用户提问。

- [x] 18. 差异化增强：考古/桥梁/映射优化
  - [x] 18.1 AlgorithmArchaeology 实体增加 shortSummary 字段
    - AlgorithmArchaeology 实体新增 `shortSummary`(String, 100字以内) 字段
    - GET /api/archaeology/{id} 响应包含 shortSummary
    - GET /api/archaeology/list 响应中每条也返回 shortSummary（用于列表预览）
    - 新增 GET /api/archaeology/by-pattern/{patternId}：按关联模式查询考古内容（题目详情页使用）
    - 更新种子数据 archaeology.json 为每条故事补充 shortSummary
    - _Requirements: 15.1, 15.2, 15.4_

  - [x] 18.2 论文桥梁 MVP 降级策略实现
    - PaperBridge 实体 leveledInterpretation JSON 中增加 `l3Available`/`l4Available`/`l5Available` 布尔字段
    - GET /api/paper-bridge/{id}?level=4 当 l4Available=false 时返回 `{"status":"coming_soon","message":"即将支持"}`
    - PaperBridge 实体新增 `experimentType`(String, 默认"COLAB") 和 `experimentUrl`(String)
    - 种子数据中仅 3 条桥梁（CV/NLP/推荐各 1 条）标记为全量可用，其余标为"即将推出"
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [x] 18.3 跨域映射"人生"维度可选展示
    - CrossDomainMapping 实体 `lifeScene` 字段允许 null
    - GET /api/patterns/{id}/cross-domain-table 返回中 lifeScene 为空时返回 null（不返回空字符串）
    - 种子数据中仅对 5 个模式（DP/回溯/贪心/BFS/分治）填充 lifeScene，其余留空
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

  - [x] 18.4 迷你案例可运行保障
    - ApplicationMapping 实体新增 `runtimeRequirements`(String) 字段
    - 种子数据中每个迷你案例补充运行环境要求（如"Python 3.8+，无额外依赖"）
    - 创建 `scripts/verify-mini-cases.sh` 脚本：遍历种子数据中所有迷你案例代码并执行验证
    - 迷你案例代码长度校验：导入时检查不超过 50 行
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

- [x] 19. Checkpoint - 差异化增强验证
  - 验证 shortSummary 在 API 响应中正确返回，题目详情页通过 patternId 能查到考古内容
  - 验证论文桥梁 L4/L5 不可用时返回"即将支持"而非空内容
  - 验证跨域映射表人生列为空时不展示该列
  - 验证迷你案例运行环境字段正确返回
  - 如有问题请向用户提问

## Notes

- 所有 Java 代码遵循编码规范：使用 Lombok、方法不超过 50 行、中文注释、时间字段用 UTC 毫秒时间戳
- 图谱数据量预估：初期 200 节点 + 800 边，MySQL + Redis 缓存足够支撑
- D3.js 可视化在节点超过 500 时需要考虑 WebGL 渲染方案（当前阶段不需要）
- 离线导出为异步任务，大文件生成不阻塞 API 响应
- 推荐引擎使用定时预计算 + Redis 缓存，不做实时计算

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "4.1"] },
    { "id": 3, "tasks": ["4.2", "6.1"] },
    { "id": 4, "tasks": ["6.2", "7.1"] },
    { "id": 5, "tasks": ["7.2", "8.1"] },
    { "id": 6, "tasks": ["8.2", "8.3", "8.4"] },
    { "id": 7, "tasks": ["8.5", "10.1", "10.2", "10.3"] },
    { "id": 8, "tasks": ["11.1"] },
    { "id": 9, "tasks": ["11.2", "11.3"] },
    { "id": 10, "tasks": ["12.1", "12.2", "12.3"] },
    { "id": 11, "tasks": ["13.1", "13.2"] },
    { "id": 12, "tasks": ["15.1", "15.2", "15.3"] },
    { "id": 13, "tasks": ["16.1", "16.2"] },
    { "id": 14, "tasks": ["18.1", "18.2", "18.3", "18.4"] }
  ]
}
```
