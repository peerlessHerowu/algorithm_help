package com.algorithm.help.mapping.entity;

import com.algorithm.help.mapping.enums.MappingStatus;
import com.algorithm.help.mapping.enums.Platform;
import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 多平台题目映射实体
 * 将不同刷题平台的题目映射到内部统一 ID
 */
@Entity(name = "CrossPlatformMapping")
@Table(name = "platform_mapping",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_platform_platform_id",
           columnNames = {"platform", "platform_id"}
       ))
@Data
@Accessors(chain = true)
public class PlatformMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /** 内部统一题目 ID */
    @Column(nullable = false)
    private String unifiedProblemId;

    /** 刷题平台 */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Platform platform;

    /** 平台上的编号/slug */
    @Column(name = "platform_id", nullable = false)
    private String platformId;

    /** 平台链接 */
    private String platformUrl;

    /** 平台上的标题（可能不同语言） */
    private String platformTitle;

    /** 映射状态 */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MappingStatus status;

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
