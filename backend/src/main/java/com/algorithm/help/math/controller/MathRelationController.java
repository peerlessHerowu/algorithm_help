package com.algorithm.help.math.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.math.dto.MathRelationDTO;
import com.algorithm.help.math.service.MathRelationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 数学关联 API 控制器
 * <p>
 * 提供算法模式与数学基础知识的关联查询接口
 */
@RestController
@RequestMapping("/api/math-relation")
@RequiredArgsConstructor
public class MathRelationController {

    private final MathRelationService mathRelationService;

    /**
     * 查询算法模式的数学基础关联
     *
     * @param patternId 算法模式节点 ID
     * @param level     数学知识分级（可选，1-5）
     * @return 数学关联节点列表（含权威引用和可视化类型建议）
     */
    @GetMapping("/{patternId}")
    public ApiResponse<List<MathRelationDTO>> getMathRelations(
            @PathVariable String patternId,
            @RequestParam(required = false) Integer level) {
        List<MathRelationDTO> relations = mathRelationService.getMathRelations(patternId, level);
        return ApiResponse.success(relations);
    }
}
