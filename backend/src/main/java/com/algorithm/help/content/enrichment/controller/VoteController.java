package com.algorithm.help.content.enrichment.controller;

import com.algorithm.help.auth.entity.User;
import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.content.enrichment.VoteService;
import com.algorithm.help.content.enrichment.VoteType;
import com.algorithm.help.content.enrichment.dto.VoteResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

/**
 * 投票 API
 * <p>
 * POST /api/v1/enriched/{id}/upvote  — 点赞（需登录）
 * POST /api/v1/enriched/{id}/downvote — 踩（需登录）
 * DELETE /api/v1/enriched/{id}/vote   — 取消投票（需登录）
 * GET /api/v1/enriched/{id}/vote      — 查询当前投票状态
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/enriched")
@RequiredArgsConstructor
public class VoteController {

    private final VoteService voteService;

    /**
     * 点赞
     */
    @PostMapping("/{id}/upvote")
    public ResponseEntity<ApiResponse<VoteResult>> upvote(@PathVariable String id) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error(40403, "请先登录"));
        }

        try {
            VoteResult result = voteService.upvote(id, user.getId().toString());
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(40402, e.getMessage()));
        }
    }

    /**
     * 踩
     */
    @PostMapping("/{id}/downvote")
    public ResponseEntity<ApiResponse<VoteResult>> downvote(@PathVariable String id) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error(40403, "请先登录"));
        }

        try {
            VoteResult result = voteService.downvote(id, user.getId().toString());
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(40402, e.getMessage()));
        }
    }

    /**
     * 取消投票
     */
    @DeleteMapping("/{id}/vote")
    public ResponseEntity<ApiResponse<VoteResult>> cancelVote(@PathVariable String id) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error(40403, "请先登录"));
        }

        try {
            VoteResult result = voteService.cancelVote(id, user.getId().toString());
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(40402, e.getMessage()));
        }
    }

    /**
     * 查询当前用户的投票状态（可匿名访问，未登录返回 null）
     */
    @GetMapping("/{id}/vote")
    public ApiResponse<VoteResult> getVoteStatus(@PathVariable String id) {
        User user = getCurrentUser();
        if (user == null) {
            // 未登录时返回无投票状态
            return ApiResponse.success(new VoteResult());
        }

        VoteType voteType = voteService.getUserVote(id, user.getId().toString());
        VoteResult result = new VoteResult().setCurrentVote(voteType);
        return ApiResponse.success(result);
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
