package com.algorithm.help.content.enrichment.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.content.enrichment.UnifiedExplanationService;
import com.algorithm.help.content.enrichment.dto.PageResult;
import com.algorithm.help.content.enrichment.dto.RawSolutionDTO;
import com.algorithm.help.content.enrichment.dto.RawSolutionQuery;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/**
 * 原始题解 API
 * <p>
 * 分页 + 排序 + 语言筛选 + hasEnriched 标记
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/raw-solutions")
@RequiredArgsConstructor
public class RawSolutionController {

    private final UnifiedExplanationService unifiedService;

    /**
     * 原始题解列表
     *
     * @param sort     排序方式：votes（默认）/ time
     * @param language 语言筛选（可选）
     * @param page     页码（从 0 开始）
     * @param size     每页条数（默认 10，最大 50）
     */
    @GetMapping("/{problemId}")
    public ApiResponse<PageResult<RawSolutionDTO>> list(
            @PathVariable String problemId,
            @RequestParam(defaultValue = "votes") String sort,
            @RequestParam(required = false) String language,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        RawSolutionQuery query = new RawSolutionQuery()
                .setSort(sort)
                .setLanguage(language)
                .setPage(page)
                .setSize(size);

        PageResult<RawSolutionDTO> result = unifiedService.getRawSolutions(problemId, query);
        return ApiResponse.success(result);
    }
}
