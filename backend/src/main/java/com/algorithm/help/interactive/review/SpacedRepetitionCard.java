package com.algorithm.help.interactive.review;

import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 间隔重复卡片实体（SM-2 算法）
 */
@Entity
@Table(name = "spaced_repetition_cards",
       uniqueConstraints = @UniqueConstraint(columnNames = {"userId", "problemId", "cardType"}))
@Data
@Accessors(chain = true)
public class SpacedRepetitionCard {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String problemId;

    /** 关联算法模式 ID（可选） */
    private String patternId;

    /** 卡片类型 */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CardType cardType;

    /** 难易因子（初始 2.5，最小 1.3） */
    @Column(nullable = false)
    private Double easeFactor = 2.5;

    /** 当前间隔天数 */
    @Column(name = "interval_days", nullable = false)
    private Integer intervalDays = 0;

    /** 连续正确次数 */
    @Column(nullable = false)
    private Integer repetitions = 0;

    /** 下次复习时间（UTC 毫秒） */
    private Long nextReviewAt;

    /** 上次复习时间（UTC 毫秒） */
    private Long lastReviewAt;

    /** 扩展元数据（JSON） */
    @Column(columnDefinition = "text")
    private String metadata;

    private Long createdAt;
    private Long updatedAt;

    @PrePersist
    protected void onCreate() {
        long now = System.currentTimeMillis();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.nextReviewAt == null) {
            this.nextReviewAt = now;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = System.currentTimeMillis();
    }
}
