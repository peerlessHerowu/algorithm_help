package com.algorithm.help.content.enrichment.ratelimit;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 频率限制检查结果
 */
@Data
@Accessors(chain = true)
public class RateLimitResult {

    /** 是否允许请求 */
    private boolean allowed;

    /** 已使用次数 */
    private int usedCount;

    /** 最大允许次数 */
    private int maxCount;

    /** 超限时需要等待的秒数 */
    private long retryAfterSeconds;

    /** 是否为降级放行（Redis 异常） */
    private boolean degraded;

    public static RateLimitResult allowed(int usedCount, int maxCount) {
        return new RateLimitResult()
                .setAllowed(true)
                .setUsedCount(usedCount)
                .setMaxCount(maxCount)
                .setRetryAfterSeconds(0)
                .setDegraded(false);
    }

    public static RateLimitResult exceeded(int usedCount, int maxCount, long retryAfterSeconds) {
        return new RateLimitResult()
                .setAllowed(false)
                .setUsedCount(usedCount)
                .setMaxCount(maxCount)
                .setRetryAfterSeconds(retryAfterSeconds)
                .setDegraded(false);
    }

    /**
     * Redis 异常时降级放行
     */
    public static RateLimitResult degraded() {
        return new RateLimitResult()
                .setAllowed(true)
                .setUsedCount(0)
                .setMaxCount(5)
                .setRetryAfterSeconds(0)
                .setDegraded(true);
    }
}
