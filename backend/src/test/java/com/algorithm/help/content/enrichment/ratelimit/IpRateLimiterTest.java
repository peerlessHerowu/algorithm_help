package com.algorithm.help.content.enrichment.ratelimit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * IpRateLimiter 单元测试
 */
@ExtendWith(MockitoExtension.class)
class IpRateLimiterTest {

    @Mock
    private StringRedisTemplate redisTemplate;
    @Mock
    private ValueOperations<String, String> valueOps;

    private IpRateLimiter ipRateLimiter;

    @BeforeEach
    void setUp() {
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
        ipRateLimiter = new IpRateLimiter(redisTemplate);
    }

    @Test
    @DisplayName("首次请求：允许并设置 TTL")
    void allowRequest_firstRequest_allowedAndSetTtl() {
        when(valueOps.increment("rate:ip:detail:192.168.1.1")).thenReturn(1L);

        boolean allowed = ipRateLimiter.allowRequest("192.168.1.1");

        assertTrue(allowed);
        verify(redisTemplate).expire("rate:ip:detail:192.168.1.1", Duration.ofMinutes(1));
    }

    @Test
    @DisplayName("未达上限：允许请求")
    void allowRequest_underLimit_allowed() {
        when(valueOps.increment("rate:ip:detail:192.168.1.1")).thenReturn(30L);

        boolean allowed = ipRateLimiter.allowRequest("192.168.1.1");

        assertTrue(allowed);
        // 非首次不设置 TTL
        verify(redisTemplate, never()).expire(anyString(), any(Duration.class));
    }

    @Test
    @DisplayName("达到 60 次上限：允许（边界值）")
    void allowRequest_atExactLimit_allowed() {
        when(valueOps.increment("rate:ip:detail:192.168.1.1")).thenReturn(60L);

        boolean allowed = ipRateLimiter.allowRequest("192.168.1.1");

        assertTrue(allowed);
    }

    @Test
    @DisplayName("超过 60 次上限：拒绝")
    void allowRequest_overLimit_rejected() {
        when(valueOps.increment("rate:ip:detail:192.168.1.1")).thenReturn(61L);

        boolean allowed = ipRateLimiter.allowRequest("192.168.1.1");

        assertFalse(allowed);
    }

    @Test
    @DisplayName("Redis 异常：降级放行")
    void allowRequest_redisException_degraded() {
        when(valueOps.increment(anyString()))
                .thenThrow(new RuntimeException("Redis 连接失败"));

        boolean allowed = ipRateLimiter.allowRequest("192.168.1.1");

        assertTrue(allowed);
    }

    @Test
    @DisplayName("increment 返回 null：降级放行")
    void allowRequest_incrementReturnsNull_degraded() {
        when(valueOps.increment("rate:ip:detail:192.168.1.1")).thenReturn(null);

        boolean allowed = ipRateLimiter.allowRequest("192.168.1.1");

        assertTrue(allowed);
    }
}
