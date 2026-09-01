package com.algorithm.help.content;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.content.dto.CommentDTO;
import com.algorithm.help.content.dto.CreateCommentRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

/**
 * 评论 REST API
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    /**
     * 发表评论
     */
    @PostMapping("/api/v1/comments")
    public ApiResponse<CommentDTO> create(
            @RequestHeader("X-User-Id") String userId,
            @RequestBody CreateCommentRequest request) {
        CommentDTO dto = commentService.create(userId, request);
        return ApiResponse.success(dto);
    }

    /**
     * 按目标查询评论（分页）
     */
    @GetMapping("/api/v1/comments")
    public ApiResponse<Page<CommentDTO>> list(
            @RequestParam String targetType,
            @RequestParam String targetId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<CommentDTO> result = commentService.list(targetType, targetId, page, size);
        return ApiResponse.success(result);
    }

    /**
     * 软删除自己的评论
     */
    @DeleteMapping("/api/v1/comments/{id}")
    public ApiResponse<Void> delete(
            @PathVariable String id,
            @RequestHeader("X-User-Id") String userId) {
        commentService.delete(id, userId);
        return ApiResponse.success();
    }

    // ======================== 管理员端点 ========================

    /**
     * AI 扩展评论（骨架：当前仅校验条件并记录日志）
     * 条件：type 为 SUPPLEMENT 或 CORRECTION，且 upvotes >= 5
     */
    @PostMapping("/api/v1/admin/comments/{id}/expand")
    public ApiResponse<Void> expand(@PathVariable String id) {
        commentService.expandByAI(id);
        return ApiResponse.success();
    }
}
