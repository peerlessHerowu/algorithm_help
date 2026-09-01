package com.algorithm.help.content.enrichment.dto;

import com.algorithm.help.content.enrichment.EnrichedStatus;
import com.algorithm.help.content.enrichment.SourceType;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 详情 DTO（含完整 content、codeImplementations、timeComplexity、spaceComplexity）
 */
@Data
@Accessors(chain = true)
public class EnrichedDetailDTO {

    private String id;
    private String problemId;
    private Integer level;
    private SourceType sourceType;
    private String sourceAuthor;
    private String sourceUrl;
    private Integer sourceVotes;
    private String title;
    private String summary;
    private String content;
    private String codeImplementations;
    private String tags;
    private String timeComplexity;
    private String spaceComplexity;
    private String aiProvider;
    private String processingSteps;
    private Float qualityScore;
    private Integer version;
    private Boolean recommended;
    private EnrichedStatus status;
    private Integer upvoteCount;
    private Integer downvoteCount;
    private Integer viewCount;
    private Integer feedbackCount;
    private Long createdAt;
    private Long updatedAt;
}
