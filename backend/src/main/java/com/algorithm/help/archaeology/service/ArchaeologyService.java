package com.algorithm.help.archaeology.service;

import com.algorithm.help.archaeology.entity.AlgorithmArchaeology;
import com.algorithm.help.archaeology.repository.AlgorithmArchaeologyRepository;
import com.algorithm.help.common.exception.ResourceNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 算法考古服务：管理算法发明故事的 CRUD 操作
 */
@Slf4j
@Service
public class ArchaeologyService {

    private final AlgorithmArchaeologyRepository archaeologyRepo;

    public ArchaeologyService(AlgorithmArchaeologyRepository archaeologyRepo) {
        this.archaeologyRepo = archaeologyRepo;
    }

    /**
     * 根据 ID 获取算法考古记录
     */
    public AlgorithmArchaeology getById(String id) {
        return archaeologyRepo.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("算法考古记录", id));
    }

    /**
     * 分页获取所有算法考古记录
     */
    public Page<AlgorithmArchaeology> getAll(Pageable pageable) {
        return archaeologyRepo.findAll(pageable);
    }

    /**
     * 根据关联的算法模式 ID 查询考古记录
     */
    public List<AlgorithmArchaeology> getByPatternId(String patternId) {
        return archaeologyRepo.findByRelatedPatternId(patternId);
    }
}
