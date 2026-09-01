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
import java.util.stream.Collectors;

/**
 * 苏格拉底式追问消息处理器
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SocraticGuideHandler implements MessageHandler {

    private static final String HINT_LEVEL_PREFIX = "socratic:hint_level:";

    private final SessionManager sessionManager;
    private final PromptTemplateEngine templateEngine;
    private final SmartRouter smartRouter;
    private final ObjectMapper objectMapper;
    private final RedisTemplate<String, Object> redisTemplate;

    @Override
    public WsMessageType supportedType() {
        return WsMessageType.SOCRATIC_CHAT;
    }

    @Override
    public void handle(WebSocketSession session, WsMessage message) {
        String sessionId = message.getSessionId();
        String userInput = message.getPayload().toString();

        sessionManager.appendMessage(sessionId, "user", userInput);

        int hintLevel = getCurrentHintLevel(sessionId);
        String aiReply = generateGuide(sessionId, userInput, hintLevel);
        sessionManager.appendMessage(sessionId, "assistant", aiReply);

        sendResponse(session, sessionId, aiReply);
    }

    /**
     * 获取当前提示级别（1-4）
     */
    private int getCurrentHintLevel(String sessionId) {
        Object level = redisTemplate.opsForValue().get(HINT_LEVEL_PREFIX + sessionId);
        return level != null ? Integer.parseInt(level.toString()) : 1;
    }

    /**
     * 升级提示级别
     */
    public void upgradeHintLevel(String sessionId) {
        int current = getCurrentHintLevel(sessionId);
        if (current < 4) {
            redisTemplate.opsForValue().set(HINT_LEVEL_PREFIX + sessionId, current + 1);
        }
    }

    private String generateGuide(String sessionId, String userInput, int hintLevel) {
        List<Map<String, String>> context = sessionManager.getContext(sessionId);
        String history = context.stream()
                .map(m -> m.get("role") + ": " + m.get("content"))
                .collect(Collectors.joining("\n"));
        try {
            String prompt = templateEngine.render("interactive/socratic-guide.md", Map.of(
                    "title", "算法题",
                    "description", "",
                    "hintLevel", String.valueOf(hintLevel),
                    "history", history
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.CHAT)
                    .setContent(prompt);
            return smartRouter.route(request).getContent();
        } catch (Exception e) {
            log.error("苏格拉底引导生成失败: {}", e.getMessage());
            return "你能换个角度想想吗？";
        }
    }

    private void sendResponse(WebSocketSession session, String sessionId, String content) {
        try {
            WsMessage response = WsMessage.builder()
                    .type(WsMessageType.AI_RESPONSE)
                    .sessionId(sessionId)
                    .payload(content)
                    .timestamp(System.currentTimeMillis())
                    .build();
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
        } catch (Exception e) {
            log.error("发送苏格拉底响应失败: {}", e.getMessage());
        }
    }
}
