package com.algorithm.help.content.enrichment.pipeline;

import com.algorithm.help.content.enrichment.EnrichedSolution;
import com.algorithm.help.content.enrichment.EnrichedSolutionRepository;
import com.algorithm.help.content.enrichment.EnrichedStatus;
import com.algorithm.help.content.enrichment.SourceType;
import com.algorithm.help.content.enrichment.UnifiedExplanationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * 异步任务管理器
 * <p>
 * 负责 enrichment 任务的创建、执行、进度追踪、取消和重试。
 * 使用 Redis 状态机管理任务生命周期：
 * - gen:active:{problemId}:L{level} — 活跃任务幂等标记
 * - gen:task:{taskId} — 任务状态 Hash
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EnrichmentTaskManager {

    private static final String ACTIVE_KEY = "gen:active:%s:L%d";
    private static final String TASK_KEY = "gen:task:%s";
    private static final long ACTIVE_TTL_MIN = 5;
    private static final long TASK_TTL_HOUR = 1;
    private static final long TASK_TIMEOUT_MS = 3 * 60 * 1000L;

    /** AI 超时重试策略：最多 2 次，退避 5s / 15s */
    private static final int TIMEOUT_MAX_RETRY = 2;
    private static final long[] TIMEOUT_BACKOFF_MS = {5000L, 15000L};

    /** AI 格式错误重试策略：最多 1 次 */
    private static final int FORMAT_ERROR_MAX_RETRY = 1;

    private final RedisTemplate<String, Object> redisTemplate;
    private final EnrichmentPipeline pipeline;
    private final EnrichmentConfig config;
    private final com.algorithm.help.repository.ProblemRepository problemRepo;
    private final com.algorithm.help.content.enrichment.CrawledSolutionRepository crawledRepo;
    private final EnrichedSolutionRepository enrichedRepo;
    private final UnifiedExplanationService unifiedService;
    private final ObjectMapper objectMapper;

    /** 运行中的任务 Future，用于取消中断 */
    private final ConcurrentHashMap<String, Thread> runningThreads = new ConcurrentHashMap<>();

    /**
     * 创建或返回已有任务（幂等）
     * <p>
     * 检查 active key，存在则返回已有 taskId；不存在则创建新任务。
     *
     * @param problemId 题目 ID
     * @param level     目标级别 1-5
     * @param force     是否强制创建（忽略幂等标记）
     */
    public TaskCreateResult createTask(String problemId, int level, boolean force) {
        String activeKey = String.format(ACTIVE_KEY, problemId, level);

        // 幂等检查：是否已有活跃任务
        if (!force) {
            String existingTaskId = getActiveTaskId(activeKey);
            if (existingTaskId != null) {
                log.info("幂等命中, problemId={}, level={}, taskId={}", problemId, level, existingTaskId);
                return TaskCreateResult.reused(existingTaskId);
            }
        }

        // 创建新任务
        String taskId = UUID.randomUUID().toString();
        long now = System.currentTimeMillis();

        // 设置活跃标记
        setActiveTask(activeKey, taskId);

        // 初始化任务 Hash
        initTaskHash(taskId, problemId, level, now);

        log.info("创建任务, problemId={}, level={}, taskId={}", problemId, level, taskId);
        return TaskCreateResult.created(taskId);
    }

    /**
     * 启动异步任务执行（便捷方法）
     * 从 problemId 和 level 构建上下文并调用管线
     * <p>
     * 注意：必须由 Spring 代理调用（从 Controller 等外部组件调用），
     * 不可在同类内部直接调用，否则 @Async 不生效。
     */
    @Async("enrichmentExecutor")
    public void executeTask(String taskId, String problemId, int level) {
        // 构建管线上下文
        EnrichmentContext ctx = new EnrichmentContext()
                .setTargetLevel(level)
                .setConfig(config);

        // 查询题目信息
        try {
            var problem = problemRepo.findById(problemId).orElse(null);
            ctx.setProblem(problem);

            // 查询爬取的原始题解作为素材
            var crawledSolutions = crawledRepo.findByProblemId(
                    problemId, org.springframework.data.domain.PageRequest.of(0, 10,
                            org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "voteCount")));
            var sources = crawledSolutions.getContent().stream()
                    .map(cs -> {
                        java.util.Map<String, Object> map = new java.util.HashMap<>();
                        map.put("title", cs.getTitle());
                        map.put("content", cs.getContent());
                        map.put("author", cs.getAuthor());
                        map.put("votes", cs.getVoteCount());
                        return map;
                    })
                    .collect(java.util.stream.Collectors.toList());
            ctx.setSources(sources);
        } catch (Exception e) {
            log.warn("构建管线上下文失败, problemId={}: {}", problemId, e.getMessage());
        }

        // 异步执行
        executeTask(taskId, ctx);
    }

    /**
     * 异步执行管线
     * <p>
     * 执行前记录线程引用（用于取消中断），执行中更新步骤级进度，
     * 执行后清理活跃标记。包含超时检查和重试策略。
     */
    @Async("enrichmentExecutor")
    public void executeTask(String taskId, EnrichmentContext ctx) {
        // 注册当前线程用于取消中断
        runningThreads.put(taskId, Thread.currentThread());
        long startTime = System.currentTimeMillis();

        try {
            // 更新状态为 PROCESSING
            updateTaskStatus(taskId, TaskState.PROCESSING);
            updateField(taskId, "startedAt", String.valueOf(startTime));

            // 计算适用步骤数
            int totalSteps = countApplicableSteps(ctx);
            updateField(taskId, "totalSteps", String.valueOf(totalSteps));

            // 带重试执行管线
            EnrichmentPipelineResult result = executeWithRetry(taskId, ctx, startTime);

            // 检查是否被取消
            if (Thread.currentThread().isInterrupted() || isTaskCancelled(taskId)) {
                log.info("任务已取消, taskId={}", taskId);
                return;
            }

            // 处理结果
            handlePipelineResult(taskId, ctx, result);

        } catch (Exception e) {
            handleTaskException(taskId, e);
        } finally {
            cleanup(taskId, ctx);
        }
    }

    /**
     * 查询任务状态
     */
    public TaskStatusDTO getTaskStatus(String taskId) {
        String taskKey = String.format(TASK_KEY, taskId);
        try {
            Map<Object, Object> entries = redisTemplate.opsForHash().entries(taskKey);
            if (entries.isEmpty()) {
                return null;
            }
            return mapToTaskStatus(taskId, entries);
        } catch (Exception e) {
            log.warn("查询任务状态失败, taskId={}: {}", taskId, e.getMessage());
            return null;
        }
    }

    /**
     * 取消任务
     * <p>
     * 仅 PENDING 或 PROCESSING 状态可取消。
     * 取消时设置 CANCELLED 状态 + 中断线程 + 清理 active key。
     */
    public boolean cancelTask(String taskId) {
        TaskStatusDTO status = getTaskStatus(taskId);
        if (status == null) {
            return false;
        }

        // 只有 PENDING 和 PROCESSING 可取消
        if (status.getStatus() != TaskState.PENDING && status.getStatus() != TaskState.PROCESSING) {
            log.warn("任务不可取消, taskId={}, status={}", taskId, status.getStatus());
            return false;
        }

        // 设置取消状态
        updateTaskStatus(taskId, TaskState.CANCELLED);

        // 中断执行线程
        Thread thread = runningThreads.get(taskId);
        if (thread != null) {
            thread.interrupt();
            log.info("已中断任务线程, taskId={}", taskId);
        }

        // 清理活跃标记
        clearActiveTask(status.getProblemId(), status.getLevel());
        runningThreads.remove(taskId);

        log.info("任务已取消, taskId={}", taskId);
        return true;
    }

    /**
     * 更新步骤级进度
     */
    public void updateProgress(String taskId, String stepName, int completed, int total) {
        String taskKey = String.format(TASK_KEY, taskId);
        try {
            redisTemplate.opsForHash().putAll(taskKey, Map.of(
                    "currentStep", stepName,
                    "completedSteps", String.valueOf(completed),
                    "totalSteps", String.valueOf(total)
            ));
        } catch (Exception e) {
            log.warn("进度更新失败, taskId={}: {}", taskId, e.getMessage());
        }
    }

    /**
     * 获取批量任务总览（最近一次批量任务）
     */
    public Map<String, Object> getBatchOverview() {
        // 从 Redis 读取最近一次批量任务信息
        try {
            Object batchIdObj = redisTemplate.opsForValue().get("batch:latest");
            if (batchIdObj == null) {
                return null;
            }
            String batchId = batchIdObj.toString();
            String batchKey = "batch:" + batchId;
            Map<Object, Object> entries = redisTemplate.opsForHash().entries(batchKey);
            if (entries.isEmpty()) {
                return null;
            }

            int total = parseInt(getStr(entries, "total"));
            int completed = parseInt(getStr(entries, "completed"));
            int failed = parseInt(getStr(entries, "failed"));
            int processing = parseInt(getStr(entries, "processing"));
            int pending = total - completed - failed - processing;
            int concurrency = parseInt(getStr(entries, "concurrency"));
            if (concurrency == 0) concurrency = 3;

            Map<String, Object> overview = new java.util.LinkedHashMap<>();
            overview.put("batchId", batchId);
            overview.put("concurrency", concurrency);
            overview.put("total", total);
            overview.put("completed", completed);
            overview.put("failed", failed);
            overview.put("processing", processing);
            overview.put("pending", Math.max(0, pending));
            overview.put("cancelled", 0);
            overview.put("tasks", List.of()); // 详细任务可按需扩展
            overview.put("createdAt", parseLong(getStr(entries, "createdAt")));
            return overview;
        } catch (Exception e) {
            log.warn("获取批量任务总览失败: {}", e.getMessage());
            return null;
        }
    }

    // ===== 私有方法 =====

    /**
     * 带重试的管线执行
     */
    private EnrichmentPipelineResult executeWithRetry(String taskId, EnrichmentContext ctx, long startTime) {
        int retryCount = 0;
        EnrichmentPipelineResult result = null;

        while (true) {
            // 超时检查
            checkTimeout(taskId, startTime, ctx);

            // 执行管线
            result = pipeline.execute(ctx);

            if (result.isSuccess()) {
                return result;
            }

            // 判断是否可重试
            if (!shouldRetry(result, retryCount)) {
                return result;
            }

            retryCount++;
            updateField(taskId, "retryCount", String.valueOf(retryCount));
            long backoff = calculateBackoff(result, retryCount);
            log.info("任务重试, taskId={}, retryCount={}, backoff={}ms", taskId, retryCount, backoff);

            sleep(backoff);

            // 重试前再次检查取消
            if (Thread.currentThread().isInterrupted() || isTaskCancelled(taskId)) {
                return result;
            }
        }
    }

    /**
     * 判断是否应该重试
     */
    private boolean shouldRetry(EnrichmentPipelineResult result, int currentRetryCount) {
        if (result.isSuccess()) {
            return false;
        }
        String error = result.getError();
        if (error == null) {
            return false;
        }

        // AI 超时：最多重试 2 次
        if (isTimeoutError(error)) {
            return currentRetryCount < TIMEOUT_MAX_RETRY;
        }
        // AI 格式错误：最多重试 1 次
        if (isFormatError(error)) {
            return currentRetryCount < FORMAT_ERROR_MAX_RETRY;
        }
        return false;
    }

    /**
     * 计算退避时间
     */
    private long calculateBackoff(EnrichmentPipelineResult result, int retryCount) {
        if (isTimeoutError(result.getError())) {
            int idx = Math.min(retryCount - 1, TIMEOUT_BACKOFF_MS.length - 1);
            return TIMEOUT_BACKOFF_MS[idx];
        }
        // 格式错误用固定 3s 退避
        return 3000L;
    }

    private boolean isTimeoutError(String error) {
        return error != null && (error.contains("timeout") || error.contains("超时"));
    }

    private boolean isFormatError(String error) {
        return error != null && (error.contains("format") || error.contains("格式"));
    }

    /**
     * 超时检查：超过 3 分钟则标记失败
     */
    private void checkTimeout(String taskId, long startTime, EnrichmentContext ctx) {
        long elapsed = System.currentTimeMillis() - startTime;
        if (elapsed > TASK_TIMEOUT_MS) {
            log.error("任务超时, taskId={}, elapsed={}ms", taskId, elapsed);
            updateTaskStatus(taskId, TaskState.FAILED);
            updateField(taskId, "error", "任务执行超时（超过3分钟）");
            clearActiveTask(ctx.getProblem().getId(), ctx.getTargetLevel());
            runningThreads.remove(taskId);
            throw new TaskTimeoutException("任务执行超时");
        }
    }

    /**
     * 处理管线执行结果：成功时持久化到 enriched_solutions 表
     */
    private void handlePipelineResult(String taskId, EnrichmentContext ctx, EnrichmentPipelineResult result) {
        if (result.isSuccess()) {
            try {
                EnrichedSolution entity = buildEnrichedEntity(ctx);
                enrichedRepo.save(entity);
                // 失效缓存
                unifiedService.invalidateCache(entity.getProblemId(), entity.getLevel());
                updateTaskStatus(taskId, TaskState.COMPLETED);
                updateField(taskId, "result", "生成完成, id=" + entity.getId());
                log.info("任务完成并持久化, taskId={}, enrichedId={}", taskId, entity.getId());
            } catch (Exception e) {
                log.error("持久化 enriched 记录失败, taskId={}: {}", taskId, e.getMessage(), e);
                updateTaskStatus(taskId, TaskState.FAILED);
                updateField(taskId, "error", "持久化失败: " + e.getMessage());
            }
        } else {
            updateTaskStatus(taskId, TaskState.FAILED);
            updateField(taskId, "error", result.getError());
            log.error("任务失败, taskId={}, step={}, error={}", taskId, result.getFailedStep(), result.getError());
        }
    }

    /**
     * 从管线上下文构建 EnrichedSolution 实体
     */
    private EnrichedSolution buildEnrichedEntity(EnrichmentContext ctx) {
        String content = stripAnsiSequences(ctx.getPolishedContent());
        String title = extractTitle(content);
        String summary = extractSummary(content);
        String codeJson = serializeCodeImplementations(ctx.getCodeImplementations());
        String tagsJson = buildTags(ctx);
        EnrichedStatus status = determineStatus(ctx);
        SourceType sourceType = determineSourceType(ctx);

        return new EnrichedSolution()
                .setProblemId(ctx.getProblem().getId())
                .setLevel(ctx.getTargetLevel())
                .setSourceType(sourceType)
                .setSourceAuthor(sourceType == SourceType.COMMUNITY ? extractSourceAuthor(ctx) : null)
                .setSourceUrl(sourceType == SourceType.COMMUNITY ? "https://leetcode.com" : null)
                .setSourceVotes(extractSourceVotes(ctx))
                .setTitle(title)
                .setSummary(summary)
                .setContent(content)
                .setCodeImplementations(codeJson)
                .setTags(tagsJson)
                .setTimeComplexity(ctx.getTimeComplexity())
                .setSpaceComplexity(ctx.getSpaceComplexity())
                .setAiProvider("kiro-cli")
                .setProcessingSteps(buildProcessingStepsJson(ctx))
                .setQualityScore(ctx.getQualityScore())
                .setStatus(status);
    }

    /**
     * 清理残留的 ANSI/终端转义序列
     */
    private String stripAnsiSequences(String text) {
        if (text == null) return null;
        return text.replaceAll("\\u001B\\[[;\\d]*[a-zA-Z]", "")
                .replaceAll("\\[\\?\\d+[a-zA-Z]", "")
                .replaceAll("^[>\\s]+", "");
    }

    /**
     * 从内容第一行提取标题
     */
    private String extractTitle(String content) {
        if (content == null || content.isBlank()) return "AI 生成解析";
        String[] lines = content.split("\n");
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isBlank()) continue;
            // 去掉 ANSI 转义序列残留
            trimmed = trimmed.replaceAll("\\[\\?\\d+[a-zA-Z]", "")
                    .replaceAll("[>\\s]+$", "").trim();
            // 去掉 Markdown 标题标记
            String title = trimmed.replaceAll("^#+\\s*", "");
            if (!title.isBlank() && title.length() > 2) {
                return title.length() > 200 ? title.substring(0, 200) : title;
            }
        }
        return "AI 生成解析";
    }

    /**
     * 提取摘要：取内容前 200 字符（去除标题行）
     */
    private String extractSummary(String content) {
        if (content == null || content.isBlank()) return "";
        String[] lines = content.split("\n");
        StringBuilder sb = new StringBuilder();
        boolean skippedTitle = false;
        for (String line : lines) {
            if (!skippedTitle && line.trim().startsWith("#")) {
                skippedTitle = true;
                continue;
            }
            if (!line.trim().isBlank()) {
                sb.append(line.trim()).append(" ");
                if (sb.length() >= 200) break;
            }
        }
        String result = sb.toString().trim();
        return result.length() > 500 ? result.substring(0, 500) : result;
    }

    /**
     * 序列化代码实现为 JSON
     */
    private String serializeCodeImplementations(Map<String, String> codes) {
        if (codes == null || codes.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(codes);
        } catch (Exception e) {
            log.warn("序列化 codeImplementations 失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 构建标签 JSON
     */
    private String buildTags(EnrichmentContext ctx) {
        java.util.List<String> tags = new java.util.ArrayList<>();
        if (ctx.getTimeComplexity() != null) tags.add(ctx.getTimeComplexity());
        if (ctx.getProblem() != null && ctx.getProblem().getDifficulty() != null) {
            tags.add(ctx.getProblem().getDifficulty().name());
        }
        tags.add("L" + ctx.getTargetLevel());
        try {
            return objectMapper.writeValueAsString(tags);
        } catch (Exception e) {
            return "[]";
        }
    }

    /**
     * 根据质量评分步骤的自动审核结果决定状态
     */
    /**
     * 根据 QualityScore 步骤的自动审核结果决定状态
     * <p>
     * 逻辑：
     * 1. QualityScoreStep 打分 >= 0.6 → warnings 里有 "auto-review:PUBLISHED" → PUBLISHED
     * 2. QualityScoreStep 未运行（score=0.0）→ 兜底发布，开发阶段有内容即可展示
     * 3. QualityScoreStep 打分 < 0.6 且 > 0 → PENDING_REVIEW（人工审核）
     */
    private EnrichedStatus determineStatus(EnrichmentContext ctx) {
        for (String warning : ctx.getWarnings()) {
            if (warning.contains("auto-review:PUBLISHED")) {
                return EnrichedStatus.PUBLISHED;
            }
        }
        // 兜底：评分步骤未运行时 score=0.0f，直接发布
        // 避免有效内容因评分步骤跳过/失败而永远卡在 PENDING_REVIEW
        if (ctx.getQualityScore() == 0.0f) {
            return EnrichedStatus.PUBLISHED;
        }
        return EnrichedStatus.PENDING_REVIEW;
    }

    /**
     * 判断来源类型：有素材来源则为 COMMUNITY，否则为 AI_ORIGINAL
     */
    private SourceType determineSourceType(EnrichmentContext ctx) {
        if (ctx.getSources() != null && !ctx.getSources().isEmpty()) {
            return SourceType.AI_ORIGINAL; // 基于社区素材 AI 润色，标记为 AI_ORIGINAL
        }
        return SourceType.AI_ORIGINAL;
    }

    /**
     * 提取素材来源作者
     */
    private String extractSourceAuthor(EnrichmentContext ctx) {
        if (ctx.getFilteredSources() != null && !ctx.getFilteredSources().isEmpty()) {
            Object author = ctx.getFilteredSources().get(0).get("author");
            return author != null ? author.toString() : null;
        }
        return null;
    }

    /**
     * 提取素材来源投票数
     */
    private Integer extractSourceVotes(EnrichmentContext ctx) {
        if (ctx.getFilteredSources() != null && !ctx.getFilteredSources().isEmpty()) {
            Object votes = ctx.getFilteredSources().get(0).get("votes");
            if (votes instanceof Number n) return n.intValue();
        }
        return 0;
    }

    /**
     * 构建管线已执行步骤 JSON
     */
    private String buildProcessingStepsJson(EnrichmentContext ctx) {
        java.util.List<String> executedSteps = new java.util.ArrayList<>();
        for (EnrichmentStep step : pipeline.getSteps()) {
            if (config.isStepEnabled(step.getName()) && step.isApplicable(ctx)) {
                executedSteps.add(step.getName());
            }
        }
        try {
            return objectMapper.writeValueAsString(executedSteps);
        } catch (Exception e) {
            return "[]";
        }
    }

    /**
     * 处理任务异常
     */
    private void handleTaskException(String taskId, Exception e) {
        if (e instanceof TaskTimeoutException) {
            return; // 超时已在 checkTimeout 中处理
        }
        if (Thread.currentThread().isInterrupted()) {
            log.info("任务被中断, taskId={}", taskId);
            return;
        }
        log.error("任务执行异常, taskId={}: {}", taskId, e.getMessage(), e);
        updateTaskStatus(taskId, TaskState.FAILED);
        updateField(taskId, "error", "系统异常: " + e.getMessage());
    }

    /**
     * 任务结束后清理
     */
    private void cleanup(String taskId, EnrichmentContext ctx) {
        runningThreads.remove(taskId);
        // 非取消的终态任务清理 active key
        TaskStatusDTO status = getTaskStatus(taskId);
        if (status != null && isTerminalState(status.getStatus()) && status.getStatus() != TaskState.CANCELLED) {
            clearActiveTask(ctx.getProblem().getId(), ctx.getTargetLevel());
        }
    }

    private boolean isTerminalState(TaskState state) {
        return state == TaskState.COMPLETED || state == TaskState.FAILED || state == TaskState.CANCELLED;
    }

    // ===== Redis 操作辅助方法 =====

    private String getActiveTaskId(String activeKey) {
        try {
            Object value = redisTemplate.opsForValue().get(activeKey);
            return value != null ? value.toString() : null;
        } catch (Exception e) {
            log.warn("查询活跃任务失败, key={}: {}", activeKey, e.getMessage());
            return null; // Redis 异常降级：允许创建新任务
        }
    }

    private void setActiveTask(String activeKey, String taskId) {
        try {
            redisTemplate.opsForValue().set(activeKey, taskId, ACTIVE_TTL_MIN, TimeUnit.MINUTES);
        } catch (Exception e) {
            log.warn("设置活跃标记失败, key={}: {}", activeKey, e.getMessage());
        }
    }

    private void clearActiveTask(String problemId, int level) {
        String activeKey = String.format(ACTIVE_KEY, problemId, level);
        try {
            redisTemplate.delete(activeKey);
            log.debug("清理活跃标记, key={}", activeKey);
        } catch (Exception e) {
            log.warn("清理活跃标记失败, key={}: {}", activeKey, e.getMessage());
        }
    }

    private void initTaskHash(String taskId, String problemId, int level, long createdAt) {
        String taskKey = String.format(TASK_KEY, taskId);
        try {
            Map<String, String> fields = Map.of(
                    "status", TaskState.PENDING.name(),
                    "problemId", problemId,
                    "level", String.valueOf(level),
                    "currentStep", "",
                    "totalSteps", "0",
                    "completedSteps", "0",
                    "retryCount", "0",
                    "createdAt", String.valueOf(createdAt)
            );
            redisTemplate.opsForHash().putAll(taskKey, fields);
            redisTemplate.expire(taskKey, TASK_TTL_HOUR, TimeUnit.HOURS);
        } catch (Exception e) {
            log.warn("初始化任务 Hash 失败, taskId={}: {}", taskId, e.getMessage());
        }
    }

    private void updateTaskStatus(String taskId, TaskState state) {
        updateField(taskId, "status", state.name());
    }

    private void updateField(String taskId, String field, String value) {
        String taskKey = String.format(TASK_KEY, taskId);
        try {
            redisTemplate.opsForHash().put(taskKey, field, value);
        } catch (Exception e) {
            log.warn("更新任务字段失败, taskId={}, field={}: {}", taskId, field, e.getMessage());
        }
    }

    private boolean isTaskCancelled(String taskId) {
        String taskKey = String.format(TASK_KEY, taskId);
        try {
            Object status = redisTemplate.opsForHash().get(taskKey, "status");
            return status != null && TaskState.CANCELLED.name().equals(status.toString());
        } catch (Exception e) {
            return false;
        }
    }

    // ===== 工具方法 =====

    /**
     * 计算当前上下文适用的步骤数
     */
    private int countApplicableSteps(EnrichmentContext ctx) {
        List<EnrichmentStep> steps = pipeline.getSteps();
        int count = 0;
        for (EnrichmentStep step : steps) {
            if (config.isStepEnabled(step.getName()) && step.isApplicable(ctx)) {
                count++;
            }
        }
        return count;
    }

    /**
     * 将 Redis Hash entries 映射为 TaskStatusDTO
     */
    private TaskStatusDTO mapToTaskStatus(String taskId, Map<Object, Object> entries) {
        TaskStatusDTO dto = new TaskStatusDTO();
        dto.setTaskId(taskId);
        dto.setStatus(parseState(getStr(entries, "status")));
        dto.setProblemId(getStr(entries, "problemId"));
        dto.setLevel(parseInt(getStr(entries, "level")));
        dto.setCurrentStep(getStr(entries, "currentStep"));
        dto.setTotalSteps(parseInt(getStr(entries, "totalSteps")));
        dto.setCompletedSteps(parseInt(getStr(entries, "completedSteps")));
        dto.setResult(getStr(entries, "result"));
        dto.setError(getStr(entries, "error"));
        dto.setRetryCount(parseInt(getStr(entries, "retryCount")));
        dto.setStartedAt(parseLong(getStr(entries, "startedAt")));
        dto.setCreatedAt(parseLong(getStr(entries, "createdAt")));
        return dto;
    }

    private String getStr(Map<Object, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString() : null;
    }

    private int parseInt(String value) {
        if (value == null || value.isEmpty()) return 0;
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private Long parseLong(String value) {
        if (value == null || value.isEmpty()) return null;
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private TaskState parseState(String value) {
        if (value == null) return TaskState.PENDING;
        try {
            return TaskState.valueOf(value);
        } catch (IllegalArgumentException e) {
            return TaskState.PENDING;
        }
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /**
     * 任务超时异常（内部使用）
     */
    private static class TaskTimeoutException extends RuntimeException {
        TaskTimeoutException(String message) {
            super(message);
        }
    }
}
