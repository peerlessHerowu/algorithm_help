package com.algorithm.help.training.service;

import com.algorithm.help.graph.entity.GraphEdge;
import com.algorithm.help.graph.entity.GraphNode;
import com.algorithm.help.graph.entity.UserProgress;
import com.algorithm.help.graph.enums.NodeType;
import com.algorithm.help.graph.enums.RelationType;
import com.algorithm.help.graph.repository.GraphEdgeRepository;
import com.algorithm.help.graph.repository.GraphNodeRepository;
import com.algorithm.help.graph.repository.GraphUserProgressRepository;
import com.algorithm.help.training.dto.*;
import com.algorithm.help.training.entity.TrainingRecord;
import com.algorithm.help.training.repository.TrainingRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 模式识别训练服务
 * <p>
 * 提供测验生成、答案提交和统计功能，帮助用户训练算法模式快速识别能力
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PatternTrainingService {

    private final GraphNodeRepository nodeRepo;
    private final GraphEdgeRepository edgeRepo;
    private final GraphUserProgressRepository progressRepo;
    private final TrainingRecordRepository recordRepo;

    /** 薄弱模式阈值（正确率低于 60% 视为薄弱） */
    private static final double WEAK_THRESHOLD = 0.6;
    /** 选项数量 */
    private static final int OPTIONS_COUNT = 4;

    private final Random random = new Random();

    // ==================== 生成测验 ====================

    /**
     * 生成模式识别测验
     *
     * @param userId        用户 ID
     * @param questionCount 题目数量
     * @return 测验对象
     */
    public Quiz generateQuiz(String userId, int questionCount) {
        // 获取薄弱模式优先出题
        List<String> weakPatterns = getWeakPatternIds(userId);
        // 获取所有 PATTERN 节点作为候选
        List<GraphNode> allPatterns = nodeRepo.findByType(NodeType.PATTERN);
        if (allPatterns.isEmpty()) {
            return new Quiz().setQuestions(Collections.emptyList());
        }

        // 选取题目节点
        List<GraphNode> problems = selectProblems(weakPatterns, questionCount);
        // 构建测验题列表
        List<QuizQuestion> questions = buildQuestions(problems, allPatterns);
        return new Quiz().setQuestions(questions);
    }

    // ==================== 提交答案 ====================

    /**
     * 提交答案并记录结果
     *
     * @param userId    用户 ID
     * @param problemId 题目 ID
     * @param answer    用户选择的模式 ID
     * @return 提交结果
     */
    @Transactional
    public QuizResult submitAnswer(String userId, String problemId, String answer) {
        // 查找题目节点，确定正确答案
        String correctPatternId = findCorrectPattern(problemId);
        boolean isCorrect = answer.equals(correctPatternId);

        // 保存训练记录
        saveTrainingRecord(userId, problemId, answer, correctPatternId, isCorrect);
        // 更新用户进度
        updateUserProgress(userId, problemId, correctPatternId, isCorrect);

        // 构建返回结果
        String patternName = getPatternName(correctPatternId);
        String explanation = buildExplanation(problemId, correctPatternId);
        return new QuizResult()
                .setCorrect(isCorrect)
                .setCorrectAnswer(correctPatternId)
                .setCorrectPatternName(patternName)
                .setExplanation(explanation);
    }

    // ==================== 统计 ====================

    /**
     * 获取用户按模式分类的训练统计
     *
     * @param userId 用户 ID
     * @return 各模式训练统计列表
     */
    public List<PatternStatsDTO> getStats(String userId) {
        List<TrainingRecord> records = recordRepo.findByUserId(userId);
        if (records.isEmpty()) {
            return Collections.emptyList();
        }

        // 按正确答案（模式 ID）分组统计
        Map<String, List<TrainingRecord>> grouped = records.stream()
                .collect(Collectors.groupingBy(TrainingRecord::getCorrectAnswer));

        return grouped.entrySet().stream()
                .map(entry -> buildPatternStats(entry.getKey(), entry.getValue()))
                .sorted(Comparator.comparingDouble(PatternStatsDTO::getAccuracy))
                .collect(Collectors.toList());
    }

    // ==================== 私有方法 ====================

    /**
     * 获取用户薄弱模式 ID 列表（正确率 < 60%）
     */
    private List<String> getWeakPatternIds(String userId) {
        List<UserProgress> progressList = progressRepo.findByUserId(userId);
        return progressList.stream()
                .filter(p -> p.getPatternId() != null && p.getAttempts() != null && p.getAttempts() > 0)
                .collect(Collectors.groupingBy(UserProgress::getPatternId))
                .entrySet().stream()
                .filter(e -> calcGroupAccuracy(e.getValue()) < WEAK_THRESHOLD)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
    }

    /**
     * 计算一组进度记录的综合正确率
     */
    private double calcGroupAccuracy(List<UserProgress> list) {
        int totalAttempts = list.stream().mapToInt(p -> p.getAttempts() != null ? p.getAttempts() : 0).sum();
        int totalCorrect = list.stream().mapToInt(p -> p.getCorrectCount() != null ? p.getCorrectCount() : 0).sum();
        return totalAttempts == 0 ? 0.0 : (double) totalCorrect / totalAttempts;
    }

    /**
     * 从薄弱模式关联的题目中选题；不足时从全部题目补充
     */
    private List<GraphNode> selectProblems(List<String> weakPatterns, int count) {
        List<GraphNode> candidates = new ArrayList<>();

        // 优先从薄弱模式关联的 PROBLEM 节点选取
        for (String patternId : weakPatterns) {
            List<GraphEdge> edges = edgeRepo.findBySourceIdAndRelationType(patternId, RelationType.SIMILAR_PATTERN);
            List<String> problemIds = edges.stream()
                    .map(GraphEdge::getTargetId)
                    .collect(Collectors.toList());
            if (!problemIds.isEmpty()) {
                candidates.addAll(nodeRepo.findByIdIn(problemIds));
            }
        }

        // 不足时从所有 PROBLEM 节点中随机补充
        if (candidates.size() < count) {
            List<GraphNode> allProblems = nodeRepo.findByType(NodeType.PROBLEM);
            Set<String> existingIds = candidates.stream().map(GraphNode::getId).collect(Collectors.toSet());
            List<GraphNode> extra = allProblems.stream()
                    .filter(p -> !existingIds.contains(p.getId()))
                    .collect(Collectors.toList());
            Collections.shuffle(extra, random);
            candidates.addAll(extra);
        }

        // 打乱并截取指定数量
        Collections.shuffle(candidates, random);
        return candidates.stream().limit(count).collect(Collectors.toList());
    }

    /**
     * 为选中的题目构建测验题（隐藏标签 + 生成选项）
     */
    private List<QuizQuestion> buildQuestions(List<GraphNode> problems, List<GraphNode> allPatterns) {
        return problems.stream()
                .map(problem -> {
                    String correctPatternId = findCorrectPattern(problem.getId());
                    List<QuizOption> options = generateOptions(correctPatternId, allPatterns);
                    return new QuizQuestion()
                            .setProblemId(problem.getId())
                            .setProblemDescription(maskTags(problem))
                            .setOptions(options)
                            .setCorrectAnswer(correctPatternId);
                })
                .collect(Collectors.toList());
    }

    /**
     * 查找题目关联的正确模式 ID（通过 SIMILAR_PATTERN 边反查）
     */
    private String findCorrectPattern(String problemId) {
        // 作为 target 被 PATTERN 节点通过 SIMILAR_PATTERN 指向
        List<GraphEdge> edges = edgeRepo.findByTargetId(problemId);
        return edges.stream()
                .filter(e -> e.getRelationType() == RelationType.SIMILAR_PATTERN)
                .map(GraphEdge::getSourceId)
                .findFirst()
                .orElse("unknown");
    }

    /**
     * 生成 4 个选项：1 正确 + 3 随机干扰
     */
    private List<QuizOption> generateOptions(String correctPatternId, List<GraphNode> allPatterns) {
        List<QuizOption> options = new ArrayList<>();

        // 添加正确选项
        GraphNode correctNode = allPatterns.stream()
                .filter(p -> p.getId().equals(correctPatternId))
                .findFirst()
                .orElse(null);
        if (correctNode != null) {
            options.add(new QuizOption().setPatternId(correctNode.getId()).setPatternName(correctNode.getName()));
        } else {
            options.add(new QuizOption().setPatternId(correctPatternId).setPatternName(correctPatternId));
        }

        // 添加 3 个随机干扰选项
        List<GraphNode> distractors = allPatterns.stream()
                .filter(p -> !p.getId().equals(correctPatternId))
                .collect(Collectors.toList());
        Collections.shuffle(distractors, random);
        distractors.stream()
                .limit(OPTIONS_COUNT - 1)
                .forEach(d -> options.add(new QuizOption().setPatternId(d.getId()).setPatternName(d.getName())));

        // 打乱选项顺序
        Collections.shuffle(options, random);
        return options;
    }

    /**
     * 隐藏题目标签信息，仅保留描述
     */
    private String maskTags(GraphNode problem) {
        String desc = problem.getDescription();
        if (desc == null || desc.isBlank()) {
            return problem.getName();
        }
        // 移除可能暴露模式的关键词标签（如 category 信息）
        return desc;
    }

    /**
     * 保存训练记录
     */
    private void saveTrainingRecord(String userId, String problemId, String answer,
                                    String correctPatternId, boolean isCorrect) {
        TrainingRecord record = new TrainingRecord()
                .setUserId(userId)
                .setProblemId(problemId)
                .setSelectedAnswer(answer)
                .setCorrectAnswer(correctPatternId)
                .setIsCorrect(isCorrect);
        recordRepo.save(record);
    }

    /**
     * 更新用户进度：增加尝试次数，正确时增加正确次数
     */
    private void updateUserProgress(String userId, String problemId,
                                    String patternId, boolean isCorrect) {
        List<UserProgress> existing = progressRepo.findByUserIdAndPatternId(userId, patternId);
        UserProgress progress;
        if (existing.isEmpty()) {
            progress = new UserProgress()
                    .setUserId(userId)
                    .setProblemId(problemId)
                    .setPatternId(patternId)
                    .setAttempts(0)
                    .setCorrectCount(0);
        } else {
            progress = existing.get(0);
        }

        progress.setAttempts(progress.getAttempts() + 1);
        if (isCorrect) {
            progress.setCorrectCount(progress.getCorrectCount() + 1);
        }
        progress.setLastPracticeAt(System.currentTimeMillis());
        progressRepo.save(progress);
    }

    /**
     * 获取模式显示名称
     */
    private String getPatternName(String patternId) {
        return nodeRepo.findById(patternId)
                .map(GraphNode::getName)
                .orElse(patternId);
    }

    /**
     * 构建解释说明（为什么是这个模式）
     */
    private String buildExplanation(String problemId, String correctPatternId) {
        String patternName = getPatternName(correctPatternId);
        return String.format("该题属于「%s」模式。通过识别题目中的关键信号可快速归类。", patternName);
    }

    /**
     * 构建单个模式的统计 DTO
     */
    private PatternStatsDTO buildPatternStats(String patternId, List<TrainingRecord> records) {
        int total = records.size();
        int correct = (int) records.stream().filter(r -> Boolean.TRUE.equals(r.getIsCorrect())).count();
        double accuracy = total == 0 ? 0.0 : (double) correct / total;

        return new PatternStatsDTO()
                .setPatternId(patternId)
                .setPatternName(getPatternName(patternId))
                .setTotalAttempts(total)
                .setCorrectCount(correct)
                .setAccuracy(accuracy);
    }
}
