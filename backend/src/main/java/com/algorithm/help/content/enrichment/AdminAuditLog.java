package com.algorithm.help.content.enrichment;

import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 管理操作审计日志实体
 * <p>
 * 记录所有管理员敏感操作，包含操作人、类型、目标、前后状态。
 * 保留策略：90 天自动清理。
 */
@Entity
@Table(name = "admin_audit_log")
@Data
@Accessors(chain = true)
public class AdminAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String operatorId;
    private String operatorName;
    private String actionType;
    private String targetId;
    private String targetType;

    @Column(columnDefinition = "json")
    private String beforeState;

    @Column(columnDefinition = "json")
    private String afterState;

    @Column(columnDefinition = "text")
    private String remark;

    private Long createdAt;

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = System.currentTimeMillis();
        }
    }
}
