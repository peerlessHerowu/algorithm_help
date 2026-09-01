package com.algorithm.help.content.enrichment.dto;

import com.algorithm.help.content.enrichment.EnrichedStatus;
import com.algorithm.help.content.enrichment.SourceType;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 列表摘要 DTO（不含 content 和 codeImplementations 完整内容）
 */
@Data
@Accessors(chain = true)
public class EnrichedSummaryDTO {

    private String id;
    private String problemId;
    private Integer level;
    private SourceType sourceType;
    private String sourceAuthor;
    private Integer sourceVotes;
    private String title;
    private String summary;
    private String tags;
    private String timeComplexity;
    private String spaceComplexity;
    private Float qualityScore;
    private Integer version;
    private Boolean recommended;
    private EnrichedStatus status;
    private Integer upvoteCount;
    private Integer downvoteCount;
    private Integer viewCount;
    private Long createdAt;
    private Long updatedAt;
}
