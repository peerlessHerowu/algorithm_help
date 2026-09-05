package com.algorithm.help.repository;

import com.algorithm.help.entity.Diagram;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 图解数据访问层
 */
public interface DiagramRepository extends JpaRepository<Diagram, String> {

    /** 按题目 ID + 级别查询（按创建时间倒序） */
    List<Diagram> findByProblemIdAndLevelOrderByCreatedAtDesc(String problemId, Integer level);

    /** 按题目 ID 查询（不限级别） */
    List<Diagram> findByProblemIdOrderByCreatedAtDesc(String problemId);

    /** 简便方法 */
    default List<Diagram> findByProblemIdAndLevel(String problemId, int level) {
        return findByProblemIdAndLevelOrderByCreatedAtDesc(problemId, level);
    }

    default List<Diagram> findByProblemId(String problemId) {
        return findByProblemIdOrderByCreatedAtDesc(problemId);
    }

    /** 统计题目是否已有图解 */
    boolean existsByProblemIdAndLevel(String problemId, Integer level);
}
