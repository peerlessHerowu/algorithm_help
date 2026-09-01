package com.algorithm.help.ai.model;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * 内容生成选项
 */
@Data
@Accessors(chain = true)
public class GenerateOptions {
    private int level = 3;
    private List<String> languages = List.of("python", "java");
    private boolean includeSteps = true;
    private boolean includeDiagrams = true;
    private boolean includeApplications = false;
}
