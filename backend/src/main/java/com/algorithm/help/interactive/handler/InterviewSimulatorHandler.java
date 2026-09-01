package com.algorithm.help.interactive.handler;

import com.algorithm.help.ai.SmartRouter;
import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.content.prompt.PromptTemplateEngine;
import com.algorithm.help.interactive.interview.InterviewReport;
import com.algorithm.help.interactive.interview.InterviewScoreService;
import com.algorithm.help.interactive.interview.InterviewState;
import com.algorithm.help.interactive.session.SessionManager;
import com.algorithm.help.interactive.ws.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.List;
import java.util.Map;
import java.util.concurrent.*;
import java.util.stream.Collectors;

/**
 * 面试模拟消息处理器
 * <p>
 * 状态机：IDLE → PROBLEM_SOLVING → FOLLOW_UP → CODING → VARIANT → SCORING
 * 计时器：定时发送时间警告和自动结束
 *
 * @author algorithm-help
 * @since 1.0.0
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class InterviewSimulatorHandler implements MessageHandler {

    private static final String STATE_KEY = "interview:state:";
    private static final String CONFIG_KEY = "interview:config:";

    private final SessionManager sessionManager;
    private final PromptTemplateEngine templateEngine;
    private final SmartRouter smartRouter;
    private final ObjectMapper objectMapper;
    private final RedisTemplate<String, Object> redisTemplate;
    private final InterviewScoreService scoreService;

    /** 计时器线程池 */
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);
    /** session → 计时器 Future */
    private final ConcurrentHashMap<String, ScheduledFuture<?>> timers = new ConcurrentHashMap<>();

    @Override
    public WsMessageType supportedType() {
        return WsMessageType.INTERVIEW_CHAT;
    }

    /**
     * 处理面试消息
     */
    @Override
    public void handle(WebSocketSession session, WsMessage message) {
        String sessionId = message.getSessionId();
        String userInput = message.getPayload();
        InterviewState state = getState(sessionId);
        log.info("面试消息: sessionId={}, state={}, inputLen={}", sessionId, state, userInput.length());

        sessionManager.appendMessage(sessionId, "user", userInput);

        switch (state) {
            case PROBLEM_SOLVING, FOLLOW_UP -> handleSolving(session, sessionId, userInput);
            case CODING -> handleCoding(session, sessionId, userInput);
            case VARIANT -> handleVariant(session, sessionId, userInput);
            default -> sendError(session, sessionId, "面试尚未开始，请先调用 /start 接口");
        }
    }

    /**
     * 启动面试
     *
     * @param session   WebSocket 会话
     * @param sessionId 会话 ID
     * @param config    面试配置（题目、时长、公司风格）
     * @param userId    用户 ID
     * @param problemId 题目 ID
     */
    public void startInterview(WebSocketSession session, String sessionId,
                               Map<String, String> config, String userId, String problemId) {
        log.info("面试开始: sessionId={}, config={}", sessionId, config);
        // 设置初始状态
        setState(sessionId, InterviewState.PROBLEM_SOLVING);
        // 保存配置
        try {
            redisTemplate.opsForValue().set(CONFIG_KEY + sessionId,
                    objectMapper.writeValueAsString(config));
        } catch (Exception e) {
            log.warn("保存面试配置失败: {}", e.getMessage());
        }

        // 生成开场白
        String opening = generateOpening(config);
        sessionManager.appendMessage(sessionId, "assistant", opening);
        sendResponse(session, sessionId, opening, WsMessageType.AI_RESPONSE);

        // 启动计时器
        int timeLimitMinutes = parseInt(config.getOrDefault("timeLimit", "45"), 45);
        scheduleTimers(session, sessionId, timeLimitMinutes, userId);
    }

    /**
     * 结束面试并生成评分报告
     */
    public InterviewReport endInterview(String sessionId, String userId, String problemId) {
        log.info("面试结束，生成评分: sessionId={}", sessionId);
        setState(sessionId, InterviewState.SCORING);
        // 取消计时器
        cancelTimers(sessionId);
        // 生成评分报告
        return scoreService.generateReport(sessionId, userId, problemId);
    }

    // ======================== 私有方法 ========================

    /**
     * 处理解题/追问阶段
     */
    private void handleSolving(WebSocketSession session, String sessionId, String userInput) {
        List<Map<String, String>> context = sessionManager.getContext(sessionId);
        String history = formatHistory(context);
        InterviewState currentState = getState(sessionId);

        try {
            String prompt = templateEngine.render("interactive/interview-followup.md", Map.of(
                    "history", history,
                    "user_input", userInput,
                    "stage", currentState.name()
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.CHAT)
                    .setContent(prompt);
            String aiReply = smartRouter.route(request).getContent();

            // 检查是否应推进阶段
            if (aiReply.contains("[ADVANCE]")) {
                aiReply = aiReply.replace("[ADVANCE]", "").trim();
                setState(sessionId, InterviewState.CODING);
                sendResponse(session, sessionId,
                        "💻 好的，现在请写出你的代码实现。", WsMessageType.AI_RESPONSE);
            }

            sessionManager.appendMessage(sessionId, "assistant", aiReply);
            sendResponse(session, sessionId, aiReply, WsMessageType.AI_RESPONSE);
        } catch (Exception e) {
            log.error("面试追问生成失败: {}", e.getMessage());
            sendResponse(session, sessionId, "你能再详细解释一下你的思路吗？", WsMessageType.AI_RESPONSE);
        }
    }

    /**
     * 处理编码阶段（AI 审查代码）
     */
    private void handleCoding(WebSocketSession session, String sessionId, String userCode) {
        List<Map<String, String>> context = sessionManager.getContext(sessionId);
        String history = formatHistory(context);
        try {
            String prompt = templateEngine.render("interactive/interview-followup.md", Map.of(
                    "history", history,
                    "user_input", "候选人提交了代码：\n" + userCode,
                    "stage", "CODING"
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.DETECT_ERRORS)
                    .setContent(prompt);
            String feedback = smartRouter.route(request).getContent();
            sessionManager.appendMessage(sessionId, "assistant", feedback);
            sendResponse(session, sessionId, feedback, WsMessageType.AI_RESPONSE);
        } catch (Exception e) {
            log.error("代码审查失败: {}", e.getMessage());
        }
    }

    /**
     * 处理变体题阶段
     */
    private void handleVariant(WebSocketSession session, String sessionId, String userInput) {
        handleSolving(session, sessionId, userInput);
    }

    /**
     * 生成面试开场白
     */
    private String generateOpening(Map<String, String> config) {
        try {
            String prompt = templateEngine.render("interactive/interview-opening.md", Map.of(
                    "title", config.getOrDefault("problemTitle", "算法题"),
                    "description", config.getOrDefault("problemDescription", ""),
                    "difficulty", config.getOrDefault("difficulty", "MEDIUM"),
                    "timeLimit", config.getOrDefault("timeLimit", "45"),
                    "company", config.getOrDefault("companyStyle", "GENERAL")
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.CHAT)
                    .setContent(prompt);
            return smartRouter.route(request).getContent();
        } catch (Exception e) {
            log.error("开场白生成失败: {}", e.getMessage());
            return "你好，我们开始今天的面试。请看一下这道题，准备好后告诉我你的思路。";
        }
    }

    /**
     * 调度时间提醒和自动结束
     */
    private void scheduleTimers(WebSocketSession session, String sessionId,
                                int timeLimitMinutes, String userId) {
        long warningDelay = (long)(timeLimitMinutes * 0.75 * 60 * 1000);
        long endDelay = (long)(timeLimitMinutes * 60 * 1000);

        // 75% 时间提醒
        ScheduledFuture<?> warnFuture = scheduler.schedule(() -> {
            if (session.isOpen()) {
                sendResponse(session, sessionId,
                        String.format("⏰ 面试进行了 %d 分钟，请注意时间分配。",
                                (int)(timeLimitMinutes * 0.75)),
                        WsMessageType.INTERVIEW_TIME_WARNING);
            }
        }, warningDelay, TimeUnit.MILLISECONDS);

        // 时间到自动结束
        ScheduledFuture<?> endFuture = scheduler.schedule(() -> {
            if (session.isOpen()) {
                sendResponse(session, sessionId, "⏱️ 面试时间到，正在生成评分报告...",
                        WsMessageType.INTERVIEW_TIME_WARNING);
                // 生成评分报告
                InterviewReport report = endInterview(sessionId, userId, "");
                try {
                    String reportJson = objectMapper.writeValueAsString(report);
                    sendResponse(session, sessionId, reportJson, WsMessageType.INTERVIEW_REPORT);
                } catch (Exception e) {
                    log.error("发送评分报告失败: {}", e.getMessage());
                }
            }
        }, endDelay, TimeUnit.MILLISECONDS);

        timers.put(sessionId + "_warn", warnFuture);
        timers.put(sessionId + "_end", endFuture);
    }

    /**
     * 取消计时器
     */
    private void cancelTimers(String sessionId) {
        ScheduledFuture<?> warn = timers.remove(sessionId + "_warn");
        ScheduledFuture<?> end = timers.remove(sessionId + "_end");
        if (warn != null) warn.cancel(false);
        if (end != null) end.cancel(false);
    }

    /**
     * 获取面试状态
     */
    public InterviewState getState(String sessionId) {
        Object state = redisTemplate.opsForValue().get(STATE_KEY + sessionId);
        if (state == null) return InterviewState.IDLE;
        try {
            return InterviewState.valueOf(state.toString());
        } catch (Exception e) {
            return InterviewState.IDLE;
        }
    }

    /**
     * 设置面试状态
     */
    public void setState(String sessionId, InterviewState state) {
        redisTemplate.opsForValue().set(STATE_KEY + sessionId, state.name());
    }

    private String formatHistory(List<Map<String, String>> context) {
        return context.stream()
                .map(m -> {
                    String role = "user".equals(m.get("role")) ? "候选人" : "面试官";
                    return role + ": " + m.get("content");
                })
                .collect(Collectors.joining("\n"));
    }

    private void sendResponse(WebSocketSession session, String sessionId,
                              String content, WsMessageType type) {
        try {
            WsMessage response = WsMessage.builder()
                    .type(type)
                    .sessionId(sessionId)
                    .payload(content)
                    .timestamp(System.currentTimeMillis())
                    .build();
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
        } catch (Exception e) {
            log.error("发送面试响应失败: {}", e.getMessage());
        }
    }

    private void sendError(WebSocketSession session, String sessionId, String msg) {
        sendResponse(session, sessionId, msg, WsMessageType.ERROR);
    }

    private int parseInt(String value, int defaultVal) {
        try {
            return Integer.parseInt(value);
        } catch (Exception e) {
            return defaultVal;
        }
    }
}
