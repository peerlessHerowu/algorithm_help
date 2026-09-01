package com.algorithm.help.graph.service;

import com.algorithm.help.common.exception.ResourceNotFoundException;
import com.algorithm.help.graph.dto.LearningPathProgressDTO;
import com.algorithm.help.graph.dto.LearningPathProgressDTO.MilestoneStatus;
import com.algorithm.help.graph.entity.LearningPath;
import com.algorithm.help.graph.entity.UserProgress;
import com.algorithm.help.graph.enums.CompletionStatus;
import com.algorithm.help.graph.model.PathNode;
import com.algorithm.help.graph.repository.LearningPathRepository;
import com.algorithm.help.graph.repository.GraphUserProgressRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 学习路径服务：路径查询 + 用户进度计算
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LearningPathService {

    private final LearningPathRepository pathRepo;
    private final GraphUserProgressRepository progressRepo;

    /**
     * 获取所有学习路径
     */
    public List<LearningPath> getAll() {
        return pathRepo.findAll();
    }

    /**
     * 按 ID 获取学习路径，不存在则抛 404
     */
    public LearningPath getById(String id) {
        return pathRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("学习路径", id));
    }

    /**
     * 计算用户在某学习路径上的进度
     *
     * @param pathId 路径 ID
     * @param userId 用户 ID
     * @return 进度 DTO（含完成百分比 + 里程碑状态）
     */
    public LearningPathProgressDTO getProgress(String pathId, String userId) {
        LearningPath path = getById(pathId);
        List<PathNode> nodes = path.getNodes();

        // 获取用户已完成的节点 ID 集合
        Set<String> completedIds = getCompletedNodeIds(userId);

        // 计算已完成节点数
        int completed = countCompletedNodes(nodes, completedIds);
        int total = nodes != null ? nodes.size() : 0;
        double percent = total > 0 ? (double) completed / total * 100 : 0.0;

        // 构建里程碑状态列表
        List<MilestoneStatus> milestones = buildMilestones(nodes, completedIds);

        return new LearningPathProgressDTO()
                .setPathId(path.getId())
                .setPathName(path.getName())
                .setTotalNodes(total)
                .setCompletedNodes(completed)
                .setProgressPercent(percent)
                .setMilestones(milestones);
    }

    /**
     * 获取用户所有已完成（COMPLETED/MASTERED）的节点 ID 集合
     */
    private Set<String> getCompletedNodeIds(String userId) {
        List<UserProgress> allProgress = progressRepo.findByUserId(userId);
        return allProgress.stream()
                .filter(p -> p.getStatus() == CompletionStatus.COMPLETED
                        || p.getStatus() == CompletionStatus.MASTERED)
                .map(p -> resolveNodeId(p))
                .collect(Collectors.toSet());
    }

    /**
     * 根据 UserProgress 解析对应的节点 ID
     * <p>
     * problemId 对应 PROBLEM 类型节点，patternId 对应 PATTERN 类型节点
     */
    private String resolveNodeId(UserProgress progress) {
        // 优先使用 problemId，其次 patternId
        return progress.getProblemId() != null
                ? progress.getProblemId()
                : progress.getPatternId();
    }

    /**
     * 计算路径中已完成的节点数量
     */
    private int countCompletedNodes(List<PathNode> nodes, Set<String> completedIds) {
        if (nodes == null) return 0;
        return (int) nodes.stream()
                .filter(node -> completedIds.contains(node.getNodeId()))
                .count();
    }

    /**
     * 构建里程碑状态列表：筛选 milestone != null 的节点并判断完成状态
     */
    private List<MilestoneStatus> buildMilestones(List<PathNode> nodes, Set<String> completedIds) {
        if (nodes == null) return List.of();
        return nodes.stream()
                .filter(node -> node.getMilestone() != null)
                .map(node -> new MilestoneStatus()
                        .setMilestoneName(node.getMilestone())
                        .setNodeId(node.getNodeId())
                        .setCompleted(completedIds.contains(node.getNodeId())))
                .collect(Collectors.toList());
    }
}
