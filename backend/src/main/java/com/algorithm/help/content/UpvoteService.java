package com.algorithm.help.content;

import com.algorithm.help.internal.entity.UserSolution;
import com.algorithm.help.internal.repository.UserSolutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * 点赞业务逻辑
 * 使用 Redis SET 防重复，同时更新数据库 upvotes 字段
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UpvoteService {

    private final StringRedisTemplate redisTemplate;
    private final UserSolutionRepository solutionRepo;
    private final CommentRepository commentRepo;

    private static final String SOLUTION_KEY_PREFIX = "upvote:solution:";
    private static final String COMMENT_KEY_PREFIX = "upvote:comment:";

    /**
     * 题解点赞
     */
    public void upvoteSolution(String solutionId, String userId) {
        String key = SOLUTION_KEY_PREFIX + solutionId;
        Long added = redisTemplate.opsForSet().add(key, userId);
        if (added == null || added == 0) {
            throw new IllegalArgumentException("已点赞，不可重复操作");
        }
        // 更新数据库 upvotes +1
        UserSolution solution = findSolutionOrThrow(solutionId);
        solution.setUpvotes(safeUpvotes(solution.getUpvotes()) + 1);
        solutionRepo.save(solution);
        log.info("用户 {} 点赞题解 {}", userId, solutionId);
    }

    /**
     * 取消题解点赞
     */
    public void cancelSolutionUpvote(String solutionId, String userId) {
        String key = SOLUTION_KEY_PREFIX + solutionId;
        Long removed = redisTemplate.opsForSet().remove(key, userId);
        if (removed == null || removed == 0) {
            throw new IllegalArgumentException("未点赞，无法取消");
        }
        // 更新数据库 upvotes -1
        UserSolution solution = findSolutionOrThrow(solutionId);
        solution.setUpvotes(Math.max(0, safeUpvotes(solution.getUpvotes()) - 1));
        solutionRepo.save(solution);
        log.info("用户 {} 取消题解点赞 {}", userId, solutionId);
    }

    /**
     * 评论点赞
     */
    public void upvoteComment(String commentId, String userId) {
        String key = COMMENT_KEY_PREFIX + commentId;
        Long added = redisTemplate.opsForSet().add(key, userId);
        if (added == null || added == 0) {
            throw new IllegalArgumentException("已点赞，不可重复操作");
        }
        Comment comment = findCommentOrThrow(commentId);
        comment.setUpvotes(comment.getUpvotes() + 1);
        commentRepo.save(comment);
        log.info("用户 {} 点赞评论 {}", userId, commentId);
    }

    /**
     * 取消评论点赞
     */
    public void cancelCommentUpvote(String commentId, String userId) {
        String key = COMMENT_KEY_PREFIX + commentId;
        Long removed = redisTemplate.opsForSet().remove(key, userId);
        if (removed == null || removed == 0) {
            throw new IllegalArgumentException("未点赞，无法取消");
        }
        Comment comment = findCommentOrThrow(commentId);
        comment.setUpvotes(Math.max(0, comment.getUpvotes() - 1));
        commentRepo.save(comment);
        log.info("用户 {} 取消评论点赞 {}", userId, commentId);
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

    private int safeUpvotes(Integer upvotes) {
        return upvotes != null ? upvotes : 0;
    }
}
