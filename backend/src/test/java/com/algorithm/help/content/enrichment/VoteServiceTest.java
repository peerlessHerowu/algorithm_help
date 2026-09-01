package com.algorithm.help.content.enrichment;

import com.algorithm.help.content.enrichment.dto.VoteResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.RedisTemplate;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * VoteService 单元测试
 * <p>
 * 覆盖：互斥投票、score 调整边界、取消投票、重复投票幂等
 */
@ExtendWith(MockitoExtension.class)
class VoteServiceTest {

    @Mock
    private EnrichedSolutionRepository enrichedRepo;
    @Mock
    private EnrichedVoteRepository voteRepo;
    @Mock
    private RedisTemplate<String, Object> redisTemplate;
    @Mock
    private HashOperations<String, Object, Object> hashOps;
    @Mock
    private UnifiedExplanationService unifiedService;

    private VoteService voteService;

    private static final String ENRICHED_ID = "test-enriched-001";
    private static final String USER_ID = "user-123";

    @BeforeEach
    void setUp() {
        lenient().when(redisTemplate.opsForHash()).thenReturn(hashOps);
        voteService = new VoteService(enrichedRepo, voteRepo, redisTemplate, unifiedService);
    }

    @Test
    @DisplayName("点赞：无投票状态 → 点赞成功, upvoteCount+1, score+0.01")
    void upvote_noExistingVote_success() {
        EnrichedSolution solution = buildSolution(0.5f, 0, 0);
        when(enrichedRepo.findById(ENRICHED_ID)).thenReturn(Optional.of(solution));
        when(hashOps.get("vote:" + ENRICHED_ID, USER_ID)).thenReturn(null);
        when(voteRepo.findByEnrichedIdAndUserId(ENRICHED_ID, USER_ID)).thenReturn(Optional.empty());

        VoteResult result = voteService.upvote(ENRICHED_ID, USER_ID);

        assertEquals(VoteType.UP, result.getCurrentVote());
        assertEquals(1, result.getUpvoteCount());
        assertEquals(0, result.getDownvoteCount());
        assertEquals(0.51f, result.getQualityScore(), 0.001f);
        verify(enrichedRepo).save(solution);
        verify(unifiedService).invalidateCache("problem-1", 3);
    }

    @Test
    @DisplayName("点赞：已点赞 → 幂等，不重复修改")
    void upvote_alreadyUpvoted_idempotent() {
        EnrichedSolution solution = buildSolution(0.51f, 1, 0);
        when(enrichedRepo.findById(ENRICHED_ID)).thenReturn(Optional.of(solution));
        when(hashOps.get("vote:" + ENRICHED_ID, USER_ID)).thenReturn("UP");

        VoteResult result = voteService.upvote(ENRICHED_ID, USER_ID);

        assertEquals(VoteType.UP, result.getCurrentVote());
        assertEquals(1, result.getUpvoteCount());
        verify(enrichedRepo, never()).save(any());
    }

    @Test
    @DisplayName("点赞：已踩 → 取消踩再赞, score +0.03, downvote-1, upvote+1")
    void upvote_afterDownvote_switchesToUpvote() {
        EnrichedSolution solution = buildSolution(0.48f, 0, 1);
        when(enrichedRepo.findById(ENRICHED_ID)).thenReturn(Optional.of(solution));
        when(hashOps.get("vote:" + ENRICHED_ID, USER_ID)).thenReturn("DOWN");
        when(voteRepo.findByEnrichedIdAndUserId(ENRICHED_ID, USER_ID)).thenReturn(Optional.empty());

        VoteResult result = voteService.upvote(ENRICHED_ID, USER_ID);

        assertEquals(VoteType.UP, result.getCurrentVote());
        assertEquals(1, result.getUpvoteCount());
        assertEquals(0, result.getDownvoteCount());
        // score: 0.48 + 0.02（取消踩） + 0.01（点赞） = 0.51
        assertEquals(0.51f, result.getQualityScore(), 0.001f);
    }

    @Test
    @DisplayName("踩：无投票状态 → 踩成功, downvoteCount+1, score-0.02")
    void downvote_noExistingVote_success() {
        EnrichedSolution solution = buildSolution(0.5f, 0, 0);
        when(enrichedRepo.findById(ENRICHED_ID)).thenReturn(Optional.of(solution));
        when(hashOps.get("vote:" + ENRICHED_ID, USER_ID)).thenReturn(null);
        when(voteRepo.findByEnrichedIdAndUserId(ENRICHED_ID, USER_ID)).thenReturn(Optional.empty());

        VoteResult result = voteService.downvote(ENRICHED_ID, USER_ID);

        assertEquals(VoteType.DOWN, result.getCurrentVote());
        assertEquals(0, result.getUpvoteCount());
        assertEquals(1, result.getDownvoteCount());
        assertEquals(0.48f, result.getQualityScore(), 0.001f);
        verify(enrichedRepo).save(solution);
    }

    @Test
    @DisplayName("踩：已踩 → 幂等")
    void downvote_alreadyDownvoted_idempotent() {
        EnrichedSolution solution = buildSolution(0.48f, 0, 1);
        when(enrichedRepo.findById(ENRICHED_ID)).thenReturn(Optional.of(solution));
        when(hashOps.get("vote:" + ENRICHED_ID, USER_ID)).thenReturn("DOWN");

        VoteResult result = voteService.downvote(ENRICHED_ID, USER_ID);

        assertEquals(VoteType.DOWN, result.getCurrentVote());
        verify(enrichedRepo, never()).save(any());
    }

    @Test
    @DisplayName("踩：已赞 → 取消赞再踩, score -0.03")
    void downvote_afterUpvote_switchesToDownvote() {
        EnrichedSolution solution = buildSolution(0.51f, 1, 0);
        when(enrichedRepo.findById(ENRICHED_ID)).thenReturn(Optional.of(solution));
        when(hashOps.get("vote:" + ENRICHED_ID, USER_ID)).thenReturn("UP");
        when(voteRepo.findByEnrichedIdAndUserId(ENRICHED_ID, USER_ID)).thenReturn(Optional.empty());

        VoteResult result = voteService.downvote(ENRICHED_ID, USER_ID);

        assertEquals(VoteType.DOWN, result.getCurrentVote());
        assertEquals(0, result.getUpvoteCount());
        assertEquals(1, result.getDownvoteCount());
        // score: 0.51 - 0.01（取消赞） - 0.02（踩） = 0.48
        assertEquals(0.48f, result.getQualityScore(), 0.001f);
    }

    @Test
    @DisplayName("取消投票：当前为赞 → 取消, upvoteCount-1, score-0.01")
    void cancelVote_fromUpvote() {
        EnrichedSolution solution = buildSolution(0.51f, 1, 0);
        when(enrichedRepo.findById(ENRICHED_ID)).thenReturn(Optional.of(solution));
        when(hashOps.get("vote:" + ENRICHED_ID, USER_ID)).thenReturn("UP");

        VoteResult result = voteService.cancelVote(ENRICHED_ID, USER_ID);

        assertNull(result.getCurrentVote());
        assertEquals(0, result.getUpvoteCount());
        assertEquals(0.5f, result.getQualityScore(), 0.001f);
        verify(voteRepo).deleteByEnrichedIdAndUserId(ENRICHED_ID, USER_ID);
    }

    @Test
    @DisplayName("取消投票：当前为踩 → 取消, downvoteCount-1, score+0.02")
    void cancelVote_fromDownvote() {
        EnrichedSolution solution = buildSolution(0.48f, 0, 1);
        when(enrichedRepo.findById(ENRICHED_ID)).thenReturn(Optional.of(solution));
        when(hashOps.get("vote:" + ENRICHED_ID, USER_ID)).thenReturn("DOWN");

        VoteResult result = voteService.cancelVote(ENRICHED_ID, USER_ID);

        assertNull(result.getCurrentVote());
        assertEquals(0, result.getDownvoteCount());
        assertEquals(0.5f, result.getQualityScore(), 0.001f);
        verify(voteRepo).deleteByEnrichedIdAndUserId(ENRICHED_ID, USER_ID);
    }

    @Test
    @DisplayName("取消投票：无投票 → 无操作")
    void cancelVote_noVote_noop() {
        EnrichedSolution solution = buildSolution(0.5f, 0, 0);
        when(enrichedRepo.findById(ENRICHED_ID)).thenReturn(Optional.of(solution));
        when(hashOps.get("vote:" + ENRICHED_ID, USER_ID)).thenReturn(null);
        when(voteRepo.findByEnrichedIdAndUserId(ENRICHED_ID, USER_ID)).thenReturn(Optional.empty());

        VoteResult result = voteService.cancelVote(ENRICHED_ID, USER_ID);

        assertNull(result.getCurrentVote());
        verify(enrichedRepo, never()).save(any());
    }

    @Test
    @DisplayName("score 下界保护：score 不会低于 0")
    void downvote_scoreBound_notBelowZero() {
        EnrichedSolution solution = buildSolution(0.01f, 0, 0);
        when(enrichedRepo.findById(ENRICHED_ID)).thenReturn(Optional.of(solution));
        when(hashOps.get("vote:" + ENRICHED_ID, USER_ID)).thenReturn(null);
        when(voteRepo.findByEnrichedIdAndUserId(ENRICHED_ID, USER_ID)).thenReturn(Optional.empty());

        VoteResult result = voteService.downvote(ENRICHED_ID, USER_ID);

        assertTrue(result.getQualityScore() >= 0f);
        assertEquals(0f, result.getQualityScore(), 0.001f);
    }

    @Test
    @DisplayName("score 上界保护：score 不会超过 1")
    void upvote_scoreBound_notAboveOne() {
        EnrichedSolution solution = buildSolution(0.998f, 0, 0);
        when(enrichedRepo.findById(ENRICHED_ID)).thenReturn(Optional.of(solution));
        when(hashOps.get("vote:" + ENRICHED_ID, USER_ID)).thenReturn(null);
        when(voteRepo.findByEnrichedIdAndUserId(ENRICHED_ID, USER_ID)).thenReturn(Optional.empty());

        VoteResult result = voteService.upvote(ENRICHED_ID, USER_ID);

        assertTrue(result.getQualityScore() <= 1f);
        assertEquals(1f, result.getQualityScore(), 0.001f);
    }

    @Test
    @DisplayName("enrichedId 不存在 → 抛出异常")
    void upvote_notFound_throwsException() {
        when(enrichedRepo.findById(ENRICHED_ID)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> voteService.upvote(ENRICHED_ID, USER_ID));
    }

    @Test
    @DisplayName("getUserVote：Redis 命中返回投票类型")
    void getUserVote_redisHit() {
        when(hashOps.get("vote:" + ENRICHED_ID, USER_ID)).thenReturn("UP");

        VoteType result = voteService.getUserVote(ENRICHED_ID, USER_ID);

        assertEquals(VoteType.UP, result);
    }

    @Test
    @DisplayName("getUserVote：Redis 未命中查 MySQL")
    void getUserVote_redisMiss_fallbackToMySQL() {
        when(hashOps.get("vote:" + ENRICHED_ID, USER_ID)).thenReturn(null);
        EnrichedVote vote = new EnrichedVote()
                .setEnrichedId(ENRICHED_ID)
                .setUserId(USER_ID)
                .setVoteType(VoteType.DOWN);
        when(voteRepo.findByEnrichedIdAndUserId(ENRICHED_ID, USER_ID))
                .thenReturn(Optional.of(vote));

        VoteType result = voteService.getUserVote(ENRICHED_ID, USER_ID);

        assertEquals(VoteType.DOWN, result);
    }

    // ===== 辅助方法 =====

    private EnrichedSolution buildSolution(float score, int upvotes, int downvotes) {
        return new EnrichedSolution()
                .setId(ENRICHED_ID)
                .setProblemId("problem-1")
                .setLevel(3)
                .setQualityScore(score)
                .setUpvoteCount(upvotes)
                .setDownvoteCount(downvotes)
                .setSourceType(SourceType.AI_ORIGINAL)
                .setTitle("测试解析")
                .setStatus(EnrichedStatus.PUBLISHED);
    }
}
