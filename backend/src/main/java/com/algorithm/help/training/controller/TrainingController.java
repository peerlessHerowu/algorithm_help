package com.algorithm.help.training.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.graph.entity.GraphEdge;
import com.algorithm.help.graph.entity.GraphNode;
import com.algorithm.help.graph.enums.RelationType;
import com.algorithm.help.graph.repository.GraphEdgeRepository;
import com.algorithm.help.graph.repository.GraphNodeRepository;
import com.algorithm.help.training.dto.*;
import com.algorithm.help.training.service.PatternTrainingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 模式训练 API 控制器
 * <p>
 * 提供测验生成、答案提交、统计查询和模式演进路径查询
 */
@Slf4j
@RestController
@RequestMapping("/api/training")
@RequiredArgsConstructor
public class TrainingController {

    private final PatternTrainingService trainingService;
    private final GraphEdgeRepository edgeRepo;
    private final GraphNodeRepository nodeRepo;

    /** 进阶推荐阈值：正确率>80% */
    private static final double ADVANCE_THRESHOLD = 0.8;
    /** 演进路径最大深度 */
    private static final int MAX_EVOLUTION_DEPTH = 10;

    /**
     * 生成模式识别测验
     */
    @PostMapping("/quiz")
    public ApiResponse<Quiz> generateQuiz(@RequestBody QuizRequest request) {
        int count = request.getQuestionCount() != null ? request.getQuestionCount() : 10;
        Quiz quiz = trainingService.generateQuiz(request.getUserId(), count);
        return ApiResponse.success(quiz);
    }

    /**
     * 提交答案
     */
    @PostMapping("/submit")
    public ApiResponse<QuizResult> submitAnswer(@RequestBody SubmitRequest request) {
        QuizResult result = trainingService.submitAnswer(
                request.getUserId(), request.getProblemId(), request.getAnswer());
        return ApiResponse.success(result);
    }

    /**
     * 获取用户训练统计
     */
    @GetMapping("/stats/{userId}")
    public ApiResponse<List<PatternStatsDTO>> getStats(@PathVariable String userId) {
        List<PatternStatsDTO> stats = trainingService.getStats(userId);
        return ApiResponse.success(stats);
    }

    /**
     * 获取模式演进路径
     * <p>
     * 通过 FOLLOW_UP 边递归查询，构建从基础模式到高级变体的有序序列。
     * 若用户在该模式正确率>80%，自动推荐进阶变体。
     */
    @GetMapping("/evolution/{patternId}")
    public ApiResponse<EvolutionPathDTO> getEvolutionPath(
            @PathVariable String patternId,
            @RequestParam(required = false) String userId) {

        // 递归沿 FOLLOW_UP 边构建演进路径
        List<GraphNode> path = buildEvolutionPath(patternId);

        // 构建响应
        EvolutionPathDTO dto = new EvolutionPathDTO().setPath(path);

        // 如传入 userId，检查是否满足进阶推荐条件
        if (userId != null && !userId.isBlank()) {
            checkAdvanceSuggestion(dto, patternId, userId);
        }

        return ApiResponse.success(dto);
    }

    /**
     * 递归沿 FOLLOW_UP 边构建演进路径（从当前模式出发，按序收集后续节点，最大深度 10）
     */
    private List<GraphNode> buildEvolutionPath(String startId) {
        List<GraphNode> path = new ArrayList<>();
        Set<String> visited = new HashSet<>();
        String currentId = startId;
        int depth = 0;

        while (currentId != null && !visited.contains(currentId) && depth < MAX_EVOLUTION_DEPTH) {
            visited.add(currentId);
            nodeRepo.findById(currentId).ifPresent(path::add);

            // 查找 FOLLOW_UP 出边，取第一个 target 作为下一步
            String nextId = edgeRepo.findBySourceIdAndRelationType(currentId, RelationType.FOLLOW_UP)
                    .stream()
                    .map(GraphEdge::getTargetId)
                    .findFirst()
                    .orElse(null);
            currentId = nextId;
            depth++;
        }
        return path;
    }

    /**
     * 检查用户在当前模式的正确率，满足阈值时推荐进阶变体
     */
    private void checkAdvanceSuggestion(EvolutionPathDTO dto, String patternId, String userId) {
        List<PatternStatsDTO> stats = trainingService.getStats(userId);
        stats.stream()
                .filter(s -> s.getPatternId().equals(patternId))
                .findFirst()
                .ifPresent(stat -> {
                    if (stat.getAccuracy() > ADVANCE_THRESHOLD) {
                        // 查找该模式的 FOLLOW_UP 目标作为推荐
                        edgeRepo.findBySourceIdAndRelationType(patternId, RelationType.FOLLOW_UP)
                                .stream()
                                .findFirst()
                                .ifPresent(edge -> {
                                    dto.setAdvanceSuggested(true);
                                    dto.setSuggestedNextId(edge.getTargetId());
                                    nodeRepo.findById(edge.getTargetId())
                                            .ifPresent(node -> dto.setSuggestedNextName(node.getName()));
                                });
                    }
                });
    }
}
