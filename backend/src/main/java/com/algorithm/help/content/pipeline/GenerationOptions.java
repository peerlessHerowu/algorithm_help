package com.algorithm.help.content.pipeline;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 内容生成选项
 */
@Data
@Accessors(chain = true)
public class GenerationOptions {

    /** 是否跳过代码生成 */
    private boolean skipCodeGen = false;

    /** 是否跳过图解生成 */
    private boolean skipDiagram = false;

    /** 是否跳过对比分析 */
    private boolean skipComparison = false;

    /** 是否强制重新生成（忽略缓存） */
    private boolean forceRegenerate = false;
}
