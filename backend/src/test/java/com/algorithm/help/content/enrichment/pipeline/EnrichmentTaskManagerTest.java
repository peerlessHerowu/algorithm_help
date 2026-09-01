package com.algorithm.help.content.enrichment.pipeline;

import com.algorithm.help.content.enrichment.EnrichedSolutionRepository;
import com.algorithm.help.content.enrichment.UnifiedExplanationService;
import com.algorithm.help.entity.Problem;
import com.algorithm.help.repository.ProblemRepository;
import com.algorithm.help.content.enrichment.CrawledSolutionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * EnrichmentTaskManager 单元测试
 */
@ExtendWith(MockitoExtension.class)
class EnrichmentTaskManagerTest {

    @Mock
    private RedisTemplate<String, Object> redisTemplate;
    @Mock
    private ValueOperations<String, Object> valueOps;
    @Mock
    private HashOperations<String, Object, Object> hashOps;
    @Mock
    private ProblemRepository problemRepo;
    @Mock
    private CrawledSolutionRepository crawledRepo;
    @Mock
    private EnrichedSolutionRepository enrichedRepo;
    @Mock
    private UnifiedExplanationService unifiedService;

    private EnrichmentPipeline pipeline;
    private EnrichmentConfig config;
    private EnrichmentTaskManager taskManager;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        config = new EnrichmentConfig();
        config.setEnabled(true);
        objectMapper = new ObjectMapper();

        // 创建带测试步骤的管线
        List<EnrichmentStep> steps = List.of(
                createStep("source-filter", true, true),
                createStep("polish", true, true),
                createStep("quality-score", true, false)
        );
        pipeline = new EnrichmentPipeline(steps, config);

        taskManager = new EnrichmentTaskManager(
                redisTemplate, pipeline, config, problemRepo, crawledRepo,
                enrichedRepo, unifiedService, objectMapper);

        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
        lenient().when(redisTemplate.opsForHash()).thenReturn(hashOps);
    }

    @Test
    @DisplayName("创建新任务：无活跃任务时返回新 taskId")
    void createTask_noActiveTask_createsNew() {
        when(valueOps.get(anyString())).thenReturn(null);

        TaskCreateResult result = taskManager.createTask("two-sum", 3, false);

        assertNotNull(result.getTaskId());
        assertFalse(result.isReused());
        // 验证设置了 active key
        verify(valueOps).set(eq("gen:active:two-sum:L3"), eq(result.getTaskId()), eq(5L), eq(TimeUnit.MINUTES));
        // 验证初始化了 task hash
        verify(hashOps).putAll(eq("gen:task:" + result.getTaskId()), anyMap());
    }

    @Test
    @DisplayName("幂等性：已有活跃任务时返回已有 taskId")
    void createTask_activeTaskExists_returnsExisting() {
        String existingId = "existing-task-id";
        when(valueOps.get("gen:active:two-sum:L3")).thenReturn(existingId);

        TaskCreateResult result = taskManager.createTask("two-sum", 3, false);

        assertEquals(existingId, result.getTaskId());
        assertTrue(result.isReused());
        // 不应该设置新的 active key
        verify(valueOps, never()).set(anyString(), anyString(), anyLong(), any(TimeUnit.class));
    }

    @Test
    @DisplayName("强制创建：即使有活跃任务也创建新的")
    void createTask_forceMode_ignoresExisting() {
        // force=true 时不检查 active key，直接创建新任务
        TaskCreateResult result = taskManager.createTask("two-sum", 3, true);

        assertNotNull(result.getTaskId());
        assertFalse(result.isReused());
        // 验证不会去查询 active key
        verify(valueOps, never()).get(anyString());
    }

    @Test
    @DisplayName("查询任务状态：从 Redis Hash 正确映射")
    void getTaskStatus_mapsFromRedisHash() {
        Map<Object, Object> entries = new HashMap<>();
        entries.put("status", "PROCESSING");
        entries.put("problemId", "two-sum");
        entries.put("level", "3");
        entries.put("currentStep", "polish");
        entries.put("totalSteps", "3");
        entries.put("completedSteps", "1");
        entries.put("retryCount", "0");
        entries.put("startedAt", "1719500000000");
        entries.put("createdAt", "1719500000000");

        when(hashOps.entries("gen:task:task-123")).thenReturn(entries);

        TaskStatusDTO dto = taskManager.getTaskStatus("task-123");

        assertNotNull(dto);
        assertEquals("task-123", dto.getTaskId());
        assertEquals(TaskState.PROCESSING, dto.getStatus());
        assertEquals("two-sum", dto.getProblemId());
        assertEquals(3, dto.getLevel());
        assertEquals("polish", dto.getCurrentStep());
        assertEquals(3, dto.getTotalSteps());
        assertEquals(1, dto.getCompletedSteps());
        assertEquals(0, dto.getRetryCount());
        assertEquals(1719500000000L, dto.getStartedAt());
    }

    @Test
    @DisplayName("查询不存在的任务：返回 null")
    void getTaskStatus_notFound_returnsNull() {
        when(hashOps.entries(anyString())).thenReturn(new HashMap<>());

        TaskStatusDTO result = taskManager.getTaskStatus("non-existent");

        assertNull(result);
    }

    @Test
    @DisplayName("取消 PROCESSING 状态的任务：成功")
    void cancelTask_processingTask_succeeds() {
        Map<Object, Object> entries = new HashMap<>();
        entries.put("status", "PROCESSING");
        entries.put("problemId", "two-sum");
        entries.put("level", "3");
        entries.put("currentStep", "polish");
        entries.put("totalSteps", "3");
        entries.put("completedSteps", "1");
        entries.put("retryCount", "0");
        entries.put("createdAt", "1719500000000");
        when(hashOps.entries("gen:task:task-123")).thenReturn(entries);
        when(redisTemplate.delete("gen:active:two-sum:L3")).thenReturn(true);

        boolean result = taskManager.cancelTask("task-123");

        assertTrue(result);
        // 验证设置了 CANCELLED 状态
        verify(hashOps).put("gen:task:task-123", "status", "CANCELLED");
        // 验证清理了 active key
        verify(redisTemplate).delete("gen:active:two-sum:L3");
    }

    @Test
    @DisplayName("取消已完成的任务：失败")
    void cancelTask_completedTask_fails() {
        Map<Object, Object> entries = new HashMap<>();
        entries.put("status", "COMPLETED");
        entries.put("problemId", "two-sum");
        entries.put("level", "3");
        entries.put("currentStep", "");
        entries.put("totalSteps", "3");
        entries.put("completedSteps", "3");
        entries.put("retryCount", "0");
        entries.put("createdAt", "1719500000000");
        when(hashOps.entries("gen:task:task-123")).thenReturn(entries);

        boolean result = taskManager.cancelTask("task-123");

        assertFalse(result);
        // 不应该更新状态
        verify(hashOps, never()).put(anyString(), eq("status"), eq("CANCELLED"));
    }

    @Test
    @DisplayName("取消不存在的任务：失败")
    void cancelTask_nonExistent_fails() {
        when(hashOps.entries(anyString())).thenReturn(new HashMap<>());

        boolean result = taskManager.cancelTask("non-existent");

        assertFalse(result);
    }

    @Test
    @DisplayName("更新步骤级进度")
    void updateProgress_updatesRedisHash() {
        taskManager.updateProgress("task-123", "polish", 2, 5);

        verify(hashOps).putAll(eq("gen:task:task-123"), argThat(map -> {
            @SuppressWarnings("unchecked")
            Map<String, String> m = (Map<String, String>) map;
            return "polish".equals(m.get("currentStep"))
                    && "2".equals(m.get("completedSteps"))
                    && "5".equals(m.get("totalSteps"));
        }));
    }

    @Test
    @DisplayName("Redis 异常时创建任务不抛异常（降级）")
    void createTask_redisException_gracefulDegradation() {
        when(valueOps.get(anyString())).thenThrow(new RuntimeException("Redis 连接失败"));

        // Redis 异常时降级允许创建新任务
        TaskCreateResult result = taskManager.createTask("two-sum", 3, false);

        assertNotNull(result.getTaskId());
        assertFalse(result.isReused());
    }

    // ===== 辅助方法 =====

    private EnrichmentStep createStep(String name, boolean applicable, boolean critical) {
        return new EnrichmentStep() {
            @Override
            public String getName() { return name; }
            @Override
            public boolean isApplicable(EnrichmentContext ctx) { return applicable; }
            @Override
            public EnrichmentResult process(EnrichmentContext ctx) { return EnrichmentResult.ok(); }
            @Override
            public boolean isCritical() { return critical; }
        };
    }
}
