package com.algorithm.help.export;

import com.algorithm.help.export.dto.ExportOptions;
import com.algorithm.help.export.dto.ExportResult;
import com.algorithm.help.export.dto.ExportableContent;

import java.util.List;

/**
 * 导出器接口，不同格式实现此接口
 */
public interface Exporter {

    /**
     * 将内容导出为指定格式
     *
     * @param contents 待导出内容列表
     * @param options  导出选项
     * @return 导出结果（文件数据）
     */
    ExportResult export(List<ExportableContent> contents, ExportOptions options);
}
