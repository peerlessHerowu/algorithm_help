package com.algorithm.help.entity;

import lombok.Data;

/**
 * 解法详情（作为 Explanation.sections JSON 的内嵌结构，非独立表）
 */
@Data
public class Approach {
    private String name;
    private String idea;
    private String code;
    private String timeComplexity;
    private String spaceComplexity;
    private String whyThisWorks;
    private String whenToUse;
    private String limitations;
}
