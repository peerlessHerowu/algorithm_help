package com.algorithm.help.content.seed;

import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 复杂度训练题实体
 * <p>
 * 存储 RANGE_GUESS（范围猜测）和 CODE_ESTIMATE（代码估算）两类训练题。
 */
@Entity
@Table(name = "complexity_training_problems")
@Data
@Accessors(chain = true)
public class ComplexityTrainingProblem {

    @Id
    private String id;

    /** 题目模式：RANGE_GUESS / CODE_ESTIMATE */
    @Column(nullable = false, length = 20)
    private String mode;

    /** 难度：EASY / MEDIUM / HARD */
    @Column(nullable = false, length = 10)
    private String difficulty;

    /** 约束和题目描述（JSON 格式） */
    @Column(columnDefinition = "text")
    private String constraints;

    /** 代码片段（CODE_ESTIMATE 模式下使用） */
    @Column(columnDefinition = "text")
    private String code;

    /** 选项列表（JSON 数组） */
    @Column(columnDefinition = "json")
    private String options;

    /** 正确答案 */
    @Column(nullable = false)
    private String correctAnswer;

    /** 解释说明 */
    @Column(columnDefinition = "text")
    private String explanation;

    /** 创建时间（UTC 毫秒时间戳） */
    private Long createdAt;

    /** 更新时间（UTC 毫秒时间戳） */
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
