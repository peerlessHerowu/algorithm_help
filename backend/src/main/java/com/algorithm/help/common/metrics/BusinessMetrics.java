package com.algorithm.help.common.metrics;

import com.algorithm.help.repository.ExplanationRepository;
import com.algorithm.help.repository.ProblemRepository;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 业务指标注册器
 * 注册自定义 Gauge 指标：总题目数、已生成解析数等
 */
@Slf4j
@Component
public class BusinessMetrics {

    public BusinessMetrics(MeterRegistry registry,
                           ProblemRepository problemRepo,
                           ExplanationRepository explanationRepo) {
        // 总题目数
        Gauge.builder("business.problems.total", problemRepo, r -> r.count())
                .description("总题目数")
                .register(registry);

        // 已生成解析数
        Gauge.builder("business.explanations.total", explanationRepo, r -> r.count())
                .description("已生成解析总数")
                .register(registry);

        log.info("业务指标已注册");
    }
}
