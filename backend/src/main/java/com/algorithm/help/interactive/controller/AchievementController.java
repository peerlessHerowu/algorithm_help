package com.algorithm.help.interactive.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.interactive.achievement.AchievementCheckService;
import com.algorithm.help.interactive.achievement.AchievementType;
import com.algorithm.help.interactive.achievement.UserAchievement;
import com.algorithm.help.interactive.achievement.UserAchievementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 成就系统 REST API
 * <p>
 * - GET  /api/v1/achievements/definitions   成就定义列表（含解锁率）
 * - GET  /api/v1/achievements/me            用户已解锁成就
 * - GET  /api/v1/users/me/achievements      同上（兼容路径）
 * - POST /api/v1/achievements/check         触发全量成就检查
 *
 * @author algorithm-help
 * @since 1.0.0
 */
@RestController
@RequiredArgsConstructor
public class AchievementController {

    private final UserAchievementRepository achievementRepo;
    private final AchievementCheckService checkService;

    /**
     * 获取成就定义列表，附带全局解锁率
     */
    @GetMapping("/api/v1/achievements/definitions")
    public ApiResponse<List<Map<String, Object>>> definitions() {
        // 统计总用户数（近似：有成就记录的用户数 + 1）
        long totalUsers = Math.max(1,
                achievementRepo.findAll().stream()
                        .map(a -> ((UserAchievement) a).getUserId())
                        .distinct().count());

        List<Map<String, Object>> defs = Arrays.stream(AchievementType.values())
                .map(t -> {
                    long unlockedCount = achievementRepo.countDistinctUsersByType(t);
                    double unlockRate = (double) unlockedCount / totalUsers;
                    Map<String, Object> def = new LinkedHashMap<>();
                    def.put("type", t.name());
                    def.put("displayName", t.getDisplayName());
                    def.put("description", t.getDescription());
                    def.put("unlockCondition", t.getUnlockCondition());
                    def.put("unlockRate", Math.min(1.0, unlockRate));
                    def.put("unlockedCount", unlockedCount);
                    return def;
                })
                .collect(Collectors.toList());
        return ApiResponse.success(defs);
    }

    /**
     * 获取用户已解锁成就列表
     */
    @GetMapping("/api/v1/achievements/me")
    public ApiResponse<List<UserAchievement>> myAchievements(@RequestParam String userId) {
        return ApiResponse.success(achievementRepo.findByUserId(userId));
    }

    /**
     * 兼容路径：/api/v1/users/me/achievements
     */
    @GetMapping("/api/v1/users/me/achievements")
    public ApiResponse<List<UserAchievement>> myAchievementsV2(@RequestParam String userId) {
        return myAchievements(userId);
    }

    /**
     * 触发全量成就检查（主动调用时使用）
     */
    @PostMapping("/api/v1/achievements/check")
    public ApiResponse<Map<String, Object>> check(@RequestParam String userId) {
        long before = achievementRepo.countByUserId(userId);
        checkService.checkAll(userId);
        long after = achievementRepo.countByUserId(userId);
        return ApiResponse.success(Map.of(
                "newlyUnlocked", after - before,
                "totalUnlocked", after
        ));
    }
}
