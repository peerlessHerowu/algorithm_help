package com.algorithm.help.graph.entity;

import com.algorithm.help.graph.enums.NodeType;
import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 知识图谱节点实体
 * <p>
 * 节点 ID 格式示例：pattern:sliding-window, problem:two-sum
 */
@Entity
@Table(name = "graph_node")
@Data
@Accessors(chain = true)
public class GraphNode {

    /** 节点唯一标识，如 "pattern:sliding-window"、"problem:two-sum" */
    @Id
    private String id;

    /** 节点类型 */
    @Enumerated(EnumType.STRING)
    @Column(length = 20, nullable = false)
    private NodeType type;

    /** 显示名称 */
    @Column(nullable = false)
    private String name;

    /** 所属大类（如"双指针"、"动态规划"） */
    private String category;

    /** 简短描述 */
    private String description;

    /** 扩展属性（JSON 格式，如模式卡片完整信息） */
    @Column(columnDefinition = "json")
    private String metadata;

    /** 难度系数 1-5（用于排序推荐） */
    private Integer difficulty;

    /** 创建时间（UTC 毫秒时间戳） */
    private Long createdAt;

    /** 更新时间（UTC 毫秒时间戳） */
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
