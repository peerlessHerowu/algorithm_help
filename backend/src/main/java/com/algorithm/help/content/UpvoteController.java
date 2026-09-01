package com.algorithm.help.content;

import com.algorithm.help.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/**
 * 点赞 REST API
 * 支持题解和评论的点赞/取消点赞
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class UpvoteController {

    private final UpvoteService upvoteService;

    /**
     * 题解点赞
     */
    @PostMapping("/api/v1/solutions/{id}/upvote")
    public ApiResponse<Void> upvoteSolution(
            @PathVariable String id,
            @RequestHeader("X-User-Id") String userId) {
        upvoteService.upvoteSolution(id, userId);
        return ApiResponse.success();
    }

    /**
     * 取消题解点赞
     */
    @DeleteMapping("/api/v1/solutions/{id}/upvote")
    public ApiResponse<Void> cancelSolutionUpvote(
            @PathVariable String id,
            @RequestHeader("X-User-Id") String userId) {
        upvoteService.cancelSolutionUpvote(id, userId);
        return ApiResponse.success();
    }

    /**
     * 评论点赞
     */
    @PostMapping("/api/v1/comments/{id}/upvote")
    public ApiResponse<Void> upvoteComment(
            @PathVariable String id,
            @RequestHeader("X-User-Id") String userId) {
        upvoteService.upvoteComment(id, userId);
        return ApiResponse.success();
    }

    /**
     * 取消评论点赞
     */
    @DeleteMapping("/api/v1/comments/{id}/upvote")
    public ApiResponse<Void> cancelCommentUpvote(
            @PathVariable String id,
            @RequestHeader("X-User-Id") String userId) {
        upvoteService.cancelCommentUpvote(id, userId);
        return ApiResponse.success();
    }
}
