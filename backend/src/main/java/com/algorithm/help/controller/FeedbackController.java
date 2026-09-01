package com.algorithm.help.controller;

import com.algorithm.help.auth.entity.User;
import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.entity.ContentFeedback;
import com.algorithm.help.repository.ContentFeedbackRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * 内容反馈控制器
 */
@RestController
@RequiredArgsConstructor
public class FeedbackController {

    private final ContentFeedbackRepository feedbackRepo;

    /** 提交解析内容反馈 */
    @PostMapping("/api/v1/problems/{problemId}/explanation/feedback")
    public ResponseEntity<ApiResponse<ContentFeedback>> submitFeedback(
            @PathVariable String problemId,
            @Valid @RequestBody FeedbackRequest request,
            @AuthenticationPrincipal User user) {
        // 防止重复提交
        if (feedbackRepo.existsByUserIdAndExplanationId(user.getId(), request.getExplanationId())) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "已提交过反馈"));
        }
        ContentFeedback feedback = ContentFeedback.builder()
                .userId(user.getId())
                .explanationId(request.getExplanationId())
                .rating(request.getRating())
                .comment(request.getComment())
                .build();
        feedback = feedbackRepo.save(feedback);
        return ResponseEntity.ok(ApiResponse.success(feedback));
    }

    @Data
    public static class FeedbackRequest {
        @NotNull(message = "解析 ID 不能为空")
        private String explanationId;
        @NotNull @Min(1) @Max(5)
        private Integer rating;
        private String comment;
    }
}
