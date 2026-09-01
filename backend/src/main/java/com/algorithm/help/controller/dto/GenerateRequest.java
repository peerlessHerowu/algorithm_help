package com.algorithm.help.controller.dto;

import lombok.Data;

import java.util.List;

/**
 * 内容生成请求 DTO
 */
@Data
public class GenerateRequest {
    private int level = 3;
    private List<String> languages = List.of("python", "java");
    private boolean includeSteps = true;
    private boolean includeDiagrams = true;
}
