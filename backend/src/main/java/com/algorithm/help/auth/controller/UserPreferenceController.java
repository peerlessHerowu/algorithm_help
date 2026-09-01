package com.algorithm.help.auth.controller;

import com.algorithm.help.auth.entity.User;
import com.algorithm.help.auth.entity.UserPreference;
import com.algorithm.help.auth.service.UserPreferenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * 用户偏好控制器
 */
@RestController
@RequestMapping("/api/v1/users/me/preferences")
@RequiredArgsConstructor
public class UserPreferenceController {

    private final UserPreferenceService prefService;

    /** 获取当前用户偏好 */
    @GetMapping
    public ResponseEntity<UserPreference> get(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(prefService.getOrCreate(user.getId()));
    }

    /** 全量更新偏好 */
    @PutMapping
    public ResponseEntity<UserPreference> update(@AuthenticationPrincipal User user,
                                                  @RequestBody UserPreference pref) {
        return ResponseEntity.ok(prefService.update(user.getId(), pref));
    }

    /** 合并偏好（只覆盖默认值字段） */
    @PostMapping("/merge")
    public ResponseEntity<UserPreference> merge(@AuthenticationPrincipal User user,
                                                 @RequestBody UserPreference pref) {
        return ResponseEntity.ok(prefService.merge(user.getId(), pref));
    }
}
