package com.algorithm.help.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.content.dto.SolutionDTO;
import com.algorithm.help.controller.dto.ProblemDTO;
import com.algorithm.help.entity.Problem;
import com.algorithm.help.internal.entity.UserSolution;
import com.algorithm.help.internal.repository.UserSolutionRepository;
import com.algorithm.help.repository.ProblemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * 全文搜索 REST API
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/search")
public class SearchController {

    private final ProblemRepository problemRepo;
    private final UserSolutionRepository solutionRepo;

    /**
     * 全文搜索端点
     * @param keyword 搜索关键词
     * @param scope 搜索范围：problems / solutions / all
     */
    @GetMapping
    public ApiResponse<Map<String, Object>> search(
            @RequestParam String keyword,
            @RequestParam(defaultValue = "all") String scope,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Map<String, Object> result = new HashMap<>();
        PageRequest pageable = PageRequest.of(page, size);

        if ("problems".equalsIgnoreCase(scope) || "all".equalsIgnoreCase(scope)) {
            Page<ProblemDTO> problems = searchProblems(keyword, pageable);
            result.put("problems", problems);
        }

        if ("solutions".equalsIgnoreCase(scope) || "all".equalsIgnoreCase(scope)) {
            Page<SolutionDTO> solutions = searchSolutions(keyword, pageable);
            result.put("solutions", solutions);
        }

        return ApiResponse.success(result);
    }

    // ======================== 私有方法 ========================

    private Page<ProblemDTO> searchProblems(String keyword, PageRequest pageable) {
        Page<Problem> problems = problemRepo.fulltextSearch(keyword, pageable);
        return problems.map(this::toProblemDTO);
    }

    private Page<SolutionDTO> searchSolutions(String keyword, PageRequest pageable) {
        Page<UserSolution> solutions = solutionRepo.searchByKeyword(keyword, pageable);
        return solutions.map(this::toSolutionDTO);
    }

    private ProblemDTO toProblemDTO(Problem p) {
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

    private SolutionDTO toSolutionDTO(UserSolution entity) {
        return new SolutionDTO()
                .setId(entity.getId())
                .setProblemId(entity.getProblemId())
                .setTitle(entity.getTitle())
                .setContent(entity.getContent())
                .setLanguage(entity.getLanguage())
                .setSourceType(entity.getSourceType())
                .setStatus(entity.getStatus())
                .setAuthorName(entity.getAuthorName())
                .setUpvotes(entity.getUpvotes())
                .setViewCount(entity.getViewCount())
                .setUserId(entity.getUserId())
                .setCreatedAt(entity.getCreatedAt())
                .setUpdatedAt(entity.getUpdatedAt());
    }
}
