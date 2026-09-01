package com.algorithm.help.graph.repository;

import com.algorithm.help.graph.entity.LearningPath;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 学习路径数据访问层
 */
public interface LearningPathRepository extends JpaRepository<LearningPath, String> {

    /** 按分类查询学习路径 */
    List<LearningPath> findByCategory(String category);
}
