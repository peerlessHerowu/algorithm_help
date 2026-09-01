package com.algorithm.help.content;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Comment 数据访问层
 */
public interface CommentRepository extends JpaRepository<Comment, String> {

    /** 按目标类型和 ID 查询未删除的评论（分页） */
    Page<Comment> findByTargetTypeAndTargetIdAndDeletedFalse(String targetType, String targetId, Pageable pageable);

    /** 统计目标下未删除的评论数 */
    long countByTargetTypeAndTargetIdAndDeletedFalse(String targetType, String targetId);

    /** 按评论类型查询未删除的评论（分页，用于审核队列） */
    Page<Comment> findByTypeInAndDeletedFalse(java.util.List<String> types, Pageable pageable);
}
