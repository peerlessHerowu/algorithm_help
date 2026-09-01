package com.algorithm.help.application.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 应用映射领域枚举
 */
@Getter
@AllArgsConstructor
public enum ApplicationDomain {

    INDUSTRY("工业应用"),
    AI_ML("AI/ML 前沿"),
    WORK("工作映射"),
    LIFE("人生哲学");

    private final String description;
}
