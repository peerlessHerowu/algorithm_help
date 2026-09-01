package com.algorithm.help.internal.service;

import com.algorithm.help.common.enums.Difficulty;
import com.algorithm.help.entity.Problem;
import com.algorithm.help.internal.dto.InternalProblemRequest;
import com.algorithm.help.internal.dto.InternalSolutionRequest;
import com.algorithm.help.internal.entity.UserSolution;
import com.algorithm.help.internal.repository.UserSolutionRepository;
import com.algorithm.help.repository.ProblemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

/**
 * 内部写入服务 — 供 Python 爬虫通过 HTTP 写入 Problem / UserSolution
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InternalWriteService {

    private final ProblemRepository problemRepo;
    private final UserSolutionRepository solutionRepo;

    /**
     * 写入或更新 Problem
     *
     * @return 创建/更新后的 Problem ID
     */
    @Transactional
    public String saveProblem(InternalProblemRequest req) {
        // 按平台+平台ID去重：如果已存在则更新
        Problem problem = findExistingProblem(req);
        if (problem == null) {
            problem = new Problem();
            problem.setId(UUID.randomUUID().toString());
        }

        problem.setTitle(req.getTitle());
        problem.setDifficulty(parseDifficulty(req.getDifficulty()));
        problem.setTags(req.getTags());
        problem.setDescription(req.getDescription());
        problem.setConstraints(req.getConstraints());
        problem.setExamples(req.getExamples());
        problem.setCompanyTags(req.getCompanyTags());

        problemRepo.save(problem);
        log.info("内部写入 Problem: id={}, title={}, platform={}",
                problem.getId(), problem.getTitle(), req.getPlatform());
        return problem.getId();
    }

    /**
     * 写入 UserSolution（sourceType=CRAWLED）
     *
     * @return 创建后的 Solution ID
     */
    @Transactional
    public String saveSolution(InternalSolutionRequest req) {
        // 去重：同一 problemId + sourceUrl 不重复写入
        if (req.getSourceUrl() != null && !req.getSourceUrl().isBlank()) {
            boolean exists = solutionRepo.existsByProblemIdAndSourceUrlAndSourceType(
                    req.getProblemId(), req.getSourceUrl(), "CRAWLED");
            if (exists) {
                log.info("题解已存在，跳过: problemId={}, sourceUrl={}", req.getProblemId(), req.getSourceUrl());
                return null;
            }
        }

        UserSolution solution = new UserSolution()
                .setId(UUID.randomUUID().toString())
                .setProblemId(req.getProblemId())
                .setTitle(req.getTitle())
                .setContent(req.getContent())
                .setLanguage(req.getLanguage())
                .setSourceType("CRAWLED")
                .setPlatform(req.getPlatform())
                .setAuthorName(req.getAuthorName())
                .setUpvotes(req.getUpvotes())
                .setSourceUrl(req.getSourceUrl())
                .setProject(req.getProject() != null ? req.getProject() : "algorithm-help");

        solutionRepo.save(solution);
        log.info("内部写入 UserSolution: id={}, problemId={}, platform={}",
                solution.getId(), solution.getProblemId(), req.getPlatform());
        return solution.getId();
    }

    private Problem findExistingProblem(InternalProblemRequest req) {
        if (req.getTitle() == null || req.getTitle().isBlank()) {
            return null;
        }
        Optional<Problem> existing = problemRepo.findByTitle(req.getTitle());
        return existing.orElse(null);
    }

    private Difficulty parseDifficulty(String difficulty) {
        try {
            return Difficulty.valueOf(difficulty.toUpperCase());
        } catch (Exception e) {
            log.warn("无法解析难度值: {}，默认为 MEDIUM", difficulty);
            return Difficulty.MEDIUM;
        }
    }
}
