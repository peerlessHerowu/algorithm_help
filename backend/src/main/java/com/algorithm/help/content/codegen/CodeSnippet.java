package com.algorithm.help.content.codegen;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 代码片段模型：某种语言生成的算法实现代码
 */
@Data
@Accessors(chain = true)
public class CodeSnippet {

    /** 编程语言：python, java, go, cpp */
    private String language;

    /** 生成的代码内容 */
    private String code;

    /** 代码中是否包含注释 */
    private boolean hasComments;
}
