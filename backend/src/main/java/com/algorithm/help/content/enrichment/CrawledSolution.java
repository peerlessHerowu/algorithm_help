package com.algorithm.help.content.enrichment;

import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 爬取的社区原始题解实体
 * 对应 crawled_solutions 表（由 Python 爬虫服务写入）
 */
@Entity
@Table(name = "crawled_solutions")
@Data
@Accessors(chain = true)
public class CrawledSolution {

    @Id
    private String id;

    @Column(name = "problem_id", nullable = false)
    private String problemId;

    @Column(name = "topic_id")
    private String topicId;

    private String title;

    @Column(columnDefinition = "mediumtext")
    private String content;

    private String author;

    @Column(name = "vote_count")
    private Integer voteCount;

    @Column(name = "view_count")
    private Integer viewCount;

    @Column(name = "comment_count")
    private Integer commentCount;

    /** 来源平台 */
    private String source;

    @Column(name = "created_at")
    private Long createdAt;

    @Column(name = "fetched_at")
    private Long fetchedAt;
}
