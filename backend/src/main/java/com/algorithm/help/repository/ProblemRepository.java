package com.algorithm.help.repository;

import com.algorithm.help.common.enums.Difficulty;
import com.algorithm.help.entity.Problem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/**
 * 题目数据访问层
 */
public interface ProblemRepository extends JpaRepository<Problem, String> {

    Page<Problem> findByDifficulty(Difficulty difficulty, Pageable pageable);

    Optional<Problem> findByTitle(String title);

    @Query("SELECT p FROM Problem p WHERE p.title LIKE %:keyword% OR p.description LIKE %:keyword%")
    Page<Problem> searchByKeyword(@Param("keyword") String keyword, Pageable pageable);

    /**
     * MySQL FULLTEXT + ngram 全文搜索
     * 使用 BOOLEAN MODE 支持更精确的匹配控制
     * 搜索范围：title 和 description 字段
     */
    @Query(value = "SELECT * FROM problems WHERE MATCH(title, description) AGAINST(:keyword IN BOOLEAN MODE)",
            countQuery = "SELECT COUNT(*) FROM problems WHERE MATCH(title, description) AGAINST(:keyword IN BOOLEAN MODE)",
            nativeQuery = true)
    Page<Problem> fulltextSearch(@Param("keyword") String keyword, Pageable pageable);
}
