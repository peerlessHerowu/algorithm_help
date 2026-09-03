package com.algorithm.help.interactive.achievement;

import com.algorithm.help.interactive.analytics.LearningAnalyticsService;
import com.algorithm.help.interactive.debug.DebugTrainingRecord;
import com.algorithm.help.interactive.debug.DebugTrainingRecordRepository;
import com.algorithm.help.interactive.interview.InterviewReport;
import com.algorithm.help.interactive.interview.InterviewReportRepository;
import com.algorithm.help.interactive.session.InteractiveSessionRepository;
import com.algorithm.help.interactive.session.SessionStatus;
import com.algorithm.help.interactive.session.SessionType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * 成就检查与解锁服务
 * <p>
 * 支持多维度成就检查：费曼阶梯、连续学习天数、面试得分、Debug 猎手。
 * 每日 02:00 定时扫描所有活跃用户，统计并解锁成就。
 *
 * @author algorithm-help
 * @since 1.0.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AchievementCheckService {

    private final UserAchievementRepository achievementRepo;
    private final InteractiveSessionRepository sessionRepo;
    private final InterviewReportRepository interviewRepo;
    private final DebugTrainingRecordRepository debugRepo;
    private final LearningAnalyticsService analyticsService;

    // ======================== 费曼阶梯 ========================

    /**
     * 检查并解锁费曼阶梯成就
     *
     * @param userId 用户 ID
     */
    public void checkFeynmanAchievements(String userId) {
        long count = sessionRepo
                .findByUserIdAndStatusOrderByCreatedAtDesc(userId, SessionStatus.COMPLETED)
                .stream()
                .filter(s -> s.getType() == SessionType.FEYNMAN)
                .count();

        tryUnlock(userId, AchievementType.FEYNMAN_SCHOLAR_5,   count >= 5);
        tryUnlock(userId, AchievementType.FEYNMAN_SCHOLAR_20,  count >= 20);
        tryUnlock(userId, AchievementType.FEYNMAN_SCHOLAR_50,  count >= 50);
        tryUnlock(userId, AchievementType.FEYNMAN_SCHOLAR_100, count >= 100);
    }

    // ======================== 连续学习天数 ========================

    /**
     * 检查连续学习天数成就
     *
     * @param userId 用户 ID
     */
    public void checkStreakAchievements(String userId) {
        int streakDays = analyticsService.getStreakDays(userId);
        tryUnlock(userId, AchievementType.STREAK_7,   streakDays >= 7);
        tryUnlock(userId, AchievementType.STREAK_30,  streakDays >= 30);
        tryUnlock(userId, AchievementType.STREAK_100, streakDays >= 100);
        tryUnlock(userId, AchievementType.STREAK_365, streakDays >= 365);
    }

    // ======================== 面试成就 ========================

    /**
     * 检查面试相关成就（面试达人：总分 90+）
     *
     * @param userId 用户 ID
     */
    public void checkInterviewAchievements(String userId) {
        List<InterviewReport> reports = interviewRepo.findByUserIdOrderByCreatedAtDesc(userId);
        boolean hasHighScore = reports.stream().anyMatch(r -> r.getTotalScore() != null && r.getTotalScore() >= 90);
        tryUnlock(userId, AchievementType.INTERVIEW_PRO, hasHighScore);
    }

    // ======================== Debug 猎手 ========================

    /**
     * 检查 Debug 猎手成就（连续 10 次全部找到）
     *
     * @param userId 用户 ID
     */
    public void checkDebugAchievements(String userId) {
        List<DebugTrainingRecord> records = debugRepo.findByUserIdOrderByCreatedAtDesc(userId);
        if (records.size() < 10) return;

        boolean consecutive10 = records.subList(0, 10).stream()
                .allMatch(r -> Boolean.TRUE.equals(r.getFound()));
        tryUnlock(userId, AchievementType.BUG_HUNTER, consecutive10);
    }

    // ======================== 首题成就 ========================

    /**
     * 检查第一道题成就
     *
     * @param userId 用户 ID
     */
    public void checkFirstProblem(String userId) {
        long sessionCount = sessionRepo
                .findByUserIdAndStatusOrderByCreatedAtDesc(userId, SessionStatus.COMPLETED)
                .size();
        tryUnlock(userId, AchievementType.FIRST_PROBLEM, sessionCount >= 1);
    }

    // ======================== 批量检查 ========================

    /**
     * 检查用户所有维度的成就（完成任何交互式会话后调用）
     *
     * @param userId 用户 ID
     */
    public void checkAll(String userId) {
        log.debug("检查所有成就: userId={}", userId);
        checkFirstProblem(userId);
        checkFeynmanAchievements(userId);
        checkStreakAchievements(userId);
        checkInterviewAchievements(userId);
        checkDebugAchievements(userId);
    }

    // ======================== 定时任务：每日 02:00 ========================

    /**
     * 每日凌晨 2 点扫描所有活跃用户，批量检查连续天数成就
     */
    @Scheduled(cron = "0 0 2 * * *")
    public void dailyStreakCheck() {
        log.info("定时任务：开始每日成就扫描");
        // 取近 7 天内有活动的用户（通过 session 表去重）
        List<String> activeUserIds = sessionRepo.findDistinctUserIdsActiveSince(
                System.currentTimeMillis() - 7L * 24 * 60 * 60 * 1000);
        int unlockCount = 0;
        for (String userId : activeUserIds) {
            try {
                int before = (int) achievementRepo.countByUserId(userId);
                checkStreakAchievements(userId);
                int after = (int) achievementRepo.countByUserId(userId);
                unlockCount += (after - before);
            } catch (Exception e) {
                log.warn("定时成就检查失败: userId={}, error={}", userId, e.getMessage());
            }
        }
        log.info("定时任务完成: 扫描用户={}, 新解锁成就={}", activeUserIds.size(), unlockCount);
    }

    // ======================== 核心方法 ========================

    /**
     * 尝试解锁成就（幂等，已解锁则跳过）
     *
     * @param userId    用户 ID
     * @param type      成就类型
     * @param condition 解锁条件是否满足
     */
    public void tryUnlock(String userId, AchievementType type, boolean condition) {
        if (!condition) return;
        Optional<UserAchievement> existing = achievementRepo.findByUserIdAndType(userId, type);
        if (existing.isPresent()) return;

        UserAchievement achievement = new UserAchievement()
                .setUserId(userId)
                .setType(type);
        achievementRepo.save(achievement);
        log.info("🏆 成就解锁: userId={}, type={}", userId, type.getDisplayName());
    }
}
