package com.algorithm.help.content.enrichment;

import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 教学走流程序列实体
 * <p>
 * 对应 teaching_sequences 表，存储 AI 生成的逐步演示序列 JSON。
 * 每条记录是某道题在某个级别下的一种场景（标准/边界/反例）的完整演示。
 */
@Entity
@Table(name = "teaching_sequences")
@Data
@Accessors(chain = true)
public class TeachingSequence {

    @Id
    private String id;

    /** 关联题目 ID */
    @Column(name = "problem_id", nullable = false)
    private String problemId;

    /** 关联解析 ID（nullable，可独立于解析存在） */
    @Column(name = "enriched_id")
    private String enrichedId;

    /** 解析级别 1-5 */
    @Column(nullable = false)
    private int level;

    /**
     * 场景类型
     * <ul>
     *   <li>standard - 标准例子</li>
     *   <li>boundary - 边界场景</li>
     *   <li>counterexample - 反例演示</li>
     * </ul>
     */
    @Column(name = "scenario_type", nullable = false, length = 20)
    private String scenarioType = "standard";

    /** 序列标题（如"两数之和 — L2逐步演示"） */
    @Column(nullable = false, length = 200)
    private String title;

    /** 序列描述 */
    @Column(columnDefinition = "TEXT")
    private String description;

    /** 总步骤数 */
    @Column(name = "total_steps", nullable = false)
    private int totalSteps;

    /** 预估总时长（毫秒） */
    @Column(name = "duration_ms", nullable = false)
    private int durationMs;

    /**
     * TeachingSequence JSON 完整内容
     * 格式见设计文档 18-可视化与教学引擎设计.md
     */
    @Column(name = "sequence_json", nullable = false, columnDefinition = "LONGTEXT")
    private String sequenceJson;

    /** JSON schema 版本，用于向后兼容 */
    @Column(name = "schema_version", nullable = false, length = 10)
    private String schemaVersion = "1.0";

    /**
     * 生成状态
     * <ul>
     *   <li>generating - 生成中</li>
     *   <li>ready - 可用</li>
     *   <li>failed - 生成失败</li>
     * </ul>
     */
    @Column(nullable = false, length = 20)
    private String status = "generating";

    /** 生成失败原因 */
    @Column(name = "error_msg", columnDefinition = "TEXT")
    private String errorMsg;

    /** 查看次数 */
    @Column(name = "view_count", nullable = false)
    private int viewCount = 0;

    @Column(name = "created_at")
    private Long createdAt;

    @Column(name = "updated_at")
    private Long updatedAt;
}
