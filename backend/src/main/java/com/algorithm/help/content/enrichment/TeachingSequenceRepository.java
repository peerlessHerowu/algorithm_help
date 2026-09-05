package com.algorithm.help.content.enrichment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * 教学走流程序列数据访问层
 */
public interface TeachingSequenceRepository extends JpaRepository<TeachingSequence, String> {

    /** 查询某题某级别某场景的序列（通常最多一条） */
    Optional<TeachingSequence> findByProblemIdAndLevelAndScenarioTypeAndStatus(
            String problemId, int level, String scenarioType, String status);

    /** 查询某题某级别的所有就绪序列 */
    List<TeachingSequence> findByProblemIdAndLevelAndStatus(
            String problemId, int level, String status);

    /** 查询某解析关联的序列 */
    List<TeachingSequence> findByEnrichedIdAndStatus(String enrichedId, String status);

    /** 统计某题是否已有序列 */
    boolean existsByProblemIdAndLevelAndScenarioType(
            String problemId, int level, String scenarioType);
}
