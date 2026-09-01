package com.algorithm.help.api.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;
import java.util.List;

/**
 * 多源题解聚合请求 DTO
 */
@Data
@Accessors(chain = true)
public class AggregateRequest implements Serializable {

    /** 题目ID */
    @NotNull
    private Long problemId;

    /** 题目标题 */
    private String problemTitle;

    /** 题目描述 */
    private String problemDescription;

    /** 多源题解内容列表 */
    @NotNull
    private List<SolutionSource> sources;

    /**
     * 单个题解来源
     */
    @Data
    @Accessors(chain = true)
    public static class SolutionSource implements Serializable {

        /** 来源标识（平台名或用户名） */
        private String sourceLabel;

        /** 题解内容 */
        private String content;

        /** 代码实现 */
        private String code;

        /** 代码语言 */
        private String codeLanguage;

        /** 点赞数（权重参考） */
        private Integer upvotes;
    }
}
