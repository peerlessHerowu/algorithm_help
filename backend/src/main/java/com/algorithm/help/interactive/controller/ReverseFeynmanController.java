package com.algorithm.help.interactive.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.interactive.handler.ReverseFeynmanHandler;
import com.algorithm.help.interactive.session.InteractiveSession;
import com.algorithm.help.interactive.session.SessionManager;
import com.algorithm.help.interactive.session.SessionType;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 反向费曼 REST API
 * <p>
 * AI 故意讲错 → 学生找出错误并纠正 → 自动加入复习计划
 */
@RestController
@RequestMapping("/api/v1/reverse-feynman")
@RequiredArgsConstructor
public class ReverseFeynmanController {

    private final SessionManager sessionManager;
    private final ReverseFeynmanHandler reverseHandler;

    /**
     * 开始反向费曼（创建会话 + 生成含错误的解释）
     */
    @PostMapping("/start")
    public ApiResponse<Map<String, Object>> start(@RequestBody StartRequest request) {
        InteractiveSession session = sessionManager.createSession(
                request.getUserId(), SessionType.REVERSE_FEYNMAN, request.getProblemId());

        int errorCount = request.getErrorCount() != null ? request.getErrorCount() : 1;
        String difficulty = request.getDifficulty() != null ? request.getDifficulty() : "MEDIUM";

        // 生成含错误的解释（内容缓存到 Redis，前端只看到段落内容）
        String content = reverseHandler.generateWithError(
                session.getSessionId(),
                request.getProblemTitle() != null ? request.getProblemTitle() : "算法题",
                request.getProblemDescription() != null ? request.getProblemDescription() : "",
                errorCount,
                difficulty
        );

        return ApiResponse.success(Map.of(
                "session", session,
                "content", content
        ));
    }

    /**
     * REST 方式提交纠错（不依赖 WebSocket）
     * <p>
     * 学生通过 HTTP 提交纠正内容，后端 AI 评估后返回结果。
     */
    @PostMapping("/{sessionId}/validate")
    public ApiResponse<java.util.Map<String, Object>> validate(
            @PathVariable String sessionId,
            @RequestBody ValidateRequest request) {
        String result = reverseHandler.evaluateCorrectionRest(sessionId,
                request.getParagraphId(), request.getCorrection());

        // 解析结果
        try {
            com.fasterxml.jackson.databind.JsonNode node =
                    new com.fasterxml.jackson.databind.ObjectMapper().readTree(result);
            boolean passed = node.path("passed").asBoolean(false);
            String feedback = node.path("feedback").asText("");
            String explanation = node.path("explanation").asText("");
            return ApiResponse.success(java.util.Map.of(
                    "passed", passed,
                    "feedback", feedback,
                    "explanation", explanation
            ));
        } catch (Exception e) {
            return ApiResponse.success(java.util.Map.of(
                    "passed", false, "feedback", "评估解析失败，请重试", "explanation", ""
            ));
        }
    }

    @Data
    public static class StartRequest {
        private String userId;
        private String problemId;
        private String problemTitle;
        private String problemDescription;
        private Integer errorCount = 1;
        private String difficulty = "MEDIUM";
    }

    @Data
    public static class ValidateRequest {
        private String paragraphId;
        private String correction;
    }
}
