package com.algorithm.help.content.enrichment.dto;

import com.algorithm.help.content.enrichment.VoteType;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 投票操作结果
 */
@Data
@Accessors(chain = true)
public class VoteResult {

    /** 当前投票状态（UP/DOWN/null 表示无投票） */
    private VoteType currentVote;

    /** 当前点赞数 */
    private Integer upvoteCount;

    /** 当前踩数 */
    private Integer downvoteCount;

    /** 调整后的 quality_score */
    private Float qualityScore;
}
