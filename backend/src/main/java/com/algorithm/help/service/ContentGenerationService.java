package com.algorithm.help.service;

import com.algorithm.help.ai.SmartRouter;
import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.ai.model.AiResponse;
import com.algorithm.help.ai.model.GenerateOptions;
import com.algorithm.help.common.exception.ResourceNotFoundException;
import com.algorithm.help.entity.Explanation;
import com.algorithm.help.entity.ExplanationStatus;
import com.algorithm.help.entity.Problem;
import com.algorithm.help.repository.ExplanationRepository;
import com.algorithm.help.repository.ProblemRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * 内容生成服务：单题生成 + 异步批量生成 + 进度追踪
 */
@Slf4j
@Service
public class ContentGenerationService {

    private static final String PROGRESS_PREFIX = "batch:progress:";
    private static final String ACTIVE_TASK_PREFIX = "gen:active:";

    private final SmartRouter smartRouter;
    private final ProblemRepository problemRepo;
    private final ExplanationRepository explanationRepo;
    private final DiagramService diagramService;
    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;

    public ContentGenerationService(SmartRouter smartRouter,
                                    ProblemRepository problemRepo,
                                    ExplanationRepository explanationRepo,
                                    DiagramService diagramService,
                                    RedisTemplate<String, Object> redisTemplate,
                                    ObjectMapper objectMapper) {
        this.smartRouter = smartRouter;
        this.problemRepo = problemRepo;
        this.explanationRepo = explanationRepo;
        this.diagramService = diagramService;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * 为单个题目生成解析内容
     * 获取题目 → 调用 SmartRouter 生成 → 生成图解 → 存储
     */
    public Explanation generateForProblem(String problemId, GenerateOptions options) {
        Problem problem = problemRepo.findById(problemId)
            .orElseThrow(() -> new ResourceNotFoundException("题目", problemId));

        // 旧版本标记为非最新
        markOldVersions(problemId, options.getLevel());

        // 调用 AI 生成解析
        AiRequest request = AiRequest.forExplanation(problem, options);
        AiResponse response = smartRouter.route(request);

        // 生成图解
        String diagram = generateDiagram(problem);

        // 构建并保存新版本
        return saveExplanation(problemId, options.getLevel(), response.getContent(), diagram);
    }

    /**
     * 异步批量生成：遍历题目列表逐个生成，更新 Redis 进度
     */
    @Async("batchExecutor")
    public void batchGenerate(String batchId, List<String> problemIds, GenerateOptions options) {
        BatchProgress progress = new BatchProgress(problemIds.size());
        saveProgress(batchId, progress);

        for (String problemId : problemIds) {
            try {
                generateForProblem(problemId, options);
                progress.setCompleted(progress.getCompleted() + 1);
            } catch (Exception e) {
                log.error("批量生成失败, problemId={}: {}", problemId, e.getMessage());
                progress.setFailed(progress.getFailed() + 1);
                progress.getFailures().add(problemId + ": " + e.getMessage());
            }
            saveProgress(batchId, progress);
        }
        log.info("批量生成完成, batchId={}, 成功={}, 失败={}",
            batchId, progress.getCompleted(), progress.getFailed());
    }

    /**
     * 查询批量任务进度
     */
    public BatchProgress getProgress(String batchId) {
        try {
            Object obj = redisTemplate.opsForValue().get(PROGRESS_PREFIX + batchId);
            if (obj != null) {
                return objectMapper.convertValue(obj, BatchProgress.class);
            }
        } catch (Exception e) {
            log.warn("读取进度失败, batchId={}: {}", batchId, e.getMessage());
        }
        return null;
    }

    /**
     * 幂等检查：查找指定题目和级别是否有活跃的生成任务
     */
    public Optional<String> findActiveTask(String problemId, int level) {
        String key = ACTIVE_TASK_PREFIX + problemId + ":L" + level;
        try {
            Object taskId = redisTemplate.opsForValue().get(key);
            return taskId != null ? Optional.of(taskId.toString()) : Optional.empty();
        } catch (Exception e) {
            log.warn("活跃任务查询失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 将旧版本标记为非最新
     */
    private void markOldVersions(String problemId, int level) {
        List<Explanation> existing = explanationRepo
            .findByProblemIdAndLevelOrderByVersionDesc(problemId, level);
        existing.forEach(e -> e.setIsLatest(false));
        if (!existing.isEmpty()) {
            explanationRepo.saveAll(existing);
        }
    }

    /**
     * 生成图解，失败时降级为空字符串
     */
    private String generateDiagram(Problem problem) {
        try {
            return diagramService.generateForProblem(problem);
        } catch (Exception e) {
            log.warn("图解生成失败，降级跳过: {}", e.getMessage());
            return "";
        }
    }

    /**
     * 保存新版本解析记录，version = 旧最大版本 + 1
     */
    private Explanation saveExplanation(String problemId, int level,
                                        String content, String diagram) {
        List<Explanation> existing = explanationRepo
            .findByProblemIdAndLevelOrderByVersionDesc(problemId, level);
        int nextVersion = existing.isEmpty() ? 1 : existing.get(0).getVersion() + 1;

        Explanation explanation = new Explanation();
        explanation.setProblemId(problemId);
        explanation.setLevel(level);
        // 清理 ANSI 转义序列
        String cleanContent = content
                .replaceAll("\u001B\\[[;\\d]*[a-zA-Z]", "")
                .replaceAll("\\[\\?25[hl]", "")
                .trim();
        // 用 Jackson ObjectMapper 正确序列化 JSON 字符串（保留 ``` 等特殊字符）
        String contentJson;
        try {
            contentJson = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(cleanContent);
        } catch (Exception e) {
            // fallback: 手动转义
            contentJson = "\"" + cleanContent.replace("\\", "\\\\").replace("\"", "\\\"")
                    .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t") + "\"";
        }
        String sectionsJson = "[{\"title\":\"解析\",\"contentType\":\"text\",\"content\":" + contentJson + "}]";
        explanation.setSections(sectionsJson);
        explanation.setVersion(nextVersion);
        explanation.setIsLatest(true);
        explanation.setStatus(ExplanationStatus.PUBLISHED);
        return explanationRepo.save(explanation);
    }

    /**
     * 保存批量进度到 Redis，TTL 1 小时
     */
    private void saveProgress(String batchId, BatchProgress progress) {
        try {
            redisTemplate.opsForValue().set(
                PROGRESS_PREFIX + batchId, progress, 1, TimeUnit.HOURS);
        } catch (Exception e) {
            log.warn("进度保存失败, batchId={}: {}", batchId, e.getMessage());
        }
    }
}
