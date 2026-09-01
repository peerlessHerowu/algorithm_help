package com.algorithm.help.entity;

import jakarta.persistence.*;
import lombok.Data;

/**
 * 平台映射实体，关联题目到各刷题平台
 */
@Entity
@Table(name = "platform_mappings")
@Data
public class PlatformMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String platform;
    private String platformId;
    private String url;
    private Integer frequency;

    @Column(columnDefinition = "json")
    private String companies;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "problem_id")
    private Problem problem;
}
