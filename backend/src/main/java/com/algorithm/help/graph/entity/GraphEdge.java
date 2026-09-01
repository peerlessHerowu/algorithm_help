package com.algorithm.help.graph.entity;

import com.algorithm.help.graph.enums.RelationType;
import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 知识图谱边（关联关系）实体
 */
@Entity
@Table(name = "graph_edge", indexes = {
        @Index(name = "idx_edge_source", columnList = "sourceId"),
        @Index(name = "idx_edge_target", columnList = "targetId"),
        @Index(name = "idx_edge_type", columnList = "relationType")
})
@Data
@Accessors(chain = true)
public class GraphEdge {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /** 起始节点 ID */
    @Column(nullable = false)
    private String sourceId;

    /** 目标节点 ID */
    @Column(nullable = false)
    private String targetId;

    /** 关系类型 */
    @Enumerated(EnumType.STRING)
    @Column(length = 30, nullable = false)
    private RelationType relationType;

    /** 关联强度 0.0-1.0 */
    private Double weight;

    /** 关系描述 */
    private String description;

    /** 扩展属性（JSON 格式） */
    @Column(columnDefinition = "json")
    private String metadata;

    /** 创建时间（UTC 毫秒时间戳） */
    private Long createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = System.currentTimeMillis();
    }
}
