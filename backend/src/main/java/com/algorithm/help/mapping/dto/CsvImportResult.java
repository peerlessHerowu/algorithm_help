package com.algorithm.help.mapping.dto;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.ArrayList;
import java.util.List;

/**
 * CSV 导入结果报告
 */
@Data
@Accessors(chain = true)
public class CsvImportResult {

    /** 总行数（不含 header） */
    private int totalRows;

    /** 成功导入数 */
    private int successCount;

    /** 错误行数 */
    private int errorCount;

    /** 错误详情列表 */
    private List<String> errors = new ArrayList<>();
}
