package com.algorithm.help.content.enrichment.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.content.enrichment.TeachingSequence;
import com.algorithm.help.content.enrichment.TeachingSequenceRepository;
import com.algorithm.help.entity.Diagram;
import com.algorithm.help.repository.DiagramRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 走流程 & 图解 API
 * <p>
 * 提供走流程序列和图解数据的查询接口，供前端「走流程」Tab 使用。
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/enriched")
@RequiredArgsConstructor
public class WalkthroughController {

    private final TeachingSequenceRepository sequenceRepo;
    private final DiagramRepository diagramRepo;

    /**
     * 获取走流程序列
     * <p>
     * GET /api/v1/enriched/{problemId}/walkthrough?level=2&scenario=standard
     *
     * @param problemId    题目 ID
     * @param level        解析级别（默认 2）
     * @param scenarioType 场景类型：standard/boundary/counterexample（默认 standard）
     */
    @GetMapping("/{problemId}/walkthrough")
    public ApiResponse<?> getWalkthrough(
            @PathVariable String problemId,
            @RequestParam(defaultValue = "2") int level,
            @RequestParam(defaultValue = "standard") String scenarioType) {

        Optional<TeachingSequence> opt = sequenceRepo
                .findByProblemIdAndLevelAndScenarioTypeAndStatus(
                        problemId, level, scenarioType, "ready");

        if (opt.isEmpty()) {
            // 没有就绪的序列，返回生成中状态
            return ApiResponse.success(Map.of(
                    "status", "not_generated",
                    "message", "走流程序列尚未生成，请先生成解析内容",
                    "problemId", problemId,
                    "level", level
            ));
        }

        TeachingSequence seq = opt.get();

        // 更新查看次数（异步）
        sequenceRepo.save(seq.setViewCount(seq.getViewCount() + 1));

        return ApiResponse.success(Map.of(
                "status", "ready",
                "id", seq.getId(),
                "problemId", seq.getProblemId(),
                "level", seq.getLevel(),
                "scenarioType", seq.getScenarioType(),
                "title", seq.getTitle(),
                "totalSteps", seq.getTotalSteps(),
                "durationMs", seq.getDurationMs(),
                "sequenceJson", seq.getSequenceJson(),  // 完整 JSON，前端解析
                "schemaVersion", seq.getSchemaVersion()
        ));
    }

    /**
     * 获取图解数据
     * <p>
     * GET /api/v1/enriched/{problemId}/diagram?level=2
     *
     * @param problemId 题目 ID
     * @param level     解析级别（默认 2）
     */
    @GetMapping("/{problemId}/diagram")
    public ApiResponse<?> getDiagram(
            @PathVariable String problemId,
            @RequestParam(defaultValue = "2") int level) {

        // 先按 problem_id + level 查最新的图解
        List<Diagram> diagrams = diagramRepo.findByProblemIdAndLevel(problemId, level);

        if (diagrams.isEmpty()) {
            // 再尝试按 problem_id 不限 level 查（降级）
            diagrams = diagramRepo.findByProblemId(problemId);
        }

        if (diagrams.isEmpty()) {
            return ApiResponse.success(Map.of(
                    "status", "not_generated",
                    "message", "图解尚未生成"
            ));
        }

        Diagram diagram = diagrams.get(0);
        return ApiResponse.success(Map.of(
                "status", "ready",
                "id", diagram.getId(),
                "diagramType", diagram.getDiagramType() != null ? diagram.getDiagramType().name() : "FLOWCHART",
                "renderEngine", diagram.getRenderEngine() != null ? diagram.getRenderEngine() : "mermaid",
                "mermaidCode", diagram.getMermaidCode() != null ? diagram.getMermaidCode() : "",
                "contentJson", diagram.getContentJson() != null ? diagram.getContentJson() : "{}"
        ));
    }
}
