package com.algorithm.help.controller.dto;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * 批量导入结果 DTO
 */
@Data
@Accessors(chain = true)
public class BatchImportResult {

    private int success;

    private int failed;

    private List<ImportDetail> details;
}
