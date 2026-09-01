package com.algorithm.help.content.batch;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.content.pipeline.GenerationOptions;
import com.algorithm.help.entity.Problem;
import com.algorithm.help.repository.ProblemRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 批量生成 API
 */
@RestController
@RequestMapping("/api/v1/batch")
@RequiredArgsConstructor
public class BatchController {

    private final BatchGenerationService batchService;
    private final ProblemRepository problemRepo;

    /**
     * 启动批量生成任务
     */
    @PostMapping("/generate")
    public ApiResponse<BatchStartResponse> startBatch(@RequestBody BatchStartRequest request) {
        List<String> problemIds = resolveProblemIds(request);
        String batchId = UUID.randomUUID().toString();

        GenerationOptions options = new GenerationOptions();
        batchService.startBatch(batchId, problemIds, options);

        BatchStartResponse response = new BatchStartResponse();
        response.setBatchId(batchId);
        response.setTotalProblems(problemIds.size());
        return ApiResponse.success(response);
    }

    /**
     * 查询批次进度
     */
    @GetMapping("/{batchId}/progress")
    public ApiResponse<BatchProgress> getProgress(@PathVariable String batchId) {
        BatchProgress progress = batchService.getProgress(batchId);
        if (progress == null) {
            return ApiResponse.error(404, "批次不存在: " + batchId);
        }
        return ApiResponse.success(progress);
    }

    /**
     * 根据请求参数解析题目 ID 列表
     */
    private List<String> resolveProblemIds(BatchStartRequest request) {
        if (request.getProblemIds() != null && !request.getProblemIds().isEmpty()) {
            return request.getProblemIds();
        }
        // 按难度级别筛选
        if (request.getLevels() != null && !request.getLevels().isEmpty()) {
            return problemRepo.findAll().stream()
                    .filter(p -> request.getLevels().contains(
                            p.getDifficulty().name().toLowerCase()))
                    .map(Problem::getId)
                    .collect(Collectors.toList());
        }
        // 默认：所有题目
        return problemRepo.findAll().stream()
                .map(Problem::getId)
                .collect(Collectors.toList());
    }

    /**
     * 批量生成请求体
     */
    @Data
    public static class BatchStartRequest {
        /** 指定题目 ID 列表 */
        private List<String> problemIds;
        /** 按难度级别筛选：easy / medium / hard */
        private List<String> levels;
        /** 并发数（预留，当前使用配置值） */
        private Integer concurrency;
    }

    /**
     * 批量生成启动响应
     */
    @Data
    public static class BatchStartResponse {
        private String batchId;
        private int totalProblems;
    }
}
