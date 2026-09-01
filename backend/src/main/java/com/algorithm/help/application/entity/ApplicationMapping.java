package com.algorithm.help.application.entity;

import com.algorithm.help.application.enums.ApplicationDomain;
import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 实际应用映射实体
 * <p>
 * 记录算法模式在各领域（工业/AI/工作/人生）的应用案例
 */
@Entity
@Table(name = "application_mapping", indexes = {
        @Index(name = "idx_app_mapping_pattern", columnList = "patternId"),
        @Index(name = "idx_app_mapping_domain", columnList = "domain")
})
@Data
@Accessors(chain = true)
public class ApplicationMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /** 关联算法模式 ID */
    @Column(nullable = false)
    private String patternId;

    /** 应用领域 */
    @Enumerated(EnumType.STRING)
    @Column(length = 20, nullable = false)
    private ApplicationDomain domain;

    /** 应用标题（如"导航路径规划"） */
    @Column(nullable = false)
    private String title;

    /** 副标题（如"Dijkstra / A* → Google Maps"） */
    private String subtitle;

    /** 应用描述（2-3段） */
    @Column(columnDefinition = "text")
    private String description;

    /** 迷你案例代码（50行以内，可运行） */
    @Column(columnDefinition = "text")
    private String miniCaseCode;

    /** 迷你案例语言（python/java） */
    private String miniCaseLanguage;

    /** 显示图标（emoji 或图标名） */
    private String icon;

    /** 运行环境要求（如"Python 3.8+，无额外依赖"） */
    private String runtimeRequirements;

    /** 创建时间（UTC 毫秒时间戳） */
    private Long createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = System.currentTimeMillis();
    }
}
