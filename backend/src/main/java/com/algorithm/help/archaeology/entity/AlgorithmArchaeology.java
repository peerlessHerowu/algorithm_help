package com.algorithm.help.archaeology.entity;

import com.algorithm.help.archaeology.model.TimelineEvent;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;
import org.hibernate.annotations.Type;

import java.util.List;

/**
 * 算法考古实体
 * <p>
 * 记录经典算法的发明故事、历史背景和设计动机
 */
@Entity
@Table(name = "algorithm_archaeology")
@Data
@Accessors(chain = true)
public class AlgorithmArchaeology {

    /** 唯一标识，如 "dijkstra-shortest-path" */
    @Id
    private String id;

    /** 算法名称，如 "Dijkstra 最短路径算法" */
    @Column(nullable = false)
    private String algorithmName;

    /** 发明者姓名 */
    private String inventorName;

    /** 发明年份 */
    private Integer inventionYear;

    /** 发明地点 */
    private String inventionPlace;

    /** 发明故事（Markdown 格式，500-1500字） */
    @Column(columnDefinition = "text")
    private String story;

    /** 发明动机 */
    @Column(columnDefinition = "text")
    private String motivation;

    /** 对后世的影响 */
    @Column(columnDefinition = "text")
    private String impact;

    /** 时间线事件列表 */
    @Type(JsonType.class)
    @Column(columnDefinition = "json")
    private List<TimelineEvent> timeline;

    /** 精简版故事摘要（100字以内，用于列表预览和题目详情页卡片） */
    @Column(length = 200)
    private String shortSummary;

    /** 关联的算法模式 ID */
    private String relatedPatternId;

    /** 创建时间（UTC 毫秒时间戳） */
    private Long createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = System.currentTimeMillis();
    }
}
