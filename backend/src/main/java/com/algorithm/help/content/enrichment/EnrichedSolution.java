package com.algorithm.help.content.enrichment;

import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

import java.util.UUID;

/**
 * AI 丰富后的解析记录实体
 * <p>
 * 存储一题一级别多条结构化解析内容，支持版本管理和状态审核。
 * version 字段同时用于乐观锁并发控制。
 */
@Entity
@Table(name = "enriched_solutions", indexes = {
        @Index(name = "idx_problem_level", columnList = "problemId, level, status"),
        @Index(name = "idx_status", columnList = "status"),
        @Index(name = "idx_recommended", columnList = "problemId, level, recommended"),
        @Index(name = "idx_version", columnList = "problemId, level, sourceSolutionId, version")
})
@Data
@Accessors(chain = true)
public class EnrichedSolution {

    @Id
    private String id;

    @Column(nullable = false)
    private String problemId;

    /** 1-5 分级 */
    @Column(nullable = false)
    private Integer level;

    /** 来源的原始题解 ID（可为空） */
    private String sourceSolutionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SourceType sourceType;

    /** 来源作者（COMMUNITY 时非空） */
    private String sourceAuthor;

    /** 来源 URL（COMMUNITY 时非空） */
    @Column(length = 512)
    private String sourceUrl;

    /** 来源题解原始点赞数 */
    private Integer sourceVotes;

    // ===== 内容 =====

    @Column(nullable = false, length = 256)
    private String title;

    @Column(length = 500)
    private String summary;

    @Column(columnDefinition = "mediumtext")
    private String content;

    /** 多语言代码实现 {"python":"...","java":"..."} */
    @Column(columnDefinition = "json")
    private String codeImplementations;

    /** 解法标签 ["哈希表","O(n)"] */
    @Column(columnDefinition = "json")
    private String tags;

    /** 时间复杂度，如 "O(n)" */
    @Column(length = 32)
    private String timeComplexity;

    /** 空间复杂度，如 "O(n)" */
    @Column(length = 32)
    private String spaceComplexity;

    // ===== AI 处理元数据 =====

    @Column(length = 32)
    private String aiProvider;

    /** 管线已执行步骤 ["error-check","polish","multi-lang"] */
    @Column(columnDefinition = "json")
    private String processingSteps;

    /** 质量评分 0-1 */
    private Float qualityScore;

    // ===== 版本管理（version 同时用于乐观锁） =====

    @Version
    private Integer version;

    private Boolean isLatest;

    // ===== 展示控制 =====

    private Integer sortOrder;

    private Boolean recommended;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private EnrichedStatus status;

    // ===== 用户反馈统计 =====

    private Integer viewCount;

    private Integer upvoteCount;

    /** 踩计数 */
    private Integer downvoteCount;

    /** 纠错反馈计数，>= 3 触发复核 */
    private Integer feedbackCount;

    // ===== 时间（UTC 毫秒时间戳） =====

    private Long createdAt;

    private Long updatedAt;

    // ===== 生命周期方法 =====

    @PrePersist
    protected void onCreate() {
        long now = System.currentTimeMillis();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
        applyDefaults();
        validateBusiness();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = System.currentTimeMillis();
        validateBusiness();
    }

    /** 设置默认值 */
    private void applyDefaults() {
        if (this.version == null) this.version = 1;
        if (this.isLatest == null) this.isLatest = true;
        if (this.sortOrder == null) this.sortOrder = 0;
        if (this.recommended == null) this.recommended = false;
        if (this.status == null) this.status = EnrichedStatus.DRAFT;
        if (this.viewCount == null) this.viewCount = 0;
        if (this.upvoteCount == null) this.upvoteCount = 0;
        if (this.downvoteCount == null) this.downvoteCount = 0;
        if (this.feedbackCount == null) this.feedbackCount = 0;
        if (this.sourceVotes == null) this.sourceVotes = 0;
    }

    /**
     * 业务校验：
     * - COMMUNITY 时 sourceAuthor/sourceUrl 非空
     * - L1 时 codeImplementations 必须为 null
     */
    private void validateBusiness() {
        if (this.sourceType == SourceType.COMMUNITY) {
            if (this.sourceAuthor == null || this.sourceAuthor.isBlank()) {
                throw new IllegalStateException("COMMUNITY 来源必须提供 sourceAuthor");
            }
            if (this.sourceUrl == null || this.sourceUrl.isBlank()) {
                throw new IllegalStateException("COMMUNITY 来源必须提供 sourceUrl");
            }
        }
        if (this.level != null && this.level == 1 && this.codeImplementations != null) {
            throw new IllegalStateException("L1 级别禁止包含代码实现");
        }
    }
}
