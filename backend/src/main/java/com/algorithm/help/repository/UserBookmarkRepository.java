package com.algorithm.help.repository;

import com.algorithm.help.entity.UserBookmark;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/**
 * 用户收藏数据访问层
 */
public interface UserBookmarkRepository extends JpaRepository<UserBookmark, UUID> {

    Page<UserBookmark> findByUserId(UUID userId, Pageable pageable);

    Optional<UserBookmark> findByUserIdAndProblemId(UUID userId, String problemId);

    void deleteByUserIdAndProblemId(UUID userId, String problemId);

    boolean existsByUserIdAndProblemId(UUID userId, String problemId);
}
