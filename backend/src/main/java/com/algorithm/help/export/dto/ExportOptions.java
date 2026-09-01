package com.algorithm.help.export.dto;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * 导出选项配置
 */
@Data
@Accessors(chain = true)
public class ExportOptions {

    /** 是否包含代码 */
    private boolean includeCode = true;

    /** 是否包含图解 */
    private boolean includeDiagrams = true;

    /** 是否包含实际应用映射 */
    private boolean includeApplications = false;

    /** 导出代码语言列表 */
    private List<String> languages = List.of("python", "java");

    /** 导出内容级别（L1-L5） */
    private Integer level = 3;
}
