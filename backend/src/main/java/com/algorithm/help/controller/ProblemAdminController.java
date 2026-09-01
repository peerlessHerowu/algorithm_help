package com.algorithm.help.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.controller.dto.BatchImportRequest;
import com.algorithm.help.controller.dto.BatchImportResult;
import com.algorithm.help.controller.dto.CreateProblemRequest;
import com.algorithm.help.controller.dto.ProblemDTO;
import com.algorithm.help.controller.dto.UpdateProblemRequest;
import com.algorithm.help.entity.Problem;
import com.algorithm.help.service.ProblemAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/**
 * 题目管理 API（Admin）
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin/problems")
@RequiredArgsConstructor
public class ProblemAdminController {

    private final ProblemAdminService adminService;

    /**
     * 创建题目
     */
    @PostMapping
    public ApiResponse<ProblemDTO> create(@Valid @RequestBody CreateProblemRequest request) {
        Problem problem = adminService.createProblem(request);
        return ApiResponse.success(toDTO(problem));
    }

    /**
     * 编辑题目（部分更新）
     */
    @PutMapping("/{id}")
    public ApiResponse<ProblemDTO> update(@PathVariable String id,
                                          @Valid @RequestBody UpdateProblemRequest request) {
        Problem problem = adminService.updateProblem(id, request);
        return ApiResponse.success(toDTO(problem));
    }

    /**
     * 删除题目
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        adminService.deleteProblem(id);
        return ApiResponse.success();
    }

    /**
     * 批量导入题目
     */
    @PostMapping("/batch-import")
    public ApiResponse<BatchImportResult> batchImport(@Valid @RequestBody BatchImportRequest request) {
        BatchImportResult result = adminService.batchImport(request.getProblems(), request.getMode());
        return ApiResponse.success(result);
    }

    private ProblemDTO toDTO(Problem p) {
        return new ProblemDTO()
                .setId(p.getId())
                .setTitle(p.getTitle())
                .setDifficulty(p.getDifficulty())
                .setTags(p.getTags())
                .setDescription(p.getDescription())
                .setConstraints(p.getConstraints())
                .setExamples(p.getExamples())
                .setCompanyTags(p.getCompanyTags())
                .setCreatedAt(p.getCreatedAt())
                .setUpdatedAt(p.getUpdatedAt());
    }
}
