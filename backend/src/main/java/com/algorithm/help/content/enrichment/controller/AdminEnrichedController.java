package com.algorithm.help.content.enrichment.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.content.enrichment.AdminAuditService;
import com.algorithm.help.content.enrichment.EnrichedSolution;
import com.algorithm.help.content.enrichment.UnifiedExplanationService;
import com.algorithm.help.content.enrichment.dto.BatchGenerateRequest;
import com.algorithm.help.content.enrichment.dto.EnrichedDetailDTO;
import com.algorithm.help.content.enrichment.dto.RejectRequest;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentTaskManager;
import com.algorithm.help.content.enrichment.pipeline.TaskCreateResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 管理后台 Enriched API
 * <p>
 * 批量生成/审核/删除/单条丰富
 * <p>
 * 权限：仅管理员（ROLE_ADMIN）可访问
 * 路径前缀 /api/v1/admin/ 已在 SecurityConfig 中配置 hasRole("ADMIN")
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin/enriched")
@RequiredArgsConstructor
public class AdminEnrichedController {

    private final UnifiedExplanationService unifiedService;
    private final EnrichmentTaskManager taskManager;
    private final AdminAuditService auditService;

    /**
     * 批量生成（最多 50 个题目）
     */
    @PostMapping("/batch-generate")
    public ResponseEntity<ApiResponse<List<TaskCreateResult>>> batchGenerate(
            @RequestBody BatchGenerateRequest request) {

        if (request.getProblemIds() == null || request.getProblemIds().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "problemIds 不能为空"));
        }
        if (request.getProblemIds().size() > 50) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "批量生成最多 50 个题目"));
        }

        int level = request.getLevel() != null ? request.getLevel() : 3;
        List<TaskCreateResult> results = new ArrayList<>();
        for (String problemId : request.getProblemIds()) {
            TaskCreateResult result = taskManager.createTask(problemId, level, false);
            results.add(result);
        }

        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(ApiResponse.success(results));
    }

    /**
     * 审核通过（设置 PUBLISHED）
     */
    @PutMapping("/{id}/approve")
    public ApiResponse<EnrichedDetailDTO> approve(
            @PathVariable String id,
            @RequestParam(defaultValue = "1") int version) {

        try {
            EnrichedDetailDTO result = unifiedService.approve(id, version);
            auditService.record(getOperatorId(), getOperatorName(),
                    "APPROVE", id, "ENRICHED_SOLUTION",
                    Map.of("status", "PENDING_REVIEW"), Map.of("status", "PUBLISHED"), null);
            return ApiResponse.success(result);
        } catch (UnifiedExplanationService.OptimisticLockConflictException e) {
            return ApiResponse.error(40004, e.getMessage());
        }
    }

    /**
     * 审核拒绝（需要 reason）
     */
    @PutMapping("/{id}/reject")
    public ApiResponse<EnrichedDetailDTO> reject(
            @PathVariable String id,
            @RequestParam(defaultValue = "1") int version,
            @RequestBody RejectRequest request) {

        if (request.getReason() == null || request.getReason().isBlank()) {
            return ApiResponse.error(400, "拒绝原因不能为空");
        }

        try {
            EnrichedDetailDTO result = unifiedService.reject(id, version, request.getReason());
            auditService.record(getOperatorId(), getOperatorName(),
                    "REJECT", id, "ENRICHED_SOLUTION",
                    Map.of("status", "PENDING_REVIEW"), Map.of("status", "REJECTED"),
                    request.getReason());
            return ApiResponse.success(result);
        } catch (UnifiedExplanationService.OptimisticLockConflictException e) {
            return ApiResponse.error(40004, e.getMessage());
        }
    }

    /**
     * 删除 enriched 记录
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        unifiedService.deleteEnriched(id);
        auditService.record(getOperatorId(), getOperatorName(),
                "DELETE", id, "ENRICHED_SOLUTION", null, null, null);
        return ApiResponse.success();
    }

    /**
     * 单条丰富：基于指定原始题解触发 enrichment
     */
    @PostMapping("/single-enrich/{rawSolutionId}")
    public ResponseEntity<ApiResponse<TaskCreateResult>> singleEnrich(
            @PathVariable String rawSolutionId,
            @RequestParam(defaultValue = "3") Integer level) {

        TaskCreateResult result = taskManager.createTask(rawSolutionId, level, true);
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(ApiResponse.success(result));
    }

    /**
     * 设置/取消推荐标记
     * <p>
     * 同题同级别唯一性约束：设置新推荐时自动取消旧推荐。
     */
    @PutMapping("/{id}/recommended")
    public ApiResponse<EnrichedDetailDTO> setRecommended(
            @PathVariable String id,
            @RequestParam boolean recommended) {

        EnrichedDetailDTO result = unifiedService.setRecommended(id, recommended);
        auditService.record(getOperatorId(), getOperatorName(),
                "SET_RECOMMENDED", id, "ENRICHED_SOLUTION",
                Map.of("recommended", !recommended), Map.of("recommended", recommended), null);
        return ApiResponse.success(result);
    }

    /**
     * 批量任务总览
     * <p>
     * 展示最近一次批量任务的执行状态和详情。
     * 并发度默认 3，由 application.yml content.batch.max-concurrency 配置。
     */
    @GetMapping("/batch/overview")
    public ApiResponse<Map<String, Object>> batchOverview() {
        Map<String, Object> overview = taskManager.getBatchOverview();
        return ApiResponse.success(overview);
    }

    /**
     * 获取待审核列表
     */
    @GetMapping("/pending-review")
    public ApiResponse<List<Map<String, Object>>> getPendingReview() {
        List<EnrichedSolution> items = unifiedService.getPendingReviewItems();
        List<Map<String, Object>> result = items.stream()
                .map(this::toReviewItemMap)
                .toList();
        return ApiResponse.success(result);
    }

    private Map<String, Object> toReviewItemMap(EnrichedSolution e) {
        Map<String, Object> map = new java.util.LinkedHashMap<>();
        map.put("id", e.getId());
        map.put("problemId", e.getProblemId());
        map.put("problemTitle", e.getProblemId());
        map.put("level", e.getLevel());
        map.put("title", e.getTitle());
        map.put("qualityScore", e.getQualityScore());
        map.put("summary", e.getSummary());
        map.put("content", e.getContent());
        map.put("feedbackCount", e.getFeedbackCount());
        map.put("createdAt", e.getCreatedAt());
        map.put("sourceType", e.getSourceType());
        return map;
    }

    /**
     * 审计日志查询（按操作人/时间范围筛选）
     */
    @GetMapping("/audit-logs")
    public ApiResponse<Map<String, Object>> getAuditLogs(
            @RequestParam(required = false) String operatorId,
            @RequestParam(required = false) Long startTime,
            @RequestParam(required = false) Long endTime,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        var result = auditService.query(operatorId, startTime, endTime, page, size);
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("content", result.getContent());
        response.put("totalElements", result.getTotalElements());
        response.put("page", page);
        response.put("size", size);
        return ApiResponse.success(response);
    }

    // ===== 辅助方法 =====

    private String getOperatorId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() != null) {
            return auth.getName();
        }
        return "unknown";
    }

    private String getOperatorName() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() != null) {
            return auth.getName();
        }
        return "unknown";
    }
}
