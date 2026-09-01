package com.algorithm.help.content.quality;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.ArrayList;
import java.util.List;

/**
 * 质量校验报告
 */
@Data
@Accessors(chain = true)
public class ValidationReport {

    /** 校验问题列表 */
    private List<ValidationIssue> issues = new ArrayList<>();

    /**
     * 是否通过：没有 error 级别的问题即为通过
     */
    public boolean isPassed() {
        return issues.stream()
                .noneMatch(i -> "error".equals(i.getSeverity()));
    }

    /**
     * 是否存在警告
     */
    public boolean hasWarnings() {
        return issues.stream()
                .anyMatch(i -> "warning".equals(i.getSeverity()));
    }

    /**
     * 添加问题
     */
    public void addIssue(ValidationIssue issue) {
        issues.add(issue);
    }
}
