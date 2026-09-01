package com.algorithm.help.repository;

import com.algorithm.help.entity.UserProgress;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/**
 * 用户学习进度数据访问层
 */
public interface UserProgressRepository extends JpaRepository<UserProgress, UUID> {

    List<UserProgress> findByUserId(UUID userId);

    List<UserProgress> findByUserIdAndProblemId(UUID userId, String problemId);

    long countByUserIdAndCompletedAtIsNotNull(UUID userId);
}
