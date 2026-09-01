package com.algorithm.help.export.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 导出结果 DTO
 */
@Data
@Accessors(chain = true)
public class ExportResult {

    /** 导出文件名 */
    private String fileName;

    /** 文件二进制数据 */
    private byte[] fileData;

    /** MIME 类型 */
    private String contentType;

    /** 文件大小（字节） */
    private long fileSizeBytes;
}
