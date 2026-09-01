package com.algorithm.help.content.enrichment.controller;

import com.algorithm.help.auth.entity.User;
import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.content.enrichment.FeedbackService;
import com.algorithm.help.content.enrichment.dto.FeedbackDTO;
import com.algorithm.help.content.enrichment.dto.FeedbackRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 纠错反馈 API
 * <p>
 * 用户端：POST /api/v1/enriched/{id}/feedback — 提交纠错反馈（需登录）
 * 管理端：GET /api/v1/admin/enriched/{id}/feedbacks — 查看反馈列表
 * 管理端：PUT /api/v1/admin/feedbacks/{feedbackId}/resolve — 处理反馈
 */
@Slf4j
@RestController("enrichedFeedbackController")
@RequiredArgsConstructor
public class FeedbackController {

    private final FeedbackService feedbackService;

    /**
     * 提交纠错反馈（需登录）
     */
    @PostMapping("/api/v1/enriched/{id}/feedback")
    public ResponseEntity<ApiResponse<Void>> submitFeedback(
            @PathVariable String id,
            @RequestBody FeedbackRequest request) {

        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error(40403, "请先登录"));
        }

        // 校验错误类型
        if (request.getErrorType() == null) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "errorType 不能为空"));
        }

        try {
            feedbackService.submitFeedback(id, user.getId().toString(), request);
            return ResponseEntity.ok(ApiResponse.success());
        } catch (IllegalArgumentException e) {
            if (e.getMessage().contains("enriched 记录不存在")) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error(40402, e.getMessage()));
            }
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, e.getMessage()));
        }
    }

    /**
     * 管理端：查看某条解析的反馈列表
     */
    @GetMapping("/api/v1/admin/enriched/{id}/feedbacks")
    public ApiResponse<List<FeedbackDTO>> getFeedbacks(@PathVariable String id) {
        List<FeedbackDTO> feedbacks = feedbackService.getFeedbacks(id);
        return ApiResponse.success(feedbacks);
    }

    /**
     * 管理端：处理反馈（标记已解决/已忽略）
     */
    @PutMapping("/api/v1/admin/feedbacks/{feedbackId}/resolve")
    public ResponseEntity<ApiResponse<Void>> resolveFeedback(
            @PathVariable Long feedbackId,
            @RequestParam String resolution) {

        User user = getCurrentUser();
        String operatorId = user != null ? user.getId().toString() : "system";

        try {
            feedbackService.resolveFeedback(feedbackId, resolution, operatorId);
            return ResponseEntity.ok(ApiResponse.success());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, e.getMessage()));
        }
    }

    // ===== 辅助方法 =====

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User user) {
            return user;
        }
        return null;
    }
}
