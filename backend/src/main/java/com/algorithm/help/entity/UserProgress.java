package com.algorithm.help.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * 用户学习进度实体
 */
@Entity
@Table(name = "user_progress")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID userId;
    private String problemId;
    private Integer level;
    private Long viewedAt;
    private Long timeSpentMs;
    private Long completedAt;

    @PrePersist
    protected void onCreate() {
        this.viewedAt = System.currentTimeMillis();
    }
}
