package com.algorithm.help.interactive.analytics;

import com.algorithm.help.interactive.debug.DebugTrainingRecord;
import com.algorithm.help.interactive.debug.DebugTrainingRecordRepository;
import com.algorithm.help.interactive.review.SpacedRepetitionCard;
import com.algorithm.help.interactive.review.SpacedRepetitionRepository;
import com.algorithm.help.interactive.session.InteractiveSession;
import com.algorithm.help.interactive.session.InteractiveSessionRepository;
import com.algorithm.help.interactive.session.SessionStatus;
import com.algorithm.help.interactive.session.SessionType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 学习数据统计与分析服务
 * <p>
 * 提供：整体统计、薄弱点分析、遗忘曲线、掌握度雷达图、
 * 每日学习计划、连续学习天数等分析功能。
 *
 * @author algorithm-help
 * @since 1.0.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LearningAnalyticsService {

    private final SpacedRepetitionRepository cardRepo;
    private final InteractiveSessionRepository sessionRepo;
    private final DebugTrainingRecordRepository debugRepo;

    /**
     * 获取整体学习统计
     *
     * @param userId 用户 ID
     * @return 统计数据 Map
     */
    public Map<String, Object> getOverallStats(String userId) {
        List<SpacedRepetitionCard> cards = cardRepo.findByUserId(userId);
        List<InteractiveSession> sessions = sessionRepo
                .findByUserIdAndStatusOrderByCreatedAtDesc(userId, SessionStatus.COMPLETED);

        // 已掌握：重复次数 >= 3 且容易度因子 >= 2.0
        long masteredCount = cards.stream()
                .filter(c -> c.getRepetitions() >= 3 && c.getEaseFactor() >= 2.0)
                .count();

        // 待复习（今天到期）
        long todayReview = cards.stream()
                .filter(c -> c.getNextReviewAt() != null && c.getNextReviewAt() <= System.currentTimeMillis())
                .count();

        // 费曼会话数
        long feynmanSessions = sessions.stream()
                .filter(s -> s.getType() == SessionType.FEYNMAN)
                .count();

        // 连续学习天数
        int streakDays = calculateStreakDays(userId);

        return Map.of(
                "totalCards", cards.size(),
                "masteredCards", masteredCount,
                "todayReview", todayReview,
                "totalSessions", sessions.size(),
                "feynmanSessions", feynmanSessions,
                "masteryRate", cards.isEmpty() ? 0.0 : (double) masteredCount / cards.size() * 100,
                "streakDays", streakDays
        );
    }

    /**
     * 识别薄弱算法模式（EF < 2.0 的模式）
     *
     * @param userId 用户 ID
     * @return 薄弱模式列表，按掌握度升序
     */
    public List<Map<String, Object>> getWeakPoints(String userId) {
        List<SpacedRepetitionCard> cards = cardRepo.findByUserId(userId);

        // 按 patternId 分组，计算平均 EF
        Map<String, List<SpacedRepetitionCard>> byPattern = cards.stream()
                .filter(c -> c.getPatternId() != null)
                .collect(Collectors.groupingBy(SpacedRepetitionCard::getPatternId));

        List<Map<String, Object>> weakPoints = new ArrayList<>();
        byPattern.forEach((pattern, patternCards) -> {
            double avgEF = patternCards.stream()
                    .mapToDouble(SpacedRepetitionCard::getEaseFactor)
                    .average().orElse(2.5);
            double masteryScore = Math.min(avgEF / 2.5, 1.0) * 100;
            weakPoints.add(Map.of(
                    "patternId", pattern,
                    "avgEaseFactor", avgEF,
                    "masteryScore", masteryScore,
                    "cardCount", patternCards.size(),
                    "isWeak", avgEF < 2.0
            ));
        });

        // 按掌握度升序，薄弱的排前面
        weakPoints.sort(Comparator.comparingDouble(m -> (double) m.get("avgEaseFactor")));
        return weakPoints;
    }

    /**
     * 生成遗忘曲线数据（按模式分组，展示记忆衰减趋势）
     *
     * @param userId 用户 ID
     * @return 遗忘曲线数据（patternId → EF 时间序列）
     */
    public Map<String, Object> getForgettingCurveData(String userId) {
        List<SpacedRepetitionCard> cards = cardRepo.findByUserId(userId);

        // 按模式分组
        Map<String, List<SpacedRepetitionCard>> byPattern = cards.stream()
                .filter(c -> c.getPatternId() != null && c.getLastReviewAt() != null)
                .collect(Collectors.groupingBy(SpacedRepetitionCard::getPatternId));

        // 计算每个模式的当前记忆强度（基于上次复习时间和 EF）
        Map<String, Double> memoryStrength = new LinkedHashMap<>();
        byPattern.forEach((pattern, patternCards) -> {
            double avgStrength = patternCards.stream()
                    .mapToDouble(c -> calculateMemoryStrength(c))
                    .average().orElse(50.0);
            memoryStrength.put(pattern, avgStrength);
        });

        // 生成未来 14 天的预测衰减曲线
        List<Map<String, Object>> forecast = new ArrayList<>();
        for (int day = 0; day <= 14; day++) {
            final int d = day;
            Map<String, Object> dayData = new HashMap<>();
            dayData.put("day", d);
            memoryStrength.forEach((pattern, strength) -> {
                // 简单指数衰减模型
                double decayed = strength * Math.exp(-d / 7.0);
                dayData.put(pattern, Math.max(0, decayed));
            });
            forecast.add(dayData);
        }

        return Map.of(
                "currentStrength", memoryStrength,
                "forecast", forecast
        );
    }

    /**
     * 生成掌握程度雷达图数据
     *
     * @param userId 用户 ID
     * @return patternId → 掌握分数（0-100）
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

    /**
     * 获取用户连续学习天数（公开，供其他服务调用）
     *
     * @param userId 用户 ID
     * @return 连续天数
     */
    public int getStreakDays(String userId) {
        return calculateStreakDays(userId);
    }

    /**
     * 获取每日学习计划（今日推荐）
     *
     * @param userId 用户 ID
     * @return 今日计划（模式回顾 + 新题推荐 + 待复习数量）
     */
    public Map<String, Object> getDailyPlan(String userId) {
        // 找最薄弱模式
        List<Map<String, Object>> weak = getWeakPoints(userId);
        String weakestPattern = weak.isEmpty() ? null
                : (String) weak.get(0).get("patternId");

        // 今日待复习数量
        long todayReviewCount = cardRepo.findByUserId(userId).stream()
                .filter(c -> c.getNextReviewAt() != null
                        && c.getNextReviewAt() <= System.currentTimeMillis())
                .count();

        return Map.of(
                "date", System.currentTimeMillis(),
                "weakestPattern", weakestPattern != null ? weakestPattern : "暂无",
                "reviewCardCount", todayReviewCount,
                "streakDays", calculateStreakDays(userId),
                "recommendation", "今日重点：" + (weakestPattern != null
                        ? "加强 " + weakestPattern + " 模式训练"
                        : "保持当前学习节奏")
        );
    }

    /**
     * 获取面试得分趋势（最近 10 次）
     * <p>
     * 由 InterviewScoreService 完成，这里只做分析封装
     *
     * @param userId 用户 ID
     * @return 趋势数据
     */
    public Map<String, Object> getInterviewTrend(String userId) {
        // 接口预留，实际数据由 InterviewReportRepository 提供
        return Map.of(
                "userId", userId,
                "description", "面试趋势数据请从 /api/v1/interview/history?includeTrend=true 获取"
        );
    }

    // ======================== 私有方法 ========================

    /**
     * 计算当前记忆强度（0-100）
     * <p>
     * 基于上次复习时间、间隔和 EF 估算
     */
    private double calculateMemoryStrength(SpacedRepetitionCard card) {
        if (card.getLastReviewAt() == null) return 50.0;
        long daysSinceReview = (System.currentTimeMillis() - card.getLastReviewAt())
                / (24 * 60 * 60 * 1000L);
        double intervalDays = Math.max(card.getIntervalDays(), 1);
        // 按实际间隔比例估算衰减
        double ratio = daysSinceReview / intervalDays;
        double strength = 100 * Math.exp(-ratio);
        return Math.max(0, Math.min(100, strength));
    }

    /**
     * 计算连续学习天数
     * <p>
     * 基于完成会话的日期计算，连续日期不断则累计
     */
    private int calculateStreakDays(String userId) {
        List<InteractiveSession> sessions = sessionRepo
                .findByUserIdAndStatusOrderByCreatedAtDesc(userId, SessionStatus.COMPLETED);
        if (sessions.isEmpty()) return 0;

        // 提取唯一日期（UTC）
        Set<LocalDate> activeDays = sessions.stream()
                .map(s -> Instant.ofEpochMilli(s.getCreatedAt())
                        .atZone(ZoneOffset.UTC).toLocalDate())
                .collect(Collectors.toSet());

        // 从今天开始向前数连续天数
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        int streak = 0;
        LocalDate current = today;
        while (activeDays.contains(current)) {
            streak++;
            current = current.minusDays(1);
        }
        return streak;
    }
}
