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
 * 费曼学习法消息处理器
 * <p>
 * 负责处理费曼对话的 WebSocket 消息：
 * - 多轮追问对话（最多 20 轮）
 * - 18 轮时发出提醒
 * - 20 轮自动触发总结
 *
 * @author algorithm-help
 * @since 1.0.0
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FeynmanSessionHandler implements MessageHandler {

    /** 最大对话轮次 */
    private static final int MAX_ROUNDS = 20;
    /** 提醒轮次 */
    private static final int WARNING_ROUND = 18;

    private final SessionManager sessionManager;
    private final PromptTemplateEngine templateEngine;
    private final SmartRouter smartRouter;
    private final ObjectMapper objectMapper;

    @Override
    public WsMessageType supportedType() {
        return WsMessageType.FEYNMAN_CHAT;
    }

    /**
     * 处理费曼对话消息
     *
     * @param session WebSocket 会话
     * @param message 客户端消息（payload 为用户输入文本）
     */
    @Override
    public void handle(WebSocketSession session, WsMessage message) {
        String sessionId = message.getSessionId();
        String userInput = message.getPayload();
        log.info("费曼对话: sessionId={}, inputLen={}", sessionId, userInput.length());

        // 追加用户消息
        sessionManager.appendMessage(sessionId, "user", userInput);

        // 计算当前轮次（user 消息数 = 轮次数）
        List<Map<String, String>> context = sessionManager.getContext(sessionId);
        int round = countUserRounds(context);

        // 第 18 轮发出系统提醒
        if (round == WARNING_ROUND) {
            sendSystemMessage(session, sessionId, "💡 还剩 2 轮对话，建议点击「结束并生成总结」保存学习成果。");
        }

        // 第 20 轮自动触发总结
        if (round >= MAX_ROUNDS) {
            sendSystemMessage(session, sessionId, "已达最大对话轮次，正在生成结构化总结...");
            String summary = generateStructuredSummary(sessionId, context, "未知题目");
            sendResponse(session, sessionId, summary, WsMessageType.FEYNMAN_SUMMARY);
            return;
        }

        // 正常追问
        String aiReply = generateFollowUp(context, userInput, round);
        sessionManager.appendMessage(sessionId, "assistant", aiReply);
        sendResponse(session, sessionId, aiReply, WsMessageType.AI_RESPONSE);
    }

    /**
     * 生成结构化学习总结（会话结束时调用）
     *
     * @param sessionId  会话 ID
     * @param problemTitle 题目名称
     * @return AI 生成的 JSON 格式总结
     */
    public String generateStructuredSummary(String sessionId, String problemTitle) {
        List<Map<String, String>> context = sessionManager.getContext(sessionId);
        return generateStructuredSummary(sessionId, context, problemTitle);
    }

    /**
     * 生成多角度类比列表
     *
     * @param sessionId  会话 ID
     * @param approach   核心解题思路（从总结中提取）
     * @param problemTitle 题目名称
     * @return AI 生成的 JSON 格式类比列表
     */
    public String generateAnalogies(String sessionId, String approach, String problemTitle) {
        log.info("生成类比: sessionId={}", sessionId);
        try {
            String prompt = templateEngine.render("interactive/feynman-analogies.md", Map.of(
                    "title", problemTitle,
                    "approach", approach
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.CHAT)
                    .setContent(prompt);
            return smartRouter.route(request).getContent();
        } catch (Exception e) {
            log.error("类比生成失败: sessionId={}, error={}", sessionId, e.getMessage());
            return "{\"analogies\": []}";
        }
    }

    // ======================== 私有方法 ========================

    /**
     * 生成 AI 追问
     */
    private String generateFollowUp(List<Map<String, String>> context, String userInput, int round) {
        String history = formatHistory(context);
        try {
            String prompt = templateEngine.render("interactive/feynman-chat.md", Map.of(
                    "title", "算法题",
                    "description", "",
                    "history", history,
                    "user_input", userInput,
                    "round", String.valueOf(round)
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.CHAT)
                    .setContent(prompt);
            return smartRouter.route(request).getContent();
        } catch (Exception e) {
            log.error("费曼追问生成失败: {}", e.getMessage());
            return "你能再详细说说这一步的思路吗？";
        }
    }

    /**
     * 生成结构化总结（内部方法）
     */
    private String generateStructuredSummary(String sessionId,
                                              List<Map<String, String>> context,
                                              String problemTitle) {
        log.info("生成费曼总结: sessionId={}", sessionId);
        String history = formatHistory(context);
        try {
            String prompt = templateEngine.render("interactive/feynman-summarize.md", Map.of(
                    "title", problemTitle,
                    "history", history
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.CHAT)
                    .setContent(prompt);
            return smartRouter.route(request).getContent();
        } catch (Exception e) {
            log.error("费曼总结生成失败: sessionId={}, error={}", sessionId, e.getMessage());
            return "{\"error\": \"总结生成失败，请重试\"}";
        }
    }

    /**
     * 统计 user 消息轮次数
     */
    private int countUserRounds(List<Map<String, String>> context) {
        return (int) context.stream()
                .filter(m -> "user".equals(m.get("role")))
                .count();
    }

    /**
     * 格式化对话历史（最近 10 轮，避免 prompt 过长）
     */
    private String formatHistory(List<Map<String, String>> context) {
        List<Map<String, String>> recent = context.size() > 20
                ? context.subList(context.size() - 20, context.size())
                : context;
        return recent.stream()
                .map(m -> {
                    String role = "user".equals(m.get("role")) ? "学生" : "教练";
                    return role + ": " + m.get("content");
                })
                .collect(Collectors.joining("\n"));
    }

    /**
     * 发送 AI 响应消息
     */
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
            log.error("发送费曼响应失败: sessionId={}, error={}", sessionId, e.getMessage());
        }
    }

    /**
     * 发送系统提示消息
     */
    private void sendSystemMessage(WebSocketSession session, String sessionId, String text) {
        sendResponse(session, sessionId, text, WsMessageType.SYSTEM_MESSAGE);
    }
}
