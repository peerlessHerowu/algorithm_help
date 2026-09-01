package com.algorithm.help.event;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * AI 加工服务 — 触发 AI 对内容进行加工
 * 包含限流逻辑：每分钟最多 10 次调用
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiEnrichService {

    private final StringRedisTemplate redisTemplate;

    /** 每分钟最大调用次数 */
    private static final int RATE_LIMIT_PER_MINUTE = 10;

    /** 限流计数器 key 前缀 */
    private static final String RATE_LIMIT_KEY = "ai:rate-limit:minute";

    /** 每日用量统计 key 前缀 */
    private static final String DAILY_USAGE_KEY_PREFIX = "ai:usage:";

    /** 简化版内存限流计数器 */
    private final AtomicInteger minuteCounter = new AtomicInteger(0);
    private volatile long lastResetTime = System.currentTimeMillis();

    /**
     * 触发 AI 加工（骨架实现）
     *
     * @param contentId   内容 ID
     * @param contentType 内容类型（如 SOLUTION、PROBLEM）
     */
    public void enrichContent(String contentId, String contentType) {
        if (!acquireRateLimit()) {
            log.warn("AI 调用限流中，跳过加工: contentId={}", contentId);
            return;
        }

        log.info("触发 AI 加工: contentId={}, contentType={}", contentId, contentType);
        incrementDailyUsage();

        // TODO: 实际 AI 加工逻辑 — 调用 AI Provider 进行内容增强
        // 当前为骨架实现，仅记录日志
        log.info("AI 加工完成（骨架）: contentId={}", contentId);
    }

    /**
     * 简化版限流：每分钟最多 RATE_LIMIT_PER_MINUTE 次
     * 使用内存计数器 + 时间窗口重置
     */
    private boolean acquireRateLimit() {
        long now = System.currentTimeMillis();
        // 超过 1 分钟则重置计数器
        if (now - lastResetTime > TimeUnit.MINUTES.toMillis(1)) {
            minuteCounter.set(0);
            lastResetTime = now;
        }
        return minuteCounter.incrementAndGet() <= RATE_LIMIT_PER_MINUTE;
    }

    /**
     * 记录每日 AI 调用次数（Redis INCR）
     * key 格式: ai:usage:2025-01-15
     */
    private void incrementDailyUsage() {
        String today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
        String key = DAILY_USAGE_KEY_PREFIX + today;
        redisTemplate.opsForValue().increment(key);
        // 设置 7 天过期，避免 key 无限积累
        redisTemplate.expire(key, 7, TimeUnit.DAYS);
    }

    /**
     * 获取今日 AI 调用次数
     */
    public long getTodayUsage() {
        String today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
        String key = DAILY_USAGE_KEY_PREFIX + today;
        String value = redisTemplate.opsForValue().get(key);
        return value == null ? 0 : Long.parseLong(value);
    }
}
