package com.algorithm.help.config;

import com.algorithm.help.entity.Problem;
import com.algorithm.help.common.enums.Difficulty;
import com.algorithm.help.repository.ProblemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 题目种子数据加载器
 * 应用启动时自动加载基础题目元信息（幂等）
 */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class ProblemSeedDataLoader implements ApplicationRunner {

    private final ProblemRepository problemRepo;

    @Override
    public void run(ApplicationArguments args) {
        long existingCount = problemRepo.count();
        if (existingCount > 0) {
            log.info("题目数据已存在({} 道)，跳过种子加载", existingCount);
            return;
        }
        List<Problem> seedProblems = buildSeedProblems();
        problemRepo.saveAll(seedProblems);
        log.info("种子数据加载完成：{} 道题目", seedProblems.size());
    }

    /** 构建种子题目列表（前 10 道热门算法题） */
    private List<Problem> buildSeedProblems() {
        return List.of(
                buildProblem("Two Sum", Difficulty.EASY, List.of("array", "hash-table")),
                buildProblem("Add Two Numbers", Difficulty.MEDIUM, List.of("linked-list", "math")),
                buildProblem("Longest Substring Without Repeating Characters", Difficulty.MEDIUM, List.of("string", "sliding-window")),
                buildProblem("Median of Two Sorted Arrays", Difficulty.HARD, List.of("array", "binary-search")),
                buildProblem("Longest Palindromic Substring", Difficulty.MEDIUM, List.of("string", "dynamic-programming"))
        );
    }

    private Problem buildProblem(String title, Difficulty difficulty, List<String> tags) {
        Problem p = new Problem();
        p.setId(java.util.UUID.randomUUID().toString());
        p.setTitle(title);
        p.setDifficulty(difficulty);
        p.setTags(toJson(tags));
        p.setDescription("题目描述待完善");
        p.setConstraints("[]");
        p.setExamples("[]");
        p.setCompanyTags("[]");
        return p;
    }

    /** 将列表转为 JSON 数组字符串 */
    private String toJson(List<String> list) {
        if (list == null || list.isEmpty()) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(list.get(i)).append("\"");
        }
        sb.append("]");
        return sb.toString();
    }
}
