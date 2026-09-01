package com.algorithm.help.entity;

import jakarta.persistence.*;
import lombok.Data;

/**
 * 题目解析实体，存储某级别下的完整解析内容
 */
@Entity
@Table(name = "explanations",
    uniqueConstraints = @UniqueConstraint(columnNames = {"problemId", "level", "version"}))
@Data
public class Explanation {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String problemId;

    @Column(nullable = false)
    private Integer level;

    @Column(columnDefinition = "mediumtext")
    private String sections;

    private Integer version = 1;
    private Boolean isLatest = true;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private ExplanationStatus status = ExplanationStatus.GENERATING;

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
