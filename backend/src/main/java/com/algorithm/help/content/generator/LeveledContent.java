package com.algorithm.help.content.generator;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * 分层内容模型：AI 生成的算法讲解内容，按 level 分层
 * <p>
 * L1-L2 以 sections 为主（概念性讲解），
 * L3-L5 以 approaches 为主（具体解法），
 * L5 额外包含 references（论文/延伸阅读）。
 */
@Data
@Accessors(chain = true)
public class LeveledContent {

    /** 内容层级：1-5 */
    private int level;

    /** 标题 */
    private String title;

    /** AI 返回的原始 JSON 字符串 */
    private String rawJson;

    /** 概念性讲解段落（L1-L2 使用） */
    private List<Section> sections;

    /** 解法列表（L3-L5 使用） */
    private List<Approach> approaches;

    /** 证明/推导（可选，L4-L5 使用） */
    private Object proofs;

    /** 参考资料（L5 使用） */
    private List<Reference> references;

    /** 是否解析成功；false 表示需人工处理 */
    private boolean parseSuccess;

    /**
     * 内容段落（L1-L2）
     */
    @Data
    @Accessors(chain = true)
    public static class Section {
        private String heading;
        private String content;
        private String contentType;
    }

    /**
     * 解法详情（L3-L5）
     */
    @Data
    @Accessors(chain = true)
    public static class Approach {
        private String name;
        private String idea;
        private String timeComplexity;
        private String spaceComplexity;
        private String code;
        private List<String> steps;
    }

    /**
     * 参考资料（L5）
     */
    @Data
    @Accessors(chain = true)
    public static class Reference {
        private String authors;
        private String title;
        private String year;
        private String venue;
        private String relevance;
    }
}
