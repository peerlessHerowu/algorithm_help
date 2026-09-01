package com.algorithm.help.archaeology.repository;

import com.algorithm.help.archaeology.entity.AlgorithmArchaeology;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 算法考古数据访问层
 */
public interface AlgorithmArchaeologyRepository extends JpaRepository<AlgorithmArchaeology, String> {

    /**
     * 根据关联的算法模式 ID 查询考古记录
     */
    List<AlgorithmArchaeology> findByRelatedPatternId(String patternId);
}
