package com.algorithm.help.content.batch;

import com.algorithm.help.content.pipeline.ContentPipeline;
import com.algorithm.help.content.pipeline.GenerationOptions;
import com.algorithm.help.repository.ExplanationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;

/**
 * 批量内容生成服务
 * <p>
 * 使用 Semaphore 控制并发，支持失败重试与断点续生成。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BatchGenerationService {

    private final ContentPipeline pipeline;
    private final ExplanationRepository explanationRepo;

    /** 批次进度存储 */
    private final ConcurrentHashMap<String, BatchProgress> progressMap = new ConcurrentHashMap<>();

    @Value("${content.batch.max-concurrency:3}")
    private int maxConcurrency;

    @Value("${content.batch.retry-max:3}")
    private int retryMax;

    @Value("${content.batch.retry-interval-ms:2000}")
    private long retryIntervalMs;

    /**
     * 异步启动批量生成任务
     *
     * @param batchId    批次 ID
     * @param problemIds 题目 ID 列表
     * @param options    生成选项
     */
    @Async("batchExecutor")
    public void startBatch(String batchId, List<String> problemIds, GenerationOptions options) {
        BatchProgress progress = initProgress(batchId, problemIds.size());
        Semaphore semaphore = new Semaphore(maxConcurrency);

        for (String problemId : problemIds) {
            progress.setCurrentProblem(problemId);

            // 断点续生成：已存在解析则跳过
            if (hasExistingExplanation(problemId)) {
                progress.setSkipped(progress.getSkipped() + 1);
                progress.setCompleted(progress.getCompleted() + 1);
                continue;
            }

            try {
                semaphore.acquire();
                generateWithRetry(problemId, options, progress);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                progress.setStatus("FAILED");
                log.error("批次 {} 被中断", batchId);
                return;
            } finally {
                semaphore.release();
            }
        }

        progress.setCurrentProblem(null);
        progress.setStatus("COMPLETED");
        log.info("批次 {} 完成: total={}, completed={}, failed={}, skipped={}",
                batchId, progress.getTotal(), progress.getCompleted(),
                progress.getFailed(), progress.getSkipped());
    }

    /**
     * 获取批次进度
     */
    public BatchProgress getProgress(String batchId) {
        return progressMap.get(batchId);
    }

    /**
     * 初始化进度对象
     */
    private BatchProgress initProgress(String batchId, int total) {
        BatchProgress progress = new BatchProgress()
                .setTotal(total)
                .setStatus("RUNNING")
                .setStartTime(System.currentTimeMillis());
        progressMap.put(batchId, progress);
        return progress;
    }

    /**
     * 检查题目是否已存在解析（断点续生成）
     */
    private boolean hasExistingExplanation(String problemId) {
        return !explanationRepo
                .findByProblemIdOrderByLevelAscVersionDesc(problemId)
                .isEmpty();
    }

    /**
     * 带重试的单题生成
     */
    private void generateWithRetry(String problemId, GenerationOptions options,
                                   BatchProgress progress) {
        int attempts = 0;
        while (attempts < retryMax) {
            try {
                pipeline.generate(problemId, 3, options);
                progress.setCompleted(progress.getCompleted() + 1);
                return;
            } catch (Exception e) {
                attempts++;
                log.warn("题目 {} 生成失败 (第 {} 次): {}", problemId, attempts, e.getMessage());
                if (attempts < retryMax) {
                    sleepBeforeRetry();
                }
            }
        }
        recordFailure(problemId, progress, attempts);
    }

    /**
     * 重试间隔等待
     */
    private void sleepBeforeRetry() {
        try {
            Thread.sleep(retryIntervalMs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /**
     * 记录失败信息
     */
    private void recordFailure(String problemId, BatchProgress progress, int retryCount) {
        progress.setFailed(progress.getFailed() + 1);
        progress.setCompleted(progress.getCompleted() + 1);
        progress.getFailures().add(
                new BatchProgress.FailureDetail()
                        .setProblemId(problemId)
                        .setError("重试 " + retryCount + " 次后仍失败")
                        .setRetryCount(retryCount)
        );
    }
}
