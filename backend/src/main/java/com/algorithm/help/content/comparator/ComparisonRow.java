package com.algorithm.help.content.comparator;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 多维对比矩阵行：记录单个解法的各维度信息
 */
@Data
@Accessors(chain = true)
public class ComparisonRow {

    /** 解法名称 */
    private String approachName;

    /** 时间复杂度 */
    private String timeComplexity;

    /** 空间复杂度 */
    private String spaceComplexity;

    /** 优点 */
    private String pros;

    /** 缺点 */
    private String cons;

    /** 最佳适用场景 */
    private String bestFor;
}
