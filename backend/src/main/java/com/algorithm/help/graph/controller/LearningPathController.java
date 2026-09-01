package com.algorithm.help.graph.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.graph.dto.LearningPathProgressDTO;
import com.algorithm.help.graph.entity.LearningPath;
import com.algorithm.help.graph.service.LearningPathService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 学习路径 API 控制器
 */
@RestController
@RequestMapping("/api/learning-path")
@RequiredArgsConstructor
public class LearningPathController {

    private final LearningPathService pathService;

    /**
     * 获取所有学习路径
     */
    @GetMapping
    public ApiResponse<List<LearningPath>> listAll() {
        return ApiResponse.success(pathService.getAll());
    }

    /**
     * 获取学习路径详情（含节点列表）
     */
    @GetMapping("/{id}")
    public ApiResponse<LearningPath> getById(@PathVariable String id) {
        return ApiResponse.success(pathService.getById(id));
    }

    /**
     * 获取用户在某路径上的进度
     */
    @GetMapping("/{id}/progress/{userId}")
    public ApiResponse<LearningPathProgressDTO> getProgress(
            @PathVariable String id,
            @PathVariable String userId) {
        return ApiResponse.success(pathService.getProgress(id, userId));
    }
}
