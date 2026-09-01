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
 * 面试模拟消息处理器
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class InterviewSimulatorHandler implements MessageHandler {

    private static final String STATE_PREFIX = "interview:state:";

    private final SessionManager sessionManager;
    private final PromptTemplateEngine templateEngine;
    private final SmartRouter smartRouter;
    private final ObjectMapper objectMapper;
    private final RedisTemplate<String, Object> redisTemplate;

    @Override
    public WsMessageType supportedType() {
        return WsMessageType.INTERVIEW_CHAT;
    }

    @Override
    public void handle(WebSocketSession session, WsMessage message) {
        String sessionId = message.getSessionId();
        String userInput = message.getPayload().toString();

        sessionManager.appendMessage(sessionId, "user", userInput);

        String aiReply = generateFollowUp(sessionId, userInput);
        sessionManager.appendMessage(sessionId, "assistant", aiReply);

        sendResponse(session, sessionId, aiReply);
    }

    private String generateFollowUp(String sessionId, String userInput) {
        List<Map<String, String>> context = sessionManager.getContext(sessionId);
        String history = context.stream()
                .map(m -> m.get("role") + ": " + m.get("content"))
                .collect(Collectors.joining("\n"));
        try {
            String prompt = templateEngine.render("interactive/interview-followup.md", Map.of(
                    "history", history,
                    "user_input", userInput
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.CHAT)
                    .setContent(prompt);
            return smartRouter.route(request).getContent();
        } catch (Exception e) {
            log.error("面试追问生成失败: {}", e.getMessage());
            return "你能再详细解释一下吗？";
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
            log.error("发送面试响应失败: {}", e.getMessage());
        }
    }
}
