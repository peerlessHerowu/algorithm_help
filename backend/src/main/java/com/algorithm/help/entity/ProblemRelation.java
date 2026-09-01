package com.algorithm.help.entity;

import com.algorithm.help.common.enums.RelationType;
import jakarta.persistence.*;
import lombok.Data;

/**
 * 题目关联关系实体
 */
@Entity
@Table(name = "problem_relations")
@Data
public class ProblemRelation {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String fromProblemId;

    @Column(nullable = false)
    private String toProblemId;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private RelationType type;

    private String description;
    private Float confidence = 1.0f;

    private Long createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = System.currentTimeMillis();
    }
}
