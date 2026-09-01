package com.algorithm.help.paper.entity;

import com.algorithm.help.paper.enums.FrontierDomain;
import com.algorithm.help.paper.model.BridgeStep;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;
import org.hibernate.annotations.Type;

import java.util.List;
import java.util.Map;

/**
 * 论文桥梁实体
 * <p>
 * 定义从基础算法到前沿论文的渐进式学习路径
 */
@Entity
@Table(name = "paper_bridge")
@Data
@Accessors(chain = true)
public class PaperBridge {

    @Id
    private String id;

    /** 基础算法名称（如 "BFS"） */
    @Column(nullable = false)
    private String baseAlgorithm;

    /** 论文标题 */
    @Column(nullable = false)
    private String paperTitle;

    /** 论文作者 */
    private String paperAuthors;

    /** 论文发表年份 */
    private Integer paperYear;

    /** 论文链接 */
    private String paperUrl;

    /** 前沿领域 */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private FrontierDomain domain;

    /** 桥梁路径步骤列表 */
    @Type(JsonType.class)
    @Column(columnDefinition = "json")
    private List<BridgeStep> bridgePath;

    /** 分级解读（L3/L4/L5 三级，key 为级别数字） */
    @Type(JsonType.class)
    @Column(columnDefinition = "json")
    private Map<Integer, String> leveledInterpretation;

    /** 实验类型（默认 "COLAB"） */
    @Column(length = 20)
    private String experimentType;

    /** 动手实验链接/代码 */
    private String experimentUrl;

    /** 创建时间（UTC 毫秒时间戳） */
    private Long createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = System.currentTimeMillis();
    }
}
