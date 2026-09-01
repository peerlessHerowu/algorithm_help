package com.algorithm.help.interactive.handler;

import com.algorithm.help.ai.SmartRouter;
import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.content.prompt.PromptTemplateEngine;
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
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 苏格拉底式追问消息处理器
 * <p>
 * 渐进式引导学生自主解题：
 * Level 1（方向）→ Level 2（方法）→ Level 3（伪代码）→ Level 4（完整引导）
 * 推导得分：Level 1=100分，Level 2=75分，Level 3=50分，Level 4=25分
 *
 * @author algorithm-help
 * @since 1.0.0
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SocraticGuideHandler implements MessageHandler {

    private static final String HINT_KEY = "socratic:hint_level:";
    private static final int MAX_HINT_LEVEL = 4;
    private static final long HINT_TTL_MINUTES = 60;

    private final SessionManager sessionManager;
    private final PromptTemplateEngine templateEngine;
    private final SmartRouter smartRouter;
    private final ObjectMapper objectMapper;
    private final RedisTemplate<String, Object> redisTemplate;

    @Override
    public WsMessageType supportedType() {
        return WsMessageType.SOCRATIC_CHAT;
    }

    /**
     * 处理苏格拉底对话消息
     */
    @Override
    public void handle(WebSocketSession session, WsMessage message) {
        String sessionId = message.getSessionId();
        String userInput = message.getPayload();
        int hintLevel = getCurrentHintLevel(sessionId);
        log.info("苏格拉底对话: sessionId={}, hintLevel={}", sessionId, hintLevel);

        sessionManager.appendMessage(sessionId, "user", userInput);

        List<Map<String, String>> context = sessionManager.getContext(sessionId);
        String aiReply = generateGuide(context, userInput, hintLevel);

        // 解析 AI 状态标记
        if (aiReply.contains("[SOLVED]")) {
            aiReply = aiReply.replace("[SOLVED]", "").trim();
            sessionManager.appendMessage(sessionId, "assistant", aiReply);
            // 生成总结
            String summary = generateSummary(context, hintLevel, "算法题");
            sendResponse(session, sessionId, aiReply, WsMessageType.AI_RESPONSE);
            sendResponse(session, sessionId, summary, WsMessageType.SOCRATIC_SUMMARY);
            sessionManager.completeSession(sessionId);
            return;
        }

        if (aiReply.contains("[UPGRADE_HINT]")) {
            aiReply = aiReply.replace("[UPGRADE_HINT]", "").trim();
            upgradeHintLevel(sessionId);
            int newLevel = getCurrentHintLevel(sessionId);
            sendSystemMessage(session, sessionId,
                    String.format("📈 提示已升级到 Level %d / %d", newLevel, MAX_HINT_LEVEL));
        }

        if (aiReply.contains("[CORRECT]")) {
            aiReply = aiReply.replace("[CORRECT]", "").trim();
        }

        sessionManager.appendMessage(sessionId, "assistant", aiReply);
        sendResponse(session, sessionId, aiReply, WsMessageType.AI_RESPONSE);
    }

    /**
     * 获取当前提示级别
     *
     * @param sessionId 会话 ID
     * @return 当前提示级别（1-4）
     */
    public int getCurrentHintLevel(String sessionId) {
        Object level = redisTemplate.opsForValue().get(HINT_KEY + sessionId);
        if (level == null) {
            redisTemplate.opsForValue().set(HINT_KEY + sessionId, "1",
                    HINT_TTL_MINUTES, TimeUnit.MINUTES);
            return 1;
        }
        return Integer.parseInt(level.toString());
    }

    /**
     * 升级提示级别
     */
    public void upgradeHintLevel(String sessionId) {
        int current = getCurrentHintLevel(sessionId);
        if (current < MAX_HINT_LEVEL) {
            redisTemplate.opsForValue().set(HINT_KEY + sessionId, String.valueOf(current + 1),
                    HINT_TTL_MINUTES, TimeUnit.MINUTES);
        }
    }

    /**
     * 计算推导得分
     *
     * @param sessionId 会话 ID
     * @return 得分（25/50/75/100）
     */
    public int calculateScore(String sessionId) {
        int hintLevel = getCurrentHintLevel(sessionId);
        return Math.max(25, 125 - hintLevel * 25);
    }

    /**
     * 生成总结报告
     */
    public String generateSummary(String sessionId, String problemTitle) {
        List<Map<String, String>> context = sessionManager.getContext(sessionId);
        int hintLevel = getCurrentHintLevel(sessionId);
        return generateSummary(context, hintLevel, problemTitle);
    }

    // ======================== 私有方法 ========================

    private String generateGuide(List<Map<String, String>> context,
                                  String userInput, int hintLevel) {
        String history = formatHistory(context);
        try {
            String prompt = templateEngine.render("interactive/socratic-guide.md", Map.of(
                    "title", "算法题",
                    "description", "",
                    "history", history,
                    "user_input", userInput,
                    "hintLevel", String.valueOf(hintLevel)
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.CHAT)
                    .setContent(prompt);
            return smartRouter.route(request).getContent();
        } catch (Exception e) {
            log.error("苏格拉底引导生成失败: {}", e.getMessage());
            return "你能从另一个角度思考这道题吗？";
        }
    }

    private String generateSummary(List<Map<String, String>> context,
                                    int hintLevel, String problemTitle) {
        String history = formatHistory(context);
        try {
            String prompt = templateEngine.render("interactive/socratic-summary.md", Map.of(
                    "title", problemTitle,
                    "history", history,
                    "hintLevel", String.valueOf(hintLevel)
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.CHAT)
                    .setContent(prompt);
            return smartRouter.route(request).getContent();
        } catch (Exception e) {
            log.error("苏格拉底总结生成失败: {}", e.getMessage());
            return "{\"score\": " + calculateScoreFromLevel(hintLevel) + "}";
        }
    }

    private int calculateScoreFromLevel(int hintLevel) {
        return Math.max(25, 125 - hintLevel * 25);
    }

    private String formatHistory(List<Map<String, String>> context) {
        return context.stream()
                .map(m -> {
                    String role = "user".equals(m.get("role")) ? "学生" : "教练";
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
            log.error("发送苏格拉底响应失败: {}", e.getMessage());
        }
    }

    private void sendSystemMessage(WebSocketSession session, String sessionId, String text) {
        sendResponse(session, sessionId, text, WsMessageType.SYSTEM_MESSAGE);
    }
}
