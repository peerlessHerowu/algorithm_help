package com.algorithm.help.content.pipeline;

import com.algorithm.help.common.exception.ResourceNotFoundException;
import com.algorithm.help.content.codegen.MultiLangCodeGenerator;
import com.algorithm.help.content.comparator.ApproachComparator;
import com.algorithm.help.content.generator.LeveledContent;
import com.algorithm.help.content.generator.LeveledGenerator;
import com.algorithm.help.content.quality.QualityValidator;
import com.algorithm.help.content.quality.ValidationReport;
import com.algorithm.help.entity.Explanation;
import com.algorithm.help.entity.ExplanationStatus;
import com.algorithm.help.entity.Problem;
import com.algorithm.help.repository.ExplanationRepository;
import com.algorithm.help.repository.ProblemRepository;
import com.algorithm.help.service.DiagramService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * 内容生成流水线
 * <p>
 * 编排完整的内容生成流程：加载题目→分级生成→补充代码→生成图解→生成对比→质量校验→持久化。
 * 非核心步骤失败时降级跳过，核心步骤（LeveledGenerator）失败则整体失败。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ContentPipeline {

    private static final String CACHE_PREFIX = "explanation:";
    private static final long CACHE_TTL_HOURS = 24;

    private final ProblemRepository problemRepo;
    private final ExplanationRepository explanationRepo;
    private final LeveledGenerator leveledGenerator;
    private final MultiLangCodeGenerator codeGenerator;
    private final DiagramService diagramService;
    private final ApproachComparator comparator;
    private final QualityValidator qualityValidator;
    private final ObjectMapper objectMapper;
    private final RedisTemplate<String, Object> redisTemplate;

    /**
     * 执行完整内容生成流水线
     *
     * @param problemId 题目 ID
     * @param level     级别（1-5）
     * @param options   生成选项
     * @return 生成结果（含持久化的 Explanation 和校验报告）
     */
    public GenerationResult generate(String problemId, int level, GenerationOptions options) {
        long startTime = System.currentTimeMillis();
        GenerationResult result = new GenerationResult();

        // 1. 加载题目
        Problem problem = loadProblem(problemId);

        // 2. 核心步骤：分级内容生成
        LeveledContent content = leveledGenerator.generate(problem, level);

        // 3. 可降级：补充代码
        supplementCode(content, problem, level, options, result);

        // 4. 可降级：生成图解
        generateDiagram(problem, options, result);

        // 5. 可降级：生成对比
        generateComparison(content, problem, options, result);

        // 6. 质量校验
        ValidationReport report = qualityValidator.validate(content.getRawJson(), level);
        result.setReport(report);

        // 7. 持久化
        ExplanationStatus status = determineStatus(report, content);
        Explanation explanation = persist(problemId, level, content, status);
        cacheExplanation(explanation);

        result.setExplanation(explanation)
                .setStatus(status)
                .setDuration(System.currentTimeMillis() - startTime);

        log.info("流水线完成: problemId={}, level={}, status={}, 耗时={}ms, warnings={}",
                problemId, level, status, result.getDuration(), result.getWarnings().size());
        return result;
    }

    /**
     * 加载题目，不存在则抛异常
     */
    private Problem loadProblem(String problemId) {
        return problemRepo.findById(problemId)
                .orElseThrow(() -> new ResourceNotFoundException("题目", problemId));
    }

    /**
     * 【可降级】为高级别内容的各解法补充多语言代码
     */
    private void supplementCode(LeveledContent content, Problem problem,
                                int level, GenerationOptions options,
                                GenerationResult result) {
        if (options.isSkipCodeGen()) return;
        if (level < 3) return;

        List<LeveledContent.Approach> approaches = content.getApproaches();
        if (approaches == null || approaches.isEmpty()) return;

        for (LeveledContent.Approach approach : approaches) {
            try {
                codeGenerator.generateForApproach(approach, problem);
            } catch (Exception e) {
                String warning = "代码生成降级: approach=" + approach.getName()
                        + ", 原因=" + e.getMessage();
                log.warn(warning);
                result.getWarnings().add(warning);
            }
        }
    }

    /**
     * 【可降级】生成图解
     */
    private void generateDiagram(Problem problem, GenerationOptions options,
                                 GenerationResult result) {
        if (options.isSkipDiagram()) return;
        try {
            diagramService.generateForProblem(problem);
        } catch (Exception e) {
            String warning = "图解生成降级: " + e.getMessage();
            log.warn(warning);
            result.getWarnings().add(warning);
        }
    }

    /**
     * 【可降级】解法对比分析（需要 2 个及以上解法）
     */
    private void generateComparison(LeveledContent content, Problem problem,
                                    GenerationOptions options, GenerationResult result) {
        if (options.isSkipComparison()) return;

        List<LeveledContent.Approach> approaches = content.getApproaches();
        if (approaches == null || approaches.size() < 2) return;

        try {
            comparator.compare(approaches, problem);
        } catch (Exception e) {
            String warning = "对比分析降级: " + e.getMessage();
            log.warn(warning);
            result.getWarnings().add(warning);
        }
    }

    /**
     * 根据校验报告和解析结果确定状态
     */
    private ExplanationStatus determineStatus(ValidationReport report, LeveledContent content) {
        // 解析失败 + 校验未通过 → 待审核
        if (!content.isParseSuccess() && !report.isPassed()) {
            return ExplanationStatus.PENDING_REVIEW;
        }
        // 校验通过（可能有 warning）→ 发布
        if (report.isPassed()) {
            return ExplanationStatus.PUBLISHED;
        }
        // 有 error → 待审核
        return ExplanationStatus.PENDING_REVIEW;
    }

    /**
     * 持久化解析内容：标记旧版本，保存新版本
     */
    private Explanation persist(String problemId, int level,
                               LeveledContent content, ExplanationStatus status) {
        markOldVersions(problemId, level);
        int nextVersion = calculateNextVersion(problemId, level);

        Explanation explanation = new Explanation();
        explanation.setProblemId(problemId);
        explanation.setLevel(level);
        explanation.setSections(content.getRawJson());
        explanation.setVersion(nextVersion);
        explanation.setIsLatest(true);
        explanation.setStatus(status);

        return explanationRepo.save(explanation);
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
     * 计算下一个版本号
     */
    private int calculateNextVersion(String problemId, int level) {
        List<Explanation> existing = explanationRepo
                .findByProblemIdAndLevelOrderByVersionDesc(problemId, level);
        return existing.isEmpty() ? 1 : existing.get(0).getVersion() + 1;
    }

    /**
     * 缓存到 Redis
     */
    private void cacheExplanation(Explanation explanation) {
        try {
            String key = CACHE_PREFIX + explanation.getProblemId()
                    + ":L" + explanation.getLevel();
            redisTemplate.opsForValue().set(key, explanation, CACHE_TTL_HOURS, TimeUnit.HOURS);
        } catch (Exception e) {
            log.warn("Redis 缓存写入失败: {}", e.getMessage());
        }
    }
}
