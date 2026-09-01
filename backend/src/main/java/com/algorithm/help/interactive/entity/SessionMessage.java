package com.algorithm.help.interactive.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

import java.util.UUID;

/**
 * 会话消息实体
 * <p>
 * 记录每条对话消息的持久化存储（user/assistant/system）
 */
@Entity
@Table(name = "session_messages")
@Data
@Accessors(chain = true)
public class SessionMessage {

    @Id
    private String id;

    /** 关联的交互会话 ID */
    @Column(nullable = false)
    private String sessionId;

    /** 消息角色：user / assistant / system */
    @Column(nullable = false, length = 20)
    private String role;

    /** 消息内容 */
    @Column(columnDefinition = "text")
    private String content;

    /** 创建时间（UTC 毫秒） */
    private Long createdAt;

    @PrePersist
    protected void onCreate() {
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
        if (this.createdAt == null) {
            this.createdAt = System.currentTimeMillis();
        }
    }
}
