package com.algorithm.help.interactive.achievement;

import com.algorithm.help.repository.ProblemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 成就解锁率定时计算（每日凌晨 2:00）
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AchievementStatsScheduler {

    private final UserAchievementRepository achievementRepo;

    /**
     * 每日计算各成就的全服解锁率
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void calculateUnlockRates() {
        long totalUsers = getTotalRegisteredUsers();
        if (totalUsers == 0) return;

        for (AchievementType type : AchievementType.values()) {
            long unlockedCount = achievementRepo.countDistinctUsersByType(type);
            float rate = (float) unlockedCount / totalUsers;
            updateUnlockRate(type, rate);
        }
        log.info("成就解锁率计算完成, 总用户数={}", totalUsers);
    }

    /**
     * 获取总注册用户数（简化：使用成就表中的去重用户数）
     */
    private long getTotalRegisteredUsers() {
        // 简化实现，后续可注入 UserRepository
        return achievementRepo.count() > 0 ? achievementRepo.count() : 1;
    }

    /**
     * 批量更新某类型成就的 unlockRate
     */
    private void updateUnlockRate(AchievementType type, float rate) {
        achievementRepo.findAll().stream()
                .filter(a -> a.getType() == type)
                .forEach(a -> {
                    a.setUnlockRate(rate);
                    achievementRepo.save(a);
                });
    }
}
