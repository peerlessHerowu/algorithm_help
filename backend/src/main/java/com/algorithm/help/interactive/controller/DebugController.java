package com.algorithm.help.interactive.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.interactive.debug.DebugTrainingRecord;
import com.algorithm.help.interactive.debug.DebugTrainingRecordRepository;
import com.algorithm.help.interactive.handler.DebugTrainerHandler;
import com.algorithm.help.interactive.session.InteractiveSession;
import com.algorithm.help.interactive.session.SessionManager;
import com.algorithm.help.interactive.session.SessionType;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Debug 训练 REST API
 * <p>
 * 生成 Bug 代码 → 学生通过 WebSocket 提交修复 → 评估结果
 */
@RestController
@RequestMapping("/api/v1/debug")
@RequiredArgsConstructor
public class DebugController {

    private final SessionManager sessionManager;
    private final DebugTrainerHandler debugHandler;
    private final DebugTrainingRecordRepository recordRepo;

    /**
     * 生成 Debug 挑战（创建会话 + 生成 Bug 代码）
     *
     * @param request 挑战请求
     * @return 会话 + Bug 代码
     */
    @PostMapping("/challenge")
    public ApiResponse<Map<String, Object>> challenge(@RequestBody ChallengeRequest request) {
        InteractiveSession session = sessionManager.createSession(
                request.getUserId(), SessionType.DEBUG, request.getProblemId());

        int bugCount = parseBugCount(request.getDifficulty());
        String challengeJson = debugHandler.generateChallenge(
                session.getSessionId(),
                request.getProblemTitle() != null ? request.getProblemTitle() : "算法题",
                request.getProblemDescription() != null ? request.getProblemDescription() : "",
                bugCount,
                request.getLanguage() != null ? request.getLanguage() : "python"
        );

        return ApiResponse.success(Map.of(
                "session", session,
                "challenge", challengeJson
        ));
    }

    /**
     * 获取训练记录
     *
     * @param userId 用户 ID
     */
    @GetMapping("/records")
    public ApiResponse<List<DebugTrainingRecord>> records(@RequestParam String userId) {
        return ApiResponse.success(recordRepo.findByUserIdOrderByCreatedAtDesc(userId));
    }

    /**
     * AI 语义验证 — REST 方式（不依赖 WebSocket）
     * <p>
     * 学生通过 HTTP 提交修复描述，后端调用 AI 评估并返回结果。
     * 同时记录训练数据到 debug_training_records 表。
     */
    @PostMapping("/{sessionId}/verify")
    public ApiResponse<java.util.Map<String, Object>> verify(
            @PathVariable String sessionId,
            @RequestBody VerifyRequest request) {
        // 从 Redis 取挑战信息（由 /challenge 端点写入）
        String evaluation = debugHandler.evaluateFixRest(sessionId, request.getUserFix());

        // 解析评估结果
        com.fasterxml.jackson.databind.JsonNode node;
        try {
            node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(evaluation);
        } catch (Exception e) {
            return ApiResponse.success(java.util.Map.of(
                    "allFound", false, "score", 0,
                    "overallFeedback", "评估解析失败，请重试"
            ));
        }

        boolean allFound = node.path("allFound").asBoolean(false);
        int score = node.path("score").asInt(0);
        String feedback = node.path("overallFeedback").asText("");

        return ApiResponse.success(java.util.Map.of(
                "allFound", allFound,
                "score", score,
                "overallFeedback", feedback,
                "foundBugs", node.has("foundBugs") ? node.get("foundBugs") : java.util.List.of(),
                "missedBugs", node.has("missedBugs") ? node.get("missedBugs") : java.util.List.of(),
                "raw", evaluation
        ));
    }

    /**
     * 获取薄弱 Bug 类型统计
     *
     * @param userId 用户 ID
     */
    @GetMapping("/stats")
    public ApiResponse<Map<String, Object>> stats(@RequestParam String userId) {
        List<DebugTrainingRecord> records = recordRepo.findByUserIdOrderByCreatedAtDesc(userId);
        Map<String, Long> byType = records.stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        DebugTrainingRecord::getBugType,
                        java.util.stream.Collectors.counting()
                ));
        long found = records.stream().filter(r -> Boolean.TRUE.equals(r.getFound())).count();
        double accuracy = records.isEmpty() ? 0 : (double) found / records.size() * 100;

        return ApiResponse.success(Map.of(
                "total", records.size(),
                "found", found,
                "accuracy", String.format("%.1f%%", accuracy),
                "byType", byType
        ));
    }

    private int parseBugCount(String difficulty) {
        if (difficulty == null) return 1;
        return switch (difficulty.toUpperCase()) {
            case "MEDIUM" -> 2;
            case "HARD" -> 3;
            default -> 1;
        };
    }

    @Data
    public static class ChallengeRequest {
        private String userId;
        private String problemId;
        private String problemTitle;
        private String problemDescription;
        private String difficulty = "EASY";
        private String language = "python";
    }

    @Data
    public static class VerifyRequest {
        private String userFix;
    }
}
