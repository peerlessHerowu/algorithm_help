package com.algorithm.help.interactive.handler;

import com.algorithm.help.ai.SmartRouter;
import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.content.prompt.PromptTemplateEngine;
import com.algorithm.help.interactive.debug.DebugTrainingRecord;
import com.algorithm.help.interactive.debug.DebugTrainingRecordRepository;
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
 * Debug 训练消息处理器
 * <p>
 * 流程：生成有 bug 的代码 → 学生找 bug 并提交修复 → AI 评估 → 渐进式提示
 *
 * @author algorithm-help
 * @since 1.0.0
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DebugTrainerHandler implements MessageHandler {

    /** Redis：存储当前挑战信息 */
    private static final String CHALLENGE_KEY = "debug:challenge:";
    private static final long CHALLENGE_TTL = 30;

    private final SessionManager sessionManager;
    private final PromptTemplateEngine templateEngine;
    private final SmartRouter smartRouter;
    private final ObjectMapper objectMapper;
    private final RedisTemplate<String, Object> redisTemplate;
    private final DebugTrainingRecordRepository recordRepo;

    @Override
    public WsMessageType supportedType() {
        return WsMessageType.DEBUG_SUBMIT;
    }

    /**
     * 处理 Debug 提交消息
     * <p>
     * payload 格式：{"buggyCode": "...", "userFix": "找到的bug描述", "requestHint": false}
     */
    @Override
    public void handle(WebSocketSession session, WsMessage message) {
        String sessionId = message.getSessionId();
        log.info("Debug 提交: sessionId={}", sessionId);

        try {
            DebugSubmitPayload payload = objectMapper.readValue(
                    message.getPayload(), DebugSubmitPayload.class);

            // 从 Redis 获取当前挑战
            String challengeJson = (String) redisTemplate.opsForValue().get(CHALLENGE_KEY + sessionId);
            if (challengeJson == null) {
                sendResponse(session, sessionId,
                        "{\"error\": \"挑战已过期，请重新生成\"}", WsMessageType.ERROR);
                return;
            }

            if (payload.isRequestHint()) {
                // 学生请求提示
                String hint = generateHint(challengeJson, payload.getHintLevel());
                sendResponse(session, sessionId, hint, WsMessageType.HINT_PROVIDED);
                return;
            }

            // 评估学生修复
            String evaluation = evaluateFix(challengeJson, payload.getUserFix());
            sessionManager.appendMessage(sessionId, "user", payload.getUserFix());
            sessionManager.appendMessage(sessionId, "assistant", evaluation);

            // 记录训练数据
            recordTraining(sessionId, challengeJson, evaluation);

            sendResponse(session, sessionId, evaluation, WsMessageType.AI_RESPONSE);
        } catch (Exception e) {
            log.error("Debug 处理失败: sessionId={}, error={}", sessionId, e.getMessage());
            sendResponse(session, sessionId,
                    "{\"error\": \"处理失败，请重试\"}", WsMessageType.ERROR);
        }
    }

    /**
     * 生成 Debug 挑战题
     *
     * @param problemTitle  题目名称
     * @param description   题目描述
     * @param bugCount      Bug 数量（1-3）
     * @param language      编程语言
     * @return 含 bug 的代码和测试用例（JSON 字符串）
     */
    public String generateChallenge(String sessionId, String problemTitle,
                                     String description, int bugCount, String language) {
        log.info("生成 Debug 挑战: sessionId={}, bugs={}, lang={}", sessionId, bugCount, language);
        try {
            String prompt = templateEngine.render("interactive/debug-generate.md", Map.of(
                    "title", problemTitle,
                    "description", description,
                    "bugCount", String.valueOf(bugCount),
                    "difficulty", getDifficulty(bugCount),
                    "language", language
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.CHAT)
                    .setContent(prompt);
            String challengeJson = smartRouter.route(request).getContent();
            // 提取 JSON
            challengeJson = extractJson(challengeJson);

            // 缓存挑战信息（供后续评估使用）
            redisTemplate.opsForValue().set(CHALLENGE_KEY + sessionId, challengeJson,
                    CHALLENGE_TTL, TimeUnit.MINUTES);
            return challengeJson;
        } catch (Exception e) {
            log.error("生成 Debug 挑战失败: {}", e.getMessage());
            return "{\"error\": \"挑战生成失败，请重试\"}";
        }
    }

    // ======================== 私有方法 ========================

    private String evaluateFix(String challengeJson, String userFix) {
        try {
            JsonNode challenge = objectMapper.readTree(challengeJson);
            String buggyCode = challenge.path("buggyCode").asText("");
            String bugsJson = objectMapper.writeValueAsString(challenge.get("bugs"));

            String prompt = templateEngine.render("interactive/debug-evaluate.md", Map.of(
                    "buggyCode", buggyCode,
                    "bugsJson", bugsJson,
                    "userFix", userFix
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.DETECT_ERRORS)
                    .setContent(prompt);
            return extractJson(smartRouter.route(request).getContent());
        } catch (Exception e) {
            log.error("Debug 评估失败: {}", e.getMessage());
            return "{\"allFound\": false, \"score\": 0, \"overallFeedback\": \"评估暂时不可用\"}";
        }
    }

    private String generateHint(String challengeJson, int hintLevel) {
        try {
            JsonNode challenge = objectMapper.readTree(challengeJson);
            String bugsJson = objectMapper.writeValueAsString(challenge.get("bugs"));

            String prompt = templateEngine.render("interactive/debug-hint.md", Map.of(
                    "remainingBugs", bugsJson,
                    "hintLevel", String.valueOf(hintLevel)
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.CHAT)
                    .setContent(prompt);
            return smartRouter.route(request).getContent();
        } catch (Exception e) {
            log.error("Debug 提示生成失败: {}", e.getMessage());
            return "仔细看看数组索引的处理部分...";
        }
    }

    private void recordTraining(String sessionId, String challengeJson, String evaluationJson) {
        try {
            JsonNode challenge = objectMapper.readTree(challengeJson);
            JsonNode evaluation = objectMapper.readTree(evaluationJson);

            // 获取会话 userId
            sessionManager.getSession(sessionId).ifPresent(session -> {
                JsonNode bugsNode = challenge.get("bugs");
                if (bugsNode != null && bugsNode.isArray()) {
                    for (JsonNode bug : bugsNode) {
                        DebugTrainingRecord record = new DebugTrainingRecord()
                                .setUserId(session.getUserId())
                                .setProblemId(session.getProblemId())
                                .setBugType(bug.path("type").asText("UNKNOWN"))
                                .setFound(evaluation.path("allFound").asBoolean(false))
                                .setHintCount(0);
                        recordRepo.save(record);
                    }
                }
            });
        } catch (Exception e) {
            log.warn("记录 Debug 训练数据失败: {}", e.getMessage());
        }
    }

    private String getDifficulty(int bugCount) {
        return switch (bugCount) {
            case 1 -> "EASY";
            case 2 -> "MEDIUM";
            default -> "HARD";
        };
    }

    private String extractJson(String text) {
        if (text == null) return "{}";
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return text.substring(start, end + 1);
        }
        return text;
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
            log.error("发送 Debug 响应失败: {}", e.getMessage());
        }
    }

    /** Debug 提交负载 */
    @Data
    public static class DebugSubmitPayload {
        private String userFix;
        private boolean requestHint;
        private int hintLevel = 1;
    }
}
