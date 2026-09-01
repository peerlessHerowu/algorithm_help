package com.algorithm.help.common.filter;

import com.algorithm.help.auth.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.Set;

/**
 * Redis 滑动窗口限流过滤器
 * <p>
 * 公开 API：单 IP 每分钟 60 次
 * AI 生成类 API：单用户每分钟 5 次
 * 超限返回 HTTP 429 + Retry-After header
 * Redis Key 格式：rate_limit:{ip|userId}:{endpoint_group}
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_MILLIS = 60_000L;
    private static final int PUBLIC_API_LIMIT = 60;
    private static final int AI_API_LIMIT = 5;

    /** AI 生成类 API 路径前缀 */
    private static final Set<String> AI_ENDPOINT_PATTERNS = Set.of(
            "/api/v1/problems/", // 包含 /generate 的路径
            "/api/v1/ai/"
    );

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        String method = request.getMethod();

        // 判断是否为 AI 生成类请求
        if (isAiEndpoint(path, method)) {
            if (!checkAiRateLimit(request, response)) {
                return;
            }
        }

        // 公开 API 限流（所有请求均受限）
        if (!checkPublicRateLimit(request, response)) {
            return;
        }

        filterChain.doFilter(request, response);
    }

    /** 判断是否为 AI 生成类 API */
    private boolean isAiEndpoint(String path, String method) {
        if (!"POST".equalsIgnoreCase(method)) {
            return false;
        }
        return path.contains("/generate") || path.startsWith("/api/v1/ai/");
    }

    /** AI API 限流检查：单用户每分钟 5 次 */
    private boolean checkAiRateLimit(HttpServletRequest request,
                                     HttpServletResponse response) throws IOException {
        String userId = extractUserId();
        if (userId == null) {
            // 未认证用户不能调用 AI 接口，交给 Security 处理
            return true;
        }
        String key = "rate_limit:" + userId + ":ai_generate";
        return performSlidingWindowCheck(key, AI_API_LIMIT, response);
    }

    /** 公开 API 限流检查：单 IP 每分钟 60 次 */
    private boolean checkPublicRateLimit(HttpServletRequest request,
                                         HttpServletResponse response) throws IOException {
        String clientIp = getClientIp(request);
        String key = "rate_limit:" + clientIp + ":public";
        return performSlidingWindowCheck(key, PUBLIC_API_LIMIT, response);
    }

    /**
     * 滑动窗口限流核心逻辑（Redis Sorted Set）
     * <p>
     * score = 时间戳，member = 唯一请求标识
     * 每次请求：移除窗口外数据 → 统计窗口内请求数 → 判断是否超限
     */
    private boolean performSlidingWindowCheck(String key, int limit,
                                              HttpServletResponse response) throws IOException {
        long now = System.currentTimeMillis();
        long windowStart = now - WINDOW_MILLIS;

        ZSetOperations<String, String> zSetOps = redisTemplate.opsForZSet();

        // 移除窗口外的过期请求记录
        zSetOps.removeRangeByScore(key, 0, windowStart);

        // 统计当前窗口内的请求数
        Long count = zSetOps.zCard(key);
        if (count != null && count >= limit) {
            writeRateLimitResponse(response);
            return false;
        }

        // 记录本次请求（member 使用时间戳+随机数确保唯一）
        String member = now + ":" + Thread.currentThread().getId() + ":" + Math.random();
        zSetOps.add(key, member, now);

        // 设置 Key 过期时间，防止僵尸 Key
        redisTemplate.expire(key, Duration.ofSeconds(70));
        return true;
    }

    /** 写入 429 限流响应 */
    private void writeRateLimitResponse(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader("Retry-After", "60");
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        Map<String, Object> body = Map.of(
                "code", 429,
                "message", "请求过于频繁，请稍后再试",
                "retryAfter", 60
        );
        objectMapper.writeValue(response.getWriter(), body);
    }

    /** 从 SecurityContext 提取用户 ID */
    private String extractUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User user) {
            return user.getId().toString();
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
