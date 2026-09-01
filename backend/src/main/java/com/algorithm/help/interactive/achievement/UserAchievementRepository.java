package com.algorithm.help.interactive.achievement;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

/**
 * 用户成就 Repository
 */
public interface UserAchievementRepository extends JpaRepository<UserAchievement, String> {

    List<UserAchievement> findByUserId(String userId);

    Optional<UserAchievement> findByUserIdAndType(String userId, AchievementType type);

    @Query("SELECT COUNT(DISTINCT ua.userId) FROM UserAchievement ua WHERE ua.type = :type")
    long countDistinctUsersByType(AchievementType type);
}
