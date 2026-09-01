package com.algorithm.help.content.enrichment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * 投票记录数据访问层
 */
public interface EnrichedVoteRepository extends JpaRepository<EnrichedVote, Long> {

    /** 查询用户对某条解析的投票记录 */
    Optional<EnrichedVote> findByEnrichedIdAndUserId(String enrichedId, String userId);

    /** 统计某条解析的点赞数 */
    long countByEnrichedIdAndVoteType(String enrichedId, VoteType voteType);

    /** 删除用户对某条解析的投票 */
    void deleteByEnrichedIdAndUserId(String enrichedId, String userId);
}
