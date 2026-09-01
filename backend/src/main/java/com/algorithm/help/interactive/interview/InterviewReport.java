package com.algorithm.help.interactive.interview;

import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 面试评分报告实体
 */
@Entity
@Table(name = "interview_reports")
@Data
@Accessors(chain = true)
public class InterviewReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String sessionId;

    private String problemId;

    /** 正确性评分 (1-10) */
    private Integer correctnessScore;

    /** 效率评分 (1-10) */
    private Integer efficiencyScore;

    /** 沟通评分 (1-10) */
    private Integer communicationScore;

    /** 代码质量评分 (1-10) */
    private Integer codeQualityScore;

    /** 总分 (满分 100) */
    private Integer totalScore;

    /** 评级 (A+/A/B+/B/C/D) */
    private String grade;

    /** 优点（JSON 数组） */
    @Column(columnDefinition = "text")
    private String strengths;

    /** 改进建议（JSON 数组） */
    @Column(columnDefinition = "text")
    private String improvements;

    /** 总结 */
    @Column(columnDefinition = "text")
    private String summary;

    private Long createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = System.currentTimeMillis();
    }
}
