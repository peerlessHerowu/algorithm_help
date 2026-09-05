package com.algorithm.help.interactive.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.interactive.analytics.LearningAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 学习分析 REST API
 */
@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final LearningAnalyticsService analyticsService;

    @GetMapping("/stats")
    public ApiResponse<Map<String, Object>> stats(@RequestParam String userId) {
        return ApiResponse.success(analyticsService.getOverallStats(userId));
    }

    @GetMapping("/weak-points")
    public ApiResponse<List<Map<String, Object>>> weakPoints(@RequestParam String userId) {
        return ApiResponse.success(analyticsService.getWeakPoints(userId));
    }

    @GetMapping("/mastery")
    public ApiResponse<Map<String, Double>> mastery(@RequestParam String userId) {
        return ApiResponse.success(analyticsService.getMasteryRadar(userId));
    }

    @GetMapping("/forgetting-curve")
    public ApiResponse<Map<String, Object>> forgettingCurve(@RequestParam String userId) {
        return ApiResponse.success(analyticsService.getForgettingCurveData(userId));
    }

    @GetMapping("/daily-plan")
    public ApiResponse<Map<String, Object>> dailyPlan(@RequestParam String userId) {
        return ApiResponse.success(analyticsService.getDailyPlan(userId));
    }

    @GetMapping("/interview-trend")
    public ApiResponse<Map<String, Object>> interviewTrend(@RequestParam String userId) {
        return ApiResponse.success(analyticsService.getInterviewTrend(userId));
    }

    /**
     * 获取学习热力图数据（过去一年，按日聚合活动计数）
     * <p>
     * 数据来源：interactive_sessions（完成的会话数）+
     *           spaced_repetition_cards（按 lastReviewAt 聚合复习次数）+
     *           debug_training_records（训练次数）
     */
    @GetMapping("/heatmap")
    public ApiResponse<java.util.List<Map<String, Object>>> heatmap(@RequestParam String userId) {
        return ApiResponse.success(analyticsService.getHeatmapData(userId));
    }
}
