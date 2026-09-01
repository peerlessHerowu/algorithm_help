package com.algorithm.help.content;

import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 评论实体
 * 支持对解析（EXPLANATION）和用户题解（USER_SOLUTION）的评论
 */
@Entity
@Table(name = "comments", indexes = {
        @Index(name = "idx_target", columnList = "targetType, targetId"),
        @Index(name = "idx_user", columnList = "userId")
})
@Data
@Accessors(chain = true)
public class Comment {

    @Id
    private String id;

    /** 评论目标类型：EXPLANATION / USER_SOLUTION */
    @Column(length = 30, nullable = false)
    private String targetType;

    /** 被评论对象 ID */
    @Column(nullable = false)
    private String targetId;

    /** 评论者用户 ID */
    @Column(nullable = false)
    private String userId;

    /** 评论内容 */
    @Column(columnDefinition = "text", nullable = false)
    private String content;

    /** 评论类型：NORMAL / CORRECTION / SUPPLEMENT / QUESTION */
    @Column(length = 20, nullable = false)
    private String type = "NORMAL";

    /** 点赞数 */
    @Column(nullable = false)
    private Integer upvotes = 0;

    /** 父评论 ID（null 表示顶级评论） */
    private String parentId;

    /** 逻辑删除 */
    @Column(nullable = false)
    private Boolean deleted = false;

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
