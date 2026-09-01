package com.algorithm.help.content.feynman;

import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 用户错误类型统计实体
 * <p>
 * 记录每个用户在各错误类型上的尝试次数和成功次数，
 * 用于自适应出题的加权随机算法。
 */
@Entity
@Table(name = "feynman_error_type_stats",
        uniqueConstraints = @UniqueConstraint(columnNames = {"userId", "errorType"}))
@Data
@Accessors(chain = true)
public class ErrorTypeStats {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 用户 ID */
    @Column(nullable = false)
    private String userId;

    /** 错误类型 */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FeynmanErrorType errorType;

    /** 总尝试次数 */
    @Column(nullable = false)
    private Integer totalAttempts = 0;

    /** 成功次数 */
    @Column(nullable = false)
    private Integer successCount = 0;

    /** 最后一次练习时间（UTC 毫秒时间戳） */
    private Long lastPracticeAt;

    /** 创建时间（UTC 毫秒时间戳） */
    private Long createdAt;

    /** 更新时间（UTC 毫秒时间戳） */
    private Long updatedAt;

    /**
     * 计算成功率（0.0 ~ 1.0）
     */
    public double successRate() {
        if (totalAttempts == null || totalAttempts == 0) {
            return 0.0;
        }
        return (double) successCount / totalAttempts;
    }

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
