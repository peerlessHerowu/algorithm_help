package com.algorithm.help.archaeology.controller;

import com.algorithm.help.archaeology.entity.AlgorithmArchaeology;
import com.algorithm.help.archaeology.service.ArchaeologyService;
import com.algorithm.help.common.ApiResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 算法考古 API 控制器
 * <p>
 * 提供算法发明故事的查询接口，含时间线信息
 */
@RestController
@RequestMapping("/api/archaeology")
public class ArchaeologyController {

    private final ArchaeologyService archaeologyService;

    public ArchaeologyController(ArchaeologyService archaeologyService) {
        this.archaeologyService = archaeologyService;
    }

    /**
     * 获取算法发明故事详情（含时间线）
     */
    @GetMapping("/{algorithmId}")
    public ApiResponse<AlgorithmArchaeology> getById(@PathVariable String algorithmId) {
        AlgorithmArchaeology archaeology = archaeologyService.getById(algorithmId);
        return ApiResponse.success(archaeology);
    }

    /**
     * 分页获取所有算法故事列表
     */
    @GetMapping("/list")
    public ApiResponse<Page<AlgorithmArchaeology>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<AlgorithmArchaeology> result = archaeologyService.getAll(pageable);
        return ApiResponse.success(result);
    }

    /**
     * 根据算法模式 ID 查询关联的考古记录
     */
    @GetMapping("/by-pattern/{patternId}")
    public ApiResponse<List<AlgorithmArchaeology>> getByPatternId(
            @PathVariable String patternId) {
        List<AlgorithmArchaeology> list = archaeologyService.getByPatternId(patternId);
        return ApiResponse.success(list);
    }
}
