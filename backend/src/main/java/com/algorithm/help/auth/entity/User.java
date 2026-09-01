package com.algorithm.help.auth.entity;

import com.algorithm.help.auth.enums.Role;
import com.algorithm.help.auth.enums.Tier;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * 用户实体
 */
@Entity
@Table(name = "users", indexes = {
        @Index(name = "idx_users_email", columnList = "email", unique = true)
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** 邮箱（唯一） */
    @Column(unique = true, nullable = false)
    private String email;

    /** 昵称 */
    private String nickname;

    /** 密码哈希 */
    @Column(nullable = false)
    private String passwordHash;

    /** 角色，默认 USER */
    @Enumerated(EnumType.STRING)
    @Column(length = 10, nullable = false)
    @Builder.Default
    private Role role = Role.USER;

    /** 订阅层级，默认 FREE */
    @Enumerated(EnumType.STRING)
    @Column(length = 10, nullable = false)
    @Builder.Default
    private Tier tier = Tier.FREE;

    /** 创建时间（UTC 毫秒） */
    private Long createdAt;

    /** 最后登录时间（UTC 毫秒） */
    private Long lastLoginAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = System.currentTimeMillis();
    }
}
