package com.algorithm.help.graph.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.graph.entity.UserProgress;
import com.algorithm.help.graph.enums.CompletionStatus;
import com.algorithm.help.graph.repository.GraphUserProgressRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 用户进度图谱 API
 * <p>
 * 为知识图谱页面提供「我的位置」数据：
 * - 已完成题目 ID 列表（绿色高亮）
 * - 薄弱模式 ID 列表（橙色高亮）
 * - 当前正在学习的节点（蓝色高亮）
 */
@RestController
@RequestMapping("/api/v1/user/progress")
@RequiredArgsConstructor
@Slf4j
public class UserProgressGraphController {

    private final GraphUserProgressRepository progressRepo;

    /**
     * 获取用户进度概览（供知识图谱颜色渲染使用）
     * <p>
     * 开发阶段无用户认证，使用 header X-User-Id，默认返回演示数据
     */
    @GetMapping("/graph")
    public ApiResponse<UserProgressGraphDTO> getUserProgressForGraph(
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        log.info("获取用户图谱进度, userId={}", userId);

        if (userId == null || userId.isBlank()) {
            // 未登录：返回演示数据
            return ApiResponse.success(demoProgress());
        }

        try {
            List<UserProgress> allProgress = progressRepo.findByUserId(userId);

            // 已完成题目 ID
            List<String> completedProblemIds = allProgress.stream()
                    .filter(p -> p.getStatus() == CompletionStatus.COMPLETED
                              || p.getStatus() == CompletionStatus.MASTERED)
                    .map(UserProgress::getProblemId)
                    .filter(Objects::nonNull)
                    .distinct()
                    .collect(Collectors.toList());

            // 薄弱模式：正确率 < 60% 且练习次数 >= 3 的模式
            List<String> weakPatternIds = allProgress.stream()
                    .filter(p -> p.getPatternId() != null
                              && p.getAttempts() != null && p.getAttempts() >= 3
                              && p.getCorrectCount() != null
                              && (double) p.getCorrectCount() / p.getAttempts() < 0.6)
                    .map(UserProgress::getPatternId)
                    .distinct()
                    .collect(Collectors.toList());

            // 当前节点：最近一次练习的题目
            String currentNodeId = allProgress.stream()
                    .filter(p -> p.getLastPracticeAt() != null)
                    .max(Comparator.comparingLong(UserProgress::getLastPracticeAt))
                    .map(UserProgress::getProblemId)
                    .orElse(null);

            UserProgressGraphDTO dto = new UserProgressGraphDTO();
            dto.setCompletedProblemIds(completedProblemIds);
            dto.setWeakPatternIds(weakPatternIds);
            dto.setCurrentNodeId(currentNodeId);
            dto.setTotalCompleted(completedProblemIds.size());
            dto.setTotalWeak(weakPatternIds.size());

            log.info("用户进度查询完成, userId={}, completed={}, weak={}",
                    userId, completedProblemIds.size(), weakPatternIds.size());
            return ApiResponse.success(dto);

        } catch (Exception e) {
            log.error("查询用户进度失败, userId={}", userId, e);
            return ApiResponse.success(demoProgress());
        }
    }

    /** 演示进度数据（未登录时使用） */
    private UserProgressGraphDTO demoProgress() {
        UserProgressGraphDTO dto = new UserProgressGraphDTO();
        dto.setCompletedProblemIds(Collections.emptyList());
        dto.setWeakPatternIds(Collections.emptyList());
        dto.setCurrentNodeId(null);
        dto.setTotalCompleted(0);
        dto.setTotalWeak(0);
        return dto;
    }

    // ===== 内部 DTO =====

    @lombok.Data
    public static class UserProgressGraphDTO {
        /** 已完成题目 ID 列表（图谱中绿色高亮） */
        private List<String> completedProblemIds;
        /** 薄弱模式 ID 列表（图谱中橙色高亮） */
        private List<String> weakPatternIds;
        /** 当前正在学习的节点 ID（图谱中蓝色高亮） */
        private String currentNodeId;
        /** 已完成总数 */
        private int totalCompleted;
        /** 薄弱模式总数 */
        private int totalWeak;
    }
}
