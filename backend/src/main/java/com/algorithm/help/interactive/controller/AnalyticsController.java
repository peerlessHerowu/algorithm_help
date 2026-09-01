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
}
