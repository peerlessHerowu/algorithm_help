package com.algorithm.help.repository;

import com.algorithm.help.entity.AlgorithmPattern;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 算法模式数据访问层
 */
public interface PatternRepository extends JpaRepository<AlgorithmPattern, String> {
}
