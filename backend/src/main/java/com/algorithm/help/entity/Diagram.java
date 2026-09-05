package com.algorithm.help.entity;

import com.algorithm.help.common.enums.DiagramType;
import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 图解实体
 * <p>
 * 对应 diagrams 表。存储为题目生成的 Mermaid/结构图解。
 */
@Entity
@Table(name = "diagrams")
@Data
@Accessors(chain = true)
public class Diagram {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /** 关联题目 ID */
    @Column(name = "problem_id")
    private String problemId;

    /** 关联解析 ID */
    @Column(name = "enriched_id")
    private String enrichedId;

    /** 解析级别 1-5 */
    private Integer level;

    /** 算法类型（如 "linked_list", "tree", "dp"） */
    private String algorithmType;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private DiagramType diagramType;

    /** Mermaid 源码（render_engine=mermaid 时） */
    @Column(columnDefinition = "TEXT")
    private String mermaidCode;

    /** 渲染引擎：mermaid/d3/canvas/svg */
    @Column(name = "render_engine", length = 20)
    private String renderEngine = "mermaid";

    /** 图解内容 JSON（渲染器特定格式） */
    @Column(name = "content_json", columnDefinition = "LONGTEXT")
    private String contentJson;

    /** 状态：generating/ready/failed */
    @Column(length = 20)
    private String status = "ready";

    @Column(name = "view_count")
    private int viewCount = 0;

    private Long createdAt;

    @Column(name = "updated_at")
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
