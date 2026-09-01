package com.algorithm.help.recommend.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.graph.dto.RecommendItem;
import com.algorithm.help.recommend.dto.WeakPatternDTO;
import com.algorithm.help.recommend.service.RecommendationEngine;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 个性化推荐 API 控制器
 */
@RestController
@RequestMapping("/api/recommend")
@RequiredArgsConstructor
public class RecommendController {

    private final RecommendationEngine recommendEngine;

    /**
     * 获取用户个性化推荐（Top 10）
     */
    @GetMapping("/{userId}")
    public ApiResponse<List<RecommendItem>> getRecommendations(
            @PathVariable String userId) {
        return ApiResponse.success(recommendEngine.recommend(userId));
    }

    /**
     * 获取用户薄弱模式列表
     */
    @GetMapping("/{userId}/weak-patterns")
    public ApiResponse<List<WeakPatternDTO>> getWeakPatterns(
            @PathVariable String userId) {
        return ApiResponse.success(recommendEngine.identifyWeakPatterns(userId));
    }
}
