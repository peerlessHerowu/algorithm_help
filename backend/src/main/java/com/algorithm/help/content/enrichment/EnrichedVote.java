package com.algorithm.help.content.enrichment;

import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 投票记录实体
 * <p>
 * 记录用户对 enriched_solutions 的点赞/踩操作。
 * 通过唯一索引 (enriched_id, user_id) 保证每个用户对同一条解析只能有一条投票记录。
 */
@Entity
@Table(name = "enriched_votes", indexes = {
        @Index(name = "idx_enriched", columnList = "enrichedId")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_user_enriched", columnNames = {"enrichedId", "userId"})
})
@Data
@Accessors(chain = true)
public class EnrichedVote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 关联 enriched_solutions.id */
    @Column(nullable = false, length = 64)
    private String enrichedId;

    /** 投票用户 */
    @Column(nullable = false, length = 64)
    private String userId;

    /** 投票类型 */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private VoteType voteType;

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
