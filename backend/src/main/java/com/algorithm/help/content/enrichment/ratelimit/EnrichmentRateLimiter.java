package com.algorithm.help.content.enrichment.ratelimit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Set;

/**
 * Enrichment 生成频率限制器（滑动窗口）
 * <p>
 * 每用户每小时最多 5 次生成请求。
 * Redis Sorted Set：key=rate:enrich:{userId}, member=timestamp, score=timestamp
 * Redis 异常时降级放行（不阻塞用户）。
 * 重试失败任务（复用原 taskId）不消耗额度。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EnrichmentRateLimiter {

    private static final String RATE_KEY_PREFIX = "rate:enrich:";
    private static final long WINDOW_MS = 3600_000L; // 1 小时
    private static final int MAX_COUNT = 5;
    private static final Duration KEY_TTL = Duration.ofSeconds(3700); // 略大于窗口

    private final StringRedisTemplate redisTemplate;

    /**
     * 检查用户是否允许生成（不增加计数）
     *
     * @param userId 用户 ID
     * @return 频率检查结果
     */
    public RateLimitResult check(String userId) {
        String key = RATE_KEY_PREFIX + userId;
        long now = System.currentTimeMillis();
        long windowStart = now - WINDOW_MS;

        try {
            ZSetOperations<String, String> zSetOps = redisTemplate.opsForZSet();

            // 清理窗口外数据
            zSetOps.removeRangeByScore(key, 0, windowStart);

            // 统计窗口内请求数
            Long count = zSetOps.zCard(key);
            int usedCount = count != null ? count.intValue() : 0;

            if (usedCount >= MAX_COUNT) {
                // 计算最早一条记录的过期时间
                long retryAfterSeconds = calcRetryAfterSeconds(zSetOps, key, now);
                return RateLimitResult.exceeded(usedCount, MAX_COUNT, retryAfterSeconds);
            }

            return RateLimitResult.allowed(usedCount, MAX_COUNT);
        } catch (Exception e) {
            log.warn("频率限制检查 Redis 异常，降级放行, userId={}: {}", userId, e.getMessage());
            return RateLimitResult.degraded();
        }
    }

    /**
     * 记录一次生成请求（计数 +1）
     *
     * @param userId 用户 ID
     */
    public void recordRequest(String userId) {
        String key = RATE_KEY_PREFIX + userId;
        long now = System.currentTimeMillis();
        String member = now + ":" + Thread.currentThread().getId();

        try {
            redisTemplate.opsForZSet().add(key, member, now);
            redisTemplate.expire(key, KEY_TTL);
        } catch (Exception e) {
            log.warn("频率记录 Redis 异常，跳过, userId={}: {}", userId, e.getMessage());
        }
    }

    /**
     * 计算最早一条请求过期还需等待的秒数
     */
    private long calcRetryAfterSeconds(ZSetOperations<String, String> zSetOps,
                                       String key, long now) {
        Set<String> earliest = zSetOps.range(key, 0, 0);
        if (earliest == null || earliest.isEmpty()) {
            return 60; // 兜底 1 分钟
        }

        String firstMember = earliest.iterator().next();
        Double firstScore = zSetOps.score(key, firstMember);
        if (firstScore == null) {
            return 60;
        }

        long expireAt = firstScore.longValue() + WINDOW_MS;
        long remaining = (expireAt - now) / 1000;
        return Math.max(1, remaining);
    }
}
