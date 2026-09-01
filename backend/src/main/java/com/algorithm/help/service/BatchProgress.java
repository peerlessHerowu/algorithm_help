package com.algorithm.help.service;

import lombok.Data;
import java.util.ArrayList;
import java.util.List;

/**
 * 批量生成进度模型
 */
@Data
public class BatchProgress {
    private int total;
    private int completed;
    private int failed;
    private List<String> failures = new ArrayList<>();

    public BatchProgress() {}
    public BatchProgress(int total) { this.total = total; }
}
