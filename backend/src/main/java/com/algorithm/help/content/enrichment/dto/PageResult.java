package com.algorithm.help.content.enrichment.dto;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * 通用分页结果
 */
@Data
@Accessors(chain = true)
public class PageResult<T> {

    private List<T> items;
    private long total;
    private int page;
    private int size;

    public static <T> PageResult<T> of(List<T> items, long total, int page, int size) {
        return new PageResult<T>()
                .setItems(items)
                .setTotal(total)
                .setPage(page)
                .setSize(size);
    }
}
