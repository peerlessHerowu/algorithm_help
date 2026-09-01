package com.algorithm.help.content.seed;

import com.algorithm.help.common.enums.Difficulty;
import com.algorithm.help.entity.Problem;
import com.algorithm.help.repository.ProblemRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.List;
import java.util.UUID;

/**
 * 种子数据加载器
 * <p>
 * 从 classpath:data/seed/problems-50.json 加载种子题目，幂等导入。
 * 通过 content.seed.auto-init 配置开关控制是否自动加载。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SeedDataLoader {

    private final ProblemRepository problemRepo;
    private final ObjectMapper objectMapper;

    @Value("${content.seed.auto-init:true}")
    private boolean autoInit;

    private static final String SEED_FILE = "data/seed/problems-50.json";

    /**
     * 应用启动后幂等加载种子数据
     */
    @PostConstruct
    public void init() {
        if (!autoInit) {
            log.info("种子数据自动加载已禁用 (content.seed.auto-init=false)");
            return;
        }
        loadSeedData();
    }

    /**
     * 加载种子数据（幂等：跳过已存在的题目）
     */
    private void loadSeedData() {
        List<SeedProblem> seeds = readSeedFile();
        if (seeds == null || seeds.isEmpty()) {
            return;
        }

        int imported = 0;
        for (SeedProblem seed : seeds) {
            if (problemRepo.existsById(seed.getId())) {
                continue;
            }
            Problem problem = convertToProblem(seed);
            problemRepo.save(problem);
            imported++;
        }
        log.info("种子数据加载完成: 文件含 {} 题, 新导入 {} 题", seeds.size(), imported);
    }

    /**
     * 读取种子文件，文件不存在则返回 null
     */
    private List<SeedProblem> readSeedFile() {
        try {
            ClassPathResource resource = new ClassPathResource(SEED_FILE);
            if (!resource.exists()) {
                log.info("种子文件不存在: {}，跳过加载", SEED_FILE);
                return null;
            }
            InputStream is = resource.getInputStream();
            return objectMapper.readValue(is, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("读取种子文件失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 将种子数据转为 Problem 实体
     */
    private Problem convertToProblem(SeedProblem seed) {
        Problem p = new Problem();
        p.setId(seed.getId() != null ? seed.getId() : UUID.randomUUID().toString());
        p.setTitle(seed.getTitle());
        p.setDifficulty(Difficulty.valueOf(seed.getDifficulty().toUpperCase()));
        p.setTags(toJson(seed.getTags()));
        p.setDescription(seed.getDescription());
        p.setConstraints(toJson(seed.getConstraints()));
        p.setExamples(toJson(seed.getExamples()));
        p.setCompanyTags("[]");
        return p;
    }

    /**
     * 对象序列化为 JSON 字符串
     */
    private String toJson(Object obj) {
        if (obj == null) return "[]";
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return "[]";
        }
    }

    /**
     * 种子题目数据结构
     */
    @Data
    public static class SeedProblem {
        private String id;
        private String title;
        private String difficulty;
        private List<String> tags;
        private String description;
        private List<String> constraints;
        private List<String> examples;
    }
}
