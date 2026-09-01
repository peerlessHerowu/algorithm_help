package com.algorithm.help.graph.entity;

import com.algorithm.help.graph.enums.CompletionStatus;
import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 用户学习进度实体
 */
@Entity(name = "GraphUserProgress")
@Table(name = "user_progress")
@Data
@Accessors(chain = true)
public class UserProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /** 用户 ID */
    private String userId;

    /** 统一题目 ID */
    private String problemId;

    /** 关联模式 ID */
    private String patternId;

    /** 完成状态 */
    @Enumerated(EnumType.STRING)
    private CompletionStatus status;

    /** 尝试次数 */
    private Integer attempts;

    /** 正确次数（模式识别训练用） */
    private Integer correctCount;

    /** 最后练习时间（UTC 毫秒时间戳） */
    private Long lastPracticeAt;

    /** 完成时间（UTC 毫秒时间戳） */
    private Long completedAt;
}
