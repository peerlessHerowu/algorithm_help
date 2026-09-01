package com.algorithm.help.service;

import com.algorithm.help.common.enums.Difficulty;
import com.algorithm.help.common.exception.ResourceNotFoundException;
import com.algorithm.help.entity.Problem;
import com.algorithm.help.repository.ProblemRepository;
import com.algorithm.help.service.search.SearchStrategyFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

/**
 * 题目服务：封装分页查询、筛选、详情
 */
@Slf4j
@Service
public class ProblemService {

    private final ProblemRepository problemRepo;
    private final SearchStrategyFactory searchFactory;

    public ProblemService(ProblemRepository problemRepo,
                          SearchStrategyFactory searchFactory) {
        this.problemRepo = problemRepo;
        this.searchFactory = searchFactory;
    }

    /**
     * 分页查询题目，支持按难度和关键词筛选
     */
    public Page<Problem> listProblems(Difficulty difficulty, String keyword, Pageable pageable) {
        if (keyword != null && !keyword.isBlank()) {
            return searchFactory.getStrategy().search(keyword, pageable);
        }
        if (difficulty != null) {
            return problemRepo.findByDifficulty(difficulty, pageable);
        }
        return problemRepo.findAll(pageable);
    }

    /**
     * 根据 ID 获取题目详情
     */
    public Problem getById(String id) {
        return problemRepo.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("题目", id));
    }
}
