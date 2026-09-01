package com.algorithm.help.graph.entity;

import com.algorithm.help.graph.model.PathNode;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;
import org.hibernate.annotations.Type;

import java.util.List;

/**
 * 学习路径实体
 */
@Entity
@Table(name = "learning_path")
@Data
@Accessors(chain = true)
public class LearningPath {

    /** 路径 ID，如 "dp-mastery", "graph-beginner" */
    @Id
    private String id;

    /** 路径名称，如 "动态规划从入门到精通" */
    private String name;

    /** 路径描述 */
    private String description;

    /** 所属大类 */
    private String category;

    /** 预计学习时长（小时） */
    private Integer estimatedHours;

    /** 路径节点总数 */
    private Integer totalNodes;

    /** 有序节点列表（JSON 存储） */
    @Type(JsonType.class)
    @Column(columnDefinition = "json")
    private List<PathNode> nodes;

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
