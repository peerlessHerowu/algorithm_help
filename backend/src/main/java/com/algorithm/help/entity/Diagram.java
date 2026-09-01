package com.algorithm.help.entity;

import com.algorithm.help.common.enums.DiagramType;
import jakarta.persistence.*;
import lombok.Data;

/**
 * 图解实体
 */
@Entity
@Table(name = "diagrams")
@Data
public class Diagram {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    private String algorithmType;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private DiagramType diagramType;

    @Column(columnDefinition = "text")
    private String mermaidCode;

    private Long createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = System.currentTimeMillis();
    }
}
