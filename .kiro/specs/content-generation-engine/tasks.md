# Implementation Plan: 内容生成引擎

## Overview

本计划在 Spec 1 基础设施层之上实现核心内容生成能力。按照"模板系统→多级别生成器→代码生成→解法对比→质量校验→流水线编排→批量生成→种子数据"的顺序递进实现，确保每步构建在前一步之上。

## Tasks

- [x] 1. Prompt 模板系统
  - [x] 1.1 创建 PromptTemplateEngine 核心类
    - 创建 `com.algorithmhelp.content.prompt.PromptTemplateEngine` 组件
    - 实现 `render(templatePath, variables)` 方法：加载模板文件、替换变量占位符
    - 使用 ConcurrentHashMap 缓存已加载模板（含文件修改时间戳）
    - 当文件修改时间变化时自动重新加载（热更新）
    - 变量未填充时抛出 `TemplateRenderException`
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6_

  - [x] 1.2 创建 L1-L5 解析生成 Prompt 模板文件
    - 创建 `resources/prompts/explanation/L1-intuition.md`：零代码、纯类比、故事化风格
    - 创建 `resources/prompts/explanation/L2-beginner.md`：具体例子+伪代码+图解
    - 创建 `resources/prompts/explanation/L3-intermediate.md`：模式框架+多解法对比
    - 创建 `resources/prompts/explanation/L4-advanced.md`：边界分析+复杂度证明
    - 创建 `resources/prompts/explanation/L5-expert.md`：论文引用+数学推导
    - 每个模板含变量占位符和输出 JSON 结构要求
    - _Requirements: 1.1, 1.3_

  - [x] 1.3 创建代码生成、图解、质量校验、对比 Prompt 模板
    - 创建 `resources/prompts/codegen/python.md`：Python PEP8 风格+中文注释
    - 创建 `resources/prompts/codegen/java.md`：Java Google Style+中文注释
    - 创建 `resources/prompts/codegen/go.md`：Go gofmt 风格+中文注释
    - 创建 `resources/prompts/codegen/cpp.md`：C++ Google Style+中文注释
    - 创建 `resources/prompts/diagram/mermaid-generate.md`
    - 创建 `resources/prompts/quality/ai-review.md`
    - 创建 `resources/prompts/quality/logic-check.md`
    - 创建 `resources/prompts/comparator/evolution-graph.md`
    - 创建 `resources/prompts/comparator/framework-extract.md`
    - _Requirements: 1.1, 1.3_


- [x] 2. Checkpoint - 模板系统验证
  - 确保 PromptTemplateEngine 可正确加载模板文件、替换变量、热更新生效。编写简单单元测试验证。如有问题请向用户提问。

- [x] 3. 多级别解析生成器
  - [x] 3.1 创建 LeveledGenerator 核心类
    - 创建 `com.algorithmhelp.content.generator.LeveledGenerator` 服务
    - 实现 `generate(problem, level)` 方法：根据 level 选择模板→填充变量→调用 SmartRouter→解析响应
    - 创建 `LeveledContent` 响应模型，包含各级别特有字段
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.2 实现级别符合性校验规则
    - 创建 `LevelComplianceChecker` 组件
    - L1 校验：内容中不得包含代码块（检测 ``` 标记）
    - L2 校验：必须包含伪代码段和逐步图解
    - L3 校验：必须包含模式框架和至少2种解法
    - L4 校验：必须包含复杂度推导过程
    - L5 校验：必须包含至少1条论文引用
    - _Requirements: 2.7_

  - [x] 3.3 创建 AI 响应解析器
    - 创建 `AiResponseParser` 工具类
    - 实现 JSON 响应解析：将 AI 返回的 JSON 字符串映射为 `LeveledContent` 对象
    - 处理 AI 返回格式不规范的情况（如多余文字包裹 JSON）：提取 JSON 部分
    - 解析失败时返回原始文本并标记为"需人工处理"
    - _Requirements: 3.2_

- [x] 4. 多语言代码生成器
  - [x] 4.1 创建 MultiLangCodeGenerator 服务
    - 创建 `com.algorithmhelp.content.codegen.MultiLangCodeGenerator` 服务
    - 实现 `generateForApproach(approach, problem)` 方法
    - 遍历 4 种语言，逐一调用对应 Prompt 模板+SmartRouter 生成代码
    - 创建 `CodeSnippet` 模型（language、code、hasComments）
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 4.2 实现代码注释校验与补充
    - 检查生成的代码是否包含中文注释（正则匹配中文字符在注释行中）
    - 若不包含注释，触发二次生成：使用"注释补充"prompt 模板
    - _Requirements: 4.5_

- [x] 5. 解法对比与框架提炼
  - [x] 5.1 创建 ApproachComparator 服务
    - 创建 `com.algorithmhelp.content.comparator.ApproachComparator` 服务
    - 实现 `compare(approaches, problem)` 方法
    - 创建 `ComparisonResult` 模型（evolutionMermaid、matrix、commonFramework、transferPath）
    - 创建 `ComparisonRow` 模型（多维对比矩阵行）
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 5.2 实现解法演进关系图生成
    - 调用 `comparator/evolution-graph.md` 模板 + AI 生成 Mermaid 流程图
    - 图中展示：暴力→优化1→优化2→最优 的路径关系
    - 每个节点标注复杂度，每条边标注"优化思路"
    - _Requirements: 7.1, 7.5_

  - [x] 5.3 实现底层框架提炼与迁移路径
    - 调用 `comparator/framework-extract.md` 模板 + AI 提炼共同思路
    - 输出格式：一句话本质 + 推广题目列表
    - 将结果写入 ComparisonResult.transferPath
    - _Requirements: 7.3, 7.4_

- [x] 6. Checkpoint - 生成器组件验证
  - 确保 LeveledGenerator、MultiLangCodeGenerator、ApproachComparator 各组件可独立运行并返回结构化结果。如有问题请向用户提问。


- [x] 7. 内容质量校验
  - [x] 7.1 创建 QualityValidator 服务
    - 创建 `com.algorithmhelp.content.quality.QualityValidator` 服务
    - 实现 `validate(explanation, level)` 方法，依次执行格式校验→级别校验→Mermaid校验→AI自审
    - 创建 `ValidationReport` 模型（issues列表、isPassed方法）
    - 创建 `ValidationIssue` 模型（type、severity、location、message、suggestion）
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 7.2 实现格式校验规则
    - Markdown 结构校验：标题层级连续性、代码块闭合、列表格式
    - Mermaid 语法校验：正则检查语法关键字、括号匹配
    - 代码块语言标注校验：必须指定语言
    - _Requirements: 6.2_

  - [x] 7.3 实现 AI 自审逻辑
    - 调用 `quality/ai-review.md` 模板，将生成内容发送给 AI 进行逻辑正确性审查
    - AI 返回结构化审查结果：是否有逻辑错误、错误位置、严重程度
    - 逻辑错误时将 Explanation 标记为"待修正"状态
    - _Requirements: 6.1, 6.6_

  - [x] 7.4 实现规则校验
    - 复杂度合理性校验：O(n²) 暴力解不应被标注为最优
    - 解法完整性校验：至少包含一种解法的完整代码
    - 引用格式校验：L5 级别必须有 `[Author, Year]` 格式引用
    - _Requirements: 6.3, 6.4_

- [x] 8. ContentPipeline 流水线编排
  - [x] 8.1 创建 ContentPipeline 服务
    - 创建 `com.algorithmhelp.content.pipeline.ContentPipeline` 服务
    - 实现 `generate(problemId, level, options)` 方法
    - 编排流程：加载题目→调用 LeveledGenerator→补充代码→生成图解→生成对比→质量校验→持久化
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

  - [x] 8.2 实现降级生成策略
    - 某步骤失败时（如图解生成失败），记录错误并跳过该步骤继续
    - 将失败步骤信息记入 GenerationResult 的 warnings 字段
    - 核心步骤（AI 主体生成）失败时整体失败并抛出异常
    - _Requirements: 3.5_

  - [x] 8.3 实现生成结果持久化
    - 校验通过：写入 ExplanationRepository（MySQL）+ Redis 缓存
    - 校验未通过：写入数据库并标记 status="PENDING_REVIEW"
    - 创建 `GenerationResult` 模型（explanation、report、status、duration）
    - _Requirements: 3.6_

- [x] 9. Checkpoint - 单题生成端到端验证
  - 使用一道简单题目（如两数之和）触发 ContentPipeline 完整流程，验证从输入到数据库存储的全链路。如有问题请向用户提问。

- [x] 10. 批量生成任务管理
  - [x] 10.1 创建 BatchGenerationService 服务
    - 创建 `com.algorithmhelp.content.batch.BatchGenerationService` 服务
    - 实现 `startBatch(batchId, problemIds, options)` @Async 方法
    - 使用 Semaphore 控制并发数（从配置读取，默认3）
    - 创建 `BatchProgress` 模型（total、completed、failed、skipped、currentProblem、status、failures、startTime）
    - 使用 ConcurrentHashMap 存储进度信息
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 10.2 实现失败重试与断点续生成
    - 单题失败后自动重试（最多3次，间隔可配置）
    - 重试仍失败则记录到 failures 列表并跳过
    - 断点续生成：检查数据库中是否已存在该题解析，存在则跳过
    - _Requirements: 5.3, 5.5_

  - [x] 10.3 创建批量生成 REST API
    - POST `/api/batch/generate`：接收 levels、concurrency 参数，返回 batchId
    - GET `/api/batch/{batchId}/progress`：返回 BatchProgress
    - 创建 `BatchController` 和对应 DTO
    - _Requirements: 5.4_

- [x] 11. 种子数据初始化
  - [x] 11.1 创建 50 题种子数据文件
    - 创建 `data/seed/problems-50.json`，包含50道精选题目的元信息
    - 每题包含：id、leetcodeId、title、difficulty、tags、description、constraints、examples
    - 覆盖各难度（Easy 15题、Medium 25题、Hard 10题）和各算法类型
    - _Requirements: 5.6_

  - [x] 11.2 创建 SeedDataLoader 组件
    - 创建 `com.algorithmhelp.content.seed.SeedDataLoader` 组件
    - 实现 `loadSeedProblems()` 方法：从 JSON 读取并反序列化
    - 实现 `@PostConstruct initSeedData()` 方法：幂等写入数据库
    - 配置 `content.seed.auto-init` 开关控制是否自动初始化
    - _Requirements: 5.1, 5.6_

- [x] 12. Checkpoint - 批量生成端到端验证
  - 使用种子数据中的 5 道题目触发小规模批量生成，验证并发控制、失败重试、进度追踪功能。如有问题请向用户提问。


- [x] 13. 集成测试与文档
  - [x] 13.1 编写核心组件单元测试
    - PromptTemplateEngine 测试：模板加载、变量替换、热更新、异常处理
    - LevelComplianceChecker 测试：各级别校验规则正确性
    - AiResponseParser 测试：正常 JSON、包裹文字的 JSON、非法格式
    - BatchProgress 测试：并发更新安全性
    - _Requirements: 全部_

  - [x] 13.2 编写集成测试
    - ContentPipeline 端到端测试（使用 StaticProvider mock AI 响应）
    - BatchGenerationService 小规模测试（3题并发生成）
    - QualityValidator 综合测试（构造各种问题场景验证检出率）
    - _Requirements: 全部_

- [x] 14. Final Checkpoint - 内容生成引擎完整验证
  - 确保所有组件协同工作：模板加载→AI调用→内容生成→质量校验→持久化→批量调度，全链路无异常。如有问题请向用户提问。

- [x] 15. 知识关联关系自动生成
  - [x] 15.1 创建 RelationExtractor 服务
    - 创建 `com.algorithmhelp.content.relation.RelationExtractor` 服务
    - 实现 `extractRelations(explanation)` 方法：从生成的解析内容中提取关联题目ID和模式标签
    - 创建 Prompt 模板 `resources/prompts/relation/extract-relations.md`：AI 分析题目后输出关联关系 JSON
    - _Requirements: 8.1_

  - [x] 15.2 实现自动关联关系推断
    - 实现 `inferRelationType(fromProblem, toProblem)` 方法
    - 推断规则：同标签+低难度→prerequisite、同标签+同难度→similar_pattern、同标签+高难度→follow_up
    - 为每条关联附带置信度分数（0-1）
    - 低置信度（<0.6）标记为 PENDING_CONFIRM 状态
    - _Requirements: 8.2, 8.5_

  - [x] 15.3 实现批量关联计算与管理 API
    - 实现 `calculateAllRelations()` 方法：遍历所有题目执行全量关联计算
    - 在 ContentPipeline 中集成：单题生成完成后自动调用 extractRelations
    - 创建管理员 API：POST /api/admin/relations/recalculate（触发全量重算）
    - 创建管理员 API：PUT /api/admin/relations/{id}（手动修正关联）
    - 创建管理员 API：DELETE /api/admin/relations/{id}（删除关联）
    - _Requirements: 8.3, 8.4_

- [x] 16. L5 论文引用校验
  - [x] 16.1 创建已知权威来源数据文件
    - 创建 `backend/src/main/resources/data/known-references.json`
    - 包含教材类（CLRS各章节、TAOCP各卷、Concrete Mathematics）
    - 包含课程类（MIT 6.006/6.046、Stanford CS161）
    - 包含论文类（Dijkstra 1959、KMP 1977、Tarjan 1972 等 Top 30 经典论文）
    - 每条记录含 name、aliases（别名列表）、type
    - _Requirements: 11.2, 11.4_

  - [x] 16.2 创建 KnownReferenceRegistry 组件
    - 创建 `com.algorithmhelp.content.quality.KnownReferenceRegistry` 组件
    - @PostConstruct 加载 known-references.json
    - 实现 `match(citation)` 方法：模糊匹配作者名+年份+书名
    - 实现 `checkAll(citations)` 方法：批量校验引用列表
    - 创建 `KnownReference` 和 `ReferenceCheckResult` 模型
    - _Requirements: 11.2, 11.3_

  - [x] 16.3 集成到 QualityValidator
    - 在 `QualityValidator.validate()` 中当 level==5 时增加引用校验步骤
    - 使用正则从内容中提取 `[Author, Year]` 和 `Author et al. (Year)` 格式引用
    - 未验证的引用生成 WARNING 级别 issue（非 ERROR，不阻止发布）
    - _Requirements: 11.1, 11.3_

- [x] 17. 反向费曼错误分类体系
  - [x] 17.1 创建错误分类枚举和数据模型
    - 创建 `FeynmanErrorType` 枚举：LOGIC/NUMERIC/BOUNDARY/COMPLEXITY/CONCEPT
    - 创建 `FeynmanDifficulty` 枚举：EASY/MEDIUM/HARD
    - 创建 `ErrorTypeStats` 模型：userId、errorType、totalAttempts、successCount、successRate()
    - _Requirements: 13.1, 13.3_

  - [x] 17.2 创建/更新反向费曼 Prompt 模板
    - 创建 `resources/prompts/interactive/reverse-feynman-generate.md`
    - 模板中约束：EASY档=LOGIC+NUMERIC、MEDIUM档=BOUNDARY+COMPLEXITY、HARD档=CONCEPT
    - 输出 JSON 中包含 errorType、errorDifficulty、errorDescription 字段
    - 创建 `resources/prompts/interactive/reverse-feynman-evaluate.md`（纠错评估模板）
    - _Requirements: 13.1, 13.2_

  - [x] 17.3 实现薄弱类型追踪与自适应出题
    - 创建 `ErrorTypeStatsRepository`（JPA）存储用户各类型纠错统计
    - 在纠错评估完成后更新统计数据
    - 实现加权随机算法：成功率 < 50% 的类型权重 ×2，实现自适应难度
    - _Requirements: 13.3, 13.4_

- [x] 18. 复杂度训练题预置数据
  - [x] 18.1 创建复杂度训练题数据文件
    - 创建 `data/static/complexity-training.json`
    - 包含 25 道"看范围猜算法"（RANGE_GUESS）题目
    - 包含 25 道"看代码估复杂度"（CODE_ESTIMATE）题目
    - 每题含 id、mode、constraints/code、options、correctAnswer、explanation、difficulty
    - 覆盖 O(1)~O(n!) 所有常见复杂度级别
    - _Requirements: 12.1, 12.2, 12.3, 12.5_

  - [x] 18.2 创建 ComplexityTrainingLoader 组件
    - 创建 `com.algorithmhelp.content.seed.ComplexityTrainingLoader` 组件
    - @PostConstruct 幂等导入训练题到数据库
    - 创建 `ComplexityTrainingProblem` 实体映射
    - _Requirements: 12.4_

- [x] 19. Checkpoint - 差异化增强功能验证
  - 验证 L5 论文引用校验能正确检出未知引用并标记 WARNING
  - 验证反向费曼 Prompt 模板能按难度档输出正确错误类型
  - 验证复杂度训练题能从 JSON 文件正确导入数据库
  - 如有问题请向用户提问

## Notes

- 所有 Java 代码遵循编码规范：使用 Lombok（@Data、@Accessors(chain=true)）、方法不超过 50 行、中文注释
- 时间字段统一使用 UTC 毫秒时间戳
- 本 spec 依赖 Spec 1 的 SmartRouter、DiagramService、Problem/Explanation 实体等组件
- Prompt 模板是核心资产，需要反复迭代优化（本 spec 提供初始版本）
- 实际 50 题内容的 AI 生成是运行时操作，不在本 spec 编码任务范围内
- R11-R13 为差异化增强需求，Task 16-18 对应实现，可在核心流水线（Task 1-15）完成后并行开发

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["3.1", "3.3"] },
    { "id": 3, "tasks": ["3.2", "4.1"] },
    { "id": 4, "tasks": ["4.2", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3"] },
    { "id": 6, "tasks": ["7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "7.4"] },
    { "id": 8, "tasks": ["8.1"] },
    { "id": 9, "tasks": ["8.2", "8.3"] },
    { "id": 10, "tasks": ["10.1", "11.1"] },
    { "id": 11, "tasks": ["10.2", "11.2"] },
    { "id": 12, "tasks": ["10.3"] },
    { "id": 13, "tasks": ["13.1", "13.2"] },
    { "id": 14, "tasks": ["15.1"] },
    { "id": 15, "tasks": ["15.2", "15.3"] },
    { "id": 16, "tasks": ["16.1", "17.1", "18.1"] },
    { "id": 17, "tasks": ["16.2", "17.2", "18.2"] },
    { "id": 18, "tasks": ["16.3", "17.3"] }
  ]
}
```
