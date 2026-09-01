package com.algorithm.help.training.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 模式识别训练记录实体
 */
@Entity
@Table(name = "training_record", indexes = {
        @Index(name = "idx_training_user", columnList = "userId"),
        @Index(name = "idx_training_user_problem", columnList = "userId, problemId")
})
@Data
@Accessors(chain = true)
public class TrainingRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /** 用户 ID */
    private String userId;

    /** 题目 ID */
    private String problemId;

    /** 用户选择的模式 ID */
    private String selectedAnswer;

    /** 正确的模式 ID */
    private String correctAnswer;

    /** 是否回答正确 */
    private Boolean isCorrect;

    /** 创建时间（UTC 毫秒时间戳） */
    private Long createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = System.currentTimeMillis();
    }
}
