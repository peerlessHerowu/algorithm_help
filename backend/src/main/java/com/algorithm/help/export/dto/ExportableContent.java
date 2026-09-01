package com.algorithm.help.export.dto;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.Map;

/**
 * 可导出内容 DTO，封装单个题目的完整解析信息
 */
@Data
@Accessors(chain = true)
public class ExportableContent {

    /** 题目 ID */
    private String problemId;

    /** 题目名称 */
    private String problemName;

    /** 题目描述 */
    private String description;

    /** 解题思路 */
    private String approach;

    /** 代码实现（language -> code） */
    private Map<String, String> code;

    /** 时间/空间复杂度说明 */
    private String complexity;

    /** Mermaid 图解源码 */
    private String diagramMermaid;

    /** 所属模式名称 */
    private String patternName;

    /** 难度等级（1-5） */
    private Integer difficulty;
}
