package com.algorithm.help.common.util;

import org.slf4j.MDC;

import java.util.UUID;

/**
 * TraceId 工具类
 * <p>
 * 提供 traceId 的生成、获取、设置和清理操作，
 * 基于 SLF4J MDC 实现跨方法/线程的请求追踪。
 * </p>
 */
public final class TraceIdUtil {

    private TraceIdUtil() {
    }

    private static final String TRACE_ID_KEY = "traceId";

    /**
     * 生成 16 位随机 traceId
     */
    public static String generate() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }

    /**
     * 获取当前线程的 traceId，不存在则生成并设置
     */
    public static String getOrCreate() {
        String traceId = MDC.get(TRACE_ID_KEY);
        if (traceId == null || traceId.isBlank()) {
            traceId = generate();
            MDC.put(TRACE_ID_KEY, traceId);
        }
        return traceId;
    }

    /**
     * 获取当前线程的 traceId（可能为 null）
     */
    public static String get() {
        return MDC.get(TRACE_ID_KEY);
    }

    /**
     * 设置当前线程的 traceId
     */
    public static void set(String traceId) {
        if (traceId != null && !traceId.isBlank()) {
            MDC.put(TRACE_ID_KEY, traceId);
        }
    }

    /**
     * 清理当前线程的 traceId（线程归还前调用）
     */
    public static void clear() {
        MDC.remove(TRACE_ID_KEY);
    }
}
