package com.algorithm.help.controller;

import com.algorithm.help.ai.model.GenerateOptions;
import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.common.enums.Difficulty;
import com.algorithm.help.content.CommentRepository;
import com.algorithm.help.content.dto.SolutionDTO;
import com.algorithm.help.controller.dto.*;
import com.algorithm.help.entity.Explanation;
import com.algorithm.help.entity.Problem;
import com.algorithm.help.internal.entity.UserSolution;
import com.algorithm.help.internal.repository.UserSolutionRepository;
import com.algorithm.help.repository.ExplanationRepository;
import com.algorithm.help.service.BatchProgress;
import com.algorithm.help.service.ContentGenerationService;
import com.algorithm.help.service.ProblemService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 题目相关 API 控制器
 */
@Slf4j
@RestController
@RequestMapping("/api/v1")
public class ProblemController {

    private final ProblemService problemService;
    private final ContentGenerationService generationService;
    private final ExplanationRepository explanationRepo;
    private final UserSolutionRepository solutionRepo;
    private final CommentRepository commentRepo;

    public ProblemController(ProblemService problemService,
                             ContentGenerationService generationService,
                             ExplanationRepository explanationRepo,
                             UserSolutionRepository solutionRepo,
                             CommentRepository commentRepo) {
        this.problemService = problemService;
        this.generationService = generationService;
        this.explanationRepo = explanationRepo;
        this.solutionRepo = solutionRepo;
        this.commentRepo = commentRepo;
    }

    /**
     * 分页查询题目列表，支持 difficulty / keyword / tag / company 筛选
     */
    @GetMapping("/problems")
    public ApiResponse<Page<ProblemDTO>> listProblems(
            @RequestParam(required = false) Difficulty difficulty,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) String company,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<Problem> problems = problemService.listProblems(
            difficulty, keyword, PageRequest.of(page, size));
        return ApiResponse.success(problems.map(this::toDTO));
    }

    /**
     * 获取题目详情
     */
    @GetMapping("/problems/{id}")
    public ApiResponse<ProblemDTO> getProblem(@PathVariable String id) {
        Problem problem = problemService.getById(id);
        return ApiResponse.success(toDTO(problem));
    }

    /**
     * 获取题目解析内容
     */
    @GetMapping("/problems/{id}/explanation")
    public ApiResponse<ExplanationDTO> getExplanation(
            @PathVariable String id,
            @RequestParam(defaultValue = "3") int level) {
        Optional<Explanation> explanation = explanationRepo
            .findByProblemIdAndLevelAndIsLatestTrue(id, level);
        return explanation.map(e -> ApiResponse.success(toExplanationDTO(e)))
            .orElseGet(ApiResponse::success);
    }

    /**
     * 触发题目内容生成
     */
    @PostMapping("/problems/{id}/generate")
    public ApiResponse<TaskStatusDTO> generate(
            @PathVariable String id,
            @RequestBody(required = false) GenerateRequest request) {
        // 幂等检查
        int level = request != null ? request.getLevel() : 3;
        Optional<String> activeTask = generationService.findActiveTask(id, level);
        if (activeTask.isPresent()) {
            return ApiResponse.success(buildTaskStatus(activeTask.get(), "RUNNING"));
        }

        GenerateOptions options = buildOptions(request);
        String taskId = UUID.randomUUID().toString();
        generationService.batchGenerate(taskId, List.of(id), options);
        return ApiResponse.success(buildTaskStatus(taskId, "STARTED"));
    }

    /**
     * 获取关联题目列表（占位实现）
     */
    @GetMapping("/problems/{id}/related")
    public ApiResponse<List<RelatedProblemDTO>> getRelated(@PathVariable String id) {
        // 确保题目存在
        problemService.getById(id);
        return ApiResponse.success(Collections.emptyList());
    }

    /**
     * 题目详情聚合端点（题目信息 + 题解数量 + 评论数量 + 热门题解）
     */
    @GetMapping("/problems/{id}/detail")
    public ApiResponse<ProblemDetailDTO> getDetail(@PathVariable String id) {
        Problem problem = problemService.getById(id);
        long solutionCount = solutionRepo.countByProblemIdAndDeletedFalse(id);
        long commentCount = commentRepo.countByTargetTypeAndTargetIdAndDeletedFalse("USER_SOLUTION", id);

        // 获取前 3 条热门题解（按点赞数排序）
        PageRequest top3 = PageRequest.of(0, 3, Sort.by(Sort.Direction.DESC, "upvotes"));
        Page<UserSolution> topPage = solutionRepo.findByProblemIdAndDeletedFalse(id, top3);
        List<SolutionDTO> topSolutions = topPage.getContent().stream()
                .map(this::toSolutionDTO)
                .toList();

        ProblemDetailDTO detail = new ProblemDetailDTO()
                .setProblem(toDTO(problem))
                .setSolutionCount(solutionCount)
                .setCommentCount(commentCount)
                .setTopSolutions(topSolutions);
        return ApiResponse.success(detail);
    }

    /**
     * 查询任务执行状态
     */
    @GetMapping("/tasks/{taskId}/status")
    public ApiResponse<TaskStatusDTO> getTaskStatus(@PathVariable String taskId) {
        BatchProgress progress = generationService.getProgress(taskId);
        if (progress == null) {
            return ApiResponse.success(buildTaskStatus(taskId, "NOT_FOUND"));
        }
        boolean done = progress.getCompleted() + progress.getFailed() >= progress.getTotal();
        String status = done ? "COMPLETED" : "RUNNING";
        return ApiResponse.success(new TaskStatusDTO()
            .setTaskId(taskId)
            .setStatus(status)
            .setTotal(progress.getTotal())
            .setCompleted(progress.getCompleted())
            .setFailed(progress.getFailed()));
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

    private ExplanationDTO toExplanationDTO(Explanation e) {
        return new ExplanationDTO()
            .setId(e.getId())
            .setProblemId(e.getProblemId())
            .setLevel(e.getLevel())
            .setSections(e.getSections())
            .setVersion(e.getVersion())
            .setStatus(e.getStatus().name())
            .setCreatedAt(e.getCreatedAt());
    }

    private TaskStatusDTO buildTaskStatus(String taskId, String status) {
        return new TaskStatusDTO().setTaskId(taskId).setStatus(status);
    }

    private GenerateOptions buildOptions(GenerateRequest request) {
        GenerateOptions options = new GenerateOptions();
        if (request != null) {
            options.setLevel(request.getLevel());
            options.setLanguages(request.getLanguages());
            options.setIncludeSteps(request.isIncludeSteps());
            options.setIncludeDiagrams(request.isIncludeDiagrams());
        }
        return options;
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
