package com.algorithm.help.common.util;

import java.util.concurrent.atomic.AtomicLong;

/**
 * 雪花 ID 生成工具类
 * <p>
 * 基于 Twitter Snowflake 算法实现，生成全局唯一的 64 位 Long 型 ID。
 * 结构：1 位符号 + 41 位时间戳 + 5 位 datacenterId + 5 位 workerId + 12 位序列号
 * </p>
 * <p>
 * 后续引入 MyBatis-Plus 后可切换为 IdWorker.getId()，
 * 当前提供独立实现确保在 JPA 环境下也能使用。
 * </p>
 */
public final class SnowflakeIdUtil {

    private SnowflakeIdUtil() {
    }

    /** 起始时间戳 (2024-01-01 00:00:00 UTC) */
    private static final long EPOCH = 1704067200000L;

    private static final long WORKER_ID_BITS = 5L;
    private static final long DATACENTER_ID_BITS = 5L;
    private static final long SEQUENCE_BITS = 12L;

    private static final long MAX_WORKER_ID = ~(-1L << WORKER_ID_BITS);
    private static final long MAX_DATACENTER_ID = ~(-1L << DATACENTER_ID_BITS);

    private static final long WORKER_ID_SHIFT = SEQUENCE_BITS;
    private static final long DATACENTER_ID_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS;
    private static final long TIMESTAMP_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS + DATACENTER_ID_BITS;
    private static final long SEQUENCE_MASK = ~(-1L << SEQUENCE_BITS);

    private static long workerId = 1L;
    private static long datacenterId = 1L;
    private static final AtomicLong SEQUENCE = new AtomicLong(0L);
    private static volatile long lastTimestamp = -1L;

    /**
     * 初始化 workerId 和 datacenterId（服务启动时调用）
     */
    public static synchronized void init(long worker, long datacenter) {
        if (worker > MAX_WORKER_ID || worker < 0) {
            throw new IllegalArgumentException("workerId 超出范围: " + worker);
        }
        if (datacenter > MAX_DATACENTER_ID || datacenter < 0) {
            throw new IllegalArgumentException("datacenterId 超出范围: " + datacenter);
        }
        workerId = worker;
        datacenterId = datacenter;
    }

    /**
     * 生成下一个雪花 ID
     */
    public static synchronized long nextId() {
        long timestamp = currentTimeMillis();
        if (timestamp < lastTimestamp) {
            throw new IllegalStateException("时钟回拨，拒绝生成 ID");
        }
        if (timestamp == lastTimestamp) {
            long seq = SEQUENCE.incrementAndGet() & SEQUENCE_MASK;
            if (seq == 0) {
                timestamp = waitNextMillis(lastTimestamp);
            }
        } else {
            SEQUENCE.set(0L);
        }
        lastTimestamp = timestamp;
        return ((timestamp - EPOCH) << TIMESTAMP_SHIFT)
                | (datacenterId << DATACENTER_ID_SHIFT)
                | (workerId << WORKER_ID_SHIFT)
                | SEQUENCE.get();
    }

    private static long waitNextMillis(long last) {
        long ts = currentTimeMillis();
        while (ts <= last) {
            ts = currentTimeMillis();
        }
        return ts;
    }

    private static long currentTimeMillis() {
        return System.currentTimeMillis();
    }
}
