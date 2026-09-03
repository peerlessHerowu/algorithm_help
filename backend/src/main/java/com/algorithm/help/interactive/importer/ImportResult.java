package com.algorithm.help.interactive.importer;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * URL 内容导入结果
 */
@Data
@Accessors(chain = true)
public class ImportResult {
    /** 原始 URL */
    private String sourceUrl;
    /** 提取到的页面标题 */
    private String title;
    /** 原始正文 */
    private String rawContent;
    /** AI 审查结果（JSON 字符串） */
    private String reviewResult;
    /** AI 精炼后的内容（Markdown） */
    private String refinedContent;
    /** 是否成功 */
    private boolean success;
    /** 错误信息 */
    private String error;
}
