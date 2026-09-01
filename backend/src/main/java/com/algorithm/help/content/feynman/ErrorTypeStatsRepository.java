package com.algorithm.help.content.feynman;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 错误类型统计 Repository
 */
@Repository
public interface ErrorTypeStatsRepository extends JpaRepository<ErrorTypeStats, Long> {

    /**
     * 查询用户所有错误类型的统计数据
     */
    List<ErrorTypeStats> findByUserId(String userId);

    /**
     * 查询用户某一类型的统计数据
     */
    Optional<ErrorTypeStats> findByUserIdAndErrorType(String userId, FeynmanErrorType errorType);
}
