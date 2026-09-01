# Design: 知识图谱与高级功能

## Overview

本设计文档定义知识图谱与高级功能层的技术实现方案。该层建立在前四个 Spec 之上，复用已有的 Problem/Pattern 实体、AIProvider 接口、SmartRouter、ContentPipeline 和前端组件体系，新增知识图谱数据模型、D3.js 可视化、推荐引擎、多平台映射和离线导出系统。

## Architecture

### 系统架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端展示层                                 │
│  D3.js 图谱可视化 | 学习路径面板 | 导出面板 | 模式训练 UI         │
├─────────────────────────────────────────────────────────────────┤
│                        REST API 层                               │
│  GraphController | RecommendController | ExportController        │
│  MappingController | ArchaeologyController | TrainingController  │
├─────────────────────────────────────────────────────────────────┤
│                        业务服务层                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ GraphService │ │ Recommend-   │ │ ExportService│            │
│  │ (图谱查询/   │ │ ationEngine  │ │ (PDF/MD/     │            │
│  │  拓扑分析)   │ │ (推荐计算)   │ │  Notion/Anki)│            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ MappingService│ │ MathRelation │ │ Archaeology  │            │
│  │ (多平台映射) │ │ Service      │ │ Service      │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│  ┌──────────────┐ ┌──────────────┐                              │
│  │ PaperBridge  │ │ PatternTrain │                              │
│  │ Service      │ │ ingService   │                              │
│  └──────────────┘ └──────────────┘                              │
├─────────────────────────────────────────────────────────────────┤
│                        数据层                                    │
│  MySQL (图谱节点/边/映射/路径) + Redis (推荐缓存)           │
└─────────────────────────────────────────────────────────────────┘
```

### 模块职责

| 模块 | 职责 | 包路径 |
|------|------|--------|
| GraphService | 图谱 CRUD、拓扑查询、路径计算 | `com.algorithmhelp.graph` |
| RecommendationEngine | 基于图谱的推荐计算、薄弱点识别 | `com.algorithmhelp.recommend` |
| ExportService | 多格式导出、模板渲染、文件生成 | `com.algorithmhelp.export` |
| MappingService | 多平台 ID 映射、导入导出 | `com.algorithmhelp.mapping` |
| MathRelationService | 数学关联查询、分级解释 | `com.algorithmhelp.math` |
| ArchaeologyService | 算法故事管理和关联 | `com.algorithmhelp.archaeology` |
| PaperBridgeService | 论文桥梁路径管理 | `com.algorithmhelp.paper` |
| PatternTrainingService | 模式识别训练、正确率统计 | `com.algorithmhelp.training` |

## Components and Interfaces

### 组件交互关系

```
GraphController ──→ GraphService ──→ GraphNodeRepository / GraphEdgeRepository
                                  ──→ Redis (路径缓存)

RecommendController ──→ RecommendationEngine ──→ GraphService
                                              ──→ UserProgressRepository
                                              ──→ Redis (推荐缓存)

ExportController ──→ ExportService ──→ PdfExporter
                                   ──→ MarkdownExporter
                                   ──→ NotionExporter
                                   ──→ AnkiExporter
                                   ──→ ExplanationRepository

MappingController ──→ MappingService ──→ PlatformMappingRepository

TrainingController ──→ PatternTrainingService ──→ TrainingRecordRepository
                                              ──→ GraphService (获取模式信息)
```

| 组件 | 接口/职责 | 依赖 |
|------|-----------|------|
| GraphService | querySubgraph(nodeId, depth): GraphDTO | GraphNodeRepo, GraphEdgeRepo, Redis |
| RecommendationEngine | recommend(userId): List<RecommendItem> | GraphService, UserProgressRepo |
| ExportService | export(request): ExportResult | Explanation/PatternRepo, Exporter 实现 |
| MappingService | resolve(platform, platformId): String | PlatformMappingRepo |
| PatternTrainingService | generateQuiz(userId): Quiz | GraphService, ProblemRepo |

## Data Models

### 知识图谱核心模型（MySQL）

```java
// 图谱节点
@Entity
@Table(name = "graph_node")
@Data @Accessors(chain = true)
public class GraphNode {
    @Id
    private String id;                          // 如 "pattern:sliding-window", "problem:two-sum"

    @Enumerated(EnumType.STRING)
    private NodeType type;                      // PATTERN, PROBLEM, MATH, PAPER, APPLICATION

    private String name;                        // 显示名称
    private String category;                    // 所属大类（如 "双指针", "动态规划"）
    private String description;                 // 简短描述

    @Type(JsonType.class)
    @Column(columnDefinition = "json")
    private Map<String, Object> metadata;       // 扩展属性（模式卡片完整信息）

    private Integer difficulty;                 // 难度系数 1-5（用于排序推荐）
    private Long createdAt;
    private Long updatedAt;
}

public enum NodeType {
    PATTERN, PROBLEM, MATH, PAPER, APPLICATION
}

// 图谱边（关联关系）
@Entity
@Table(name = "graph_edge",
       indexes = {
           @Index(name = "idx_edge_source", columnList = "sourceId"),
           @Index(name = "idx_edge_target", columnList = "targetId"),
           @Index(name = "idx_edge_type", columnList = "relationType")
       })
@Data @Accessors(chain = true)
public class GraphEdge {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    private String sourceId;                    // 起始节点 ID
    private String targetId;                    // 目标节点 ID

    @Enumerated(EnumType.STRING)
    private RelationType relationType;          // 关系类型

    private Double weight;                      // 关联强度 0.0-1.0
    private String description;                 // 关系描述（如"前置知识"）

    @Type(JsonType.class)
    @Column(columnDefinition = "json")
    private Map<String, Object> metadata;       // 扩展属性

    private Long createdAt;
}

public enum RelationType {
    PREREQUISITE,       // 前置知识
    VARIANT,            // 变体
    SIMILAR_PATTERN,    // 同模式
    FOLLOW_UP,          // 进阶
    HARDER_VERSION,     // 困难版本
    MATH_FOUNDATION,    // 数学基础
    PAPER_REFERENCE,    // 论文引用
    APPLICATION_OF      // 应用实例
}
```

### 多平台映射模型

```java
@Entity
@Table(name = "platform_mapping",
       uniqueConstraints = @UniqueConstraint(columnNames = {"platform", "platformId"}))
@Data @Accessors(chain = true)
public class PlatformMapping {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    private String unifiedProblemId;            // 内部统一题目 ID

    @Enumerated(EnumType.STRING)
    private Platform platform;                  // LEETCODE, NOWCODER, HACKERRANK, CODEFORCES, LUOGU

    private String platformId;                  // 平台上的编号/slug
    private String platformUrl;                 // 平台链接
    private String platformTitle;               // 平台上的标题（可能不同语言）

    @Enumerated(EnumType.STRING)
    private MappingStatus status;               // CONFIRMED, PENDING, REJECTED

    private Long createdAt;
    private Long updatedAt;
}

public enum Platform {
    LEETCODE, NOWCODER, HACKERRANK, CODEFORCES, LUOGU, ATCODER
}

public enum MappingStatus {
    CONFIRMED, PENDING, REJECTED
}
```

### 用户学习进度模型

```java
@Entity
@Table(name = "user_progress")
@Data @Accessors(chain = true)
public class UserProgress {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    private String userId;
    private String problemId;                   // 统一题目 ID
    private String patternId;                   // 关联模式 ID

    @Enumerated(EnumType.STRING)
    private CompletionStatus status;            // NOT_STARTED, IN_PROGRESS, COMPLETED, MASTERED

    private Integer attempts;                   // 尝试次数
    private Integer correctCount;               // 正确次数（模式识别训练用）
    private Long lastPracticeAt;                // 最后练习时间
    private Long completedAt;                   // 完成时间
}

public enum CompletionStatus {
    NOT_STARTED, IN_PROGRESS, COMPLETED, MASTERED
}
```


### 学习路径模型

```java
@Entity
@Table(name = "learning_path")
@Data @Accessors(chain = true)
public class LearningPath {
    @Id
    private String id;                          // 如 "dp-mastery", "graph-beginner"

    private String name;                        // "动态规划从入门到精通"
    private String description;
    private String category;                    // 所属大类
    private Integer estimatedHours;             // 预计学习时长
    private Integer totalNodes;                 // 路径节点总数

    @Type(JsonType.class)
    @Column(columnDefinition = "json")
    private List<PathNode> nodes;               // 有序节点列表

    private Long createdAt;
    private Long updatedAt;
}

@Data @Accessors(chain = true)
public class PathNode {
    private String nodeId;                      // 关联 GraphNode ID
    private NodeType nodeType;                  // PATTERN / PROBLEM / MATH / PAPER
    private Integer order;                      // 顺序号
    private boolean optional;                   // 是否可选
    private String unlockCondition;             // 解锁条件描述
    private String milestone;                   // 如果是里程碑节点，标注里程碑名称（null表示非里程碑）
}
```

### 实际应用映射模型

```java
@Entity
@Table(name = "application_mapping")
@Data @Accessors(chain = true)
public class ApplicationMapping {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    private String patternId;                   // 关联算法模式 ID

    @Enumerated(EnumType.STRING)
    private ApplicationDomain domain;           // INDUSTRY / AI_ML / WORK / LIFE

    private String title;                       // 应用标题（如"导航路径规划"）
    private String subtitle;                    // 副标题（如"Dijkstra / A* → Google Maps"）

    @Column(columnDefinition = "text")
    private String description;                 // 应用描述（2-3段）

    @Column(columnDefinition = "text")
    private String miniCaseCode;                // 迷你案例代码（50行以内，可运行）

    private String miniCaseLanguage;            // 迷你案例语言（python/java）
    private String icon;                        // 显示图标（emoji 或图标名）

    private Long createdAt;
}

public enum ApplicationDomain {
    INDUSTRY,       // 工业应用
    AI_ML,          // AI/ML 前沿
    WORK,           // 工作映射
    LIFE            // 人生哲学
}

// 跨域迁移映射表（每个模式一条记录，含四列文字）
@Entity
@Table(name = "cross_domain_mapping")
@Data @Accessors(chain = true)
public class CrossDomainMapping {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    private String patternId;                   // 关联算法模式
    private String leetcodeScene;               // LeetCode 场景描述（1-2句）
    private String workScene;                   // 工作场景描述
    private String aiScene;                     // AI/ML 场景描述
    private String lifeScene;                   // 日常生活类比

    @Column(columnDefinition = "text")
    private String detailJson;                  // 展开详情（每列2-3段+代码片段，JSON）

    private Long createdAt;
}
```

### 学习活动热力图模型

```java
// 每日学习活动聚合（定时任务每日凌晨计算前一天数据）
@Entity
@Table(name = "daily_activity",
       uniqueConstraints = @UniqueConstraint(columnNames = {"userId", "date"}))
@Data @Accessors(chain = true)
public class DailyActivity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    private String userId;
    private long date;                          // 当天 0 点 UTC 毫秒
    private int problemsStudied;                // 学习题目数
    private int reviewsCompleted;               // 完成复习数
    private long timeSpentMs;                   // 学习总时长（毫秒）
    private int interactionsCount;              // 交互功能使用次数（费曼/面试/苏格拉底等）
    private long createdAt;
}
```

### 算法考古模型

```java
@Entity
@Table(name = "algorithm_archaeology")
@Data @Accessors(chain = true)
public class AlgorithmArchaeology {
    @Id
    private String id;                          // 如 "dijkstra-shortest-path"

    private String algorithmName;               // "Dijkstra 最短路径算法"
    private String inventorName;                // "Edsger W. Dijkstra"
    private Integer inventionYear;              // 1956
    private String inventionPlace;              // "阿姆斯特丹，一家咖啡馆"

    @Column(columnDefinition = "text")
    private String story;                       // 发明故事（Markdown 格式，500-1500字）

    @Column(columnDefinition = "text")
    private String motivation;                  // 发明动机

    @Column(columnDefinition = "text")
    private String impact;                      // 对后世的影响

    @Type(JsonType.class)
    @Column(columnDefinition = "json")
    private List<TimelineEvent> timeline;       // 时间线事件

    private String relatedPatternId;            // 关联的算法模式 ID
    private Long createdAt;
}

@Data @Accessors(chain = true)
public class TimelineEvent {
    private Integer year;
    private String event;
    private String significance;
}
```

### 论文桥梁模型

```java
@Entity
@Table(name = "paper_bridge")
@Data @Accessors(chain = true)
public class PaperBridge {
    @Id
    private String id;

    private String baseAlgorithm;               // 基础算法（如 "BFS"）
    private String paperTitle;                  // 论文标题
    private String paperAuthors;                // 作者
    private Integer paperYear;                  // 发表年份
    private String paperUrl;                    // 论文链接

    @Enumerated(EnumType.STRING)
    private FrontierDomain domain;              // 前沿领域

    @Type(JsonType.class)
    @Column(columnDefinition = "json")
    private List<BridgeStep> bridgePath;        // 桥梁路径步骤

    @Type(JsonType.class)
    @Column(columnDefinition = "json")
    private Map<Integer, String> leveledInterpretation;  // L3/L4/L5 三级解读

    private String experimentUrl;               // 动手实验链接/代码

    private Long createdAt;
}

public enum FrontierDomain {
    CV, NLP, ROBOTICS, RECOMMENDATION, BIOINFORMATICS, QUANTUM
}

@Data @Accessors(chain = true)
public class BridgeStep {
    private Integer order;
    private String title;                       // 步骤标题
    private String description;                 // 步骤描述
    private String connectionToNext;            // 与下一步的衔接说明
}
```

## Component Design

### 1. GraphService（图谱服务）

```java
@Service
@RequiredArgsConstructor
public class GraphService {

    private final GraphNodeRepository nodeRepo;
    private final GraphEdgeRepository edgeRepo;
    private final RedisTemplate<String, Object> redisTemplate;

    /**
     * 查询以某节点为中心的子图（BFS 扩展）
     */
    public GraphDTO querySubgraph(String nodeId, int depth) {
        // BFS 向外扩展 depth 层，收集节点和边
        Set<String> visited = new HashSet<>();
        Queue<String> queue = new LinkedList<>();
        queue.add(nodeId);
        visited.add(nodeId);

        List<GraphNode> nodes = new ArrayList<>();
        List<GraphEdge> edges = new ArrayList<>();

        for (int d = 0; d < depth && !queue.isEmpty(); d++) {
            int size = queue.size();
            for (int i = 0; i < size; i++) {
                String current = queue.poll();
                nodes.add(nodeRepo.findById(current).orElse(null));
                List<GraphEdge> outEdges = edgeRepo.findBySourceId(current);
                List<GraphEdge> inEdges = edgeRepo.findByTargetId(current);
                for (GraphEdge edge : concat(outEdges, inEdges)) {
                    edges.add(edge);
                    String neighbor = edge.getSourceId().equals(current)
                        ? edge.getTargetId() : edge.getSourceId();
                    if (!visited.contains(neighbor)) {
                        visited.add(neighbor);
                        queue.add(neighbor);
                    }
                }
            }
        }
        return new GraphDTO(nodes, edges);
    }

    /**
     * "做了这题还应做"推荐
     */
    public List<RecommendItem> recommendNext(String problemId) {
        // 1. 查找同模式题目（SIMILAR_PATTERN 边）
        // 2. 查找进阶题目（FOLLOW_UP / HARDER_VERSION 边）
        // 3. 查找变体题目（VARIANT 边）
        // 4. 按权重排序取 Top 5
        // 5. 附带推荐理由
    }

    /**
     * 两节点间最短路径
     */
    public List<GraphNode> shortestPath(String fromId, String toId) {
        // BFS 求最短路径，缓存到 Redis
    }
}
```


### 2. RecommendationEngine（推荐引擎）

```java
@Service
@RequiredArgsConstructor
public class RecommendationEngine {

    private final GraphService graphService;
    private final UserProgressRepository progressRepo;
    private final RedisTemplate<String, Object> redisTemplate;

    private static final String CACHE_PREFIX = "recommend:";
    private static final long CACHE_TTL_HOURS = 6;

    /**
     * 为用户生成个性化推荐
     */
    public List<RecommendItem> recommend(String userId) {
        // 1. 先查 Redis 缓存
        String cacheKey = CACHE_PREFIX + userId;
        var cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) return (List<RecommendItem>) cached;

        // 2. 获取用户已完成题目和掌握模式
        var progress = progressRepo.findByUserId(userId);
        var completedIds = extractCompletedIds(progress);
        var weakPatterns = identifyWeakPatterns(progress);

        // 3. 基于图谱拓扑推荐
        var candidates = new ArrayList<ScoredCandidate>();

        // 3.1 薄弱模式优先：推荐薄弱模式的练习题
        for (String patternId : weakPatterns) {
            var relatedProblems = graphService.getRelatedProblems(patternId);
            for (var problem : relatedProblems) {
                if (!completedIds.contains(problem.getId())) {
                    candidates.add(new ScoredCandidate(problem, 1.5, "薄弱模式训练"));
                }
            }
        }

        // 3.2 拓扑顺序：推荐已完成题目的 FOLLOW_UP
        for (String completedId : completedIds) {
            var nextItems = graphService.recommendNext(completedId);
            for (var item : nextItems) {
                if (!completedIds.contains(item.getNodeId())) {
                    candidates.add(new ScoredCandidate(item, item.getWeight(), "进阶推荐"));
                }
            }
        }

        // 4. 去重、排序、取 Top 10
        var result = dedupAndRank(candidates, 10);

        // 5. 写入缓存
        redisTemplate.opsForValue().set(cacheKey, result, CACHE_TTL_HOURS, TimeUnit.HOURS);
        return result;
    }

    /**
     * 识别薄弱模式（正确率<60%）
     */
    private List<String> identifyWeakPatterns(List<UserProgress> progress) {
        return progress.stream()
            .filter(p -> p.getPatternId() != null)
            .collect(Collectors.groupingBy(UserProgress::getPatternId))
            .entrySet().stream()
            .filter(e -> calculateAccuracy(e.getValue()) < 0.6)
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());
    }
}

@Data @Accessors(chain = true)
public class RecommendItem {
    private String nodeId;
    private NodeType nodeType;
    private String name;
    private String reason;          // 推荐理由
    private Double score;           // 推荐分数
    private String patternName;     // 所属模式
    private Integer difficulty;     // 难度
}
```

### 3. ExportService（导出服务）

```java
@Service
@RequiredArgsConstructor
public class ExportService {

    private final ExplanationRepository explanationRepo;
    private final PatternRepository patternRepo;
    private final PdfExporter pdfExporter;
    private final MarkdownExporter mdExporter;
    private final NotionExporter notionExporter;
    private final AnkiExporter ankiExporter;

    /**
     * 统一导出入口
     */
    public ExportResult export(ExportRequest request) {
        // 1. 收集待导出内容
        var contents = collectContents(request);

        // 2. 路由到对应 Exporter
        return switch (request.getFormat()) {
            case PDF -> pdfExporter.export(contents, request.getOptions());
            case MARKDOWN -> mdExporter.export(contents, request.getOptions());
            case NOTION -> notionExporter.export(contents, request.getOptions());
            case ANKI -> ankiExporter.export(contents, request.getOptions());
        };
    }

    private List<ExportableContent> collectContents(ExportRequest request) {
        return switch (request.getScope()) {
            case SINGLE_PROBLEM -> List.of(loadProblemContent(request.getProblemId()));
            case BY_PATTERN -> loadPatternContents(request.getPatternId());
            case BY_LEARNING_PATH -> loadPathContents(request.getPathId());
            case ALL -> loadAllContents();
        };
    }
}

@Data @Accessors(chain = true)
public class ExportRequest {
    private ExportFormat format;     // PDF, MARKDOWN, NOTION, ANKI
    private ExportScope scope;      // SINGLE_PROBLEM, BY_PATTERN, BY_LEARNING_PATH, ALL
    private String problemId;       // scope=SINGLE_PROBLEM 时必填
    private String patternId;       // scope=BY_PATTERN 时必填
    private String pathId;          // scope=BY_LEARNING_PATH 时必填
    private ExportOptions options;  // 可选配置
}

@Data @Accessors(chain = true)
public class ExportOptions {
    private boolean includeCode = true;
    private boolean includeDiagrams = true;
    private boolean includeApplications = false;
    private List<String> languages = List.of("python", "java");
    private Integer level = 3;      // 默认导出 L3 级别
}

@Data @Accessors(chain = true)
public class ExportResult {
    private String fileName;
    private byte[] fileData;
    private String contentType;
    private long fileSizeBytes;
}
```

### 4. D3.js 图谱可视化方案（前端）

```typescript
// components/KnowledgeGraph.tsx
interface GraphData {
  nodes: GraphNodeDTO[];
  edges: GraphEdgeDTO[];
}

interface GraphNodeDTO {
  id: string;
  type: 'PATTERN' | 'PROBLEM' | 'MATH' | 'PAPER' | 'APPLICATION';
  name: string;
  category: string;
  difficulty: number;
  metadata: Record<string, any>;
}

interface GraphEdgeDTO {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  weight: number;
  description: string;
}

// D3 Force Simulation 配置
const simulationConfig = {
  forceLink: {
    distance: (edge: GraphEdgeDTO) => 100 / edge.weight,  // 权重越大距离越近
    strength: (edge: GraphEdgeDTO) => edge.weight * 0.5
  },
  forceManyBody: {
    strength: -300,                    // 斥力
    distanceMax: 500
  },
  forceCollide: {
    radius: 30                          // 防止节点重叠
  },
  forceCenter: { x: width / 2, y: height / 2 }
};

// 节点颜色映射
const nodeColorMap: Record<string, string> = {
  PATTERN: '#4F46E5',     // 靛蓝 - 模式
  PROBLEM: '#059669',     // 翠绿 - 题目
  MATH: '#D97706',        // 琥珀 - 数学
  PAPER: '#DC2626',       // 红色 - 论文
  APPLICATION: '#7C3AED'  // 紫色 - 应用
};

// 节点大小映射（按难度和连接数）
const nodeSize = (node: GraphNodeDTO, connections: number) =>
  Math.max(8, Math.min(30, 10 + connections * 2 + node.difficulty * 2));
```

#### 图谱交互设计

| 交互行为 | 效果 |
|----------|------|
| 节点点击 | 高亮相邻节点和边，侧边栏展示详情 |
| 节点双击 | 以该节点为中心展开子图（加载更多关联） |
| 节点拖拽 | 自由拖拽定位，释放后固定位置 |
| 边 hover | tooltip 显示关系类型和描述 |
| 滚轮缩放 | 缩放画布，支持 minimap 导航 |
| 右键节点 | 上下文菜单：查看详情/标记已完成/加入学习路径 |
| 搜索框输入 | 高亮匹配节点，自动平移画布居中 |


### 5. AnkiExporter（Anki 卡片导出）

```java
@Component
public class AnkiExporter implements Exporter {

    /**
     * 生成 .apkg 文件（Anki 包格式）
     * 内部结构：SQLite 数据库 + 媒体文件
     */
    public ExportResult export(List<ExportableContent> contents, ExportOptions options) {
        var cards = new ArrayList<AnkiCard>();

        for (var content : contents) {
            // 卡片1：题目描述 → 核心思路
            cards.add(buildProblemToApproachCard(content));

            // 卡片2：模式信号 → 模式名称
            cards.add(buildSignalToPatternCard(content));

            // 卡片3：给出代码骨架 → 补全关键步骤
            cards.add(buildCodeCompletionCard(content));

            // 卡片4：复杂度选择题
            cards.add(buildComplexityQuizCard(content));
        }

        // 使用 Anki 包格式（SQLite collection.anki2 + media）
        return packageAsApkg(cards);
    }
}

@Data @Accessors(chain = true)
public class AnkiCard {
    private String front;           // 正面（问题）
    private String back;            // 反面（答案）
    private List<String> tags;      // 标签（模式名、难度等）
    private String deckName;        // 牌组名
}
```

### 6. PatternTrainingService（模式识别训练）

```java
@Service
@RequiredArgsConstructor
public class PatternTrainingService {

    private final GraphService graphService;
    private final ProblemRepository problemRepo;
    private final TrainingRecordRepository recordRepo;

    /**
     * 生成模式识别测验
     */
    public Quiz generateQuiz(String userId, int questionCount) {
        // 1. 获取用户薄弱模式（优先出题）
        var weakPatterns = getWeakPatterns(userId);

        // 2. 从薄弱模式中随机选题
        var questions = new ArrayList<QuizQuestion>();
        for (int i = 0; i < questionCount; i++) {
            var problem = pickRandomProblem(weakPatterns);
            var options = generateOptions(problem);  // 正确答案 + 3个干扰项
            questions.add(new QuizQuestion()
                .setProblemDescription(maskTags(problem.getDescription()))  // 隐藏标签
                .setOptions(options)
                .setCorrectAnswer(problem.getPatternId())
                .setExplanation(generateExplanation(problem)));
        }

        return new Quiz().setQuestions(questions);
    }

    /**
     * 提交答案并更新正确率
     */
    public QuizResult submitAnswer(String userId, String questionId, String answer) {
        // 记录结果，更新正确率统计
    }
}
```

## Data Flow

### 图谱查询数据流

```
前端请求: GET /api/graph/subgraph?nodeId=pattern:dp&depth=2
  ↓
GraphController.getSubgraph("pattern:dp", 2)
  ↓
GraphService.querySubgraph("pattern:dp", 2)
  ├── Redis 缓存检查 → 命中则直接返回
  ├── BFS 遍历 MySQL graph_node + graph_edge 表
  └── 结果写入 Redis (TTL=1h)
  ↓
返回: { nodes: [...], edges: [...] }
  ↓
前端 D3.js force simulation 渲染
```

### 推荐计算数据流

```
定时任务（每6小时）or 用户请求: GET /api/recommend/{userId}
  ↓
RecommendationEngine.recommend(userId)
  ├── Redis 缓存检查
  ├── UserProgressRepository → 用户完成历史
  ├── 识别薄弱模式（正确率<60%）
  ├── GraphService.recommendNext() → 图谱拓扑推荐
  ├── 合并、去重、评分排序
  └── 结果写入 Redis (TTL=6h)
  ↓
返回: List<RecommendItem> (Top 10 推荐)
```

### 导出数据流

```
前端请求: POST /api/export { format: "ANKI", scope: "BY_PATTERN", patternId: "dp" }
  ↓
ExportController.export(request)
  ↓
ExportService.export(request)
  ├── collectContents() → 收集该模式所有题目的解析内容
  ├── ankiExporter.export(contents) → 生成 AnkiCard 列表
  └── packageAsApkg() → 打包为 .apkg 文件
  ↓
返回: ExportResult { fileName: "dp-cards.apkg", fileData: byte[], contentType: "application/octet-stream" }
```

## API Extensions

在前四个 Spec 的 REST API 基础上新增：

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/graph/subgraph` | GET | 查询子图（参数：nodeId, depth） |
| `/api/v1/graph/shortest-path` | GET | 两节点间最短路径 |
| `/api/v1/graph/nodes` | POST | 批量创建图谱节点 |
| `/api/v1/graph/edges` | POST | 批量创建图谱边 |
| `/api/v1/graph/import` | POST | JSON 批量导入图谱数据 |
| `/api/v1/graph/export` | GET | JSON 导出完整图谱 |
| `/api/v1/recommend/{userId}` | GET | 获取个性化推荐 |
| `/api/v1/recommend/{userId}/weak-patterns` | GET | 获取薄弱模式列表 |
| `/api/v1/training/quiz` | POST | 生成模式识别测验 |
| `/api/v1/training/submit` | POST | 提交测验答案 |
| `/api/v1/training/stats/{userId}` | GET | 获取训练统计 |
| `/api/v1/mapping/resolve` | GET | 解析平台映射 |
| `/api/v1/mapping/import` | POST | CSV 批量导入映射 |
| `/api/v1/mapping/problem/{id}/links` | GET | 获取题目各平台链接 |
| `/api/v1/export` | POST | 触发导出任务 |
| `/api/v1/export/{taskId}/download` | GET | 下载导出文件 |
| `/api/v1/archaeology/{algorithmId}` | GET | 获取算法故事 |
| `/api/v1/paper-bridge/{domain}` | GET | 获取某领域论文桥梁列表 |
| `/api/v1/paper-bridge/{id}` | GET | 获取论文桥梁详情 |
| `/api/v1/math-relation/{patternId}` | GET | 获取算法-数学关联 |
| `/api/v1/learning-path` | GET | 获取学习路径列表 |
| `/api/v1/learning-path/{id}` | GET | 获取学习路径详情 |
| `/api/v1/learning-path/{id}/progress/{userId}` | GET | 获取用户在路径上的进度 |
| `/api/v1/patterns/{id}/applications` | GET | 获取模式的实际应用映射（四维：工业/AI/工作/人生） |
| `/api/v1/patterns/{id}/applications/{domain}` | GET | 获取模式某维度的详细案例（含迷你案例代码） |
| `/api/v1/patterns/{id}/cross-domain-table` | GET | 获取模式跨域迁移映射表（四列表格） |
| `/api/v1/users/me/activity-heatmap` | GET | 获取学习日历热力图数据（参数：days=90） |
| `/api/v1/users/me/streak` | GET | 获取连续学习天数和历史最长记录 |

## Configuration

```yaml
# application.yml 新增配置
graph:
  cache:
    subgraph-ttl-minutes: 60        # 子图缓存 TTL
    recommend-ttl-hours: 6          # 推荐缓存 TTL
    path-ttl-minutes: 30            # 路径缓存 TTL
  query:
    max-depth: 5                    # 子图查询最大深度
    max-nodes: 200                  # 单次查询最大返回节点数

recommend:
  weak-pattern-threshold: 0.6       # 薄弱模式阈值（正确率<60%）
  top-k: 10                         # 推荐条目数
  refresh-cron: "0 0 */6 * * *"     # 推荐缓存刷新频率

export:
  pdf:
    template-dir: classpath:export/pdf/
    font-dir: classpath:fonts/
    max-pages: 500
  anki:
    deck-prefix: "ADUE-"
    card-types: ["problem-approach", "signal-pattern", "code-completion", "complexity-quiz"]
  temp-dir: /tmp/adue-export/
  max-file-size-mb: 100

mapping:
  platforms: ["LEETCODE", "NOWCODER", "HACKERRANK", "CODEFORCES", "LUOGU", "ATCODER"]
  auto-match-threshold: 0.85        # 自动匹配置信度阈值

training:
  quiz-size: 10                     # 默认测验题数
  options-count: 4                  # 选项数（1正确+3干扰）
```

## Error Handling

| 错误场景 | 处理策略 | 用户可见行为 |
|----------|----------|-------------|
| 图谱节点不存在 | 抛出 ResourceNotFoundException | 返回 404 + "节点不存在" |
| 子图查询超时（>500ms） | 缩减 depth 重试 | 返回部分结果 + 提示"数据量大，已截断" |
| 推荐缓存失效且计算超时 | 返回基于规则的默认推荐 | 降级为热门题推荐 |
| 导出文件超过大小限制 | 拒绝导出 | 返回 400 + "内容过多，请缩小导出范围" |
| CSV 导入格式错误 | 逐行校验，跳过错误行 | 返回 200 + 导入报告（成功/失败/跳过数） |
| Anki 包生成失败 | 记录错误日志，返回 500 | 提示"导出失败，请稍后重试" |
| 多平台映射冲突 | 标记为 PENDING 状态 | 提示用户人工确认 |

## Testing Strategy

### 单元测试
- GraphService：querySubgraph BFS 扩展正确性、recommendNext 排除已完成题目、shortestPath 正确性
- RecommendationEngine：薄弱模式识别、推荐去重、缓存命中逻辑
- ExportService：各 Exporter 输出格式校验（MD 含 TOC、PDF 含目录页、Anki 卡片非空）
- MappingService：唯一约束、CSV 解析容错、模糊匹配阈值
- PatternTrainingService：选项生成（1正确+3干扰）、正确率计算

### 集成测试
- GraphController：导入 JSON → 查询子图 → 验证返回节点/边数
- 推荐流程：创建用户进度 → 调用推荐 → 验证不含已完成题
- 导出流程：ExportController 触发导出 → 下载文件 → 验证文件格式
- 映射流程：CSV 导入 → 查询映射 → 验证关联

### Mock 策略
- 数据库使用 H2 内存数据库
- Redis 使用 Embedded Redis 或 Mock
- 文件导出使用临时目录

## Correctness Properties

### Property 1: 图谱引用完整性
对于 graph_edge 表中的每条边，其 sourceId 和 targetId 必须在 graph_node 表中存在。删除节点时必须先删除或级联删除关联边。

**Validates: Requirements 10.1**

### Property 2: 推荐不重复
推荐引擎返回的推荐列表中，不包含用户已完成（status=COMPLETED 或 MASTERED）的题目。

**Validates: Requirements 7.1**

### Property 3: 导出格式完整性
PDF 导出结果必须包含目录页；Anki 导出的每张卡片必须同时有 front 和 back 内容且非空。

**Validates: Requirements 9.3, 9.4**

### Property 4: 映射唯一性
同一平台同一 platformId 最多映射到一个 unifiedProblemId（唯一约束）。

**Validates: Requirements 8.1**

### Property 5: 学习路径单调性
用户在某学习路径上的进度只增不减，已完成的里程碑不会回退。

**Validates: Requirements 7.2, 7.4**

## Scope

### 包含
- 知识图谱数据模型（节点、边、权重）和 MySQL 存储
- D3.js force-directed 可视化（含交互：拖拽、缩放、点击、搜索）
- 推荐引擎（基于图谱拓扑 + 用户进度）
- 模式识别训练系统
- 多平台 ID 映射与 CSV 导入
- 离线导出（PDF/Markdown/Notion/Anki）
- 算法考古内容模型和 API
- 论文桥梁路径模型和 API
- 数学关联层模型和 API
- 学习路径与进度追踪

### 不包含
- AI 实时生成考古故事/论文解读（使用预生成内容，后续按需触发 AI 生成）
- 社区协作功能
- 间隔重复调度引擎（独立 Spec 实现）
- 面试模拟模式
- 移动端适配
- 实际爬取各平台做题记录（仅支持 CSV 手动导入）
