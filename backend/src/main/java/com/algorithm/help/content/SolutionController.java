package com.algorithm.help.content;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.content.dto.CreateSolutionRequest;
import com.algorithm.help.content.dto.SolutionDTO;
import com.algorithm.help.content.dto.UpdateSolutionRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

/**
 * 用户题解 REST API
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class SolutionController {

    private final SolutionService solutionService;

    /**
     * 创建题解
     */
    @PostMapping("/api/v1/problems/{problemId}/solutions")
    public ApiResponse<SolutionDTO> create(
            @PathVariable String problemId,
            @RequestHeader("X-User-Id") String userId,
            @RequestBody CreateSolutionRequest request) {
        SolutionDTO dto = solutionService.create(problemId, userId, request);
        return ApiResponse.success(dto);
    }

    /**
     * 题解列表（分页）
     * @param sort latest=按createdAt降序, hot=按upvotes降序, featured=筛选精选
     */
    @GetMapping("/api/v1/problems/{problemId}/solutions")
    public ApiResponse<Page<SolutionDTO>> list(
            @PathVariable String problemId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "latest") String sort) {
        Page<SolutionDTO> result = solutionService.list(problemId, page, size, sort);
        return ApiResponse.success(result);
    }

    /**
     * 编辑自己的题解
     */
    @PutMapping("/api/v1/solutions/{id}")
    public ApiResponse<SolutionDTO> update(
            @PathVariable String id,
            @RequestHeader("X-User-Id") String userId,
            @RequestBody UpdateSolutionRequest request) {
        SolutionDTO dto = solutionService.update(id, userId, request);
        return ApiResponse.success(dto);
    }

    /**
     * 软删除自己的题解
     */
    @DeleteMapping("/api/v1/solutions/{id}")
    public ApiResponse<Void> delete(
            @PathVariable String id,
            @RequestHeader("X-User-Id") String userId) {
        solutionService.delete(id, userId);
        return ApiResponse.success();
    }

    // ======================== 管理员端点 ========================

    /**
     * 标记精选
     */
    @PostMapping("/api/v1/admin/solutions/{id}/feature")
    public ApiResponse<SolutionDTO> feature(@PathVariable String id) {
        SolutionDTO dto = solutionService.feature(id);
        return ApiResponse.success(dto);
    }

    /**
     * 提升为官方解析（当前仅记录日志，复制到 Explanation 表留作 TODO）
     */
    @PostMapping("/api/v1/admin/solutions/{id}/promote")
    public ApiResponse<Void> promote(@PathVariable String id) {
        solutionService.promote(id);
        return ApiResponse.success();
    }
}
