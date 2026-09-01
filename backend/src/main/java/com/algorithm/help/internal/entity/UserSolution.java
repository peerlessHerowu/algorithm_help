package com.algorithm.help.internal.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 用户题解实体（含爬虫采集的题解）
 */
@Entity
@Table(name = "user_solutions")
@Data
@Accessors(chain = true)
public class UserSolution {

    @Id
    private String id;

    /** 关联的 Problem ID */
    @Column(nullable = false)
    private String problemId;

    /** 题解标题 */
    private String title;

    /** 题解内容（Markdown） */
    @Column(columnDefinition = "text")
    private String content;

    /** 编程语言 */
    private String language;

    /** 题解状态：DRAFT / PUBLISHED / FEATURED / HIDDEN */
    @Column(length = 20, nullable = false)
    private String status = "PUBLISHED";

    /** 原始内容（AI 处理前） */
    @Column(columnDefinition = "text")
    private String rawContent;

    /** 提交者用户 ID（用户题解时有值） */
    private String userId;

    /** 浏览次数 */
    @Column(nullable = false)
    private Integer viewCount = 0;

    /** 逻辑删除 */
    @Column(nullable = false)
    private Boolean deleted = false;

    /** 来源类型：USER_SUBMIT / CRAWLED */
    @Column(length = 20, nullable = false)
    private String sourceType;

    /** 来源平台（仅 CRAWLED 类型有值） */
    private String platform;

    /** 平台原始作者 */
    private String authorName;

    /** 平台点赞数 */
    private Integer upvotes;

    /** 平台题解 URL */
    private String sourceUrl;

    /** 所属项目 */
    private String project;

    private Long createdAt;
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
