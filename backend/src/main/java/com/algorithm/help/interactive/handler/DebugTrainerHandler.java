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

import java.util.Map;

/**
 * Debug 训练消息处理器
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DebugTrainerHandler implements MessageHandler {

    private final SessionManager sessionManager;
    private final PromptTemplateEngine templateEngine;
    private final SmartRouter smartRouter;
    private final ObjectMapper objectMapper;

    @Override
    public WsMessageType supportedType() {
        return WsMessageType.DEBUG_SUBMIT;
    }

    @Override
    public void handle(WebSocketSession session, WsMessage message) {
        String sessionId = message.getSessionId();
        String userFix = message.getPayload().toString();

        sessionManager.appendMessage(sessionId, "user", userFix);

        String evaluation = evaluateFix(sessionId, userFix);
        sessionManager.appendMessage(sessionId, "assistant", evaluation);

        sendResponse(session, sessionId, evaluation);
    }

    private String evaluateFix(String sessionId, String userFix) {
        try {
            String prompt = templateEngine.render("interactive/debug-evaluate.md", Map.of(
                    "buggyCode", "",
                    "bugsJson", "[]",
                    "userFix", userFix
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.DETECT_ERRORS)
                    .setContent(prompt);
            return smartRouter.route(request).getContent();
        } catch (Exception e) {
            log.error("Debug 评估失败: {}", e.getMessage());
            return "{\"score\": 0, \"feedback\": \"评估暂时不可用\"}";
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
            log.error("发送 Debug 响应失败: {}", e.getMessage());
        }
    }
}
