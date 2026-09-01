package com.algorithm.help.interactive.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.interactive.achievement.AchievementType;
import com.algorithm.help.interactive.achievement.UserAchievement;
import com.algorithm.help.interactive.achievement.UserAchievementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 成就系统 REST API
 */
@RestController
@RequestMapping("/api/v1/achievements")
@RequiredArgsConstructor
public class AchievementController {

    private final UserAchievementRepository achievementRepo;

    /**
     * 获取成就定义列表
     */
    @GetMapping("/definitions")
    public ApiResponse<List<Map<String, String>>> definitions() {
        List<Map<String, String>> defs = Arrays.stream(AchievementType.values())
                .map(t -> Map.of(
                        "type", t.name(),
                        "displayName", t.getDisplayName(),
                        "description", t.getDescription()
                ))
                .collect(Collectors.toList());
        return ApiResponse.success(defs);
    }

    /**
     * 获取用户已解锁成就
     */
    @GetMapping("/me")
    public ApiResponse<List<UserAchievement>> myAchievements(@RequestParam String userId) {
        return ApiResponse.success(achievementRepo.findByUserId(userId));
    }
}
