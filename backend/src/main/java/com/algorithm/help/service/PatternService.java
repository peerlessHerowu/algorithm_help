package com.algorithm.help.service;

import com.algorithm.help.common.exception.ResourceNotFoundException;
import com.algorithm.help.entity.AlgorithmPattern;
import com.algorithm.help.repository.PatternRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 算法模式服务：列表查询和详情
 */
@Slf4j
@Service
public class PatternService {

    private final PatternRepository patternRepo;

    public PatternService(PatternRepository patternRepo) {
        this.patternRepo = patternRepo;
    }

    /**
     * 获取所有算法模式列表
     */
    public List<AlgorithmPattern> listPatterns() {
        return patternRepo.findAll();
    }

    /**
     * 根据 ID 获取模式详情
     */
    public AlgorithmPattern getById(String id) {
        return patternRepo.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("算法模式", id));
    }

    /**
     * 批量根据 ID 列表查询模式
     */
    public List<AlgorithmPattern> findByIds(List<String> ids) {
        return patternRepo.findAllById(ids);
    }
}
