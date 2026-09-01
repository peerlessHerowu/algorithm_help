package com.algorithm.help.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * 用户收藏实体
 */
@Entity
@Table(name = "user_bookmarks", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"userId", "problemId"})
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserBookmark {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID userId;
    private String problemId;
    private Long createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = System.currentTimeMillis();
    }
}
