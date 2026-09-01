package com.algorithm.help.content.enrichment.controller;

import com.algorithm.help.auth.entity.User;
import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.content.enrichment.UnifiedExplanationService;
import com.algorithm.help.content.enrichment.dto.*;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentTaskManager;
import com.algorithm.help.content.enrichment.pipeline.TaskCreateResult;
import com.algorithm.help.content.enrichment.pipeline.TaskStatusDTO;
import com.algorithm.help.content.enrichment.ratelimit.EnrichmentRateLimiter;
import com.algorithm.help.content.enrichment.ratelimit.IpRateLimiter;
import com.algorithm.help.content.enrichment.ratelimit.RateLimitExceededData;
import com.algorithm.help.content.enrichment.ratelimit.RateLimitResult;
import com.algorithm.help.content.enrichment.ratelimit.UserDetailRateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;

/**
 * Enriched 解析 API
 * <p>
 * 列表/详情/生成/进度/取消/标签
 * <p>
 * 权限模型：
 * - 列表/详情/标签/进度：游客可访问（只读）
 * - 生成/取消：登录用户（受频率限制）
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/enriched")
@RequiredArgsConstructor
public class EnrichedSolutionController {

    private final UnifiedExplanationService unifiedService;
    private final EnrichmentTaskManager taskManager;
    private final EnrichmentRateLimiter rateLimiter;
    private final IpRateLimiter ipRateLimiter;
    private final UserDetailRateLimiter userDetailRateLimiter;

    /**
     * 查询 enriched 解析列表（摘要，含 source_votes）
     * 支持 ETag 缓存头
     */
    @GetMapping("/{problemId}/level/{level}")
    public ResponseEntity<ApiResponse<UnifiedExplanationResponse>> listByLevel(
            @PathVariable String problemId,
            @PathVariable Integer level,
            @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {

        UnifiedExplanationResponse response = unifiedService.getExplanations(problemId, level);

        // ETag 支持
        String etag = generateETag(response);
        if (etag.equals(ifNoneMatch)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).build();
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.ETAG, etag)
                .body(ApiResponse.success(response));
    }

    /**
     * 查询单条详情（含 timeComplexity、spaceComplexity）
     * <p>
     * IP 级限流：每 IP 60 次/分钟
     * 用户级限流：每用户 200 次/分钟
     */
    @GetMapping("/{id}/detail")
    public ResponseEntity<ApiResponse<EnrichedDetailDTO>> getDetail(
            @PathVariable String id,
            HttpServletRequest request) {

        // IP 级限流
        String clientIp = getClientIp(request);
        if (!ipRateLimiter.allowRequest(clientIp)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(ApiResponse.error(429, "请求过于频繁，请稍后再试"));
        }

        // 用户级限流
        User currentUser = getCurrentUser();
        if (currentUser != null) {
            String userId = currentUser.getId().toString();
            if (!userDetailRateLimiter.allowRequest(userId)) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .body(ApiResponse.error(429, "请求过于频繁，请稍后再试"));
            }
        }

        EnrichedDetailDTO detail = unifiedService.getDetail(id);
        if (detail == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(40402, "enriched 记录不存在"));
        }
        return ResponseEntity.ok(ApiResponse.success(detail));
    }

    /**
     * 触发异步生成，返回 202 + taskId
     * <p>
     * 权限：登录用户可调用（SecurityConfig 控制）
     * 频率：每用户每小时 5 次（滑动窗口）
     * 重试失败任务时不消耗额度（复用原 taskId）
     */
    @PostMapping("/{problemId}/generate")
    public ResponseEntity<ApiResponse<?>> generate(
            @PathVariable String problemId,
            @RequestParam(defaultValue = "3") Integer level,
            @RequestParam(defaultValue = "false") Boolean force) {

        // 提取当前用户
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error(40403, "请先登录"));
        }

        String userId = currentUser.getId().toString();

        // 频率检查（重试/幂等命中不消耗额度，由 TaskManager 处理）
        RateLimitResult rateResult = rateLimiter.check(userId);
        if (!rateResult.isAllowed()) {
            RateLimitExceededData data = new RateLimitExceededData()
                    .setRetryAfterSeconds(rateResult.getRetryAfterSeconds())
                    .setUsedCount(rateResult.getUsedCount())
                    .setMaxCount(rateResult.getMaxCount());
            ApiResponse<RateLimitExceededData> resp = ApiResponse.<RateLimitExceededData>error(40002, "请稍后再试")
                    .setData(data);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(resp);
        }

        // 创建任务
        TaskCreateResult result = taskManager.createTask(problemId, level, force);

        // 仅新创建的任务消耗额度（幂等命中/重试不消耗）
        if (!result.isReused()) {
            rateLimiter.recordRequest(userId);
            // 启动异步执行管线
            taskManager.executeTask(result.getTaskId(), problemId, level);
        }

        if (result.isReused()) {
            return ResponseEntity.status(HttpStatus.OK)
                    .body(ApiResponse.success(result));
        }

        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(ApiResponse.success(result));
    }

    /**
     * 查询任务状态 + 进度
     */
    @GetMapping("/tasks/{taskId}")
    public ApiResponse<TaskStatusDTO> getTaskStatus(@PathVariable String taskId) {
        TaskStatusDTO status = taskManager.getTaskStatus(taskId);
        if (status == null) {
            return ApiResponse.error(40402, "任务不存在或已过期");
        }
        return ApiResponse.success(status);
    }

    /**
     * 取消任务
     */
    @DeleteMapping("/tasks/{taskId}")
    public ApiResponse<Void> cancelTask(@PathVariable String taskId) {
        boolean cancelled = taskManager.cancelTask(taskId);
        if (!cancelled) {
            return ApiResponse.error(40402, "任务不存在或无法取消");
        }
        return ApiResponse.success();
    }

    /**
     * 标签聚合
     */
    @GetMapping("/{problemId}/level/{level}/tags")
    public ApiResponse<List<TagCount>> getTags(
            @PathVariable String problemId,
            @PathVariable Integer level) {

        List<TagCount> tags = unifiedService.getTagAggregation(problemId, level);
        return ApiResponse.success(tags);
    }

    // ===== ETag 生成 =====

    private String generateETag(Object data) {
        try {
            String json = data.toString();
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(json.getBytes(StandardCharsets.UTF_8));
            return "\"" + HexFormat.of().formatHex(digest) + "\"";
        } catch (Exception e) {
            return "\"" + System.currentTimeMillis() + "\"";
        }
    }

    // ===== 辅助方法 =====

    /** 从 SecurityContext 获取当前用户 */
    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User user) {
            return user;
        }
        return null;
    }

    /** 获取客户端真实 IP（支持代理转发） */
    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        return request.getRemoteAddr();
    }
}
