package com.algorithm.help.common.metrics;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * AI 调用指标收集器
 * 记录 AI 调用次数、成功率、耗时、缓存命中率
 */
@Slf4j
@Component
public class AiMetricsCollector {

    private final Counter totalCalls;
    private final Counter successCalls;
    private final Counter failedCalls;
    private final Counter cacheHits;
    private final Counter cacheMisses;
    private final Timer callDuration;

    public AiMetricsCollector(MeterRegistry registry) {
        this.totalCalls = Counter.builder("ai.calls.total")
                .description("AI 调用总次数")
                .register(registry);
        this.successCalls = Counter.builder("ai.calls.success")
                .description("AI 调用成功次数")
                .register(registry);
        this.failedCalls = Counter.builder("ai.calls.failed")
                .description("AI 调用失败次数")
                .register(registry);
        this.cacheHits = Counter.builder("ai.cache.hits")
                .description("AI 缓存命中次数")
                .register(registry);
        this.cacheMisses = Counter.builder("ai.cache.misses")
                .description("AI 缓存未命中次数")
                .register(registry);
        this.callDuration = Timer.builder("ai.calls.duration")
                .description("AI 调用耗时")
                .register(registry);
    }

    /** 记录一次 AI 调用开始 */
    public void recordCallStart() {
        totalCalls.increment();
    }

    /** 记录一次成功调用及耗时 */
    public void recordSuccess(Duration duration) {
        successCalls.increment();
        callDuration.record(duration);
    }

    /** 记录一次失败调用 */
    public void recordFailure() {
        failedCalls.increment();
    }

    /** 记录缓存命中 */
    public void recordCacheHit() {
        cacheHits.increment();
    }

    /** 记录缓存未命中 */
    public void recordCacheMiss() {
        cacheMisses.increment();
    }

    /** 获取成功率（百分比） */
    public double getSuccessRate() {
        double total = totalCalls.count();
        if (total == 0) return 100.0;
        return (successCalls.count() / total) * 100.0;
    }

    /** 获取缓存命中率（百分比） */
    public double getCacheHitRate() {
        double total = cacheHits.count() + cacheMisses.count();
        if (total == 0) return 0.0;
        return (cacheHits.count() / total) * 100.0;
    }
}
