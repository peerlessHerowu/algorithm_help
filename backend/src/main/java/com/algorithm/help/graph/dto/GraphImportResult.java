package com.algorithm.help.graph.dto;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * 图谱批量导入结果
 */
@Data
@Accessors(chain = true)
public class GraphImportResult {

    /** 成功导入的节点数 */
    private int nodesImported;

    /** 成功导入的边数 */
    private int edgesImported;

    /** 因校验失败跳过的边数 */
    private int errorsSkipped;

    /** 跳过的边的错误详情 */
    private List<String> errorDetails;
}
