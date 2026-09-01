package com.algorithm.help.content.relation;

import com.algorithm.help.common.enums.RelationType;
import com.algorithm.help.content.relation.RelationInferencer.InferenceResult;
import com.algorithm.help.entity.Problem;
import com.algorithm.help.entity.ProblemRelation;
import com.algorithm.help.repository.ProblemRelationRepository;
import com.algorithm.help.repository.ProblemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 关联关系管理服务
 * <p>
 * 提供批量关联计算、单条更新/删除等管理功能。
 * 计算流程：遍历所有题目对 → 推断关联类型 → 去重存储。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RelationService {

    private final ProblemRepository problemRepo;
    private final ProblemRelationRepository relationRepo;
    private final RelationInferencer inferencer;

    /**
     * 批量计算所有题目间的关联关系（异步执行）
     * <p>
     * 清除旧的推断关联后重新计算。手动确认的关联不受影响。
     */
    @Async
    public void calculateAllRelations() {
        log.info("开始批量关联关系计算...");
        List<Problem> problems = problemRepo.findAll();
        int totalPairs = 0;
        int created = 0;

        // 清除旧的自动推断关联（保留手动编辑的）
        clearAutoInferredRelations();

        for (int i = 0; i < problems.size(); i++) {
            for (int j = i + 1; j < problems.size(); j++) {
                totalPairs++;
                created += processRelationPair(problems.get(i), problems.get(j));
            }
        }
        log.info("批量关联计算完成: 总计评估 {} 对，生成 {} 条关联", totalPairs, created);
    }

    /**
     * 处理单个题目对的关联推断
     *
     * @return 生成的关联条数（0 或 1）
     */
    private int processRelationPair(Problem from, Problem to) {
        InferenceResult result = inferencer.inferRelationType(from, to);
        if (result == null) {
            return 0;
        }
        saveRelation(from.getId(), to.getId(), result);
        return 1;
    }

    /**
     * 保存推断结果为 ProblemRelation 实体
     */
    private void saveRelation(String fromId, String toId, InferenceResult result) {
        ProblemRelation relation = new ProblemRelation();
        relation.setFromProblemId(fromId);
        relation.setToProblemId(toId);
        relation.setType(result.getType());
        relation.setDescription(result.getReason());
        relation.setConfidence(result.getConfidence());
        relationRepo.save(relation);
    }

    /**
     * 清除自动推断的关联（置信度 < 1.0 的均视为自动推断）
     */
    private void clearAutoInferredRelations() {
        List<ProblemRelation> all = relationRepo.findAll();
        List<ProblemRelation> autoInferred = all.stream()
                .filter(r -> r.getConfidence() != null && r.getConfidence() < 1.0f)
                .toList();
        if (!autoInferred.isEmpty()) {
            relationRepo.deleteAll(autoInferred);
            log.info("已清除 {} 条旧的自动推断关联", autoInferred.size());
        }
    }

    /**
     * 更新关联关系
     *
     * @param id          关联 ID
     * @param type        新关联类型（可选）
     * @param description 新描述（可选）
     * @param confidence  新置信度（可选）
     * @return 更新后的关联，不存在时返回 null
     */
    public ProblemRelation updateRelation(String id, RelationType type,
                                          String description, Float confidence) {
        return relationRepo.findById(id).map(relation -> {
            if (type != null) {
                relation.setType(type);
            }
            if (description != null) {
                relation.setDescription(description);
            }
            if (confidence != null) {
                relation.setConfidence(confidence);
            }
            return relationRepo.save(relation);
        }).orElse(null);
    }

    /**
     * 删除关联关系
     *
     * @param id 关联 ID
     * @return 是否成功删除
     */
    public boolean deleteRelation(String id) {
        if (relationRepo.existsById(id)) {
            relationRepo.deleteById(id);
            return true;
        }
        return false;
    }
}
