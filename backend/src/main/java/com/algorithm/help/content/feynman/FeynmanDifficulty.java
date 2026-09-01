package com.algorithm.help.content.feynman;

import java.util.List;

/**
 * 反向费曼题目难度等级
 * <p>
 * 每个难度级别对应特定的错误类型范围：
 * EASY = LOGIC + NUMERIC
 * MEDIUM = BOUNDARY + COMPLEXITY
 * HARD = CONCEPT
 */
public enum FeynmanDifficulty {

    EASY("简单", List.of(FeynmanErrorType.LOGIC, FeynmanErrorType.NUMERIC)),
    MEDIUM("中等", List.of(FeynmanErrorType.BOUNDARY, FeynmanErrorType.COMPLEXITY)),
    HARD("困难", List.of(FeynmanErrorType.CONCEPT));

    private final String displayName;
    private final List<FeynmanErrorType> allowedErrorTypes;

    FeynmanDifficulty(String displayName, List<FeynmanErrorType> allowedErrorTypes) {
        this.displayName = displayName;
        this.allowedErrorTypes = allowedErrorTypes;
    }

    public String getDisplayName() {
        return displayName;
    }

    public List<FeynmanErrorType> getAllowedErrorTypes() {
        return allowedErrorTypes;
    }
}
