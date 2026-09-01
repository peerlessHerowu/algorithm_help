package com.algorithm.help.content.comparator;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * 解法对比结果模型
 */
@Data
@Accessors(chain = true)
public class ComparisonResult {

    /** 演进关系 Mermaid 代码 */
    private String evolutionMermaid;

    /** 多维对比矩阵 */
    private List<ComparisonRow> matrix;

    /** 底层共同框架描述 */
    private String commonFramework;

    /** 迁移路径建议 */
    private String transferPath;
}
