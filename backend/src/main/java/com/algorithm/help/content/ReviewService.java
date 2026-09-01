package com.algorithm.help.content;

import com.algorithm.help.content.dto.SolutionDTO;
import com.algorithm.help.internal.entity.UserSolution;
import com.algorithm.help.internal.repository.UserSolutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 内容审核业务逻辑
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewService {

    private final UserSolutionRepository solutionRepo;
    private final CommentRepository commentRepo;

    /**
     * 获取待审核题解队列（status=DRAFT）
     */
    public Page<SolutionDTO> getSolutionQueue(int page, int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<UserSolution> solutions = solutionRepo.findByStatusAndDeletedFalse("DRAFT", pageable);
        return solutions.map(this::toSolutionDTO);
    }

    /**
     * 获取待审核评论队列（type=CORRECTION 或 SUPPLEMENT）
     */
    public Page<Comment> getCommentQueue(int page, int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        List<String> types = List.of("CORRECTION", "SUPPLEMENT");
        return commentRepo.findByTypeInAndDeletedFalse(types, pageable);
    }

    /**
     * 批准题解（设 status=PUBLISHED）
     */
    public SolutionDTO approveSolution(String id) {
        UserSolution solution = findSolutionOrThrow(id);
        solution.setStatus("PUBLISHED");
        solutionRepo.save(solution);
        log.info("审核通过题解: {}", id);
        return toSolutionDTO(solution);
    }

    /**
     * 驳回题解（设 status=HIDDEN）
     */
    public SolutionDTO rejectSolution(String id, String reason) {
        UserSolution solution = findSolutionOrThrow(id);
        solution.setStatus("HIDDEN");
        solutionRepo.save(solution);
        log.info("审核驳回题解: {}, 原因: {}", id, reason);
        return toSolutionDTO(solution);
    }

    /**
     * 批准评论（当前仅记录日志，评论无额外状态字段）
     */
    public void approveComment(String id) {
        Comment comment = findCommentOrThrow(id);
        log.info("审核通过评论: {} (type={})", id, comment.getType());
    }

    /**
     * 驳回评论（软删除）
     */
    public void rejectComment(String id, String reason) {
        Comment comment = findCommentOrThrow(id);
        comment.setDeleted(true);
        commentRepo.save(comment);
        log.info("审核驳回评论: {}, 原因: {}", id, reason);
    }

    // ======================== 私有方法 ========================

    private UserSolution findSolutionOrThrow(String id) {
        return solutionRepo.findById(id)
                .filter(s -> !s.getDeleted())
                .orElseThrow(() -> new IllegalArgumentException("题解不存在: " + id));
    }

    private Comment findCommentOrThrow(String id) {
        return commentRepo.findById(id)
                .filter(c -> !c.getDeleted())
                .orElseThrow(() -> new IllegalArgumentException("评论不存在: " + id));
    }

    private SolutionDTO toSolutionDTO(UserSolution entity) {
        return new SolutionDTO()
                .setId(entity.getId())
                .setProblemId(entity.getProblemId())
                .setTitle(entity.getTitle())
                .setContent(entity.getContent())
                .setLanguage(entity.getLanguage())
                .setSourceType(entity.getSourceType())
                .setStatus(entity.getStatus())
                .setAuthorName(entity.getAuthorName())
                .setUpvotes(entity.getUpvotes())
                .setViewCount(entity.getViewCount())
                .setUserId(entity.getUserId())
                .setCreatedAt(entity.getCreatedAt())
                .setUpdatedAt(entity.getUpdatedAt());
    }
}
