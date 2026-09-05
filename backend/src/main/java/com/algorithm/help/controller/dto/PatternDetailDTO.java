package com.algorithm.help.controller.dto;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * 算法模式完整详情 DTO
 * <p>
 * 用于 /patterns/[id]/detail 端点，包含演进路径信息
 */
@Data
@Accessors(chain = true)
public class PatternDetailDTO {

    /** 模式 ID（不含 pattern: 前缀） */
    private String id;

    /** 模式名称 */
    private String name;

    /** 分类（如：动态规划、图论、数据结构） */
    private String category;

    /** 多语言模板代码（JSON 字符串，如 {"python": "...", "java": "..."}） */
    private String template;

    /** 识别信号列表（JSON 字符串，如 ["有序数组", "目标值查找"]） */
    private String signals;

    /** 变体列表（JSON 字符串） */
    private String variants;

    /** 关联题目 ID 列表（JSON 字符串） */
    private String relatedProblems;

    /** 前置知识模式（需要先掌握这些才能学该模式） */
    private List<RelatedPatternDTO> prerequisites;

    /** 进阶路径（掌握该模式后推荐学习的下一步） */
    private List<RelatedPatternDTO> followUps;

    /** 困难版本（该模式的进阶变体） */
    private List<RelatedPatternDTO> harderVersions;

    /** 相似模式（同类别的相关模式） */
    private List<RelatedPatternDTO> similarPatterns;

    /**
     * 关联模式简要信息
     */
    @Data
    @Accessors(chain = true)
    public static class RelatedPatternDTO {
        /** 模式 ID（不含 pattern: 前缀） */
        private String id;
        /** 模式名称 */
        private String name;
        /** 分类 */
        private String category;
    }
}
