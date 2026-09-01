package com.algorithm.help.interactive.achievement;

import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 用户成就实体
 */
@Entity
@Table(name = "user_achievements",
       uniqueConstraints = @UniqueConstraint(columnNames = {"userId", "type"}))
@Data
@Accessors(chain = true)
public class UserAchievement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private AchievementType type;

    /** 解锁时间（UTC 毫秒） */
    private Long unlockedAt;

    /** 全服解锁率（定时计算） */
    private Float unlockRate;

    @PrePersist
    protected void onCreate() {
        if (this.unlockedAt == null) {
            this.unlockedAt = System.currentTimeMillis();
        }
    }
}
