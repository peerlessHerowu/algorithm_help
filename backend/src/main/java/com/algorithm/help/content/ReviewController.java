package com.algorithm.help.content;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.content.dto.SolutionDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 内容审核管理 REST API
 */
@Slf4j
@RestController("contentReviewController")
@RequiredArgsConstructor
@RequestMapping("/api/v1/admin/review")
public class ReviewController {

    private final ReviewService reviewService;

    /**
     * 获取待审核内容队列
     * @param type SOLUTION 或 COMMENT
     */
    @GetMapping("/queue")
    public ApiResponse<?> getQueue(
            @RequestParam String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return switch (type.toUpperCase()) {
            case "SOLUTION" -> {
                Page<SolutionDTO> result = reviewService.getSolutionQueue(page, size);
                yield ApiResponse.success(result);
            }
            case "COMMENT" -> {
                Page<Comment> result = reviewService.getCommentQueue(page, size);
                yield ApiResponse.success(result);
            }
            default -> ApiResponse.error(400, "不支持的审核类型: " + type);
        };
    }

    /**
     * 批准内容
     */
    @PostMapping("/{type}/{id}/approve")
    public ApiResponse<?> approve(
            @PathVariable String type,
            @PathVariable String id) {
        return switch (type.toUpperCase()) {
            case "SOLUTION" -> ApiResponse.success(reviewService.approveSolution(id));
            case "COMMENT" -> {
                reviewService.approveComment(id);
                yield ApiResponse.success();
            }
            default -> ApiResponse.error(400, "不支持的审核类型: " + type);
        };
    }

    /**
     * 驳回内容
     */
    @PostMapping("/{type}/{id}/reject")
    public ApiResponse<?> reject(
            @PathVariable String type,
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body) {
        String reason = body != null ? body.get("reason") : null;
        return switch (type.toUpperCase()) {
            case "SOLUTION" -> ApiResponse.success(reviewService.rejectSolution(id, reason));
            case "COMMENT" -> {
                reviewService.rejectComment(id, reason);
                yield ApiResponse.success();
            }
            default -> ApiResponse.error(400, "不支持的审核类型: " + type);
        };
    }
}
