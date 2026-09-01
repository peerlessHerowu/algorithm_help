package com.algorithm.help.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;

/**
 * 用户输入结构化请求 DTO
 */
@Data
@Accessors(chain = true)
public class StructurizeRequest implements Serializable {

    /** 用户原始输入文本 */
    @NotBlank
    private String rawInput;

    /** 关联题目ID */
    private Long problemId;

    /** 关联题目标题（上下文） */
    private String problemTitle;

    /** 关联题目描述（上下文） */
    private String problemDescription;
}
