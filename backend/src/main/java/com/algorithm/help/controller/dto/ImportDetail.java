package com.algorithm.help.controller.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 单条导入失败详情
 */
@Data
@Accessors(chain = true)
public class ImportDetail {

    /** 在原始数组中的下标 */
    private int index;

    /** 失败原因 */
    private String error;
}
