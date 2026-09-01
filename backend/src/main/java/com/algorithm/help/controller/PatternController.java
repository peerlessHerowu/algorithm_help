package com.algorithm.help.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.controller.dto.PatternDTO;
import com.algorithm.help.entity.AlgorithmPattern;
import com.algorithm.help.service.PatternService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 算法模式 API 控制器
 */
@RestController
@RequestMapping("/api/v1/patterns")
public class PatternController {

    private final PatternService patternService;

    public PatternController(PatternService patternService) {
        this.patternService = patternService;
    }

    /**
     * 获取所有算法模式列表
     */
    @GetMapping
    public ApiResponse<List<PatternDTO>> listPatterns() {
        List<PatternDTO> patterns = patternService.listPatterns().stream()
            .map(this::toDTO)
            .toList();
        return ApiResponse.success(patterns);
    }

    /**
     * 获取模式详情
     */
    @GetMapping("/{id}")
    public ApiResponse<PatternDTO> getPattern(@PathVariable String id) {
        AlgorithmPattern pattern = patternService.getById(id);
        return ApiResponse.success(toDTO(pattern));
    }

    private PatternDTO toDTO(AlgorithmPattern p) {
        return new PatternDTO()
            .setId(p.getId())
            .setName(p.getName())
            .setCategory(p.getCategory())
            .setTemplate(p.getTemplate())
            .setSignals(p.getSignals())
            .setVariants(p.getVariants())
            .setRelatedProblems(p.getRelatedProblems());
    }
}
