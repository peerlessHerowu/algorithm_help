package com.algorithm.help.repository;

import com.algorithm.help.entity.ProblemRelation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 题目关联关系数据访问层
 */
public interface ProblemRelationRepository extends JpaRepository<ProblemRelation, String> {

    List<ProblemRelation> findByFromProblemIdOrderByConfidenceDesc(String fromProblemId);
}
