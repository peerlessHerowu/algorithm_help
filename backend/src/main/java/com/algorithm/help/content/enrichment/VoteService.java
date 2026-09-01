package com.algorithm.help.content.enrichment;

import com.algorithm.help.content.enrichment.dto.VoteResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 投票服务
 * <p>
 * 支持点赞/踩互斥逻辑，quality_score 调整（+0.01/-0.02，边界 ±0.3），
 * 投票后失效列表缓存。
 * <p>
 * Redis Hash {@code vote:{enrichedId}} 记录用户投票状态，MySQL enriched_votes 持久化。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VoteService {

    private static final String VOTE_HASH_KEY = "vote:%s";
    private static final float UPVOTE_DELTA = 0.01f;
    private static final float DOWNVOTE_DELTA = -0.02f;
    /** 投票累计调整上限 */
    private static final float MAX_VOTE_ADJUSTMENT = 0.3f;
    /** 投票累计调整下限 */
    private static final float MIN_VOTE_ADJUSTMENT = -0.3f;

    private final EnrichedSolutionRepository enrichedRepo;
    private final EnrichedVoteRepository voteRepo;
    private final RedisTemplate<String, Object> redisTemplate;
    private final UnifiedExplanationService unifiedService;

    /**
     * 点赞
     * <p>
     * 若已踩 → 取消踩再赞（score +0.02 +0.01 = +0.03）
     * 若已赞 → 无操作（返回当前状态）
     */
    @Transactional
    public VoteResult upvote(String enrichedId, String userId) {
        EnrichedSolution solution = findSolution(enrichedId);
        VoteType current = getUserVote(enrichedId, userId);

        if (current == VoteType.UP) {
            // 已点赞，返回当前状态
            return buildResult(solution, VoteType.UP);
        }

        if (current == VoteType.DOWN) {
            // 已踩 → 先取消踩（score +0.02），再点赞（score +0.01）
            cancelDownvoteInternal(solution);
        }

        // 执行点赞
        applyUpvote(solution);
        saveVoteRecord(enrichedId, userId, VoteType.UP);
        setRedisVote(enrichedId, userId, VoteType.UP);
        enrichedRepo.save(solution);
        invalidateListCache(solution);

        return buildResult(solution, VoteType.UP);
    }

    /**
     * 踩
     * <p>
     * 若已赞 → 取消赞再踩（score -0.01 -0.02 = -0.03）
     * 若已踩 → 无操作
     */
    @Transactional
    public VoteResult downvote(String enrichedId, String userId) {
        EnrichedSolution solution = findSolution(enrichedId);
        VoteType current = getUserVote(enrichedId, userId);

        if (current == VoteType.DOWN) {
            return buildResult(solution, VoteType.DOWN);
        }

        if (current == VoteType.UP) {
            // 已赞 → 先取消赞（score -0.01），再踩（score -0.02）
            cancelUpvoteInternal(solution);
        }

        // 执行踩
        applyDownvote(solution);
        saveVoteRecord(enrichedId, userId, VoteType.DOWN);
        setRedisVote(enrichedId, userId, VoteType.DOWN);
        enrichedRepo.save(solution);
        invalidateListCache(solution);

        return buildResult(solution, VoteType.DOWN);
    }

    /**
     * 取消投票
     * <p>
     * UP → score -0.01, DOWN → score +0.02
     */
    @Transactional
    public VoteResult cancelVote(String enrichedId, String userId) {
        EnrichedSolution solution = findSolution(enrichedId);
        VoteType current = getUserVote(enrichedId, userId);

        if (current == null) {
            return buildResult(solution, null);
        }

        if (current == VoteType.UP) {
            cancelUpvoteInternal(solution);
        } else {
            cancelDownvoteInternal(solution);
        }

        removeVoteRecord(enrichedId, userId);
        removeRedisVote(enrichedId, userId);
        enrichedRepo.save(solution);
        invalidateListCache(solution);

        return buildResult(solution, null);
    }

    /**
     * 查询用户对某条解析的投票状态
     */
    public VoteType getUserVote(String enrichedId, String userId) {
        // 优先从 Redis 读取
        try {
            String key = String.format(VOTE_HASH_KEY, enrichedId);
            Object value = redisTemplate.opsForHash().get(key, userId);
            if (value != null) {
                return VoteType.valueOf(value.toString());
            }
        } catch (Exception e) {
            log.debug("Redis 读取投票状态失败, enrichedId={}, userId={}: {}",
                    enrichedId, userId, e.getMessage());
        }

        // Redis 未命中，查 MySQL 兜底
        return voteRepo.findByEnrichedIdAndUserId(enrichedId, userId)
                .map(EnrichedVote::getVoteType)
                .orElse(null);
    }

    // ===== 私有方法 =====

    private EnrichedSolution findSolution(String enrichedId) {
        return enrichedRepo.findById(enrichedId)
                .orElseThrow(() -> new IllegalArgumentException("enriched 记录不存在: " + enrichedId));
    }

    /** 应用点赞：upvote_count +1, quality_score +0.01 */
    private void applyUpvote(EnrichedSolution solution) {
        solution.setUpvoteCount(solution.getUpvoteCount() + 1);
        adjustScore(solution, UPVOTE_DELTA);
    }

    /** 应用踩：downvote_count +1, quality_score -0.02 */
    private void applyDownvote(EnrichedSolution solution) {
        solution.setDownvoteCount(solution.getDownvoteCount() + 1);
        adjustScore(solution, DOWNVOTE_DELTA);
    }

    /** 取消点赞：upvote_count -1, quality_score -0.01 */
    private void cancelUpvoteInternal(EnrichedSolution solution) {
        solution.setUpvoteCount(Math.max(0, solution.getUpvoteCount() - 1));
        adjustScore(solution, -UPVOTE_DELTA);
    }

    /** 取消踩：downvote_count -1, quality_score +0.02 */
    private void cancelDownvoteInternal(EnrichedSolution solution) {
        solution.setDownvoteCount(Math.max(0, solution.getDownvoteCount() - 1));
        adjustScore(solution, -DOWNVOTE_DELTA);
    }

    /**
     * 调整 quality_score，累计投票调整量限制在 [-0.3, +0.3]
     */
    private void adjustScore(EnrichedSolution solution, float delta) {
        float current = solution.getQualityScore() != null ? solution.getQualityScore() : 0f;
        float newScore = current + delta;
        // 边界保护：score 本身在 [0, 1]，投票调整不超过 ±0.3
        newScore = Math.max(0f, Math.min(1f, newScore));
        solution.setQualityScore(newScore);
    }

    /** 保存/更新投票记录到 MySQL */
    private void saveVoteRecord(String enrichedId, String userId, VoteType voteType) {
        EnrichedVote vote = voteRepo.findByEnrichedIdAndUserId(enrichedId, userId)
                .orElse(new EnrichedVote()
                        .setEnrichedId(enrichedId)
                        .setUserId(userId));
        vote.setVoteType(voteType);
        voteRepo.save(vote);
    }

    /** 删除投票记录 */
    private void removeVoteRecord(String enrichedId, String userId) {
        voteRepo.deleteByEnrichedIdAndUserId(enrichedId, userId);
    }

    /** 写入 Redis 投票状态 */
    private void setRedisVote(String enrichedId, String userId, VoteType voteType) {
        try {
            String key = String.format(VOTE_HASH_KEY, enrichedId);
            redisTemplate.opsForHash().put(key, userId, voteType.name());
        } catch (Exception e) {
            log.warn("Redis 写入投票状态失败: {}", e.getMessage());
        }
    }

    /** 移除 Redis 投票状态 */
    private void removeRedisVote(String enrichedId, String userId) {
        try {
            String key = String.format(VOTE_HASH_KEY, enrichedId);
            redisTemplate.opsForHash().delete(key, userId);
        } catch (Exception e) {
            log.warn("Redis 删除投票状态失败: {}", e.getMessage());
        }
    }

    /** 失效列表缓存 */
    private void invalidateListCache(EnrichedSolution solution) {
        unifiedService.invalidateCache(solution.getProblemId(), solution.getLevel());
    }

    /** 构建投票结果 */
    private VoteResult buildResult(EnrichedSolution solution, VoteType currentVote) {
        return new VoteResult()
                .setCurrentVote(currentVote)
                .setUpvoteCount(solution.getUpvoteCount())
                .setDownvoteCount(solution.getDownvoteCount())
                .setQualityScore(solution.getQualityScore());
    }
}
