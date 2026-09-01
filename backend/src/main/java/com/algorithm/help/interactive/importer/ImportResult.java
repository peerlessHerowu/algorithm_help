package com.algorithm.help.interactive.importer;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * URL 导入结果模型
 */
@Data
@Accessors(chain = true)
public class ImportResult {

    private String sourceUrl;
    private String rawContent;
    private String refinedContent;
    private String reviewResult;
    private boolean success;
    private String error;
}
