# Technical Design: 数据采集与内容管理

## Overview

本设计文档定义"算法深度理解引擎"项目数据采集与内容管理层的技术实现方案。系统采用微服务架构，拆分为 algorithm-core（核心业务）和 algorithm-crawler（数据采集）两个 Java 服务 + algorithm-ai（Python AI）服务，通过 Dubbo RPC + Redis Stream 异步事件通信。

核心设计决策：
- **适配器模式**：PlatformAdapter 接口实现多平台可插拔采集，新平台零侵入接入
- **DDD 四层架构**：domain/application/infrastructure/interfaces 严格分层
- **配置驱动**：所有平台参数通过 Nacos 动态管理，运行时热更新
- **反爬弹性**：Resilience4j 全套（限流/熔断/重试/隔离舱），每平台独立策略
- **三区内容模型**：官方解析 + 用户题解 + 评论，清晰分离
- **异步解耦**：采集→标准化→AI加工 通过 Redis Stream 事件驱动，各阶段独立容错

### Spec 间依赖关系

```
Spec 1: algorithm-engine-infrastructure（基础设施）
  └→ Spec 2: content-generation-engine（内容生成）
       └→ Spec 6: data-acquisition-management（本 Spec，数据采集与内容管理）
            └→ Spec 3: web-presentation-layer（展示层）
```

## Architecture

### 系统架构总览

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Client (Browser)                              │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │ HTTP
┌────────────────────────────────▼─────────────────────────────────────┐
│                    Spring Cloud Gateway                                │
│              路由 / JWT 鉴权 / 限流 / CORS                            │
└───────────┬────────────────────────────────────────────┬─────────────┘
            │ HTTP                                       │ HTTP
┌───────────▼───────────────┐          ┌─────────────────▼─────────────┐
│    algorithm-core          │          │    algorithm-crawler           │
│    (核心业务服务)          │◄─Dubbo──►│    (数据采集服务)             │
│                            │          │                               │
│ ┌────────────────────────┐│          │ ┌───────────────────────────┐ │
│ │ 题目 CRUD              ││          │ │ CrawlerScheduler          │ │
│ │ 用户题解 CRUD          ││          │ │ (XXL-JOB Executor)        │ │
│ │ 评论系统               ││          │ └─────────────┬─────────────┘ │
│ │ 内容审核               ││          │               ↓               │
│ │ 搜索                   ││          │ ┌───────────────────────────┐ │
│ │ 采集任务管理 API       ││          │ │ PlatformAdapter Layer     │ │
│ │ 映射管理               ││          │ │ ┌───┐┌───┐┌───┐┌───┐    │ │
│ │ 点赞/排序              ││          │ │ │LC ││CF ││NC ││AT │... │ │
│ └────────────────────────┘│          │ │ └───┘└───┘└───┘└───┘    │ │
│                            │          │ └─────────────┬─────────────┘ │
│ ┌────────────────────────┐│          │               ↓               │
│ │ Redis Stream Consumer  ││          │ ┌───────────────────────────┐ │
│ │ (事件消费)             ││          │ │ AntiCrawlManager          │ │
│ └────────────────────────┘│          │ │ (限流/UA/Cookie/熔断)     │ │
└───────────┬───────────────┘          │ └─────────────┬─────────────┘ │
            │                          │               ↓               │
            │                          │ ┌───────────────────────────┐ │
            │                          │ │ DataStandardizer          │ │
            │                          │ │ (格式转换/图片下载/去重)  │ │
            │                          │ └─────────────┬─────────────┘ │
            │                          │               ↓               │
            │                          │ ┌───────────────────────────┐ │
            │                          │ │ Redis Stream Producer     │ │
            │                          │ │ (发布采集完成事件)        │ │
            │                          │ └───────────────────────────┘ │
            │                          └───────────────┬───────────────┘
            │                                          │
            │         ┌────────────────────────────────┘
            ↓         ↓
┌───────────────────────────┐     ┌─────────────────────────────┐
│        MySQL 8.0          │     │        Redis 7              │
│  (Core DB + Crawler DB)   │     │  (缓存/锁/队列/Stream)     │
└───────────────────────────┘     └─────────────────────────────┘
            │                                    │
┌───────────▼───────────────┐     ┌──────────────▼──────────────┐
│        MinIO              │     │     algorithm-ai (Python)    │
│  (图片/文件存储)          │     │  FastAPI + Ollama + 云端 AI  │
└───────────────────────────┘     └─────────────────────────────┘
```

### 微服务职责边界

| 服务 | 职责 | 技术栈 |
|------|------|--------|
| algorithm-gateway | 路由、鉴权、限流、CORS | Spring Cloud Gateway |
| algorithm-core | 题目CRUD、题解、评论、审核、搜索、管理API | Spring Boot 3 + MyBatis-Plus + Dubbo |
| algorithm-crawler | 多平台采集、反爬、标准化、文件存储、XXL-JOB | Spring Boot 3 + OkHttp + Jsoup + Dubbo |
| algorithm-ai | AI加工、多模态识别、内容精炼 | Python FastAPI + Ollama |


### Maven 多模块结构

```
algorithm-help/
├── pom.xml (parent)
├── algorithm-help-api/                 # Dubbo 接口定义模块（各服务共享）
│   └── src/main/java/com/algorithmhelp/api/
│       ├── crawler/CrawlerFacade.java
│       ├── problem/ProblemFacade.java
│       ├── ai/AiProcessFacade.java
│       └── dto/                        # 跨服务传输 DTO
├── algorithm-help-common/              # 公共模块
│   └── src/main/java/com/algorithmhelp/common/
│       ├── enums/
│       ├── exception/
│       ├── result/ApiResponse.java
│       └── util/
├── algorithm-help-gateway/             # Gateway 服务
├── algorithm-help-core/                # 核心业务服务
└── algorithm-help-crawler/             # 数据采集服务
```

### algorithm-crawler DDD 包结构

```
com.algorithmhelp.crawler/
├── CrawlerApplication.java
├── domain/
│   ├── crawler/
│   │   ├── model/
│   │   │   ├── CrawlTask.java              # 聚合根
│   │   │   ├── CrawlTaskStatus.java        # PENDING/RUNNING/COMPLETED/FAILED
│   │   │   ├── CrawlTaskType.java          # PROBLEM_SYNC/SOLUTION_SYNC/SINGLE_FETCH
│   │   │   ├── TriggerType.java            # CRON/MANUAL
│   │   │   └── Platform.java               # 平台枚举
│   │   ├── adapter/
│   │   │   └── PlatformAdapter.java        # 适配器接口（领域层定义）
│   │   ├── service/
│   │   │   ├── CrawlOrchestrator.java      # 采集编排领域服务
│   │   │   └── DeduplicationService.java   # 去重领域服务
│   │   └── repository/
│   │       ├── CrawlTaskRepository.java
│   │       └── RawSourceRepository.java
│   └── standardize/
│       ├── model/
│       │   ├── RawSource.java               # 聚合根
│       │   ├── ProcessStatus.java           # PENDING/PROCESSED/FAILED
│       │   └── NormalizedContent.java       # 值对象
│       └── service/
│           └── DataStandardizer.java        # 标准化领域服务
```

```
├── application/
│   ├── CrawlCommandService.java         # 触发采集用例
│   ├── CrawlProgressService.java        # 进度查询用例
│   ├── StandardizeUseCase.java          # 标准化编排用例
│   └── dto/
│       ├── CrawlTriggerRequest.java
│       └── CrawlTaskDTO.java
├── infrastructure/
│   ├── adapter/                          # PlatformAdapter 具体实现
│   │   ├── LeetCodeGlobalAdapter.java
│   │   ├── LeetCodeCnAdapter.java
│   │   ├── CodeforcesAdapter.java
│   │   ├── NowCoderAdapter.java
│   │   ├── AtCoderAdapter.java
│   │   ├── LuoguAdapter.java
│   │   └── GenericUrlAdapter.java
│   ├── anticrawl/
│   │   ├── AntiCrawlManager.java        # 反爬总管理器
│   │   ├── CookieStoreRedis.java        # Cookie Redis 持久化
│   │   ├── UserAgentRotator.java        # UA 轮转
│   │   └── ProxyProvider.java           # 代理池接口（预留）
│   ├── persistence/
│   │   ├── MybatisCrawlTaskRepository.java
│   │   └── MybatisRawSourceRepository.java
│   ├── storage/
│   │   └── MinioFileStorage.java        # MinIO 存储实现
│   ├── event/
│   │   └── RedisStreamEventPublisher.java
│   ├── config/
│   │   ├── CrawlerPlatformConfig.java   # @ConfigurationProperties
│   │   ├── Resilience4jConfig.java
│   │   ├── MinioConfig.java
│   │   └── XxlJobConfig.java
│   └── job/
│       ├── ProblemSyncJobHandler.java    # XXL-JOB 题目同步
│       ├── SolutionSyncJobHandler.java   # XXL-JOB 题解同步
│       └── RetryFailedJobHandler.java    # XXL-JOB 失败重试
└── interfaces/
    ├── rest/
    │   └── CrawlerInternalController.java  # 内部调试 API
    └── dubbo/
        └── CrawlerFacadeImpl.java        # Dubbo 接口实现
```

### algorithm-core 新增包结构（本 Spec 扩展）

```
com.algorithmhelp.core/
├── domain/
│   ├── solution/
│   │   ├── model/
│   │   │   ├── UserSolution.java         # 聚合根
│   │   │   ├── SolutionStatus.java       # DRAFT/PUBLISHED/FEATURED/HIDDEN
│   │   │   └── SourceType.java           # USER_INPUT/URL_IMPORT/FEYNMAN_OUTPUT/CRAWLED
│   │   ├── service/
│   │   │   ├── SolutionDomainService.java  # 提升/精选/AI处理
│   │   │   └── UpvoteService.java          # 点赞领域逻辑
│   │   └── repository/
│   │       └── UserSolutionRepository.java
│   ├── comment/
│   │   ├── model/
│   │   │   ├── Comment.java              # 聚合根
│   │   │   ├── CommentType.java          # NORMAL/CORRECTION/SUPPLEMENT/QUESTION
│   │   │   └── TargetType.java           # EXPLANATION/USER_SOLUTION
│   │   └── repository/
│   │       └── CommentRepository.java
│   ├── mapping/
│   │   ├── model/
│   │   │   └── PlatformMapping.java      # 聚合根
│   │   └── repository/
│   │       └── PlatformMappingRepository.java
│   └── review/
│       └── service/
│           └── ContentReviewService.java  # 审核领域服务
├── application/
│   ├── solution/
│   │   ├── SubmitSolutionUseCase.java
│   │   ├── ImportUrlUseCase.java
│   │   ├── FeynmanConvertUseCase.java
│   │   └── PromoteSolutionUseCase.java
│   ├── comment/
│   │   ├── PostCommentUseCase.java
│   │   └── ExpandCommentUseCase.java
│   ├── admin/
│   │   ├── ProblemAdminUseCase.java
│   │   ├── CrawlerManageUseCase.java
│   │   ├── MappingManageUseCase.java
│   │   └── ReviewQueueUseCase.java
│   └── search/
│       └── UnifiedSearchUseCase.java
└── interfaces/
    └── rest/
        ├── UserSolutionController.java
        ├── CommentController.java
        ├── AdminProblemController.java
        ├── AdminCrawlerController.java
        ├── AdminMappingController.java
        ├── AdminReviewController.java
        └── SearchController.java
```

## Components and Interfaces

### Component 1: PlatformAdapter 接口与实现

**Requirement coverage:** R1, R37, R38, R39

```java
/**
 * 平台适配器接口 —— 领域层定义，infrastructure 层实现
 */
public interface PlatformAdapter {

    Platform getPlatform();

    Set<PlatformCapability> getCapabilities();

    /** 采集题目列表（增量：传入 lastFetchTime） */
    List<RawProblemData> fetchProblemList(FetchOptions options);

    /** 采集单题详情 */
    RawProblemData fetchProblemDetail(String platformProblemId);

    /** 采集题解列表（高赞前N条） */
    List<RawSolutionData> fetchSolutions(String platformProblemId, int topN);

    /** 采集官方 Editorial */
    Optional<RawEditorialData> fetchEditorial(String platformProblemId);

    /** 采集评论 */
    List<RawCommentData> fetchComments(String solutionId, int minUpvotes);
}

public enum Platform {
    LEETCODE_GLOBAL, LEETCODE_CN, CODEFORCES, NOWCODER, ATCODER, LUOGU
}

public enum PlatformCapability {
    PROBLEM_FETCH, SOLUTION_FETCH, EDITORIAL_FETCH, COMMENT_FETCH,
    COMPANY_TAGS, FREQUENCY_DATA, DIFFICULTY_RATING, CONTEST_PROBLEMS
}
```

**LeetCode GraphQL 适配器示例：**

```java
@Component
@RequiredArgsConstructor
public class LeetCodeGlobalAdapter implements PlatformAdapter {

    private final OkHttpClient httpClient;
    private final AntiCrawlManager antiCrawl;
    private final CrawlerPlatformConfig.PlatformProperties config;

    @Override
    public Platform getPlatform() { return Platform.LEETCODE_GLOBAL; }

    @Override
    public Set<PlatformCapability> getCapabilities() {
        return Set.of(PROBLEM_FETCH, SOLUTION_FETCH, EDITORIAL_FETCH,
                      COMMENT_FETCH, COMPANY_TAGS, FREQUENCY_DATA);
    }

    @Override
    public List<RawProblemData> fetchProblemList(FetchOptions options) {
        // 1. 反爬检查（限流 + UA + Cookie）
        antiCrawl.acquirePermit(getPlatform());
        // 2. 构建 GraphQL query
        var query = buildProblemListQuery(options.getOffset(), options.getLimit());
        // 3. 发送请求
        var response = executeGraphQL(config.getGraphqlUrl(), query);
        // 4. 解析响应
        return parseProblemList(response);
    }
}
```

### Component 2: AntiCrawlManager 反爬管理器

**Requirement coverage:** R3, R28

```java
@Component
@RequiredArgsConstructor
public class AntiCrawlManager {

    private final Map<Platform, RateLimiter> rateLimiters;           // Resilience4j
    private final Map<Platform, CircuitBreaker> circuitBreakers;     // Resilience4j
    private final UserAgentRotator uaRotator;
    private final CookieStoreRedis cookieStore;
    private final CrawlerPlatformConfig config;

    /** 获取采集许可（限流 + 熔断检查） */
    public void acquirePermit(Platform platform) {
        var cb = circuitBreakers.get(platform);
        if (cb.getState() == CircuitBreaker.State.OPEN) {
            throw new PlatformUnavailableException(platform + " 已熔断");
        }
        rateLimiters.get(platform).acquirePermission();
        randomDelay(config.getPlatform(platform).getRequestDelayMs());
    }

    /** 构建带反爬策略的 Request */
    public Request.Builder buildRequest(Platform platform, String url) {
        return new Request.Builder()
            .url(url)
            .header("User-Agent", uaRotator.next())
            .header("Cookie", cookieStore.get(platform));
    }

    /** 记录请求结果（成功/失败，用于熔断判断） */
    public void recordResult(Platform platform, boolean success) {
        if (success) circuitBreakers.get(platform).onSuccess();
        else circuitBreakers.get(platform).onError(0, TimeUnit.MILLISECONDS, new RuntimeException());
    }

    private void randomDelay(String delayRange) {
        // 解析 "1000-3000" → 在范围内随机 sleep
        var parts = delayRange.split("-");
        var min = Long.parseLong(parts[0]);
        var max = Long.parseLong(parts[1]);
        ThreadUtil.sleep(RandomUtil.randomLong(min, max));
    }
}
```

### Component 3: CrawlOrchestrator 采集编排

**Requirement coverage:** R2, R5, R6, R36

```java
@Service
@RequiredArgsConstructor
public class CrawlOrchestrator {

    private final List<PlatformAdapter> adapters;  // Spring 自动注入所有实现
    private final DeduplicationService dedup;
    private final DataStandardizer standardizer;
    private final CrawlTaskRepository taskRepo;
    private final RedisStreamEventPublisher eventPublisher;

    /**
     * 执行采集任务（由 XXL-JOB 或管理员 API 触发）
     */
    public void executeCrawl(CrawlTask task) {
        task.start();
        taskRepo.save(task);

        var adapter = findAdapter(task.getPlatform());
        var options = FetchOptions.incremental(task.getLastFetchTime());

        try {
            var rawProblems = adapter.fetchProblemList(options);
            for (var raw : rawProblems) {
                try {
                    processOneProblem(raw, adapter, task);
                    task.incrementCompleted();
                } catch (Exception e) {
                    task.incrementFailed(raw.getPlatformId(), e.getMessage());
                    log.warn("采集失败 [{}/{}]: {}", task.getPlatform(), raw.getPlatformId(), e.getMessage());
                }
                taskRepo.updateProgress(task);
            }
            task.complete();
        } catch (PlatformUnavailableException e) {
            task.fail(e.getMessage());
        }
        taskRepo.save(task);
        eventPublisher.publishTaskStatusChanged(task);
    }

    private void processOneProblem(RawProblemData raw, PlatformAdapter adapter, CrawlTask task) {
        // 1. 去重检测
        var deduResult = dedup.check(raw, task.getPlatform());
        // 2. 标准化
        var normalized = standardizer.standardize(raw, task.getPlatform());
        // 3. 保存原始数据
        standardizer.saveRawSource(raw, task.getPlatform());
        // 4. 发布标准化完成事件（触发 AI 加工）
        eventPublisher.publishContentStandardized(normalized, deduResult);
    }
}
```

### Component 4: DataStandardizer 数据标准化

**Requirement coverage:** R4, R7, R36

```java
@Service
@RequiredArgsConstructor
public class DataStandardizer {

    private final MinioFileStorage fileStorage;
    private final TagMappingConfig tagMapping;
    private final RawSourceRepository rawSourceRepo;

    /**
     * 将平台原始数据标准化为内部 Problem 模型
     */
    public NormalizedContent standardize(RawProblemData raw, Platform platform) {
        // 1. 完整性校验
        validateCompleteness(raw);
        // 2. HTML → Markdown 转换
        var markdown = convertHtmlToMarkdown(raw.getDescriptionHtml());
        // 3. 图片下载到 MinIO 并替换 URL
        markdown = downloadAndReplaceImages(markdown, platform);
        // 4. 难度映射
        var difficulty = mapDifficulty(raw.getRawDifficulty(), platform);
        // 5. 标签映射
        var tags = mapTags(raw.getRawTags(), platform);
        // 6. 组装标准化结果
        return NormalizedContent.builder()
            .title(raw.getTitle())
            .description(markdown)
            .difficulty(difficulty)
            .tags(tags)
            .constraints(raw.getConstraints())
            .examples(raw.getExamples())
            .platformMapping(buildMapping(raw, platform))
            .build();
    }

    private String convertHtmlToMarkdown(String html) {
        // Jsoup 清洗 → Readability4J 提取正文 → flexmark-java 转 Markdown
        var doc = Jsoup.parse(html);
        doc.select("script, style, nav").remove();
        return FlexmarkHtmlConverter.builder().build().convert(doc.body().html());
    }

    private String downloadAndReplaceImages(String markdown, Platform platform) {
        // 正则匹配 ![alt](url) → 下载图片到 MinIO → 替换为内部 URL
        return ImageUrlReplacer.replace(markdown, url -> {
            try {
                return fileStorage.downloadAndStore(url, "crawler-assets");
            } catch (Exception e) {
                log.warn("图片下载失败: {}", url);
                return url; // 保留原始外部 URL
            }
        });
    }
}
```

### Component 5: Dubbo 接口定义

**Requirement coverage:** R25

```java
// algorithm-help-api 模块中定义

/** Core → Crawler：触发采集 */
public interface CrawlerFacade {
    CrawlTaskDTO triggerCrawl(CrawlTriggerRequest request);
    CrawlTaskDTO getTaskProgress(Long taskId);
    void cancelTask(Long taskId);
}

/** Crawler → Core：写入题目/题解数据 */
public interface ProblemFacade {
    Long saveProblem(ProblemSaveDTO dto);
    void updateProblem(Long id, ProblemUpdateDTO dto);
    Long checkDuplicate(String title, String platform, String platformId);
    void savePlatformMapping(PlatformMappingDTO dto);
}

/** Crawler/Core → AI：触发 AI 加工 */
public interface AiProcessFacade {
    AiProcessResult enrichContent(ContentEnrichRequest request);
    AiProcessResult detectErrors(ErrorDetectRequest request);
    AiProcessResult describeImage(ImageDescribeRequest request);
    AiProcessResult aggregateSolutions(AggregateRequest request);
    AiProcessResult structurizeUserInput(StructurizeRequest request);
}
```

**Dubbo 配置（application.yml）：**

```yaml
dubbo:
  application:
    name: algorithm-crawler
  registry:
    address: nacos://${NACOS_HOST:localhost}:8848
  protocol:
    name: dubbo
    port: 20880
    serialization: hessian2
  consumer:
    timeout: 5000        # 默认 5s
    retries: 0           # 不自动重试（由业务层控制）
  provider:
    timeout: 5000
```

### Component 6: Redis Stream 异步事件

**Requirement coverage:** R26

```java
@Component
@RequiredArgsConstructor
public class RedisStreamEventPublisher {

    private final StringRedisTemplate redis;
    private static final String CRAWL_EVENTS = "stream:crawl-events";
    private static final String CONTENT_EVENTS = "stream:content-events";

    public void publishTaskStatusChanged(CrawlTask task) {
        var msg = Map.of(
            "eventType", "TASK_STATUS_CHANGED",
            "taskId", String.valueOf(task.getId()),
            "platform", task.getPlatform().name(),
            "status", task.getStatus().name(),
            "timestamp", String.valueOf(System.currentTimeMillis()),
            "traceId", MDC.get("traceId")
        );
        redis.opsForStream().add(CRAWL_EVENTS, msg);
    }

    public void publishContentStandardized(NormalizedContent content, DeduResult dedup) {
        var msg = Map.of(
            "eventType", "CONTENT_STANDARDIZED",
            "contentType", content.getType().name(),
            "contentId", String.valueOf(content.getId()),
            "action", "STANDARDIZED",
            "needsAiEnrich", String.valueOf(dedup.isNewContent()),
            "timestamp", String.valueOf(System.currentTimeMillis()),
            "traceId", MDC.get("traceId")
        );
        redis.opsForStream().add(CONTENT_EVENTS, msg);
    }
}
```

**Core 端 Consumer Group 消费：**

```java
@Component
@RequiredArgsConstructor
public class ContentEventConsumer implements StreamListener<String, MapRecord<String, String, String>> {

    private final AiProcessFacade aiFacade;  // Dubbo 引用

    @Override
    public void onMessage(MapRecord<String, String, String> message) {
        var payload = message.getValue();
        if ("CONTENT_STANDARDIZED".equals(payload.get("eventType"))
            && "true".equals(payload.get("needsAiEnrich"))) {
            // 触发 AI 加工（走 batch 池限流）
            aiFacade.enrichContent(new ContentEnrichRequest(
                Long.parseLong(payload.get("contentId")),
                payload.get("contentType")
            ));
        }
    }
}
```

## Data Models

### 数据库表设计（MySQL 8.0）

**user_solution 表：**

```sql
CREATE TABLE user_solution (
    id BIGINT PRIMARY KEY COMMENT '雪花ID',
    problem_id BIGINT NOT NULL COMMENT '关联题目ID',
    user_id BIGINT NOT NULL COMMENT '作者用户ID',
    title VARCHAR(200) NOT NULL COMMENT '题解标题',
    content JSON COMMENT 'AI结构化后的内容',
    raw_content TEXT COMMENT '用户原始输入',
    source_type VARCHAR(20) NOT NULL COMMENT 'USER_INPUT/URL_IMPORT/FEYNMAN_OUTPUT/CRAWLED',
    source_url VARCHAR(500) COMMENT '来源URL',
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT/PUBLISHED/FEATURED/HIDDEN',
    upvotes INT NOT NULL DEFAULT 0 COMMENT '点赞数',
    featured TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否精选',
    deleted TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否删除',
    created_at BIGINT NOT NULL COMMENT 'UTC毫秒',
    updated_at BIGINT NOT NULL COMMENT 'UTC毫秒',
    INDEX idx_solution_problem_id (problem_id),
    INDEX idx_solution_user_id (user_id),
    INDEX idx_solution_status (status),
    FULLTEXT INDEX ft_solution_content (title, raw_content) WITH PARSER ngram
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**comment 表：**

```sql
CREATE TABLE comment (
    id BIGINT PRIMARY KEY COMMENT '雪花ID',
    user_id BIGINT NOT NULL,
    target_type VARCHAR(20) NOT NULL COMMENT 'EXPLANATION/USER_SOLUTION',
    target_id BIGINT NOT NULL COMMENT '关联目标ID',
    content TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'NORMAL' COMMENT 'NORMAL/CORRECTION/SUPPLEMENT/QUESTION',
    upvotes INT NOT NULL DEFAULT 0,
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    INDEX idx_comment_target (target_type, target_id),
    INDEX idx_comment_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**raw_source 表：**

```sql
CREATE TABLE raw_source (
    id BIGINT PRIMARY KEY COMMENT '雪花ID',
    platform VARCHAR(20) NOT NULL COMMENT '来源平台',
    platform_id VARCHAR(100) NOT NULL COMMENT '平台原始ID',
    content_type VARCHAR(20) NOT NULL COMMENT 'PROBLEM/SOLUTION/EDITORIAL/COMMENT',
    raw_json TEXT NOT NULL COMMENT '原始JSON数据',
    process_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/PROCESSED/FAILED',
    error_message TEXT COMMENT '处理失败原因',
    fetched_at BIGINT NOT NULL,
    processed_at BIGINT,
    INDEX idx_rawsource_platform_id (platform, platform_id),
    INDEX idx_rawsource_status (process_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**crawl_task 表：**

```sql
CREATE TABLE crawl_task (
    id BIGINT PRIMARY KEY COMMENT '雪花ID',
    platform VARCHAR(20) NOT NULL,
    task_type VARCHAR(30) NOT NULL COMMENT 'PROBLEM_SYNC/SOLUTION_SYNC/SINGLE_FETCH',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/RUNNING/COMPLETED/FAILED',
    progress JSON COMMENT '{"total":100,"completed":50,"failed":2,"currentItem":"two-sum"}',
    trigger_type VARCHAR(10) NOT NULL COMMENT 'CRON/MANUAL',
    error_message TEXT,
    created_at BIGINT NOT NULL,
    completed_at BIGINT,
    INDEX idx_crawltask_platform_status (platform, status),
    INDEX idx_crawltask_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**platform_mapping 表：**

```sql
CREATE TABLE platform_mapping (
    id BIGINT PRIMARY KEY COMMENT '雪花ID',
    unified_problem_id BIGINT NOT NULL COMMENT '内部统一题目ID',
    platform VARCHAR(20) NOT NULL,
    platform_problem_id VARCHAR(100) NOT NULL COMMENT '平台原始题号',
    platform_url VARCHAR(500) COMMENT '平台链接',
    confidence FLOAT NOT NULL DEFAULT 1.0 COMMENT '映射置信度 0-1',
    confirmed TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否人工确认',
    created_at BIGINT NOT NULL,
    UNIQUE INDEX uk_mapping_platform_problemid (platform, platform_problem_id),
    INDEX idx_mapping_unified (unified_problem_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## Data Flow

### 采集→标准化→AI加工 全流程

```
XXL-JOB Cron 触发 / 管理员 API 触发
    ↓
CrawlOrchestrator.executeCrawl(task)
    ↓
PlatformAdapter.fetchProblemList()
    ├── AntiCrawlManager.acquirePermit() → 限流/UA/Cookie
    ├── OkHttp 请求目标平台
    └── 解析响应 → List<RawProblemData>
    ↓
每条 RawProblemData:
    ├── DeduplicationService.check() → 去重检测
    │   ├── 精确匹配: platform+platformId → UPDATE
    │   ├── 模糊匹配 ≥0.8: AUTO_MAP + confirmed=true
    │   ├── 模糊匹配 0.5-0.8: AUTO_MAP + confirmed=false
    │   └── 不匹配: CREATE_NEW
    ├── DataStandardizer.standardize()
    │   ├── HTML → Markdown
    │   ├── 图片下载 → MinIO
    │   ├── 难度映射 → EASY/MEDIUM/HARD
    │   └── 标签映射 → 内部标签体系
    ├── RawSourceRepository.save() → 保存原始数据
    └── RedisStreamEventPublisher.publishContentStandardized()
    ↓
Redis Stream: stream:content-events
    ↓
ContentEventConsumer (Core_Service) 消费
    ↓
AiProcessFacade.enrichContent() [Dubbo → algorithm-ai]
    ├── SmartRouter 路由 (batch 池, 10次/分钟)
    ├── 多源聚合精炼
    ├── 错误检测
    └── 结构化格式化
    ↓
结果写入 Explanation 表 (status=PENDING_REVIEW 或 PUBLISHED)
```

### 用户提交题解流程

```
用户 POST /api/v1/problems/{id}/solutions
    ↓
Gateway 鉴权 → Core_Service
    ↓
SubmitSolutionUseCase:
    ├── sourceType=USER_INPUT:
    │   └── Dubbo → AiProcessFacade.structurizeUserInput(rawContent)
    │       → AI 结构化处理 → 存入 content 字段
    ├── sourceType=URL_IMPORT:
    │   ├── SSRF 检查
    │   ├── OkHttp 抓取 → Jsoup 提取正文
    │   └── Dubbo → AiProcessFacade.enrichContent()
    │       → AI 精炼 → 存入 content 字段
    └── sourceType=FEYNMAN_OUTPUT:
        └── 从 InteractiveSession 读取总结 → AI 结构化
    ↓
UserSolution 持久化 (status=PUBLISHED)
    ↓
异步: AI 预审（检查违规/逻辑错误）
```

## Configuration

### Nacos 动态配置（crawler 服务）

```yaml
# dataId: algorithm-crawler.yml, group: DEFAULT_GROUP
crawler:
  platforms:
    leetcode-global:
      enabled: true
      graphql-url: https://leetcode.com/graphql
      rate-limit: 10
      retry-max: 3
      retry-delay-ms: 2000
      cookie-key: crawler:cookie:leetcode-global
      capabilities: [PROBLEM_FETCH, SOLUTION_FETCH, EDITORIAL_FETCH, COMMENT_FETCH, COMPANY_TAGS]
      solution-fetch-enabled: true
    leetcode-cn:
      enabled: true
      graphql-url: https://leetcode.cn/graphql
      rate-limit: 10
      retry-max: 3
      retry-delay-ms: 2000
      cookie-key: crawler:cookie:leetcode-cn
      capabilities: [PROBLEM_FETCH, SOLUTION_FETCH, EDITORIAL_FETCH, COMPANY_TAGS]
      solution-fetch-enabled: true
    codeforces:
      enabled: true
      api-url: https://codeforces.com/api
      rate-limit: 5
      retry-max: 3
      retry-delay-ms: 3000
      capabilities: [PROBLEM_FETCH, EDITORIAL_FETCH, DIFFICULTY_RATING, CONTEST_PROBLEMS]
      solution-fetch-enabled: false
    nowcoder:
      enabled: true
      base-url: https://www.nowcoder.com
      rate-limit: 8
      retry-max: 2
      capabilities: [PROBLEM_FETCH, SOLUTION_FETCH, COMMENT_FETCH]
      solution-fetch-enabled: true
    atcoder:
      enabled: true
      base-url: https://atcoder.jp
      api-url: https://kenkoooo.com/atcoder/resources
      rate-limit: 5
      capabilities: [PROBLEM_FETCH, EDITORIAL_FETCH, DIFFICULTY_RATING]
      solution-fetch-enabled: false
    luogu:
      enabled: false  # 暂未实现
      base-url: https://www.luogu.com.cn
      rate-limit: 5
      capabilities: [PROBLEM_FETCH]
      solution-fetch-enabled: false

  anti-detect:
    user-agents:
      - "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
      - "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      - "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
    request-delay-ms: "1500-3500"
    circuit-breaker:
      failure-threshold: 5
      wait-duration-ms: 300000
    proxy:
      enabled: false
      provider: none

  storage:
    minio:
      endpoint: http://${MINIO_HOST:localhost}:9000
      access-key: ${MINIO_ACCESS_KEY:admin}
      secret-key: ${MINIO_SECRET_KEY:changeme123}
      buckets:
        crawler-assets: crawler-assets
        user-uploads: user-uploads

  ai:
    auto-enrich-on-fetch: true
    daily-budget: 500          # 每日最大 AI 调用次数
    priority-queue-enabled: true
```

## REST API 设计

### Core_Service API（通过 Gateway 对外暴露）

| 端点 | 方法 | 权限 | 描述 | Req |
|------|------|------|------|-----|
| `/api/v1/admin/problems` | POST | ADMIN | 创建题目 | R8 |
| `/api/v1/admin/problems/{id}` | PUT | ADMIN | 编辑题目 | R8 |
| `/api/v1/admin/problems/{id}` | DELETE | ADMIN | 软删除题目 | R8 |
| `/api/v1/admin/problems/batch-import` | POST | ADMIN | 批量导入 | R8 |
| `/api/v1/admin/crawler/trigger` | POST | ADMIN | 触发采集 | R9 |
| `/api/v1/admin/crawler/tasks` | GET | ADMIN | 采集任务列表 | R9 |
| `/api/v1/admin/crawler/tasks/{id}` | GET | ADMIN | 任务详情 | R9 |
| `/api/v1/admin/crawler/tasks/{id}/cancel` | POST | ADMIN | 取消任务 | R9 |
| `/api/v1/admin/crawler/config` | GET | ADMIN | 查看采集配置 | R15 |
| `/api/v1/admin/crawler/config/{platform}` | PUT | ADMIN | 修改平台配置 | R15 |
| `/api/v1/admin/mappings` | GET | ADMIN | 映射列表 | R19 |
| `/api/v1/admin/mappings/{id}/confirm` | PUT | ADMIN | 确认映射 | R19 |
| `/api/v1/admin/mappings/{id}/reject` | PUT | ADMIN | 拒绝映射 | R19 |
| `/api/v1/admin/mappings` | POST | ADMIN | 手动创建映射 | R19 |
| `/api/v1/admin/review/queue` | GET | ADMIN | 审核队列 | R13 |
| `/api/v1/admin/review/{type}/{id}/approve` | POST | ADMIN | 批准 | R13 |
| `/api/v1/admin/review/{type}/{id}/reject` | POST | ADMIN | 驳回 | R13 |
| `/api/v1/admin/solutions/{id}/feature` | POST | ADMIN | 标记精选 | R11 |
| `/api/v1/admin/solutions/{id}/promote` | POST | ADMIN | 提升为官方 | R11 |
| `/api/v1/admin/comments/{id}/expand` | POST | ADMIN | 评论扩展为题解 | R18 |
| `/api/v1/admin/sources/{platform}/{id}` | DELETE | ADMIN | 按来源下架 | R14 |
| `/api/v1/admin/quality/stats` | GET | ADMIN | 质量统计 | R36 |
| `/api/v1/admin/ai/usage` | GET | ADMIN | AI调用统计 | R40 |
| `/api/v1/problems/{id}/solutions` | POST | AUTH | 提交题解 | R10 |
| `/api/v1/problems/{id}/solutions` | GET | PUBLIC | 题解列表 | R10 |
| `/api/v1/problems/{id}/detail` | GET | PUBLIC | 聚合详情 | R35 |
| `/api/v1/solutions/{id}` | PUT | AUTH(自己) | 编辑题解 | R10 |
| `/api/v1/solutions/{id}` | DELETE | AUTH(自己) | 删除题解 | R10 |
| `/api/v1/solutions/{id}/upvote` | POST | AUTH | 点赞 | R34 |
| `/api/v1/solutions/{id}/upvote` | DELETE | AUTH | 取消点赞 | R34 |
| `/api/v1/solutions/import-url` | POST | AUTH | URL导入 | R33 |
| `/api/v1/solutions/from-feynman` | POST | AUTH | 费曼转题解 | R32 |
| `/api/v1/comments` | POST | AUTH | 发表评论 | R12 |
| `/api/v1/comments` | GET | PUBLIC | 评论列表 | R12 |
| `/api/v1/comments/{id}` | DELETE | AUTH(自己) | 删除评论 | R12 |
| `/api/v1/comments/{id}/upvote` | POST | AUTH | 点赞评论 | R34 |
| `/api/v1/comments/{id}/upvote` | DELETE | AUTH | 取消点赞 | R34 |
| `/api/v1/search` | GET | PUBLIC | 统一搜索 | R22 |
| `/api/v1/files/{fileId}` | GET | PUBLIC | 文件访问 | R24 |

## Docker Compose 新增服务

```yaml
services:
  # 已有: mysql, redis, algorithm-core, algorithm-gateway, algorithm-ai

  nacos:
    image: nacos/nacos-server:v2.3.0
    ports:
      - "8848:8848"
      - "9848:9848"
    environment:
      - MODE=standalone
      - SPRING_DATASOURCE_PLATFORM=mysql
      - MYSQL_SERVICE_HOST=mysql
      - MYSQL_SERVICE_DB_NAME=nacos
      - MYSQL_SERVICE_USER=${DB_USER:-root}
      - MYSQL_SERVICE_PASSWORD=${DB_PASSWORD}
    depends_on: [mysql]

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio-data:/data
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-admin}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-changeme123}

  xxl-job-admin:
    image: xuxueli/xxl-job-admin:2.4.0
    ports:
      - "8090:8080"
    environment:
      PARAMS: >-
        --spring.datasource.url=jdbc:mysql://mysql:3306/xxl_job?useUnicode=true&characterEncoding=UTF-8
        --spring.datasource.username=${DB_USER:-root}
        --spring.datasource.password=${DB_PASSWORD}
    depends_on: [mysql]

  algorithm-crawler:
    build: ./algorithm-help-crawler
    ports:
      - "8082:8082"
      - "20881:20881"     # Dubbo 端口
    depends_on: [mysql, redis, nacos, minio, xxl-job-admin]
    environment:
      - NACOS_HOST=nacos
      - MYSQL_HOST=mysql
      - REDIS_HOST=redis
      - MINIO_HOST=minio
      - XXL_JOB_ADMIN_ADDRESS=http://xxl-job-admin:8080/xxl-job-admin

volumes:
  minio-data:
```

## 关键技术选型清单

| 分类 | 选型 | 版本 | 用途 |
|------|------|------|------|
| 基础框架 | Spring Boot | 3.2.x | 服务基础 |
| 微服务 | Spring Cloud Alibaba | 2023.0.x | Nacos/Dubbo 集成 |
| RPC | Apache Dubbo | 3.2.x | 服务间通信 |
| 网关 | Spring Cloud Gateway | 4.1.x | 路由/鉴权/限流 |
| ORM | MyBatis-Plus | 3.5.5+ | 数据库操作 |
| 数据库 | MySQL | 8.0 | 主存储 |
| 缓存 | Redis + Lettuce | 7.x | 缓存/锁/队列/Stream |
| 分布式锁 | Redisson | 3.27.x | 采集任务防并发 |
| 文件存储 | MinIO | latest | 图片/附件 S3 兼容 |
| 定时任务 | XXL-JOB | 2.4.x | 分布式调度 |
| HTTP 客户端 | OkHttp | 4.12.x | 爬虫请求 |
| HTML 解析 | Jsoup | 1.17.x | DOM 解析 |
| 正文提取 | Readability4J | 1.0.x | 去噪提取正文 |
| Markdown 转换 | flexmark-java | 0.64.x | HTML→MD |
| 弹性容错 | Resilience4j | 2.2.x | 限流/熔断/重试/隔离舱 |
| Bean 映射 | MapStruct | 1.5.x | DTO↔Entity 转换 |
| 工具库 | Hutool | 5.8.x | 通用工具 |
| ID 生成 | MyBatis-Plus 雪花 | - | ASSIGN_ID |
| 数据库迁移 | Flyway | 9.x | DDL 版本管理 |
| 配置中心 | Nacos | 2.3.x | 动态配置 |
| 注册中心 | Nacos | 2.3.x | 服务发现 |
| 监控 | Micrometer | 1.12.x | 指标暴露 |
| 日志 | SLF4J + Logback | - | JSON 结构化日志 |
| 安全 | Spring Security + JWT | - | 认证/鉴权 |
| Lombok | Lombok | 1.18.x | 减少样板代码 |

## 后续预留（本 Spec 不实施）

| 预留项 | 说明 | 触发条件 |
|--------|------|---------|
| Nginx 反向代理 | SSL终结、静态资源、负载均衡 | 部署到生产环境时 |
| Elasticsearch | 全文搜索升级 | 题目数 > 5000 或搜索场景复杂化 |
| RabbitMQ/RocketMQ | 消息队列升级 | Redis Stream 不满足（如需延时队列/死信高级特性） |
| 代理池 | ProxyProvider 实现 | 平台封禁频繁时 |
| Sentinel | 流控降级 | 需要更精细的流控（如热点参数限流） |
| SkyWalking | 分布式链路追踪 | 微服务调用链排查困难时 |

## Scope

### 本 Spec 包含
- algorithm-crawler 微服务完整实现
- algorithm-core 新增模块（题解/评论/CRUD/审核/搜索/映射管理）
- algorithm-help-api 模块（Dubbo 接口定义）
- Docker Compose 新增服务（Nacos/MinIO/XXL-JOB/Crawler）
- Flyway 迁移脚本（5 张新表）
- 全部 6 个平台适配器骨架 + LeetCode/Codeforces 完整实现

### 本 Spec 不包含
- 前端页面实现（Spec 3 负责）
- AI 加工的具体 Prompt 模板（Spec 2 负责）
- 交互功能（费曼/面试等，Spec 4 负责）
- Nginx 部署（后续单独处理）
- 管理后台前端 UI（后续独立 Spec）
