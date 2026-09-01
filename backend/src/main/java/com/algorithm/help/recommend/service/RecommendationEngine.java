package com.algorithm.help.recommend.service;

import com.algorithm.help.graph.dto.RecommendItem;
import com.algorithm.help.graph.entity.GraphNode;
import com.algorithm.help.graph.entity.UserProgress;
import com.algorithm.help.graph.enums.CompletionStatus;
import com.algorithm.help.graph.repository.GraphNodeRepository;
import com.algorithm.help.graph.repository.GraphUserProgressRepository;
import com.algorithm.help.graph.service.GraphService;
import com.algorithm.help.recommend.dto.WeakPatternDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 推荐引擎：基于用户学习历史 + 薄弱模式 + 图谱拓扑计算个性化推荐
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecommendationEngine {

    private final GraphService graphService;
    private final GraphUserProgressRepository progressRepo;
    private final GraphNodeRepository nodeRepo;
    private final RedisTemplate<String, Object> redisTemplate;

    private static final String CACHE_PREFIX = "recommend:";
    private static final long CACHE_TTL_HOURS = 6;
    private static final double WEAK_PATTERN_THRESHOLD = 0.6;
    private static final double WEAK_PATTERN_BONUS = 1.5;
    private static final int TOP_K = 10;

    /**
     * 为用户生成个性化推荐（Top 10）
     * <p>
     * 策略：薄弱模式候选加 1.5x 分数加成，已完成题目的进阶推荐按原始分数
     * 去重 + 排除已完成 + 按分数降序取 Top 10，结果缓存 6h
     */
    @SuppressWarnings("unchecked")
    public List<RecommendItem> recommend(String userId) {
        // 检查 Redis 缓存
        String cacheKey = CACHE_PREFIX + userId;
        Object cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached instanceof List<?> list && !list.isEmpty()) {
            return (List<RecommendItem>) list;
        }

        // 获取用户全部进度
        List<UserProgress> allProgress = progressRepo.findByUserId(userId);
        Set<String> completedIds = extractCompletedIds(allProgress);
        List<WeakPatternDTO> weakPatterns = identifyWeakPatterns(userId);

        // 收集候选推荐项
        List<RecommendItem> candidates = new ArrayList<>();
        collectWeakPatternCandidates(weakPatterns, completedIds, candidates);
        collectFollowUpCandidates(completedIds, candidates);

        // 去重、排除已完成、按分数降序、取 Top 10
        List<RecommendItem> result = deduplicateAndRank(candidates, completedIds);

        // 写入缓存
        redisTemplate.opsForValue().set(cacheKey, result, CACHE_TTL_HOURS, TimeUnit.HOURS);
        log.info("为用户 {} 生成 {} 条推荐，缓存 {}h", userId, result.size(), CACHE_TTL_HOURS);
        return result;
    }

    /**
     * 识别用户薄弱模式：按模式分组后，正确率 < 60% 的模式
     */
    public List<WeakPatternDTO> identifyWeakPatterns(String userId) {
        List<UserProgress> allProgress = progressRepo.findByUserId(userId);
        return allProgress.stream()
                .filter(p -> p.getPatternId() != null && p.getAttempts() != null && p.getAttempts() > 0)
                .collect(Collectors.groupingBy(UserProgress::getPatternId))
                .entrySet().stream()
                .map(entry -> buildWeakPatternDTO(entry.getKey(), entry.getValue()))
                .filter(dto -> dto.getAccuracy() < WEAK_PATTERN_THRESHOLD)
                .collect(Collectors.toList());
    }

    /**
     * 构建薄弱模式 DTO：计算正确率、查找模式名称、建议练习题数
     */
    private WeakPatternDTO buildWeakPatternDTO(String patternId, List<UserProgress> records) {
        int totalCorrect = records.stream()
                .mapToInt(p -> p.getCorrectCount() != null ? p.getCorrectCount() : 0).sum();
        int totalAttempts = records.stream()
                .mapToInt(p -> p.getAttempts() != null ? p.getAttempts() : 0).sum();
        double accuracy = totalAttempts > 0 ? (double) totalCorrect / totalAttempts : 0.0;

        // 查找模式名称
        String patternName = nodeRepo.findById(patternId)
                .map(GraphNode::getName)
                .orElse(patternId);

        // 建议题数：正确率越低建议越多，范围 5-10
        int suggestedCount = Math.min(10, Math.max(5, (int) ((1 - accuracy) * 15)));

        return new WeakPatternDTO()
                .setPatternId(patternId)
                .setPatternName(patternName)
                .setAccuracy(accuracy)
                .setSuggestedCount(suggestedCount);
    }

    /**
     * 提取用户已完成题目 ID 集合（COMPLETED 或 MASTERED）
     */
    private Set<String> extractCompletedIds(List<UserProgress> progress) {
        return progress.stream()
                .filter(p -> p.getStatus() == CompletionStatus.COMPLETED
                        || p.getStatus() == CompletionStatus.MASTERED)
                .map(UserProgress::getProblemId)
                .collect(Collectors.toSet());
    }

    /**
     * 收集薄弱模式相关候选：通过 GraphService 查找薄弱模式的关联题目，加 1.5x bonus
     */
    private void collectWeakPatternCandidates(List<WeakPatternDTO> weakPatterns,
                                              Set<String> completedIds,
                                              List<RecommendItem> candidates) {
        for (WeakPatternDTO weak : weakPatterns) {
            // 通过图谱查询薄弱模式的后续推荐
            List<RecommendItem> related = graphService.recommendNext(weak.getPatternId());
            for (RecommendItem item : related) {
                if (!completedIds.contains(item.getNodeId())) {
                    // 薄弱模式加成 1.5x
                    double boostedScore = (item.getScore() != null ? item.getScore() : 0.5) * WEAK_PATTERN_BONUS;
                    candidates.add(new RecommendItem()
                            .setNodeId(item.getNodeId())
                            .setNodeType(item.getNodeType())
                            .setName(item.getName())
                            .setReason("薄弱模式[" + weak.getPatternName() + "]训练")
                            .setScore(boostedScore)
                            .setPatternName(item.getPatternName())
                            .setDifficulty(item.getDifficulty()));
                }
            }
        }
    }

    /**
     * 收集已完成题目的进阶推荐：通过 GraphService.recommendNext 查找后续题目
     */
    private void collectFollowUpCandidates(Set<String> completedIds,
                                           List<RecommendItem> candidates) {
        for (String completedId : completedIds) {
            List<RecommendItem> nextItems = graphService.recommendNext(completedId);
            for (RecommendItem item : nextItems) {
                if (!completedIds.contains(item.getNodeId())) {
                    candidates.add(new RecommendItem()
                            .setNodeId(item.getNodeId())
                            .setNodeType(item.getNodeType())
                            .setName(item.getName())
                            .setReason(item.getReason())
                            .setScore(item.getScore())
                            .setPatternName(item.getPatternName())
                            .setDifficulty(item.getDifficulty()));
                }
            }
        }
    }

    /**
     * 去重（按 nodeId）、排除已完成、按分数降序排序、取 Top K
     */
    private List<RecommendItem> deduplicateAndRank(List<RecommendItem> candidates,
                                                   Set<String> completedIds) {
        Map<String, RecommendItem> bestByNode = new LinkedHashMap<>();
        for (RecommendItem item : candidates) {
            // 跳过已完成
            if (completedIds.contains(item.getNodeId())) continue;
            // 保留分数最高的
            bestByNode.merge(item.getNodeId(), item, (existing, newer) ->
                    newer.getScore() > existing.getScore() ? newer : existing);
        }

        return bestByNode.values().stream()
                .sorted(Comparator.comparingDouble(RecommendItem::getScore).reversed())
                .limit(TOP_K)
                .collect(Collectors.toList());
    }
}
