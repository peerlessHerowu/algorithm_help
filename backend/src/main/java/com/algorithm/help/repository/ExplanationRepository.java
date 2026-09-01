package com.algorithm.help.repository;

import com.algorithm.help.entity.Explanation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * 解析数据访问层
 */
public interface ExplanationRepository extends JpaRepository<Explanation, String> {

    Optional<Explanation> findByProblemIdAndLevelAndIsLatestTrue(String problemId, Integer level);

    List<Explanation> findByProblemIdAndLevelOrderByVersionDesc(String problemId, Integer level);

    List<Explanation> findByProblemIdOrderByLevelAscVersionDesc(String problemId);
}
