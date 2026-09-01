package com.algorithm.help.controller.dto;

import com.algorithm.help.content.dto.SolutionDTO;
import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * 题目详情聚合 DTO
 */
@Data
@Accessors(chain = true)
public class ProblemDetailDTO {

    /** 题目基本信息 */
    private ProblemDTO problem;

    /** 题解总数 */
    private long solutionCount;

    /** 评论总数 */
    private long commentCount;

    /** 热门题解（前 3 条） */
    private List<SolutionDTO> topSolutions;
}
