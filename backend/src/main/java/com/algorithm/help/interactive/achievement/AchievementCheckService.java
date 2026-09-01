package com.algorithm.help.interactive.achievement;

import com.algorithm.help.interactive.session.InteractiveSessionRepository;
import com.algorithm.help.interactive.session.SessionStatus;
import com.algorithm.help.interactive.session.SessionType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * 成就检查与解锁服务
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AchievementCheckService {

    private final UserAchievementRepository achievementRepo;
    private final InteractiveSessionRepository sessionRepo;

    /**
     * 检查并解锁费曼阶梯成就
     */
    public void checkFeynmanAchievements(String userId) {
        long feynmanCount = sessionRepo
                .findByUserIdAndStatusOrderByCreatedAtDesc(userId, SessionStatus.COMPLETED)
                .stream()
                .filter(s -> s.getType() == SessionType.FEYNMAN)
                .count();

        tryUnlock(userId, AchievementType.FEYNMAN_SCHOLAR_5, feynmanCount >= 5);
        tryUnlock(userId, AchievementType.FEYNMAN_SCHOLAR_20, feynmanCount >= 20);
        tryUnlock(userId, AchievementType.FEYNMAN_SCHOLAR_50, feynmanCount >= 50);
        tryUnlock(userId, AchievementType.FEYNMAN_SCHOLAR_100, feynmanCount >= 100);
    }

    /**
     * 尝试解锁成就（幂等）
     */
    public void tryUnlock(String userId, AchievementType type, boolean condition) {
        if (!condition) return;
        Optional<UserAchievement> existing = achievementRepo.findByUserIdAndType(userId, type);
        if (existing.isPresent()) return;

        UserAchievement achievement = new UserAchievement()
                .setUserId(userId)
                .setType(type);
        achievementRepo.save(achievement);
        log.info("成就解锁: userId={}, type={}", userId, type.getDisplayName());
    }
}
