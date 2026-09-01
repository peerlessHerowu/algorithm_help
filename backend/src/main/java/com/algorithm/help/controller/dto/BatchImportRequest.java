package com.algorithm.help.controller.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * 批量导入题目请求 DTO
 */
@Data
@Accessors(chain = true)
public class BatchImportRequest {

    @NotEmpty(message = "题目列表不能为空")
    @Size(max = 100, message = "单次最多导入 100 条")
    @Valid
    private List<CreateProblemRequest> problems;

    /** 导入模式：skip-跳过已存在 / update-覆盖已存在 */
    @Pattern(regexp = "^(skip|update)$", message = "mode 只能是 skip 或 update")
    private String mode = "skip";
}
