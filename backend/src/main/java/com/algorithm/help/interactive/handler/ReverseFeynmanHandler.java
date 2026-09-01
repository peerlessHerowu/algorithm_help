package com.algorithm.help.interactive.handler;

import com.algorithm.help.ai.SmartRouter;
import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.content.prompt.PromptTemplateEngine;
import com.algorithm.help.interactive.session.SessionManager;
import com.algorithm.help.interactive.ws.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 反向费曼消息处理器
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReverseFeynmanHandler implements MessageHandler {

    private final SessionManager sessionManager;
    private final PromptTemplateEngine templateEngine;
    private final SmartRouter smartRouter;
    private final ObjectMapper objectMapper;

    @Override
    public WsMessageType supportedType() {
        return WsMessageType.REVERSE_FEYNMAN_CHAT;
    }

    @Override
    public void handle(WebSocketSession session, WsMessage message) {
        String sessionId = message.getSessionId();
        String userCorrection = message.getPayload().toString();

        sessionManager.appendMessage(sessionId, "user", userCorrection);

        String evaluation = evaluateCorrection(sessionId, userCorrection);
        sessionManager.appendMessage(sessionId, "assistant", evaluation);

        sendResponse(session, sessionId, evaluation);
    }

    private String evaluateCorrection(String sessionId, String userCorrection) {
        List<Map<String, String>> context = sessionManager.getContext(sessionId);
        String history = context.stream()
                .map(m -> m.get("role") + ": " + m.get("content"))
                .collect(Collectors.joining("\n"));
        try {
            String prompt = templateEngine.render("interactive/reverse-feynman-evaluate.md", Map.of(
                    "buggyCode", "",
                    "errorType", "",
                    "studentAnswer", userCorrection,
                    "correctCode", ""
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.DETECT_ERRORS)
                    .setContent(prompt);
            return smartRouter.route(request).getContent();
        } catch (Exception e) {
            log.error("反向费曼评估失败: {}", e.getMessage());
            return "{\"passed\": false, \"feedback\": \"评估暂时不可用\"}";
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
            log.error("发送反向费曼响应失败: {}", e.getMessage());
        }
    }
}
