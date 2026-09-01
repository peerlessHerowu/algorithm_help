package com.algorithm.help.service;

import com.algorithm.help.entity.ProblemRelation;
import com.algorithm.help.repository.ProblemRelationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * 关联题目推荐服务
 * 排序逻辑：follow_up > variant > similar_pattern > harder_version > prerequisite
 */
@Service
@RequiredArgsConstructor
public class RelatedProblemService {

    private static final int MAX_RESULTS = 10;
    private static final Map<String, Integer> PRIORITY = Map.of(
            "FOLLOW_UP", 1,
            "VARIANT", 2,
            "SIMILAR_PATTERN", 3,
            "HARDER_VERSION", 4,
            "PREREQUISITE", 5
    );

    private final ProblemRelationRepository relationRepo;

    /** 获取题目的关联推荐列表（最多 10 条） */
    public List<ProblemRelation> getRelated(String problemId) {
        List<ProblemRelation> relations = relationRepo.findByFromProblemIdOrderByConfidenceDesc(problemId);
        return relations.stream()
                .sorted(Comparator.comparingInt(r -> PRIORITY.getOrDefault(r.getType().name(), 99)))
                .limit(MAX_RESULTS)
                .toList();
    }
}
