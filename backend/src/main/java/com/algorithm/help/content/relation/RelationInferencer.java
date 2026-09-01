package com.algorithm.help.content.relation;

import com.algorithm.help.common.enums.Difficulty;
import com.algorithm.help.common.enums.RelationType;
import com.algorithm.help.entity.Problem;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.experimental.Accessors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 关联关系推断器
 * <p>
 * 基于题目标签和难度等级规则推断关联类型，并计算置信度分数。
 * 推断规则：
 * - 同标签 + 目标难度低 → PREREQUISITE
 * - 同标签 + 同难度 → SIMILAR_PATTERN
 * - 同标签 + 目标难度高 → FOLLOW_UP
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RelationInferencer {

    /** 低置信度阈值，低于此值标记为 PENDING_CONFIRM */
    public static final float LOW_CONFIDENCE_THRESHOLD = 0.6f;

    private final ObjectMapper objectMapper;

    /**
     * 推断两道题之间的关联类型和置信度
     *
     * @param fromProblem 源题目
     * @param toProblem   目标题目
     * @return 推断结果，无法推断时返回 null
     */
    public InferenceResult inferRelationType(Problem fromProblem, Problem toProblem) {
        Set<String> commonTags = findCommonTags(fromProblem, toProblem);
        if (commonTags.isEmpty()) {
            return null;
        }

        RelationType type = inferByDifficulty(fromProblem.getDifficulty(), toProblem.getDifficulty());
        float confidence = calculateConfidence(commonTags, fromProblem, toProblem);
        String status = confidence < LOW_CONFIDENCE_THRESHOLD ? "PENDING_CONFIRM" : "CONFIRMED";

        return new InferenceResult()
                .setType(type)
                .setConfidence(confidence)
                .setStatus(status)
                .setCommonTags(commonTags)
                .setReason(buildReason(type, commonTags));
    }

    /**
     * 根据难度差异推断关联类型
     * - 目标比源简单 → PREREQUISITE（前置知识）
     * - 同难度 → SIMILAR_PATTERN（相似模式）
     * - 目标比源难 → FOLLOW_UP（进阶题）
     */
    private RelationType inferByDifficulty(Difficulty from, Difficulty to) {
        int diff = difficultyOrder(to) - difficultyOrder(from);
        if (diff < 0) {
            return RelationType.PREREQUISITE;
        } else if (diff == 0) {
            return RelationType.SIMILAR_PATTERN;
        } else {
            return RelationType.FOLLOW_UP;
        }
    }

    /**
     * 难度等级数值映射
     */
    private int difficultyOrder(Difficulty difficulty) {
        return switch (difficulty) {
            case EASY -> 1;
            case MEDIUM -> 2;
            case HARD -> 3;
        };
    }

    /**
     * 计算置信度分数
     * 基础置信度 = 公共标签数 / 源题标签数
     * 加成因子：标签数越多、匹配越精确，置信度越高
     */
    private float calculateConfidence(Set<String> commonTags, Problem from, Problem to) {
        List<String> fromTags = parseTags(from.getTags());
        if (fromTags.isEmpty()) {
            return 0.5f;
        }
        // 基础分 = 公共标签占比
        float baseScore = (float) commonTags.size() / fromTags.size();
        // 加成：公共标签 >= 2 时额外加 0.1
        float bonus = commonTags.size() >= 2 ? 0.1f : 0f;
        return Math.min(1.0f, baseScore * 0.8f + bonus + 0.2f);
    }

    /**
     * 查找两道题的公共标签
     */
    private Set<String> findCommonTags(Problem from, Problem to) {
        List<String> fromTags = parseTags(from.getTags());
        List<String> toTags = parseTags(to.getTags());
        if (fromTags.isEmpty() || toTags.isEmpty()) {
            return Collections.emptySet();
        }
        Set<String> toTagSet = Set.copyOf(toTags);
        return fromTags.stream()
                .filter(toTagSet::contains)
                .collect(Collectors.toSet());
    }

    /**
     * 解析 JSON 格式的标签字段
     */
    private List<String> parseTags(String tagsJson) {
        if (tagsJson == null || tagsJson.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(tagsJson, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            log.warn("标签 JSON 解析失败: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * 构建推断原因描述
     */
    private String buildReason(RelationType type, Set<String> commonTags) {
        String tags = String.join("、", commonTags);
        return switch (type) {
            case PREREQUISITE -> "共享标签[" + tags + "]，目标题难度较低，属前置知识";
            case SIMILAR_PATTERN -> "共享标签[" + tags + "]，难度相同，属相似模式";
            case FOLLOW_UP -> "共享标签[" + tags + "]，目标题难度更高，属进阶题";
            default -> "共享标签[" + tags + "]";
        };
    }

    /**
     * 推断结果数据结构
     */
    @Data
    @Accessors(chain = true)
    public static class InferenceResult {
        /** 推断的关联类型 */
        private RelationType type;
        /** 置信度 0-1 */
        private float confidence;
        /** 状态：CONFIRMED / PENDING_CONFIRM */
        private String status;
        /** 公共标签 */
        private Set<String> commonTags;
        /** 推断原因 */
        private String reason;
    }
}
