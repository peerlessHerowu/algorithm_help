package com.algorithm.help.interactive.session;

import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 交互式会话实体
 */
@Entity
@Table(name = "interactive_sessions")
@Data
@Accessors(chain = true)
public class InteractiveSession {

    @Id
    private String sessionId;

    @Column(nullable = false)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SessionType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SessionStatus status;

    /** 关联题目 ID（可选） */
    private String problemId;

    /** 对话上下文快照（JSON，用于断线恢复） */
    @Column(columnDefinition = "text")
    private String contextJson;

    /** 创建时间（UTC 毫秒） */
    private Long createdAt;

    /** 最后活跃时间（UTC 毫秒） */
    private Long lastActiveAt;

    /** 完成时间（UTC 毫秒） */
    private Long completedAt;

    @PrePersist
    protected void onCreate() {
        if (this.sessionId == null) {
            this.sessionId = java.util.UUID.randomUUID().toString();
        }
        long now = System.currentTimeMillis();
        this.createdAt = now;
        this.lastActiveAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.lastActiveAt = System.currentTimeMillis();
    }
}
