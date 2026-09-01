package com.algorithm.help.content.enrichment.ratelimit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * EnrichmentRateLimiter 单元测试
 */
@ExtendWith(MockitoExtension.class)
class EnrichmentRateLimiterTest {

    @Mock
    private StringRedisTemplate redisTemplate;
    @Mock
    private ZSetOperations<String, String> zSetOps;

    private EnrichmentRateLimiter rateLimiter;

    @BeforeEach
    void setUp() {
        lenient().when(redisTemplate.opsForZSet()).thenReturn(zSetOps);
        rateLimiter = new EnrichmentRateLimiter(redisTemplate);
    }

    @Test
    @DisplayName("未达上限：允许请求")
    void check_underLimit_allowed() {
        when(zSetOps.zCard("rate:enrich:user-1")).thenReturn(3L);

        RateLimitResult result = rateLimiter.check("user-1");

        assertTrue(result.isAllowed());
        assertEquals(3, result.getUsedCount());
        assertEquals(5, result.getMaxCount());
        assertEquals(0, result.getRetryAfterSeconds());
        assertFalse(result.isDegraded());
    }

    @Test
    @DisplayName("达到上限：拒绝请求并返回等待秒数")
    void check_atLimit_exceeded() {
        when(zSetOps.zCard("rate:enrich:user-1")).thenReturn(5L);
        // 模拟最早一条记录
        long earliestTs = System.currentTimeMillis() - 2400_000L; // 40 分钟前
        when(zSetOps.range("rate:enrich:user-1", 0, 0))
                .thenReturn(Set.of(earliestTs + ":1"));
        when(zSetOps.score("rate:enrich:user-1", earliestTs + ":1"))
                .thenReturn((double) earliestTs);

        RateLimitResult result = rateLimiter.check("user-1");

        assertFalse(result.isAllowed());
        assertEquals(5, result.getUsedCount());
        assertEquals(5, result.getMaxCount());
        // 最早记录 40 分钟前，窗口 60 分钟，还需等约 20 分钟 ≈ 1200 秒
        assertTrue(result.getRetryAfterSeconds() > 1100);
        assertTrue(result.getRetryAfterSeconds() <= 1200);
    }

    @Test
    @DisplayName("零次使用：允许请求")
    void check_noUsage_allowed() {
        when(zSetOps.zCard("rate:enrich:user-1")).thenReturn(0L);

        RateLimitResult result = rateLimiter.check("user-1");

        assertTrue(result.isAllowed());
        assertEquals(0, result.getUsedCount());
    }

    @Test
    @DisplayName("Redis 异常：降级放行")
    void check_redisException_degraded() {
        when(zSetOps.removeRangeByScore(anyString(), anyDouble(), anyDouble()))
                .thenThrow(new RuntimeException("Redis 连接失败"));

        RateLimitResult result = rateLimiter.check("user-1");

        assertTrue(result.isAllowed());
        assertTrue(result.isDegraded());
    }

    @Test
    @DisplayName("记录请求：写入 Redis ZSet")
    void recordRequest_writesToRedis() {
        rateLimiter.recordRequest("user-1");

        verify(zSetOps).add(eq("rate:enrich:user-1"), anyString(), anyDouble());
        verify(redisTemplate).expire(eq("rate:enrich:user-1"), any());
    }

    @Test
    @DisplayName("记录请求 Redis 异常：不抛出")
    void recordRequest_redisException_noThrow() {
        when(zSetOps.add(anyString(), anyString(), anyDouble()))
                .thenThrow(new RuntimeException("Redis 写入失败"));

        assertDoesNotThrow(() -> rateLimiter.recordRequest("user-1"));
    }
}
