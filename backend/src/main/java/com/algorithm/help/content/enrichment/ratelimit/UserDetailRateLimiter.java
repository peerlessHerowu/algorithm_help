package com.algorithm.help.content.enrichment.ratelimit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * 用户级详情接口限流器
 * <p>
 * 登录用户每分钟最多 200 次详情请求。
 * Redis key: rate:detail:user:{userId}，使用 INCR + TTL 固定窗口。
 * Redis 异常时降级放行。
 *
 * Requirements: 30.3
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserDetailRateLimiter {

    private static final String KEY_PREFIX = "rate:detail:user:";
    private static final Duration WINDOW = Duration.ofMinutes(1);

    @Value("${content.enrichment.rate-limit.user-detail-per-minute:200}")
    private int limit;

    private final StringRedisTemplate redisTemplate;

    /**
     * 检查并递增用户计数
     *
     * @param userId 用户 ID
     * @return true=允许，false=超限
     */
    public boolean allowRequest(String userId) {
        if (userId == null || userId.isBlank()) {
            return true; // 未登录用户由 IP 限流控制
        }

        String key = KEY_PREFIX + userId;
        try {
            Long count = redisTemplate.opsForValue().increment(key);
            if (count == null) {
                return true; // 异常降级
            }
            if (count == 1) {
                redisTemplate.expire(key, WINDOW);
            }
            return count <= limit;
        } catch (Exception e) {
            log.warn("用户详情限流 Redis 异常，降级放行, userId={}: {}", userId, e.getMessage());
            return true;
        }
    }
}
