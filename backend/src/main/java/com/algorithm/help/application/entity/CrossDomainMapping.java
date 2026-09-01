package com.algorithm.help.application.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 跨域迁移映射表实体
 * <p>
 * 每个模式一条记录，含四列场景描述（LeetCode/工作/AI/人生）
 */
@Entity
@Table(name = "cross_domain_mapping", indexes = {
        @Index(name = "idx_cross_domain_pattern", columnList = "patternId")
})
@Data
@Accessors(chain = true)
public class CrossDomainMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /** 关联算法模式 ID */
    @Column(nullable = false, unique = true)
    private String patternId;

    /** LeetCode 场景描述（1-2句） */
    private String leetcodeScene;

    /** 工作场景描述 */
    private String workScene;

    /** AI/ML 场景描述 */
    private String aiScene;

    /** 日常生活类比（可为 null，仅高质量类比时填充） */
    private String lifeScene;

    /** 展开详情（每列2-3段+代码片段，JSON 格式） */
    @Column(columnDefinition = "text")
    private String detailJson;

    /** 创建时间（UTC 毫秒时间戳） */
    private Long createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = System.currentTimeMillis();
    }
}
