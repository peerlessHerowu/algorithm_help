package com.algorithm.help.paper.model;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 论文桥梁路径步骤（嵌入对象，存储在 JSON 列中）
 */
@Data
@Accessors(chain = true)
public class BridgeStep {

    /** 步骤顺序号 */
    private Integer order;

    /** 步骤标题 */
    private String title;

    /** 步骤描述 */
    private String description;

    /** 与下一步的衔接说明 */
    private String connectionToNext;
}
