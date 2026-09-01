package com.algorithm.help.content.enrichment;

import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 纠错反馈实体
 * <p>
 * 用户对 enriched_solutions 内容提交的纠错反馈记录。
 * 当某条解析累计收到 >= 3 条反馈时，系统自动触发复核。
 */
@Entity
@Table(name = "enriched_feedback", indexes = {
        @Index(name = "idx_enriched", columnList = "enrichedId, status"),
        @Index(name = "idx_status", columnList = "status, createdAt")
})
@Data
@Accessors(chain = true)
public class EnrichedFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 关联 enriched_solutions.id */
    @Column(nullable = false, length = 64)
    private String enrichedId;

    /** 反馈用户（可匿名，允许 null） */
    @Column(length = 64)
    private String userId;

    /** 错误类型 */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FeedbackErrorType errorType;

    /** 错误描述 */
    @Column(columnDefinition = "text")
    private String description;

    /** 处理状态 */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private FeedbackStatus status;

    /** 处理人 */
    @Column(length = 64)
    private String resolvedBy;

    /** 处理时间（UTC 毫秒） */
    private Long resolvedAt;

    /** 创建时间（UTC 毫秒） */
    private Long createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = System.currentTimeMillis();
        if (this.status == null) {
            this.status = FeedbackStatus.PENDING;
        }
    }
}
