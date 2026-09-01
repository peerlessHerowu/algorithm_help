package com.algorithm.help.content.enrichment.ratelimit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * IP 级限流器
 * <p>
 * 详情接口每 IP 60 次/分钟。
 * Redis key: rate:ip:detail:{ip}，使用 INCR + TTL 固定窗口。
 * Redis 异常时降级放行。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IpRateLimiter {

    private static final String KEY_PREFIX = "rate:ip:detail:";
    private static final int LIMIT = 60;
    private static final Duration WINDOW = Duration.ofMinutes(1);

    private final StringRedisTemplate redisTemplate;

    /**
     * 检查并递增 IP 计数
     *
     * @param ip 客户端 IP
     * @return true=允许，false=超限
     */
    public boolean allowRequest(String ip) {
        String key = KEY_PREFIX + ip;
        try {
            Long count = redisTemplate.opsForValue().increment(key);
            if (count == null) {
                return true; // 异常降级
            }

            // 首次设置 TTL
            if (count == 1) {
                redisTemplate.expire(key, WINDOW);
            }

            return count <= LIMIT;
        } catch (Exception e) {
            log.warn("IP 限流 Redis 异常，降级放行, ip={}: {}", ip, e.getMessage());
            return true;
        }
    }
}
