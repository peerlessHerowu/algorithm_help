package com.algorithm.help.content.pipeline;

import com.algorithm.help.content.quality.ValidationReport;
import com.algorithm.help.entity.Explanation;
import com.algorithm.help.entity.ExplanationStatus;
import lombok.Data;
import lombok.experimental.Accessors;

import java.util.ArrayList;
import java.util.List;

/**
 * 内容生成流水线结果
 */
@Data
@Accessors(chain = true)
public class GenerationResult {

    /** 持久化后的解析实体 */
    private Explanation explanation;

    /** 质量校验报告 */
    private ValidationReport report;

    /** 最终状态 */
    private ExplanationStatus status;

    /** 生成耗时（毫秒） */
    private long duration;

    /** 降级步骤记录 */
    private List<String> warnings = new ArrayList<>();
}
