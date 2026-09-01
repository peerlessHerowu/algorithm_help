package com.algorithm.help.auth.entity;

import com.algorithm.help.auth.enums.ThemePreference;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * 用户偏好设置实体
 */
@Entity
@Table(name = "user_preferences")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserPreference {

    @Id
    private UUID userId;

    /** 默认解析级别（1-5），默认 3 */
    @Builder.Default
    private Integer defaultLevel = 3;

    /** 默认编程语言 */
    @Builder.Default
    private String defaultLanguage = "python";

    /** 主题偏好 */
    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    @Builder.Default
    private ThemePreference theme = ThemePreference.SYSTEM;

    /** 通知设置（JSON） */
    @Column(columnDefinition = "json")
    private String notificationSettings;

    /** 创建时间（UTC 毫秒） */
    private Long createdAt;

    /** 更新时间（UTC 毫秒） */
    private Long updatedAt;

    @PrePersist
    protected void onCreate() {
        long now = System.currentTimeMillis();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = System.currentTimeMillis();
    }
}
