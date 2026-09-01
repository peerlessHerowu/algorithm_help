package com.algorithm.help.auth.service;

import com.algorithm.help.auth.entity.UserPreference;
import com.algorithm.help.auth.enums.ThemePreference;
import com.algorithm.help.auth.repository.UserPreferenceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * 用户偏好服务 — 查询、更新、合并
 */
@Service
@RequiredArgsConstructor
public class UserPreferenceService {

    private final UserPreferenceRepository prefRepo;

    /** 获取用户偏好（不存在则创建默认） */
    public UserPreference getOrCreate(UUID userId) {
        return prefRepo.findById(userId)
                .orElseGet(() -> createDefault(userId));
    }

    /** 全量更新用户偏好 */
    public UserPreference update(UUID userId, UserPreference incoming) {
        UserPreference pref = getOrCreate(userId);
        pref.setDefaultLevel(incoming.getDefaultLevel());
        pref.setDefaultLanguage(incoming.getDefaultLanguage());
        pref.setTheme(incoming.getTheme());
        pref.setNotificationSettings(incoming.getNotificationSettings());
        return prefRepo.save(pref);
    }

    /**
     * 合并偏好：服务端已有非默认值的字段保留，默认值字段用传入值覆盖
     */
    public UserPreference merge(UUID userId, UserPreference incoming) {
        UserPreference existing = getOrCreate(userId);
        mergeFields(existing, incoming);
        return prefRepo.save(existing);
    }

    /** 创建默认偏好 */
    private UserPreference createDefault(UUID userId) {
        UserPreference pref = UserPreference.builder()
                .userId(userId)
                .build();
        return prefRepo.save(pref);
    }

    /** 合并字段：只覆盖默认值字段 */
    private void mergeFields(UserPreference existing, UserPreference incoming) {
        if (isDefault(existing.getDefaultLevel(), 3) && incoming.getDefaultLevel() != null) {
            existing.setDefaultLevel(incoming.getDefaultLevel());
        }
        if (isDefault(existing.getDefaultLanguage(), "python") && incoming.getDefaultLanguage() != null) {
            existing.setDefaultLanguage(incoming.getDefaultLanguage());
        }
        if (existing.getTheme() == ThemePreference.SYSTEM && incoming.getTheme() != null) {
            existing.setTheme(incoming.getTheme());
        }
        if (existing.getNotificationSettings() == null && incoming.getNotificationSettings() != null) {
            existing.setNotificationSettings(incoming.getNotificationSettings());
        }
    }

    private boolean isDefault(Object current, Object defaultVal) {
        return current == null || current.equals(defaultVal);
    }
}
