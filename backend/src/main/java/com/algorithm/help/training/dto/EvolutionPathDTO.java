package com.algorithm.help.training.dto;

import com.algorithm.help.graph.entity.GraphNode;
import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * 模式演进路径响应
 */
@Data
@Accessors(chain = true)
public class EvolutionPathDTO {

    /** 演进路径节点有序列表（从基础到高级） */
    private List<GraphNode> path;

    /** 是否建议进阶（用户正确率>80% 时为 true） */
    private boolean advanceSuggested;

    /** 推荐的下一个进阶模式 ID（advanceSuggested=true 时非空） */
    private String suggestedNextId;

    /** 推荐的下一个进阶模式名称 */
    private String suggestedNextName;
}
