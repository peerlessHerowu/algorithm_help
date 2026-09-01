package com.algorithm.help.graph.dto;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * 学习路径进度 DTO
 */
@Data
@Accessors(chain = true)
public class LearningPathProgressDTO {

    /** 路径 ID */
    private String pathId;

    /** 路径名称 */
    private String pathName;

    /** 路径节点总数 */
    private int totalNodes;

    /** 已完成节点数 */
    private int completedNodes;

    /** 进度百分比 (0.0 ~ 100.0) */
    private double progressPercent;

    /** 里程碑完成状态列表 */
    private List<MilestoneStatus> milestones;

    /**
     * 里程碑完成状态
     */
    @Data
    @Accessors(chain = true)
    public static class MilestoneStatus {

        /** 里程碑名称 */
        private String milestoneName;

        /** 对应节点 ID */
        private String nodeId;

        /** 是否已完成 */
        private boolean completed;
    }
}
