package com.algorithm.help.entity;

import jakarta.persistence.*;
import lombok.Data;

/**
 * 算法模式实体
 */
@Entity
@Table(name = "algorithm_patterns")
@Data
public class AlgorithmPattern {
    @Id
    private String id;

    private String name;
    private String category;

    @Column(columnDefinition = "json")
    private String template;

    @Column(columnDefinition = "json")
    private String signals;

    @Column(columnDefinition = "json")
    private String variants;

    @Column(columnDefinition = "json")
    private String relatedProblems;

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
