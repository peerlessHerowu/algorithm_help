package com.algorithm.help.graph.repository;

import com.algorithm.help.graph.entity.UserProgress;
import com.algorithm.help.graph.enums.CompletionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 用户学习进度数据访问层
 */
public interface GraphUserProgressRepository extends JpaRepository<UserProgress, String> {

    /** 查询某用户的全部进度 */
    List<UserProgress> findByUserId(String userId);

    /** 查询某用户在某题的进度 */
    List<UserProgress> findByUserIdAndProblemId(String userId, String problemId);

    /** 查询某用户某状态的进度列表 */
    List<UserProgress> findByUserIdAndStatus(String userId, CompletionStatus status);

    /** 查询某用户某模式下的进度列表 */
    List<UserProgress> findByUserIdAndPatternId(String userId, String patternId);
}
