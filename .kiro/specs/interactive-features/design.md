# Design: 交互式功能层

## Overview

本设计文档定义交互式功能层的技术实现方案。该层建立在 Spec 1-3 之上，实现实时 AI 对话交互能力。核心技术挑战包括：WebSocket 通信与会话管理、多轮对话上下文保持、面试模拟状态机、SM-2 间隔重复算法、以及 URL 内容解析引擎。所有 AI 调用复用 SmartRouter 路由层。

## Architecture

### 系统架构总览

> **包路径说明**：本 spec 所有类统一使用 `com.algorithmhelp.interactive` 包路径，与 Spec 1 基础设施层的 `com.algorithmhelp` 保持一致。

```
前端（Next.js 14）
  │ WebSocket / REST
  ↓
┌─────────────────────────────────────────────────────────┐
│              WebSocket Gateway（统一入口）                 │
│   认证 → 路由 → 速率限制 → 消息分发                       │
└────┬────────┬────────┬────────┬────────┬────────┬───────┘
     ↓        ↓        ↓        ↓        ↓        ↓
┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐
│Feynman ││Interview││Socratic││ Debug  ││Reverse ││Content │
│Session ││Simulator││ Guide  ││Trainer ││Feynman ││Importer│
│Handler ││Handler  ││Handler ││Handler ││Handler ││(REST)  │
└────┬───┘└────┬───┘└────┬───┘└────┬───┘└────┬───┘└────┬───┘
     │         │         │         │         │         │
     ↓         ↓         ↓         ↓         ↓         ↓
┌─────────────────────────────────────────────────────────┐
│              SessionManager（会话管理层）                  │
│   会话创建/恢复/过期 + 上下文存储(Redis)                   │
└──────────────────────────┬──────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│              SmartRouter（Spec 1 AI 路由层）              │
│         Redis缓存 → Ollama → OpenAI → Anthropic         │
└──────────────────────────┬──────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│    Storage: MySQL + Redis + 文件系统                 │
└─────────────────────────────────────────────────────────┘
```

### 模块职责

| 模块 | 职责 | 包路径 |
|------|------|--------|
| WebSocketGateway | WebSocket 连接管理、认证、消息路由 | `com.algorithmhelp.interactive.websocket` |
| SessionManager | 会话生命周期管理、上下文存储/恢复 | `com.algorithmhelp.interactive.session` |
| FeynmanSessionHandler | 费曼模式对话逻辑 | `com.algorithmhelp.interactive.feynman` |
| InterviewSimulatorHandler | 面试模拟状态机 | `com.algorithmhelp.interactive.interview` |
| SocraticGuideHandler | 苏格拉底追问逻辑 | `com.algorithmhelp.interactive.socratic` |
| DebugTrainerHandler | Debug 训练逻辑 | `com.algorithmhelp.interactive.debug` |
| ReverseFeynmanHandler | 反向费曼逻辑 | `com.algorithmhelp.interactive.reverse` |
| ContentImportService | URL 解析与内容导入 | `com.algorithmhelp.interactive.importer` |
| SpacedRepetitionService | SM-2 算法调度与复习管理 | `com.algorithmhelp.interactive.spaced` |
| LearningAnalyticsService | 学习数据统计与分析 | `com.algorithmhelp.interactive.analytics` |


## Components and Interfaces

### 组件总览

| 组件 | 接口/职责 | 依赖 |
|------|-----------|------|
| WebSocketGateway | 连接管理、消息分发 | SessionManager |
| SessionManager | createSession/getSession/expireSession | Redis |
| FeynmanSessionHandler | handleMessage(sessionId, msg): AiResponse | SessionManager, SmartRouter |
| InterviewSimulatorHandler | startInterview/handleAnswer/endInterview | SessionManager, SmartRouter |
| SocraticGuideHandler | startGuide/handleResponse/getNextHint | SessionManager, SmartRouter |
| DebugTrainerHandler | generateBuggyCode/submitFix/getHint | SmartRouter |
| ReverseFeynmanHandler | generateWithError/checkCorrection | SmartRouter |
| ContentImportService | importFromUrl(url): ImportResult | HttpClient, SmartRouter |
| SpacedRepetitionService | getNextReview/recordResult/getSchedule | SM-2 算法, DB |
| LearningAnalyticsService | getStats/getWeakPoints/getDailyPlan | DB |

## Data Models

### 核心实体模型

```java
// 交互会话
@Entity @Data @Accessors(chain = true)
public class InteractiveSession {
    @Id
    private String sessionId;           // UUID
    private String userId;
    private SessionType type;           // FEYNMAN / INTERVIEW / SOCRATIC / DEBUG / REVERSE_FEYNMAN
    private SessionStatus status;       // ACTIVE / PAUSED / COMPLETED / EXPIRED
    private String problemId;           // 关联题目
    @Column(columnDefinition = "json")
    private String contextJson;         // 对话上下文（序列化的 ChatMessage 列表）
    private long createdAt;             // UTC 毫秒
    private long lastActiveAt;          // 最后活跃时间
    private long completedAt;           // 结束时间
}

// 会话消息
@Entity @Data @Accessors(chain = true)
public class SessionMessage {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    private String sessionId;
    private String role;                // USER / AI / SYSTEM
    private String content;
    private long timestamp;
}

// 面试评分报告
@Entity @Data @Accessors(chain = true)
public class InterviewReport {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    private String sessionId;
    private String userId;
    private String problemId;
    private int correctnessScore;       // 1-10
    private int efficiencyScore;        // 1-10
    private int communicationScore;     // 1-10
    private int codeQualityScore;       // 1-10
    private String feedback;            // AI 综合反馈
    @Column(columnDefinition = "json")
    private String improvements;        // 各维度改进建议 JSON: {"correctness":"注意边界...", "efficiency":"可用哈希..."}
    private long duration;              // 面试时长（毫秒）
    private long createdAt;
}

// 间隔重复卡片
@Entity @Data @Accessors(chain = true)
public class SpacedRepetitionCard {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    private String userId;
    private String problemId;
    private String patternId;           // 关联算法模式
    private CardType cardType;          // GUESS_ALGO / COMPLETE_CODE / EXPLAIN / PATTERN_QUIZ / VARIANT
    private double easeFactor;          // SM-2 容易度因子（初始 2.5）
    private int interval;              // 当前间隔天数
    private int repetitions;            // 连续正确次数
    private long nextReviewAt;          // 下次复习时间（UTC 毫秒）
    private long lastReviewAt;
    private long createdAt;
}

// 复习记录
@Entity @Data @Accessors(chain = true)
public class ReviewRecord {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    private String cardId;
    private String userId;
    private int quality;                // 用户自评 0-5（SM-2 输入）
    private long reviewedAt;
    private long responseTime;          // 回答耗时（毫秒）
}

// Debug 训练记录
@Entity @Data @Accessors(chain = true)
public class DebugTrainingRecord {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    private String userId;
    private String problemId;
    private String bugType;             // OFF_BY_ONE / BOUNDARY / CONDITION / INIT
    private boolean found;              // 是否找到
    private int hintsUsed;              // 使用的提示数
    private long timeSpent;             // 花费时间（毫秒）
    private long createdAt;
}

// 成就记录
@Entity @Data @Accessors(chain = true)
public class Achievement {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    private String userId;
    @Enumerated(EnumType.STRING)
    private AchievementType type;
    @Column(columnDefinition = "json")
    private String metadata;            // 额外数据（如具体模式名、评分值等）
    private long unlockedAt;            // 解锁时间 UTC 毫秒
}

public enum AchievementType {
    FIRST_PROBLEM,      // 完成第一题
    PATTERN_MASTER,     // 完成某模式全部题
    STREAK_7,           // 连续学习 7 天
    STREAK_30,          // 连续学习 30 天
    FEYNMAN_SCHOLAR,    // 完成 20 次费曼讲解
    INTERVIEW_PRO,      // 面试评分 > 80
    BUG_HUNTER,         // 反向费曼正确率 > 90%
    SPEED_DEMON         // 面试 25 分钟内满分
}

// 面试配置
@Data @Accessors(chain = true)
public class InterviewConfig {
    private String problemId;           // 可选，不指定则随机选题
    @Enumerated(EnumType.STRING)
    private Difficulty difficulty;      // EASY / MEDIUM / HARD / RANDOM
    private int timeLimitMinutes;       // 25 / 45 / 60
    private String companyStyle;        // GOOGLE / META / AMAZON / BYTEDANCE / GENERAL
}

// 每日学习计划
@Entity @Data @Accessors(chain = true)
public class DailyPlan {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    private String userId;
    private long date;                  // 当天 0 点 UTC 毫秒
    private String patternReviewId;     // 推荐回顾的模式 ID
    private String newProblemId;        // 推荐的新题 ID
    private int reviewCardCount;        // 当天待复习卡片数
    private boolean completed;          // 是否完成
    private long completedAt;           // 完成时间
    private long createdAt;
}

// 复杂度训练记录
@Entity @Data @Accessors(chain = true)
public class ComplexityTrainingRecord {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    private String userId;
    @Enumerated(EnumType.STRING)
    private ComplexityTrainingMode mode; // RANGE_GUESS / CODE_ESTIMATE
    @Column(columnDefinition = "json")
    private String question;            // 题目内容 JSON
    private String userAnswer;
    private String correctAnswer;
    private boolean isCorrect;
    private long createdAt;
}

public enum ComplexityTrainingMode {
    RANGE_GUESS,        // 看数据范围猜算法复杂度
    CODE_ESTIMATE       // 看代码估复杂度
}

// 全服飘屏消息
@Entity @Data @Accessors(chain = true)
public class BroadcastMessage {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    private String userId;              // 触发用户
    private String nickname;            // 用户昵称（冗余存储避免JOIN）
    @Enumerated(EnumType.STRING)
    private AchievementType achievementType;
    private String achievementName;     // 成就显示名
    private long createdAt;
}

// 导入内容
@Entity @Data @Accessors(chain = true)
public class ImportedContent {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    private String sourceUrl;
    private String title;
    @Column(columnDefinition = "text")
    private String rawContent;          // 原始提取内容
    @Column(columnDefinition = "text")
    private String refinedContent;      // AI 精炼后的内容
    @Column(columnDefinition = "json")
    private String imagesJson;          // 图片列表
    @Column(columnDefinition = "json")
    private String commentsJson;        // 提取的评论
    @Column(columnDefinition = "json")
    private String errorsJson;          // AI 审查发现的错误
    private String problemId;           // 关联题目
    private long createdAt;
}
```

### WebSocket 消息协议

```java
// WebSocket 消息封装
@Data @Accessors(chain = true)
public class WsMessage {
    private String type;        // 消息类型
    private String sessionId;   // 会话ID
    private String payload;     // JSON 格式的业务数据
    private long timestamp;
}

// 消息类型枚举
public enum WsMessageType {
    // 客户端 → 服务端
    FEYNMAN_CHAT,               // 费曼模式用户输入
    INTERVIEW_CHAT,             // 面试模拟用户回答
    SOCRATIC_CHAT,              // 苏格拉底模式用户回答
    DEBUG_SUBMIT,               // Debug 模式提交修复
    REVERSE_FEYNMAN_CHAT,       // 反向费曼用户纠错

    // 服务端 → 客户端
    AI_RESPONSE,                // AI 回复
    SESSION_CREATED,            // 会话创建确认
    SESSION_EXPIRED,            // 会话过期通知
    INTERVIEW_TIME_WARNING,     // 面试时间提醒
    INTERVIEW_REPORT,           // 面试评分报告
    HINT_PROVIDED,              // 提示发送
    ERROR                       // 错误通知
}
```


## Component Design

### 1. WebSocket Gateway

#### Spring WebSocket 配置

```java
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(interactiveWebSocketHandler(), "/ws/interactive")
            .setAllowedOrigins("*");
        // 注意：认证不通过 URL 参数，而是通过首条消息携带 token
    }
}
```

#### 认证流程

```java
/**
 * WebSocket 认证流程：
 * 1. 客户端连接 ws://host/ws/interactive（无需 URL token）
 * 2. 连接建立后，客户端必须在 5 秒内发送认证消息：{"type":"AUTH","payload":"<jwt-token>"}
 * 3. 服务端验证 token，通过后标记连接为已认证
 * 4. 未在 5 秒内认证或 token 无效的连接自动断开
 * 5. 已认证后的后续消息正常处理
 *
 * 安全考虑：禁止通过 URL 查询参数传递 token，避免服务器日志和浏览器历史泄露
 */
```

#### 统一消息处理器

```java
@Component
@RequiredArgsConstructor
public class InteractiveWebSocketHandler extends TextWebSocketHandler {

    private final SessionManager sessionManager;
    private final FeynmanSessionHandler feynmanHandler;
    private final InterviewSimulatorHandler interviewHandler;
    private final SocraticGuideHandler socraticHandler;
    private final DebugTrainerHandler debugHandler;
    private final ReverseFeynmanHandler reverseHandler;
    private final RateLimiter rateLimiter;

    @Override
    protected void handleTextMessage(WebSocketSession wsSession, TextMessage message) {
        // 1. 速率限制检查（每用户每秒最多5条）
        if (!rateLimiter.tryAcquire(getUserId(wsSession))) {
            sendError(wsSession, "请求过于频繁，请稍后再试");
            return;
        }
        // 2. 解析消息
        var wsMsg = parseMessage(message.getPayload());
        // 3. 根据消息类型路由到对应 handler
        switch (wsMsg.getType()) {
            case "FEYNMAN_CHAT" -> feynmanHandler.handle(wsSession, wsMsg);
            case "INTERVIEW_CHAT" -> interviewHandler.handle(wsSession, wsMsg);
            case "SOCRATIC_CHAT" -> socraticHandler.handle(wsSession, wsMsg);
            case "DEBUG_SUBMIT" -> debugHandler.handle(wsSession, wsMsg);
            case "REVERSE_FEYNMAN_CHAT" -> reverseHandler.handle(wsSession, wsMsg);
            default -> sendError(wsSession, "未知消息类型: " + wsMsg.getType());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        // 标记会话为 PAUSED，支持断线重连
        sessionManager.pauseSession(getSessionId(session));
    }
}
```

#### 速率限制器

```java
@Component
public class WsRateLimiter {
    // 滑动窗口限流：每用户每秒最多 5 条消息
    private final Map<String, Deque<Long>> userWindows = new ConcurrentHashMap<>();

    public boolean tryAcquire(String userId) {
        var window = userWindows.computeIfAbsent(userId, k -> new ConcurrentLinkedDeque<>());
        long now = System.currentTimeMillis();
        // 移除 1 秒前的记录
        while (!window.isEmpty() && now - window.peekFirst() > 1000) {
            window.pollFirst();
        }
        if (window.size() >= 5) return false;
        window.addLast(now);
        return true;
    }
}
```

### 2. SessionManager（会话管理）

#### 核心设计

```java
@Service
@RequiredArgsConstructor
public class SessionManager {

    private final RedisTemplate<String, String> redisTemplate;
    private final InteractiveSessionRepository sessionRepo;
    private final ObjectMapper objectMapper;

    private static final long SESSION_TTL_MINUTES = 30;
    private static final long RECONNECT_WINDOW_MINUTES = 15;
    private static final String SESSION_KEY_PREFIX = "session:context:";

    /**
     * 创建新会话
     */
    public InteractiveSession createSession(String userId, SessionType type, String problemId) {
        var session = new InteractiveSession()
            .setSessionId(UUID.randomUUID().toString())
            .setUserId(userId)
            .setType(type)
            .setStatus(SessionStatus.ACTIVE)
            .setProblemId(problemId)
            .setCreatedAt(System.currentTimeMillis())
            .setLastActiveAt(System.currentTimeMillis());
        sessionRepo.save(session);
        return session;
    }

    /**
     * 获取会话上下文（从 Redis）
     */
    public List<ChatMessage> getContext(String sessionId) {
        var key = SESSION_KEY_PREFIX + sessionId;
        var json = redisTemplate.opsForValue().get(key);
        if (json == null) return new ArrayList<>();
        return objectMapper.readValue(json, new TypeReference<>() {});
    }

    /**
     * 追加消息到上下文（最多保留 20 轮）
     */
    public void appendMessage(String sessionId, ChatMessage message) {
        var context = getContext(sessionId);
        context.add(message);
        // 保持最多 20 轮（40 条消息：user + ai 各一条为一轮）
        while (context.size() > 40) {
            context.remove(0);
        }
        var key = SESSION_KEY_PREFIX + sessionId;
        redisTemplate.opsForValue().set(key, objectMapper.writeValueAsString(context),
            Duration.ofMinutes(SESSION_TTL_MINUTES));
        // 更新最后活跃时间
        updateLastActive(sessionId);
    }

    /**
     * 断线重连恢复
     */
    public InteractiveSession reconnect(String sessionId) {
        var session = sessionRepo.findById(sessionId).orElseThrow();
        long elapsed = System.currentTimeMillis() - session.getLastActiveAt();
        if (elapsed > RECONNECT_WINDOW_MINUTES * 60 * 1000) {
            throw new SessionExpiredException("会话已过期，请重新开始");
        }
        session.setStatus(SessionStatus.ACTIVE);
        sessionRepo.save(session);
        return session;
    }

    /**
     * 定时任务：清理过期会话
     */
    @Scheduled(fixedRate = 300_000) // 每5分钟
    public void cleanExpiredSessions() {
        long threshold = System.currentTimeMillis() - SESSION_TTL_MINUTES * 60 * 1000;
        sessionRepo.expireInactiveSessions(threshold);
    }
}
```

### 3. 费曼学习模式（FeynmanSessionHandler）

#### 核心逻辑

```java
@Component
@RequiredArgsConstructor
public class FeynmanSessionHandler {

    private final SessionManager sessionManager;
    private final SmartRouter smartRouter;
    private final PromptTemplateEngine templateEngine;

    public void handle(WebSocketSession wsSession, WsMessage msg) {
        var sessionId = msg.getSessionId();
        var userInput = msg.getPayload();

        // 1. 获取会话上下文
        var context = sessionManager.getContext(sessionId);

        // 2. 构建费曼模式 prompt
        var variables = Map.of(
            "userInput", userInput,
            "conversationHistory", formatHistory(context),
            "round", String.valueOf(context.size() / 2 + 1)
        );
        var prompt = templateEngine.render("interactive/feynman-chat.md", variables);

        // 3. 调用 AI（含上下文的对话）
        var messages = buildMessagesWithContext(context, prompt);
        var response = smartRouter.chat(messages);

        // 4. 解析 AI 响应（可能是追问、也可能是最终结构化输出）
        var aiMessage = new ChatMessage("assistant", response.getContent());

        // 5. 保存到上下文
        sessionManager.appendMessage(sessionId, new ChatMessage("user", userInput));
        sessionManager.appendMessage(sessionId, aiMessage);

        // 6. 发送给前端
        sendResponse(wsSession, sessionId, response.getContent());
    }

    /**
     * 生成最终结构化输出（用户选择结束会话时）
     */
    public String generateStructuredOutput(String sessionId) {
        var context = sessionManager.getContext(sessionId);
        var variables = Map.of("fullConversation", formatHistory(context));
        var prompt = templateEngine.render("interactive/feynman-summarize.md", variables);
        return smartRouter.call(prompt);
    }
}
```

#### 费曼模式 Prompt 模板（prompts/interactive/feynman-chat.md）

```markdown
你是一个费曼学习教练。用户正在用自己的话解释一道算法题的解法。

## 你的任务
分析用户的描述，识别以下问题：
1. 理解漏洞：概念理解不到位的地方
2. 跳步：用户跳过了关键推导步骤
3. 模糊点：用词不精确或含糊

## 当前对话轮次：第 {{round}} 轮

## 对话历史
{{conversationHistory}}

## 用户最新输入
{{userInput}}

## 回复规则
- 如果发现漏洞/跳步/模糊，用引导式追问指出（不直接告诉答案）
- 追问举例："你说的'然后排序'，排序依据是什么？是按什么属性排？"
- 如果用户已经讲清楚了，给予肯定并引导下一步
- 每次只追问一个点，不要一次指出所有问题
- 语气友好、鼓励性质

## 输出格式（JSON）
{
  "type": "follow_up" 或 "summary",
  "message": "你的回复内容",
  "identified_gaps": ["发现的漏洞1", "漏洞2"],
  "analogies": ["如果是 follow_up 且合适时，提供类比"]
}
```


### 4. 面试模拟状态机（InterviewSimulatorHandler）

#### 状态机设计

```
┌─────────┐    开始面试    ┌──────────┐    用户作答    ┌──────────────┐
│  IDLE   │ ──────────→  │ PROBLEM  │ ──────────→  │  FOLLOW_UP   │
└─────────┘              │ SOLVING  │              │  (AI追问)     │
                         └──────────┘              └──────────────┘
                              ↑                          │
                              │        用户继续回答       │
                              └──────────────────────────┘
                                                         │
                              超时/用户完成               ↓
                         ┌──────────┐              ┌──────────────┐
                         │ VARIANT  │ ←─────────── │  CODING      │
                         │ (变体题) │              │  (手写代码)   │
                         └──────────┘              └──────────────┘
                              │
                              ↓ 面试结束
                         ┌──────────┐
                         │ SCORING  │ → 生成评分报告
                         └──────────┘
```

#### 状态枚举与转移

```java
public enum InterviewState {
    IDLE,               // 等待开始
    PROBLEM_SOLVING,    // 思考解题中
    FOLLOW_UP,          // AI 追问中
    CODING,             // 编码阶段
    VARIANT,            // 变体题阶段
    SCORING             // 评分阶段
}

@Component
@RequiredArgsConstructor
public class InterviewSimulatorHandler {

    private final SessionManager sessionManager;
    private final SmartRouter smartRouter;
    private final PromptTemplateEngine templateEngine;
    private final InterviewReportRepository reportRepo;

    // 面试状态存储（Redis）
    private static final String STATE_KEY_PREFIX = "interview:state:";

    /**
     * 启动面试
     */
    public void startInterview(WebSocketSession wsSession, String sessionId, String problemId, int timeLimit) {
        // 设置状态为 PROBLEM_SOLVING
        setState(sessionId, InterviewState.PROBLEM_SOLVING);
        // 设置计时器
        scheduleTimeWarning(wsSession, sessionId, timeLimit);
        // 生成开场白
        var opening = generateOpening(problemId);
        sendResponse(wsSession, sessionId, opening);
    }

    /**
     * 处理用户回答
     */
    public void handle(WebSocketSession wsSession, WsMessage msg) {
        var sessionId = msg.getSessionId();
        var state = getState(sessionId);

        switch (state) {
            case PROBLEM_SOLVING, FOLLOW_UP -> handleSolving(wsSession, sessionId, msg.getPayload());
            case CODING -> handleCoding(wsSession, sessionId, msg.getPayload());
            case VARIANT -> handleVariant(wsSession, sessionId, msg.getPayload());
            default -> sendError(wsSession, "面试尚未开始");
        }
    }

    /**
     * 处理解题阶段回答 — AI 追问逻辑
     */
    private void handleSolving(WebSocketSession wsSession, String sessionId, String answer) {
        var context = sessionManager.getContext(sessionId);
        var variables = Map.of(
            "userAnswer", answer,
            "history", formatHistory(context),
            "interviewStyle", "追问优化空间和扩展性"
        );
        var prompt = templateEngine.render("interactive/interview-followup.md", variables);
        var response = smartRouter.call(prompt);

        // 解析 AI 判断：是继续追问还是进入下一阶段
        var decision = parseInterviewDecision(response);
        if (decision.shouldMoveToNext()) {
            setState(sessionId, InterviewState.CODING);
        } else {
            setState(sessionId, InterviewState.FOLLOW_UP);
        }

        sessionManager.appendMessage(sessionId, new ChatMessage("user", answer));
        sessionManager.appendMessage(sessionId, new ChatMessage("assistant", decision.getMessage()));
        sendResponse(wsSession, sessionId, decision.getMessage());
    }

    /**
     * 生成面试评分报告
     */
    public InterviewReport generateReport(String sessionId) {
        var context = sessionManager.getContext(sessionId);
        var variables = Map.of("fullInterview", formatHistory(context));
        var prompt = templateEngine.render("interactive/interview-scoring.md", variables);
        var response = smartRouter.call(prompt);

        var report = parseScoreReport(response);
        report.setSessionId(sessionId);
        report.setCreatedAt(System.currentTimeMillis());
        return reportRepo.save(report);
    }

    /**
     * 定时提醒（面试剩余时间）
     */
    private void scheduleTimeWarning(WebSocketSession wsSession, String sessionId, int timeLimitMinutes) {
        // 75% 时间时提醒
        long warningDelay = (long)(timeLimitMinutes * 0.75 * 60 * 1000);
        // 100% 时间时强制结束
        long endDelay = timeLimitMinutes * 60 * 1000L;
        // 使用 ScheduledExecutorService 调度
    }
}
```

### 5. SM-2 间隔重复算法实现

#### 核心算法

```java
@Service
@RequiredArgsConstructor
public class SpacedRepetitionService {

    private final SpacedRepetitionCardRepository cardRepo;
    private final ReviewRecordRepository recordRepo;

    /**
     * SM-2 算法核心：根据用户反馈计算下次复习时间
     *
     * @param quality 用户自评 0-5
     *   0 = 完全忘记
     *   1 = 做错但看到答案后记起
     *   2 = 做错但感觉快想起来了
     *   3 = 答对但很费力
     *   4 = 答对，稍有犹豫
     *   5 = 答对，完全流畅
     */
    public SpacedRepetitionCard recordReview(String cardId, int quality) {
        var card = cardRepo.findById(cardId).orElseThrow();

        // SM-2 核心公式
        if (quality >= 3) {
            // 答对：增加间隔
            if (card.getRepetitions() == 0) {
                card.setInterval(1);
            } else if (card.getRepetitions() == 1) {
                card.setInterval(6);
            } else {
                card.setInterval((int) Math.round(card.getInterval() * card.getEaseFactor()));
            }
            card.setRepetitions(card.getRepetitions() + 1);
        } else {
            // 答错：重置
            card.setRepetitions(0);
            card.setInterval(1);
        }

        // 更新容易度因子 EF
        double newEf = card.getEaseFactor()
            + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        card.setEaseFactor(Math.max(1.3, newEf));

        // 计算下次复习时间
        card.setNextReviewAt(System.currentTimeMillis() + card.getInterval() * 24L * 60 * 60 * 1000);
        card.setLastReviewAt(System.currentTimeMillis());

        cardRepo.save(card);

        // 记录复习历史
        recordRepo.save(new ReviewRecord()
            .setCardId(cardId)
            .setUserId(card.getUserId())
            .setQuality(quality)
            .setReviewedAt(System.currentTimeMillis()));

        return card;
    }

    /**
     * 获取今日待复习卡片（按优先级排序）
     */
    public List<SpacedRepetitionCard> getTodayReviews(String userId) {
        long now = System.currentTimeMillis();
        return cardRepo.findByUserIdAndNextReviewAtLessThanEqualOrderByNextReviewAt(userId, now);
    }

    /**
     * 获取每日推荐（算法日历）
     */
    public DailyRecommendation getDailyRecommendation(String userId) {
        // 1. 从薄弱模式中选择一个模式回顾
        var weakPattern = findWeakestPattern(userId);
        // 2. 推荐一道新题
        var newProblem = recommendNewProblem(userId);
        return new DailyRecommendation()
            .setPatternReview(weakPattern)
            .setNewProblem(newProblem)
            .setDate(System.currentTimeMillis());
    }

    /**
     * 创建复习卡片（学习新题目时自动创建）
     */
    public SpacedRepetitionCard createCard(String userId, String problemId, CardType type) {
        return cardRepo.save(new SpacedRepetitionCard()
            .setUserId(userId)
            .setProblemId(problemId)
            .setCardType(type)
            .setEaseFactor(2.5)
            .setInterval(0)
            .setRepetitions(0)
            .setNextReviewAt(System.currentTimeMillis() + 24 * 60 * 60 * 1000) // 明天复习
            .setCreatedAt(System.currentTimeMillis()));
    }
}
```

#### 复习方式多样化

```java
public enum CardType {
    GUESS_ALGO,         // 看图/描述猜算法
    COMPLETE_CODE,      // 补全关键代码
    EXPLAIN,            // 口头讲解思路
    PATTERN_QUIZ,       // 模式识别选择题
    VARIANT,            // 变体题
    COMPLEXITY_GUESS    // 复杂度直觉训练
}
```


### 6. URL 解析引擎（ContentImportService）

#### 解析流程

```
URL 输入
  ↓
┌────────────────────────────────┐
│ 1. HTTP 请求获取网页 HTML       │
└───────────────┬────────────────┘
                ↓
┌────────────────────────────────┐
│ 2. Readability 提取正文         │
│    (去除导航/广告/侧边栏)       │
└───────────────┬────────────────┘
                ↓
┌────────────────────────────────┐
│ 3. 提取图片/GIF                │
│    下载到本地 + 标注用途        │
└───────────────┬────────────────┘
                ↓
┌────────────────────────────────┐
│ 4. 提取评论区优质评论           │
│    (点赞 > 阈值的纠错/补充)    │
└───────────────┬────────────────┘
                ↓
┌────────────────────────────────┐
│ 5. AI 正确性审查                │
│    标注逻辑错误和不准确说法     │
└───────────────┬────────────────┘
                ↓
┌────────────────────────────────┐
│ 6. AI 精炼为标准格式            │
│    题目理解→思路→代码→复杂度    │
└────────────────────────────────┘
```

#### 核心实现

```java
@Service
@RequiredArgsConstructor
public class ContentImportService {

    private final WebClient webClient;
    private final SmartRouter smartRouter;
    private final PromptTemplateEngine templateEngine;
    private final ImportedContentRepository contentRepo;
    private final FileStorageService fileStorage;

    /**
     * 从 URL 导入并解析内容
     */
    public ImportResult importFromUrl(String url) {
        // 1. 获取网页 HTML
        var html = fetchHtml(url);
        if (html == null || html.isBlank()) {
            throw new ImportException("无法访问 URL: " + url);
        }

        // 2. Readability 提取正文
        var article = extractArticle(html);

        // 3. 提取并下载图片
        var images = extractAndDownloadImages(article, url);

        // 4. 提取评论（需根据平台定制解析器）
        var comments = extractComments(html, url);

        // 5. AI 正确性审查
        var errors = aiReview(article.getContent());

        // 6. AI 精炼为标准格式
        var refined = aiRefine(article.getContent());

        // 7. 持久化
        var content = new ImportedContent()
            .setSourceUrl(url)
            .setTitle(article.getTitle())
            .setRawContent(article.getContent())
            .setRefinedContent(refined)
            .setImagesJson(toJson(images))
            .setCommentsJson(toJson(comments))
            .setErrorsJson(toJson(errors))
            .setCreatedAt(System.currentTimeMillis());

        contentRepo.save(content);
        return new ImportResult(content, errors);
    }

    /**
     * Readability 算法提取正文
     * 使用 Jsoup + 自定义评分规则
     */
    private Article extractArticle(String html) {
        var doc = Jsoup.parse(html);
        // 移除 script、style、nav、header、footer
        doc.select("script, style, nav, header, footer, .sidebar, .comments").remove();
        // 找到正文主体（最大文本密度的节点）
        var mainContent = findMainContent(doc);
        return new Article()
            .setTitle(doc.title())
            .setContent(mainContent.html())
            .setTextContent(mainContent.text());
    }

    /**
     * 提取图片并下载到本地
     */
    private List<ImportedImage> extractAndDownloadImages(Article article, String baseUrl) {
        var images = new ArrayList<ImportedImage>();
        var doc = Jsoup.parse(article.getContent());
        for (var img : doc.select("img")) {
            var src = img.absUrl("src");
            if (src.isBlank()) continue;
            var localPath = fileStorage.downloadAndStore(src);
            var alt = img.attr("alt");
            images.add(new ImportedImage(src, localPath, alt));
        }
        return images;
    }
}

@Data @Accessors(chain = true)
public class ImportResult {
    private ImportedContent content;
    private List<ContentError> errors;
    private boolean hasErrors;
}

@Data @Accessors(chain = true)
public class Article {
    private String title;
    private String content;     // HTML 正文
    private String textContent; // 纯文本正文
}

@Data @AllArgsConstructor
public class ImportedImage {
    private String originalUrl;
    private String localPath;
    private String description;
}
```

### 7. 苏格拉底式追问（SocraticGuideHandler）

```java
@Component
@RequiredArgsConstructor
public class SocraticGuideHandler {

    private final SessionManager sessionManager;
    private final SmartRouter smartRouter;
    private final PromptTemplateEngine templateEngine;

    // 提示级别
    private static final String HINT_KEY = "socratic:hint_level:";

    public void handle(WebSocketSession wsSession, WsMessage msg) {
        var sessionId = msg.getSessionId();
        var userResponse = msg.getPayload();
        var hintLevel = getHintLevel(sessionId); // 当前提示级别 1-4

        var context = sessionManager.getContext(sessionId);
        var variables = Map.of(
            "userResponse", userResponse,
            "currentHintLevel", String.valueOf(hintLevel),
            "history", formatHistory(context)
        );
        var prompt = templateEngine.render("interactive/socratic-guide.md", variables);
        var response = smartRouter.call(prompt);

        // 解析 AI 判断：用户是否需要下一级提示
        var decision = parseSocraticDecision(response);
        if (decision.isCorrect()) {
            // 用户答对，给出肯定和总结
            sendResponse(wsSession, sessionId, decision.getMessage());
            completeSession(sessionId);
        } else if (decision.needsNextHint()) {
            // 用户需要下一级提示
            incrementHintLevel(sessionId);
            sendResponse(wsSession, sessionId, decision.getMessage());
        } else {
            // 继续在当前级别追问
            sendResponse(wsSession, sessionId, decision.getMessage());
        }

        sessionManager.appendMessage(sessionId, new ChatMessage("user", userResponse));
        sessionManager.appendMessage(sessionId, new ChatMessage("assistant", decision.getMessage()));
    }
}
```

### 8. Debug 训练（DebugTrainerHandler）

```java
@Component
@RequiredArgsConstructor
public class DebugTrainerHandler {

    private final SmartRouter smartRouter;
    private final PromptTemplateEngine templateEngine;
    private final DebugTrainingRecordRepository recordRepo;

    /**
     * 生成有 bug 的代码
     */
    public BuggyCodeChallenge generateChallenge(String problemId) {
        var variables = Map.of("problemId", problemId);
        var prompt = templateEngine.render("interactive/debug-generate.md", variables);
        var response = smartRouter.call(prompt);
        return parseBuggyChallenge(response);
    }

    /**
     * 处理用户提交的修复
     */
    public void handle(WebSocketSession wsSession, WsMessage msg) {
        var payload = parseDebugSubmission(msg.getPayload());
        var sessionId = msg.getSessionId();

        var variables = Map.of(
            "buggyCode", payload.getBuggyCode(),
            "userFix", payload.getUserFix(),
            "actualBugs", payload.getActualBugsJson()
        );
        var prompt = templateEngine.render("interactive/debug-evaluate.md", variables);
        var response = smartRouter.call(prompt);

        var evaluation = parseDebugEvaluation(response);
        sendResponse(wsSession, sessionId, evaluation.getFeedback());

        // 记录训练数据
        recordRepo.save(new DebugTrainingRecord()
            .setUserId(payload.getUserId())
            .setProblemId(payload.getProblemId())
            .setBugType(evaluation.getBugType())
            .setFound(evaluation.isAllFound())
            .setHintsUsed(evaluation.getHintsUsed())
            .setCreatedAt(System.currentTimeMillis()));
    }
}

@Data @Accessors(chain = true)
public class BuggyCodeChallenge {
    private String code;                    // 含 bug 的代码
    private List<Bug> actualBugs;           // 实际 bug 列表（不暴露给前端）
    private List<TestCase> testCases;       // 测试用例（部分会触发 bug）
}

@Data @Accessors(chain = true)
public class Bug {
    private int lineNumber;
    private String type;        // OFF_BY_ONE / BOUNDARY / CONDITION / INIT
    private String description;
    private String correctCode;
}
```


## Data Flow

### 费曼模式数据流

```
前端 WebSocket 连接
  ↓ FEYNMAN_CHAT {sessionId, payload: "我觉得这题用双指针..."}
WebSocketGateway → FeynmanSessionHandler
  ↓
SessionManager.getContext(sessionId) → [历史对话]
  ↓
PromptTemplateEngine.render("feynman-chat.md", {userInput, history, round})
  ↓
SmartRouter.chat([system + history + user]) → AI 追问响应
  ↓
SessionManager.appendMessage(sessionId, userMsg + aiMsg)
  ↓
WebSocket 发送 AI_RESPONSE → 前端展示
```

### 面试模拟数据流

```
POST /api/interview/start {problemId, timeLimit: 45}
  ↓
InterviewSimulatorHandler.startInterview()
  → 创建 Session + 设定定时器 + 生成开场白
  ↓
WebSocket 持续交互（INTERVIEW_CHAT）
  → 状态机驱动: PROBLEM_SOLVING → FOLLOW_UP → CODING → VARIANT
  ↓
超时/用户结束 → InterviewSimulatorHandler.generateReport()
  → AI 评分（正确性/效率/沟通/代码质量各1-10分）
  → 持久化 InterviewReport → WebSocket 发送 INTERVIEW_REPORT
```

### SM-2 间隔重复数据流

```
GET /api/review/today → SpacedRepetitionService.getTodayReviews(userId)
  → 返回今日待复习卡片列表
  ↓
用户完成复习 → POST /api/review/record {cardId, quality: 4}
  ↓
SpacedRepetitionService.recordReview(cardId, quality)
  → SM-2 计算新间隔 → 更新 nextReviewAt → 保存 ReviewRecord
  ↓
GET /api/review/stats → LearningAnalyticsService.getStats(userId)
  → 返回掌握程度/遗忘曲线/薄弱点数据
```

## API Design

### REST API 端点

| 端点 | 方法 | 描述 | 请求体 |
|------|------|------|--------|
| `/api/v1/session/create` | POST | 创建交互式会话 | `{type, problemId}` |
| `/api/v1/session/{id}` | GET | 获取会话状态和历史 | - |
| `/api/v1/session/{id}/end` | POST | 结束会话并生成总结 | - |
| `/api/v1/import/url` | POST | 导入 URL 内容 | `{url}` |
| `/api/v1/import/{id}` | GET | 获取导入结果 | - |
| `/api/v1/interview/start` | POST | 开始面试模拟 | `{problemId, timeLimit, difficulty, companyStyle}` |
| `/api/v1/interview/{sessionId}/report` | GET | 获取面试评分报告 | - |
| `/api/v1/interview/history` | GET | 获取面试历史列表（含评分趋势） | - |
| `/api/v1/review/today` | GET | 获取今日待复习列表 | - |
| `/api/v1/review/record` | POST | 记录复习结果 | `{cardId, quality}` |
| `/api/v1/review/stats` | GET | 获取学习统计数据 | - |
| `/api/v1/daily-plan` | GET | 获取今日个性化学习计划 | - |
| `/api/v1/daily-plan/complete` | POST | 标记今日计划完成 | - |
| `/api/v1/daily-plan/history` | GET | 获取历史计划(参数:days=30) | - |
| `/api/v1/complexity-training/generate` | POST | 生成复杂度训练题 | `{mode, count}` |
| `/api/v1/complexity-training/submit` | POST | 提交训练答案 | `{questionId, answer}` |
| `/api/v1/complexity-training/stats` | GET | 获取训练统计 | - |
| `/api/v1/debug/challenge` | POST | 获取 Debug 挑战 | `{problemId}` |
| `/api/v1/debug/records` | GET | 获取 Debug 训练记录 | - |
| `/api/v1/users/me/achievements` | GET | 获取已解锁成就列表 | - |
| `/api/v1/achievements/definitions` | GET | 获取所有成就定义(公开) | - |

### WebSocket 端点

| 端点 | 描述 |
|------|------|
| `ws://host/ws/interactive` | 统一交互式 WebSocket 入口（首条消息携带JWT认证） |

### SSE 通知通道扩展

已有 `GET /api/v1/users/me/notifications/stream` SSE 端点，新增以下消息类型：

| 消息类型 | 触发时机 | 数据结构 |
|----------|----------|----------|
| `ACHIEVEMENT_UNLOCKED` | 用户解锁成就时 | `{achievementType, name, description, icon}` |
| `BROADCAST_ACHIEVEMENT` | 其他用户解锁成就时（全服飘屏） | `{nickname, achievementType, achievementName}` |
| `DAILY_PLAN_READY` | 每日计划生成完成时 | `{todayPlanId, reviewCount, newProblemTitle}` |

## Configuration

```yaml
# application.yml 新增配置
interactive:
  websocket:
    endpoint: /ws/interactive
    rate-limit: 5                          # 每用户每秒最大消息数
    max-message-size: 65536                # 最大消息大小（64KB）
  session:
    ttl-minutes: 30                        # 会话空闲过期时间
    reconnect-window-minutes: 15           # 断线重连窗口
    max-context-rounds: 20                 # 最大上下文轮次
    cleanup-interval-minutes: 5            # 过期清理间隔
  interview:
    default-time-limit: 45                 # 默认面试时间（分钟）
    time-warning-ratio: 0.75              # 时间提醒比例
  spaced-repetition:
    initial-ease-factor: 2.5              # SM-2 初始容易度
    minimum-ease-factor: 1.3              # 最小容易度
    daily-new-cards: 5                    # 每日新卡片推荐数
    review-batch-size: 20                 # 单次复习批量大小
  importer:
    connect-timeout-ms: 10000             # URL 请求超时
    read-timeout-ms: 30000
    max-content-length: 5242880           # 最大内容长度（5MB）
    comment-like-threshold: 10            # 评论点赞阈值
    image-storage-dir: data/imported-images/
```

## Error Handling

| 错误场景 | 处理策略 | 用户可见行为 |
|----------|----------|-------------|
| WebSocket 连接失败 | 前端自动重连（最多 3 次，指数退避） | 显示"连接中..."状态 |
| AI 响应超时 (>10s) | 发送 HINT_PROVIDED 消息提示等待 | "AI 正在思考，请稍候..." |
| 会话过期 | 返回 SESSION_EXPIRED 消息 | 弹窗提示"会话已过期，是否重新开始？" |
| URL 不可访问 | 返回 ImportException | "无法访问该链接，请检查 URL" |
| URL 内容为空 | 返回 ImportException | "未能从该页面提取到有效内容" |
| 速率限制触发 | 返回 ERROR 消息 | "请求过于频繁，请稍后再试" |
| SM-2 计算异常 | 回退到默认间隔（1天） | 用户无感知 |
| 面试超时 | 自动进入 SCORING 状态 | "面试时间到，正在生成评分报告..." |

## Correctness Properties

### Property 1: SM-2 间隔单调性
当用户连续回答正确（quality ≥ 3）时，复习间隔（interval）严格递增。当用户回答错误（quality < 3）时，间隔重置为 1。

**Validates: Requirements 4.1**

### Property 2: 会话上下文有界性
任何会话的上下文消息数量不超过 40 条（20轮 × 2）。超出时移除最早的消息。

**Validates: Requirements 1.2, 8.3**

### Property 3: 面试状态机合法转移
面试模拟器只能沿定义的有效路径转移状态（IDLE→PROBLEM_SOLVING→FOLLOW_UP→CODING→VARIANT→SCORING），不存在非法状态跳转。

**Validates: Requirements 3.1, 3.2**

### Property 4: 速率限制准确性
在任意 1 秒窗口内，单用户的消息处理数不超过 5 条。

**Validates: Requirements 8.5**

### Property 5: 断线重连一致性
15 分钟内断线重连后，恢复的上下文与断线前完全一致（消息数量和内容相同）。

**Validates: Requirements 8.4**

## Scope

### 包含
- WebSocket Gateway 统一通信层
- SessionManager 会话管理（含 Redis 上下文存储）
- FeynmanSessionHandler 费曼学习模式
- InterviewSimulatorHandler 面试模拟（含状态机 + 配置面板）
- SocraticGuideHandler 苏格拉底追问
- DebugTrainerHandler Debug 训练
- ReverseFeynmanHandler 反向费曼
- ContentImportService URL 解析引擎
- SpacedRepetitionService SM-2 间隔重复
- LearningAnalyticsService 学习数据统计
- AchievementCheckService 成就检测与解锁
- DailyPlanService 算法日历/每日计划
- ComplexityTrainingService 复杂度直觉训练
- BroadcastService 全服飘屏推送（复用 SSE 通道）
- 所有交互式 Prompt 模板
- REST API + WebSocket + SSE 端点
- 交互数据持久化

### 不包含
- 前端 WebSocket 客户端实现（归 Next.js 前端 spec）
- 用户认证系统（假设已有 JWT token）
- 支付/商业化逻辑
- 语音输入转文字（标记为后期功能）
- 移动端适配


---

## 补充设计（2026-06-21 UI Review 后新增）

### 成就触发规则引擎（AchievementCheckService）

```java
@Service
@RequiredArgsConstructor
public class AchievementCheckService {

    private final AchievementRepository achievementRepo;
    private final BroadcastService broadcastService;

    /**
     * 触发时机（事件驱动）：
     * - FIRST_PROBLEM: ContentPipeline 完成第一道题解析后，或用户首次标记完成
     * - PATTERN_MASTER: 用户完成该模式最后一题时（UserProgress 更新后检查）
     * - STREAK_7 / STREAK_30: 每日首次登录时检查连续天数
     * - FEYNMAN_SCHOLAR: 费曼会话 COMPLETED 时，检查总完成数 >= 20
     * - INTERVIEW_PRO: InterviewReport 保存后，检查总分 > 80
     * - BUG_HUNTER: DebugTrainingRecord 保存后，检查总正确率 > 90%
     * - SPEED_DEMON: InterviewReport 保存后，检查时长 < 25min 且总分 = 100
     */
    public void checkAndUnlock(String userId, AchievementTriggerEvent event) {
        // 1. 根据事件类型确定要检查的成就列表
        // 2. 逐一检查条件是否满足
        // 3. 满足且未解锁 → 创建 Achievement 记录
        // 4. 触发飘屏推送
    }
}
```

### 飘屏推送机制（BroadcastService）

```java
@Service
@RequiredArgsConstructor
public class BroadcastService {

    /**
     * 推送通道：复用已有 SSE 通知通道（GET /api/v1/users/me/notifications/stream）
     * 新增消息类型：BROADCAST_ACHIEVEMENT
     * 
     * 前端处理规则：
     * - 收到 BROADCAST_ACHIEVEMENT 事件后，展示飘屏动画
     * - 同时最多显示 2 条飘屏，新消息排队等待
     * - 飘屏右侧有 ✕ 关闭按钮
     * - 用户可在设置页关闭飘屏显示（UserPreference.notificationSettings.broadcast = false）
     * - 关闭后不接收 BROADCAST_ACHIEVEMENT 类型的 SSE 事件
     */
    public void broadcast(String userId, AchievementType type, String achievementName) {
        // 1. 创建 BroadcastMessage 记录
        // 2. 向所有在线用户的 SSE 通道推送 BROADCAST_ACHIEVEMENT 事件
        // 3. 跳过已关闭飘屏的用户
    }
}
```

### 每日计划生成逻辑（DailyPlanService）

```java
@Service
@RequiredArgsConstructor
public class DailyPlanService {

    /**
     * 生成时机：每日凌晨 00:05 定时任务（@Scheduled cron）
     * 为每个活跃用户（7天内有登录）生成当天计划
     * 
     * 生成逻辑：
     * 1. patternReviewId = 用户最薄弱模式（正确率最低）
     * 2. newProblemId = 该模式下用户未完成的最简单题目
     * 3. reviewCardCount = SpacedRepetitionService.getTodayReviews(userId).size()
     */
    @Scheduled(cron = "0 5 0 * * *")
    public void generateDailyPlans() { ... }
}
```

### 面试评分评级标准

| 总分范围 | 评级 | 含义 |
|----------|------|------|
| 90-100 | A+ | 卓越 |
| 80-89 | A | 优秀 |
| 70-79 | B+ | 良好 |
| 60-69 | B | 及格 |
| 50-59 | C | 需要提升 |
| < 50 | D | 建议大量练习 |

总分计算：`(correctnessScore + efficiencyScore + communicationScore + codeQualityScore) / 4 * 10`
