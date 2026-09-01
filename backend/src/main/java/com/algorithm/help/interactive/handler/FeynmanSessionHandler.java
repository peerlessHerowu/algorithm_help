package com.algorithm.help.interactive.handler;

import com.algorithm.help.ai.SmartRouter;
import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.ai.model.AiResponse;
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
 * 费曼学习法消息处理器
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FeynmanSessionHandler implements MessageHandler {

    private final SessionManager sessionManager;
    private final PromptTemplateEngine templateEngine;
    private final SmartRouter smartRouter;
    private final ObjectMapper objectMapper;

    @Override
    public WsMessageType supportedType() {
        return WsMessageType.FEYNMAN_CHAT;
    }

    @Override
    public void handle(WebSocketSession session, WsMessage message) {
        String sessionId = message.getSessionId();
        String userInput = message.getPayload().toString();

        // 追加用户消息
        sessionManager.appendMessage(sessionId, "user", userInput);

        // 构建 prompt 并调用 AI
        String aiReply = generateReply(sessionId, userInput);

        // 追加 AI 回复
        sessionManager.appendMessage(sessionId, "assistant", aiReply);

        // 发送响应
        sendResponse(session, sessionId, aiReply);
    }

    /**
     * 生成 AI 追问回复
     */
    private String generateReply(String sessionId, String userInput) {
        List<Map<String, String>> context = sessionManager.getContext(sessionId);
        String history = formatHistory(context);

        try {
            String prompt = templateEngine.render("interactive/feynman-chat.md", Map.of(
                    "title", "算法题",
                    "description", "",
                    "history", history,
                    "user_input", userInput
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.CHAT)
                    .setContent(prompt);
            AiResponse response = smartRouter.route(request);
            return response.getContent();
        } catch (Exception e) {
            log.error("费曼模式 AI 调用失败: {}", e.getMessage());
            return "抱歉，我暂时无法回复。请稍后重试。";
        }
    }

    private String formatHistory(List<Map<String, String>> context) {
        return context.stream()
                .map(m -> m.get("role") + ": " + m.get("content"))
                .collect(Collectors.joining("\n"));
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
            log.error("发送费曼响应失败: {}", e.getMessage());
        }
    }
}
