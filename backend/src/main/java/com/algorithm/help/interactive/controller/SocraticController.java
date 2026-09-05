package com.algorithm.help.interactive.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.interactive.handler.SocraticGuideHandler;
import com.algorithm.help.interactive.session.InteractiveSession;
import com.algorithm.help.interactive.session.SessionManager;
import com.algorithm.help.interactive.session.SessionType;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 苏格拉底式追问 REST API
 */
@RestController
@RequestMapping("/api/v1/socratic")
@RequiredArgsConstructor
public class SocraticController {

    private final SessionManager sessionManager;
    private final SocraticGuideHandler socraticHandler;

    @PostMapping("/start")
    public ApiResponse<InteractiveSession> start(@RequestBody StartRequest request) {
        InteractiveSession session = sessionManager.createSession(
                request.getUserId(), SessionType.SOCRATIC, request.getProblemId());
        return ApiResponse.success(session);
    }

    /**
     * 请求下一级提示
     */
    @GetMapping("/{sessionId}/hint")
    public ApiResponse<Integer> nextHint(@PathVariable String sessionId) {
        socraticHandler.upgradeHintLevel(sessionId);
        int newLevel = socraticHandler.getCurrentHintLevel(sessionId);
        return ApiResponse.success(newLevel);
    }

    /**
     * 获取当前提示级别和推导得分
     */
    @GetMapping("/{sessionId}/status")
    public ApiResponse<java.util.Map<String, Object>> status(@PathVariable String sessionId) {
        int hintLevel = socraticHandler.getCurrentHintLevel(sessionId);
        int score = socraticHandler.calculateScore(sessionId);
        return ApiResponse.success(java.util.Map.of(
                "hintLevel", hintLevel,
                "score", score,
                "scoreDescription", getScoreDesc(score)
        ));
    }

    /**
     * 自主得分与引导模式对比
     * <p>
     * 返回用户在不同提示级别下的得分，便于前端展示独立性对比图
     */
    @GetMapping("/{sessionId}/compare")
    public ApiResponse<java.util.Map<String, Object>> compare(@PathVariable String sessionId) {
        int hintLevel = socraticHandler.getCurrentHintLevel(sessionId);
        int actual = socraticHandler.calculateScore(sessionId);
        return ApiResponse.success(java.util.Map.of(
                "hintLevel", hintLevel,
                "actualScore", actual,
                "maxScore", 100,
                "autonomyPercent", actual,  // 同 score，含义：自主完成度百分比
                "guidePercent", 100 - actual,
                "label", getScoreDesc(actual),
                "breakdown", java.util.List.of(
                        java.util.Map.of("level", 1, "label", "自主推导", "score", 100, "achieved", hintLevel == 1),
                        java.util.Map.of("level", 2, "label", "少量提示", "score", 75,  "achieved", hintLevel == 2),
                        java.util.Map.of("level", 3, "label", "适量引导", "score", 50,  "achieved", hintLevel == 3),
                        java.util.Map.of("level", 4, "label", "深度引导", "score", 25,  "achieved", hintLevel == 4)
                )
        ));
    }

    /**
     * 手动触发总结
     */
    @PostMapping("/{sessionId}/summarize")
    public ApiResponse<String> summarize(@PathVariable String sessionId,
                                         @RequestParam(defaultValue = "算法题") String problemTitle) {
        String summary = socraticHandler.generateSummary(sessionId, problemTitle);
        sessionManager.completeSession(sessionId);
        return ApiResponse.success(summary);
    }

    private String getScoreDesc(int score) {
        if (score >= 100) return "🏆 完全自主推导";
        if (score >= 75) return "💪 少量提示解出";
        if (score >= 50) return "📖 适量引导解出";
        return "🤝 深度引导解出";
    }

    @Data
    public static class StartRequest {
        private String userId;
        private String problemId;
    }
}
