package com.algorithm.help.interactive.debug;

import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * Debug 训练记录实体
 */
@Entity
@Table(name = "debug_training_records")
@Data
@Accessors(chain = true)
public class DebugTrainingRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String sessionId;

    private String problemId;

    /** Bug 类型 */
    private String bugType;

    /** 是否找到 */
    private Boolean found;

    /** 使用提示次数 */
    private Integer hintCount = 0;

    /** 耗时（毫秒） */
    private Long durationMs;

    private Long createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = System.currentTimeMillis();
    }
}
