package com.algorithm.help.paper.dto;

import com.algorithm.help.paper.enums.FrontierDomain;
import com.algorithm.help.paper.model.BridgeStep;
import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;
import java.util.Map;

/**
 * 论文桥梁 DTO，支持分级解读查询
 */
@Data
@Accessors(chain = true)
public class PaperBridgeDTO {

    private String id;
    private String baseAlgorithm;
    private String paperTitle;
    private String paperAuthors;
    private Integer paperYear;
    private String paperUrl;
    private FrontierDomain domain;
    private List<BridgeStep> bridgePath;
    private Map<Integer, String> leveledInterpretation;
    private String experimentType;
    private String experimentUrl;
    private Long createdAt;

    /** 请求的解读级别 */
    private Integer requestedLevel;

    /** 指定级别对应的解读内容 */
    private String selectedInterpretation;

    /** 响应状态："available" 或 "coming_soon" */
    private String status;

    /** 各级别是否可用 */
    private Boolean l3Available;
    private Boolean l4Available;
    private Boolean l5Available;

    /** 当 status=coming_soon 时的提示信息 */
    private String message;
}
