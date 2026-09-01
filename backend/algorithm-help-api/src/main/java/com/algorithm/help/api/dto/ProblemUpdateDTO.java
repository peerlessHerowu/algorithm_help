package com.algorithm.help.api.dto;

import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;
import java.util.List;

/**
 * 题目更新 DTO（部分更新，字段为 null 表示不更新）
 */
@Data
@Accessors(chain = true)
public class ProblemUpdateDTO implements Serializable {

    private String title;

    private String description;

    private String difficulty;

    private List<String> tags;

    private String constraints;

    private String examples;

    private String platformUrl;
}
