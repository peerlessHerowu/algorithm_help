package com.algorithm.help.content.feynman;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 自适应错误类型选择器
 * <p>
 * 基于用户历史表现，使用加权随机算法选择下一道题的错误类型。
 * 核心策略：成功率 < 50% 的类型权重 ×2，优先强化薄弱环节。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdaptiveErrorSelector {

    private final ErrorTypeStatsRepository statsRepo;

    /** 默认权重（无历史数据时） */
    private static final double DEFAULT_WEIGHT = 1.0;

    /** 薄弱类型加权倍数 */
    private static final double WEAK_MULTIPLIER = 2.0;

    /** 薄弱阈值：成功率低于此值视为薄弱 */
    private static final double WEAK_THRESHOLD = 0.5;

    /**
     * 根据用户历史选择下一个错误类型
     *
     * @param userId     用户 ID
     * @param difficulty 当前难度等级
     * @return 选中的错误类型
     */
    public FeynmanErrorType selectNextErrorType(String userId, FeynmanDifficulty difficulty) {
        List<FeynmanErrorType> candidates = difficulty.getAllowedErrorTypes();
        List<ErrorTypeStats> userStats = statsRepo.findByUserId(userId);
        Map<FeynmanErrorType, Double> weightMap = buildWeightMap(candidates, userStats);
        return weightedRandomSelect(weightMap);
    }

    /**
     * 构建加权映射表
     * <p>
     * 规则：
     * - 无历史记录的类型：默认权重 1.0
     * - 成功率 < 50% 的类型：权重 ×2
     * - 成功率 >= 50% 的类型：权重 1.0
     */
    private Map<FeynmanErrorType, Double> buildWeightMap(
            List<FeynmanErrorType> candidates,
            List<ErrorTypeStats> userStats) {

        Map<FeynmanErrorType, ErrorTypeStats> statsMap = new HashMap<>();
        for (ErrorTypeStats stat : userStats) {
            statsMap.put(stat.getErrorType(), stat);
        }

        Map<FeynmanErrorType, Double> weightMap = new LinkedHashMap<>();
        for (FeynmanErrorType type : candidates) {
            ErrorTypeStats stat = statsMap.get(type);
            double weight = calculateWeight(stat);
            weightMap.put(type, weight);
        }
        return weightMap;
    }

    /**
     * 计算单个类型的权重
     */
    private double calculateWeight(ErrorTypeStats stat) {
        if (stat == null || stat.getTotalAttempts() == 0) {
            // 无历史数据，给默认权重（鼓励尝试新类型）
            return DEFAULT_WEIGHT;
        }
        double rate = stat.successRate();
        return rate < WEAK_THRESHOLD ? DEFAULT_WEIGHT * WEAK_MULTIPLIER : DEFAULT_WEIGHT;
    }

    /**
     * 加权随机选择
     */
    private FeynmanErrorType weightedRandomSelect(Map<FeynmanErrorType, Double> weightMap) {
        double totalWeight = weightMap.values().stream().mapToDouble(Double::doubleValue).sum();
        double random = ThreadLocalRandom.current().nextDouble() * totalWeight;

        double cumulative = 0.0;
        for (Map.Entry<FeynmanErrorType, Double> entry : weightMap.entrySet()) {
            cumulative += entry.getValue();
            if (random <= cumulative) {
                return entry.getKey();
            }
        }
        // 兜底：返回最后一个
        return weightMap.keySet().stream().reduce((a, b) -> b).orElse(FeynmanErrorType.LOGIC);
    }

    /**
     * 记录用户答题结果，更新统计数据
     *
     * @param userId    用户 ID
     * @param errorType 错误类型
     * @param success   是否答对
     */
    public void recordAttempt(String userId, FeynmanErrorType errorType, boolean success) {
        ErrorTypeStats stats = statsRepo.findByUserIdAndErrorType(userId, errorType)
                .orElseGet(() -> new ErrorTypeStats()
                        .setUserId(userId)
                        .setErrorType(errorType)
                        .setTotalAttempts(0)
                        .setSuccessCount(0));

        stats.setTotalAttempts(stats.getTotalAttempts() + 1);
        if (success) {
            stats.setSuccessCount(stats.getSuccessCount() + 1);
        }
        stats.setLastPracticeAt(System.currentTimeMillis());
        statsRepo.save(stats);

        log.debug("用户 {} 错误类型 {} 统计更新: 尝试={}, 成功={}, 成功率={}",
                userId, errorType, stats.getTotalAttempts(),
                stats.getSuccessCount(), String.format("%.2f", stats.successRate()));
    }
}
