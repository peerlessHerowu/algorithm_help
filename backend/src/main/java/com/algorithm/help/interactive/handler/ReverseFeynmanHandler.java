package com.algorithm.help.interactive.handler;

import com.algorithm.help.ai.SmartRouter;
import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.content.prompt.PromptTemplateEngine;
import com.algorithm.help.interactive.review.CardType;
import com.algorithm.help.interactive.review.SpacedRepetitionService;
import com.algorithm.help.interactive.session.SessionManager;
import com.algorithm.help.interactive.ws.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * 反向费曼消息处理器
 * <p>
 * AI 故意讲错 → 学生指出错误 → AI 确认纠正 → 自动创建复习卡片
 *
 * @author algorithm-help
 * @since 1.0.0
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReverseFeynmanHandler implements MessageHandler {

    private static final String CONTENT_KEY = "reverse_feynman:content:";
    private static final long CONTENT_TTL = 30;

    private final SessionManager sessionManager;
    private final PromptTemplateEngine templateEngine;
    private final SmartRouter smartRouter;
    private final ObjectMapper objectMapper;
    private final RedisTemplate<String, Object> redisTemplate;
    private final SpacedRepetitionService reviewService;

    @Override
    public WsMessageType supportedType() {
        return WsMessageType.REVERSE_FEYNMAN_CHAT;
    }

    /**
     * 处理用户纠错消息
     * <p>
     * payload 格式：{"paragraphId": "p2", "correction": "用户的纠正内容"}
     */
    @Override
    public void handle(WebSocketSession session, WsMessage message) {
        String sessionId = message.getSessionId();
        log.info("反向费曼纠错: sessionId={}", sessionId);

        try {
            CorrectionPayload payload = objectMapper.readValue(
                    message.getPayload(), CorrectionPayload.class);

            // 从 Redis 获取原始内容（含真实错误信息）
            String contentJson = (String) redisTemplate.opsForValue().get(CONTENT_KEY + sessionId);
            if (contentJson == null) {
                sendResponse(session, sessionId,
                        "{\"error\": \"内容已过期，请重新生成\"}", WsMessageType.ERROR);
                return;
            }

            // 找到对应段落的错误信息
            JsonNode content = objectMapper.readTree(contentJson);
            JsonNode errorInfo = findErrorForParagraph(content, payload.getParagraphId());

            if (errorInfo == null) {
                // 学生指出了一个没有错误的段落
                sendResponse(session, sessionId,
                        "{\"passed\": false, \"feedback\": \"这段话是正确的，请仔细找找其他段落\"}",
                        WsMessageType.AI_RESPONSE);
                return;
            }

            // 评估学生的纠正
            String evaluation = evaluateCorrection(errorInfo, payload.getCorrection());
            sessionManager.appendMessage(sessionId, "user", payload.getCorrection());
            sessionManager.appendMessage(sessionId, "assistant", evaluation);

            // 如果纠错成功，自动创建复习卡片（Task 19）
            JsonNode evalNode = objectMapper.readTree(evaluation);
            if (evalNode.path("passed").asBoolean(false)) {
                createReviewCardAfterCorrection(sessionId, errorInfo, evaluation);
            }

            sendResponse(session, sessionId, evaluation, WsMessageType.AI_RESPONSE);
        } catch (Exception e) {
            log.error("反向费曼处理失败: sessionId={}, error={}", sessionId, e.getMessage());
            sendResponse(session, sessionId,
                    "{\"error\": \"处理失败，请重试\"}", WsMessageType.ERROR);
        }
    }

    /**
     * 生成含错误的解释内容
     *
     * @param sessionId   会话 ID
     * @param problemTitle 题目名称
     * @param description  题目描述
     * @param errorCount   错误数量（1-2）
     * @param difficulty   错误难度（EASY/MEDIUM/HARD）
     * @return 段落列表 JSON（不含 hasError 字段）
     */
    public String generateWithError(String sessionId, String problemTitle,
                                     String description, int errorCount, String difficulty) {
        log.info("生成反向费曼内容: sessionId={}, errors={}", sessionId, errorCount);
        try {
            String prompt = templateEngine.render("interactive/reverse-feynman-generate.md", Map.of(
                    "title", problemTitle,
                    "description", description,
                    "errorCount", String.valueOf(errorCount),
                    "difficulty", difficulty
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.CHAT)
                    .setContent(prompt);
            String fullJson = extractJson(smartRouter.route(request).getContent());

            // 缓存完整信息（含错误位置，不给前端看）
            redisTemplate.opsForValue().set(CONTENT_KEY + sessionId, fullJson,
                    CONTENT_TTL, TimeUnit.MINUTES);

            // 返回给前端的版本：只含 paragraphId + content，不含 hasError
            return buildClientResponse(fullJson);
        } catch (Exception e) {
            log.error("反向费曼内容生成失败: {}", e.getMessage());
            return "{\"error\": \"内容生成失败，请重试\"}";
        }
    }

    // ======================== 私有方法 ========================

    /**
     * 评估学生纠正
     */
    private String evaluateCorrection(JsonNode errorInfo, String studentAnswer) {
        try {
            String prompt = templateEngine.render("interactive/reverse-feynman-evaluate.md", Map.of(
                    "paragraphId", errorInfo.path("paragraphId").asText(),
                    "wrongStatement", errorInfo.path("wrongStatement").asText(),
                    "correctStatement", errorInfo.path("correctStatement").asText(),
                    "errorType", errorInfo.path("errorType").asText(),
                    "studentAnswer", studentAnswer
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.DETECT_ERRORS)
                    .setContent(prompt);
            return extractJson(smartRouter.route(request).getContent());
        } catch (Exception e) {
            log.error("反向费曼评估失败: {}", e.getMessage());
            return "{\"passed\": false, \"feedback\": \"评估暂时不可用\"}";
        }
    }

    /**
     * Task 19：纠错成功后自动创建复习卡片
     */
    private void createReviewCardAfterCorrection(String sessionId,
                                                  JsonNode errorInfo,
                                                  String evaluation) {
        sessionManager.getSession(sessionId).ifPresent(session -> {
            try {
                // 创建 EXPLAIN 类型复习卡片
                var card = reviewService.createCard(
                        session.getUserId(), session.getProblemId(), CardType.EXPLAIN);

                // 更新 metadata：记录纠错来源和内容
                String metadata = objectMapper.writeValueAsString(Map.of(
                        "source", "reverse_feynman",
                        "errorType", errorInfo.path("errorType").asText(),
                        "correctionContent", errorInfo.path("correctStatement").asText()
                ));
                card.setMetadata(metadata);
                reviewService.updateCardMetadata(card.getId(), metadata);

                log.info("反向费曼纠错成功，已创建复习卡片: cardId={}", card.getId());
            } catch (Exception e) {
                log.warn("创建复习卡片失败: {}", e.getMessage());
            }
        });
    }

    /**
     * 查找段落对应的错误信息
     */
    private JsonNode findErrorForParagraph(JsonNode content, String paragraphId) {
        JsonNode errors = content.get("errors");
        if (errors == null || !errors.isArray()) return null;
        for (JsonNode error : errors) {
            if (paragraphId.equals(error.path("paragraphId").asText())) {
                return error;
            }
        }
        return null;
    }

    /**
     * 构建给前端的响应（移除 hasError 字段）
     */
    private String buildClientResponse(String fullJson) {
        try {
            JsonNode node = objectMapper.readTree(fullJson);
            JsonNode explanations = node.get("explanation");
            if (explanations == null) return "{\"paragraphs\": []}";

            // 构建纯内容列表（不含 hasError）
            var paragraphs = new java.util.ArrayList<Map<String, String>>();
            for (JsonNode para : explanations) {
                paragraphs.add(Map.of(
                        "id", para.path("id").asText(),
                        "content", para.path("content").asText()
                ));
            }
            return objectMapper.writeValueAsString(Map.of("paragraphs", paragraphs));
        } catch (Exception e) {
            log.warn("构建客户端响应失败: {}", e.getMessage());
            return fullJson;
        }
    }

    private String extractJson(String text) {
        if (text == null) return "{}";
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        return (start >= 0 && end > start) ? text.substring(start, end + 1) : text;
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
            log.error("发送反向费曼响应失败: {}", e.getMessage());
        }
    }

    /** 纠错提交负载 */
    @Data
    public static class CorrectionPayload {
        private String paragraphId;
        private String correction;
    }
}
