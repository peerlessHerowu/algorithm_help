package com.algorithm.help.mapping.service;

import com.algorithm.help.mapping.dto.CsvImportResult;
import com.algorithm.help.mapping.dto.PlatformLinkDTO;
import com.algorithm.help.mapping.entity.PlatformMapping;
import com.algorithm.help.mapping.enums.MappingStatus;
import com.algorithm.help.mapping.enums.Platform;
import com.algorithm.help.mapping.repository.PlatformMappingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 多平台题目映射服务
 * <p>
 * 负责平台 ID 解析、CSV 导入、跨平台链接查询和模糊匹配
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MappingService {

    private final PlatformMappingRepository mappingRepo;

    /** 模糊匹配置信度阈值 */
    private static final double MATCH_THRESHOLD = 0.85;

    // ==================== 映射解析 ====================

    /**
     * 根据平台和平台 ID 查询统一题目 ID
     *
     * @param platform   刷题平台
     * @param platformId 平台编号/slug
     * @return 统一题目 ID（不存在则返回 empty）
     */
    public Optional<String> resolve(Platform platform, String platformId) {
        return mappingRepo.findByPlatformAndPlatformId(platform, platformId)
                .map(PlatformMapping::getUnifiedProblemId);
    }

    // ==================== CSV 导入 ====================

    /**
     * 从 CSV 文件导入映射数据
     * <p>
     * CSV 格式：platform,platformId,platformUrl,unifiedProblemId
     * 第一行为 header（跳过），逐行校验，跳过错误行
     *
     * @param file CSV 文件（MultipartFile）
     * @return 导入结果报告
     */
    public CsvImportResult importFromCsv(MultipartFile file) {
        CsvImportResult result = new CsvImportResult();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            // 跳过 header
            String header = reader.readLine();
            if (header == null) {
                return result;
            }
            String line;
            int lineNum = 1;
            while ((line = reader.readLine()) != null) {
                lineNum++;
                processCsvLine(line, lineNum, result);
            }
            result.setTotalRows(lineNum - 1);
        } catch (Exception e) {
            log.error("CSV 导入异常", e);
            result.getErrors().add("文件读取失败: " + e.getMessage());
        }
        return result;
    }

    /**
     * 处理 CSV 单行数据
     */
    private void processCsvLine(String line, int lineNum, CsvImportResult result) {
        String[] parts = line.split(",", -1);
        if (parts.length < 4) {
            result.setErrorCount(result.getErrorCount() + 1);
            result.getErrors().add("第" + lineNum + "行: 列数不足，期望4列");
            return;
        }

        String platformStr = parts[0].trim();
        String platformId = parts[1].trim();
        String platformUrl = parts[2].trim();
        String unifiedProblemId = parts[3].trim();

        // 校验平台枚举
        Platform platform = parsePlatform(platformStr);
        if (platform == null) {
            result.setErrorCount(result.getErrorCount() + 1);
            result.getErrors().add("第" + lineNum + "行: 无效平台 '" + platformStr + "'");
            return;
        }

        // 校验必填字段
        if (platformId.isEmpty() || unifiedProblemId.isEmpty()) {
            result.setErrorCount(result.getErrorCount() + 1);
            result.getErrors().add("第" + lineNum + "行: platformId 或 unifiedProblemId 为空");
            return;
        }

        saveMappingFromCsv(platform, platformId, platformUrl, unifiedProblemId);
        result.setSuccessCount(result.getSuccessCount() + 1);
    }

    /**
     * 保存 CSV 中的映射记录（已存在则更新）
     */
    private void saveMappingFromCsv(Platform platform, String platformId,
                                    String platformUrl, String unifiedProblemId) {
        Optional<PlatformMapping> existing = mappingRepo.findByPlatformAndPlatformId(platform, platformId);
        if (existing.isPresent()) {
            // 已存在则更新
            PlatformMapping mapping = existing.get();
            mapping.setUnifiedProblemId(unifiedProblemId)
                    .setPlatformUrl(platformUrl)
                    .setStatus(MappingStatus.CONFIRMED);
            mappingRepo.save(mapping);
        } else {
            PlatformMapping mapping = new PlatformMapping()
                    .setPlatform(platform)
                    .setPlatformId(platformId)
                    .setPlatformUrl(platformUrl)
                    .setUnifiedProblemId(unifiedProblemId)
                    .setStatus(MappingStatus.CONFIRMED);
            mappingRepo.save(mapping);
        }
    }

    /**
     * 安全解析 Platform 枚举（无效返回 null）
     */
    private Platform parsePlatform(String value) {
        try {
            return Platform.valueOf(value.toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    // ==================== 跨平台链接查询 ====================

    /**
     * 返回某题在所有平台上的链接列表
     *
     * @param unifiedProblemId 统一题目 ID
     * @return 平台链接 DTO 列表
     */
    public List<PlatformLinkDTO> getLinks(String unifiedProblemId) {
        List<PlatformMapping> mappings = mappingRepo.findByUnifiedProblemId(unifiedProblemId);
        return mappings.stream()
                .map(this::toLinkDTO)
                .collect(Collectors.toList());
    }

    private PlatformLinkDTO toLinkDTO(PlatformMapping mapping) {
        return new PlatformLinkDTO()
                .setPlatform(mapping.getPlatform())
                .setPlatformId(mapping.getPlatformId())
                .setPlatformUrl(mapping.getPlatformUrl())
                .setPlatformTitle(mapping.getPlatformTitle());
    }

    // ==================== 模糊匹配 ====================

    /**
     * 基于标题的 Jaccard 相似度模糊匹配
     * <p>
     * 将标题按空格分词，计算 Jaccard 相似度：|A∩B| / |A∪B|
     * 相似度 >= 0.85 时标记为 CONFIRMED，否则标记为 PENDING
     *
     * @param title 待匹配的标题
     * @return 匹配到的映射（如有）
     */
    public Optional<PlatformMapping> fuzzyMatch(String title) {
        if (title == null || title.isBlank()) {
            return Optional.empty();
        }
        Set<String> inputTokens = tokenize(title);
        List<PlatformMapping> allMappings = mappingRepo.findAll();

        PlatformMapping bestMatch = null;
        double bestScore = 0;

        for (PlatformMapping mapping : allMappings) {
            if (mapping.getPlatformTitle() == null) continue;
            Set<String> candidateTokens = tokenize(mapping.getPlatformTitle());
            double similarity = jaccardSimilarity(inputTokens, candidateTokens);
            if (similarity > bestScore) {
                bestScore = similarity;
                bestMatch = mapping;
            }
        }

        if (bestMatch == null) {
            return Optional.empty();
        }

        // 根据置信度设置状态
        if (bestScore >= MATCH_THRESHOLD) {
            bestMatch.setStatus(MappingStatus.CONFIRMED);
        } else {
            bestMatch.setStatus(MappingStatus.PENDING);
        }
        mappingRepo.save(bestMatch);

        return Optional.of(bestMatch);
    }

    /**
     * 分词：按空格拆分并转小写
     */
    private Set<String> tokenize(String text) {
        return Arrays.stream(text.toLowerCase().split("\\s+"))
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    /**
     * 计算两个集合的 Jaccard 相似度：|A∩B| / |A∪B|
     */
    private double jaccardSimilarity(Set<String> a, Set<String> b) {
        if (a.isEmpty() && b.isEmpty()) {
            return 1.0;
        }
        if (a.isEmpty() || b.isEmpty()) {
            return 0.0;
        }
        Set<String> intersection = new HashSet<>(a);
        intersection.retainAll(b);

        Set<String> union = new HashSet<>(a);
        union.addAll(b);

        return (double) intersection.size() / union.size();
    }
}
