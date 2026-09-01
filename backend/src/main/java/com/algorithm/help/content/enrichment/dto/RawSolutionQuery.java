package com.algorithm.help.content.enrichment.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 原始题解查询参数
 */
@Data
@Accessors(chain = true)
public class RawSolutionQuery {

    /** 排序方式：votes（默认） / time */
    private String sort = "votes";

    /** 语言筛选（可选） */
    private String language;

    /** 页码（从 0 开始） */
    private int page = 0;

    /** 每页条数（默认 10，最大 50） */
    private int size = 10;

    public int getSize() {
        return Math.min(size, 50);
    }
}
