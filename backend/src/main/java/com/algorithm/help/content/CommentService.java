package com.algorithm.help.content;

import com.algorithm.help.content.dto.CommentDTO;
import com.algorithm.help.content.dto.CreateCommentRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * 评论业务逻辑
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CommentService {

    private final CommentRepository commentRepo;

    /**
     * 发表评论
     */
    public CommentDTO create(String userId, CreateCommentRequest request) {
        Comment comment = new Comment()
                .setId(UUID.randomUUID().toString())
                .setTargetType(request.getTargetType())
                .setTargetId(request.getTargetId())
                .setUserId(userId)
                .setContent(request.getContent())
                .setType(request.getType())
                .setParentId(request.getParentId());

        commentRepo.save(comment);
        log.info("用户 {} 发表评论 {} (target={}/{})",
                userId, comment.getId(), request.getTargetType(), request.getTargetId());
        return toDTO(comment);
    }

    /**
     * 按目标查询评论（分页）
     */
    public Page<CommentDTO> list(String targetType, String targetId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Comment> comments = commentRepo.findByTargetTypeAndTargetIdAndDeletedFalse(
                targetType, targetId, pageable);
        return comments.map(this::toDTO);
    }

    /**
     * 软删除评论（仅作者可操作）
     */
    public void delete(String commentId, String userId) {
        Comment comment = findByIdOrThrow(commentId);
        checkOwnership(comment, userId);

        comment.setDeleted(true);
        commentRepo.save(comment);
        log.info("用户 {} 软删除评论 {}", userId, commentId);
    }

    /**
     * AI 扩展校验：type 为 SUPPLEMENT 或 CORRECTION，且 upvotes >= 5
     */
    public void expandByAI(String commentId) {
        Comment comment = findByIdOrThrow(commentId);

        boolean validType = "SUPPLEMENT".equals(comment.getType())
                || "CORRECTION".equals(comment.getType());
        if (!validType) {
            throw new IllegalArgumentException(
                    "仅 SUPPLEMENT 或 CORRECTION 类型评论可 AI 扩展，当前类型: " + comment.getType());
        }
        if (comment.getUpvotes() < 5) {
            throw new IllegalArgumentException(
                    "点赞数不足，需 >= 5，当前: " + comment.getUpvotes());
        }

        log.info("评论 {} 满足 AI 扩展条件 (type={}, upvotes={})，TODO: 调用 AI 服务",
                commentId, comment.getType(), comment.getUpvotes());
    }

    // ======================== 私有方法 ========================

    private Comment findByIdOrThrow(String id) {
        return commentRepo.findById(id)
                .filter(c -> !c.getDeleted())
                .orElseThrow(() -> new IllegalArgumentException("评论不存在: " + id));
    }

    private void checkOwnership(Comment comment, String userId) {
        if (!comment.getUserId().equals(userId)) {
            throw new IllegalArgumentException("无权操作他人的评论");
        }
    }

    private CommentDTO toDTO(Comment entity) {
        return new CommentDTO()
                .setId(entity.getId())
                .setTargetType(entity.getTargetType())
                .setTargetId(entity.getTargetId())
                .setUserId(entity.getUserId())
                .setContent(entity.getContent())
                .setType(entity.getType())
                .setUpvotes(entity.getUpvotes())
                .setParentId(entity.getParentId())
                .setCreatedAt(entity.getCreatedAt())
                .setUpdatedAt(entity.getUpdatedAt());
    }
}
