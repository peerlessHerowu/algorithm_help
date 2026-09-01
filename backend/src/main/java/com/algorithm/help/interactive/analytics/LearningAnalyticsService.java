package com.algorithm.help.interactive.analytics;

import com.algorithm.help.interactive.review.SpacedRepetitionCard;
import com.algorithm.help.interactive.review.SpacedRepetitionRepository;
import com.algorithm.help.interactive.session.InteractiveSession;
import com.algorithm.help.interactive.session.InteractiveSessionRepository;
import com.algorithm.help.interactive.session.SessionStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 学习数据统计与分析服务
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LearningAnalyticsService {

    private final SpacedRepetitionRepository cardRepo;
    private final InteractiveSessionRepository sessionRepo;

    /**
     * 获取整体学习统计
     */
    public Map<String, Object> getOverallStats(String userId) {
        List<SpacedRepetitionCard> cards = cardRepo.findByUserId(userId);
        List<InteractiveSession> sessions = sessionRepo
                .findByUserIdAndStatusOrderByCreatedAtDesc(userId, SessionStatus.COMPLETED);

        long masteredCount = cards.stream()
                .filter(c -> c.getRepetitions() >= 3 && c.getEaseFactor() >= 2.0)
                .count();

        return Map.of(
                "totalCards", cards.size(),
                "masteredCards", masteredCount,
                "totalSessions", sessions.size(),
                "masteryRate", cards.isEmpty() ? 0.0 : (double) masteredCount / cards.size()
        );
    }

    /**
     * 识别薄弱算法模式
     */
    public List<Map<String, Object>> getWeakPoints(String userId) {
        List<SpacedRepetitionCard> cards = cardRepo.findByUserId(userId);

        // 按 patternId 分组，计算每个模式的平均 EF
        Map<String, List<SpacedRepetitionCard>> byPattern = cards.stream()
                .filter(c -> c.getPatternId() != null)
                .collect(Collectors.groupingBy(SpacedRepetitionCard::getPatternId));

        List<Map<String, Object>> weakPoints = new ArrayList<>();
        byPattern.forEach((pattern, patternCards) -> {
            double avgEF = patternCards.stream()
                    .mapToDouble(SpacedRepetitionCard::getEaseFactor)
                    .average().orElse(2.5);
            if (avgEF < 2.0) {
                weakPoints.add(Map.of(
                        "patternId", pattern,
                        "avgEaseFactor", avgEF,
                        "cardCount", patternCards.size()
                ));
            }
        });

        weakPoints.sort(Comparator.comparingDouble(m -> (double) m.get("avgEaseFactor")));
        return weakPoints;
    }

    /**
     * 生成掌握程度雷达图数据
     */
    public Map<String, Double> getMasteryRadar(String userId) {
        List<SpacedRepetitionCard> cards = cardRepo.findByUserId(userId);

        Map<String, List<SpacedRepetitionCard>> byPattern = cards.stream()
                .filter(c -> c.getPatternId() != null)
                .collect(Collectors.groupingBy(SpacedRepetitionCard::getPatternId));

        Map<String, Double> radar = new LinkedHashMap<>();
        byPattern.forEach((pattern, patternCards) -> {
            double score = patternCards.stream()
                    .mapToDouble(c -> Math.min(c.getEaseFactor() / 2.5, 1.0) * 100)
                    .average().orElse(0.0);
            radar.put(pattern, score);
        });
        return radar;
    }
}
