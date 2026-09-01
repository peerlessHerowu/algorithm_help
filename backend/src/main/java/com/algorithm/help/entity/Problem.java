package com.algorithm.help.entity;

import com.algorithm.help.common.enums.Difficulty;
import jakarta.persistence.*;
import lombok.Data;

import java.util.List;

/**
 * 算法题目实体
 */
@Entity
@Table(name = "problems")
@Data
public class Problem {

    @Id
    private String id;

    private String title;

    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private Difficulty difficulty;

    @Column(columnDefinition = "json")
    private String tags;

    @Column(columnDefinition = "text")
    private String description;

    /** 中文标题 */
    @Column(name = "title_cn")
    private String titleCn;

    /** 中文题目描述 */
    @Column(name = "description_cn", columnDefinition = "MEDIUMTEXT")
    private String descriptionCn;

    @Column(columnDefinition = "json")
    private String constraints;

    @Column(columnDefinition = "json")
    private String examples;

    @Column(columnDefinition = "json")
    private String companyTags;

    @OneToMany(mappedBy = "problem", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PlatformMapping> platforms;

    private Long createdAt;
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
