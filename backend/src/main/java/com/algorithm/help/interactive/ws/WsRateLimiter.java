package com.algorithm.help.interactive.ws;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * WebSocket 消息速率限制器
 * <p>
 * 滑动窗口限流：每用户每秒最多 5 条消息
 */
@Slf4j
@Component
public class WsRateLimiter {

    private static final int MAX_MESSAGES_PER_SECOND = 5;

    /** 用户ID → 当前窗口内计数器 */
    private final Map<String, WindowCounter> counters = new ConcurrentHashMap<>();

    /**
     * 检查是否允许发送
     *
     * @param userId 用户 ID
     * @return true=允许, false=超限
     */
    public boolean allowMessage(String userId) {
        WindowCounter counter = counters.computeIfAbsent(userId, k -> new WindowCounter());
        long now = System.currentTimeMillis();
        return counter.tryAcquire(now);
    }

    /**
     * 滑动窗口计数器（1 秒窗口）
     */
    private static class WindowCounter {
        private long windowStart = System.currentTimeMillis();
        private final AtomicInteger count = new AtomicInteger(0);

        synchronized boolean tryAcquire(long now) {
            // 窗口过期，重置
            if (now - windowStart >= 1000) {
                windowStart = now;
                count.set(0);
            }
            return count.incrementAndGet() <= MAX_MESSAGES_PER_SECOND;
        }
    }
}
