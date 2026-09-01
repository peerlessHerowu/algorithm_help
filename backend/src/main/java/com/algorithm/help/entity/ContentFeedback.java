package com.algorithm.help.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * 用户内容反馈实体
 */
@Entity
@Table(name = "content_feedback")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContentFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** 提交反馈的用户 ID */
    private UUID userId;

    /** 被反馈的解析 ID */
    private String explanationId;

    /** 评分（1-5） */
    private Integer rating;

    /** 评论内容（可选） */
    @Column(columnDefinition = "text")
    private String comment;

    /** 创建时间（UTC 毫秒） */
    private Long createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = System.currentTimeMillis();
    }
}
