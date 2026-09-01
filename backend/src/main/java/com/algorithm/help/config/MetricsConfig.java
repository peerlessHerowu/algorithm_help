package com.algorithm.help.config;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 自定义业务监控指标配置
 * 使用 Micrometer（Spring Boot Actuator 内置）
 */
@Configuration
public class MetricsConfig {

    /**
     * 题解提交计数器
     */
    @Bean
    public Counter solutionSubmitCounter(MeterRegistry registry) {
        return Counter.builder("solution.submit.count")
                .description("题解提交次数")
                .tag("type", "solution")
                .register(registry);
    }

    /**
     * 评论创建计数器
     */
    @Bean
    public Counter commentCreateCounter(MeterRegistry registry) {
        return Counter.builder("comment.create.count")
                .description("评论创建次数")
                .tag("type", "comment")
                .register(registry);
    }
}
