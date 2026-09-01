package com.algorithm.help.service;

import com.algorithm.help.common.exception.ResourceNotFoundException;
import com.algorithm.help.controller.dto.BatchImportResult;
import com.algorithm.help.controller.dto.CreateProblemRequest;
import com.algorithm.help.controller.dto.ImportDetail;
import com.algorithm.help.controller.dto.UpdateProblemRequest;
import com.algorithm.help.entity.Problem;
import com.algorithm.help.repository.ProblemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 题目管理服务（Admin 操作）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProblemAdminService {

    private final ProblemRepository problemRepo;

    /**
     * 创建题目
     */
    @Transactional
    public Problem createProblem(CreateProblemRequest request) {
        Problem problem = new Problem();
        problem.setId(UUID.randomUUID().toString());
        problem.setTitle(request.getTitle());
        problem.setDifficulty(request.getDifficulty());
        problem.setDescription(request.getDescription());
        problem.setTags(request.getTags());
        problem.setConstraints(request.getConstraints());
        problem.setExamples(request.getExamples());
        problem.setCompanyTags(request.getCompanyTags());
        return problemRepo.save(problem);
    }

    /**
     * 更新题目（部分更新，只更新非 null 字段）
     */
    @Transactional
    public Problem updateProblem(String id, UpdateProblemRequest request) {
        Problem problem = problemRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("题目", id));
        applyPartialUpdate(problem, request);
        return problemRepo.save(problem);
    }

    /**
     * 删除题目（硬删除）
     */
    @Transactional
    public void deleteProblem(String id) {
        if (!problemRepo.existsById(id)) {
            throw new ResourceNotFoundException("题目", id);
        }
        problemRepo.deleteById(id);
        log.info("删除题目: id={}", id);
    }

    /**
     * 批量导入题目
     *
     * @param requests 题目列表
     * @param mode     skip-跳过已存在 / update-覆盖已存在
     */
    @Transactional
    public BatchImportResult batchImport(List<CreateProblemRequest> requests, String mode) {
        int success = 0;
        List<ImportDetail> details = new ArrayList<>();

        for (int i = 0; i < requests.size(); i++) {
            try {
                success += processSingleImport(requests.get(i), mode) ? 1 : 0;
            } catch (Exception e) {
                details.add(new ImportDetail().setIndex(i).setError(e.getMessage()));
            }
        }

        return new BatchImportResult()
                .setSuccess(success)
                .setFailed(details.size())
                .setDetails(details);
    }

    // ==================== 私有方法 ====================

    /**
     * 处理单条导入
     *
     * @return true-成功导入或更新, false-跳过
     */
    private boolean processSingleImport(CreateProblemRequest request, String mode) {
        Optional<Problem> existing = problemRepo.findByTitle(request.getTitle());
        if (existing.isPresent()) {
            if ("update".equals(mode)) {
                applyFullUpdate(existing.get(), request);
                problemRepo.save(existing.get());
                return true;
            }
            // skip 模式，跳过但不算失败
            return false;
        }
        createProblem(request);
        return true;
    }

    private void applyPartialUpdate(Problem problem, UpdateProblemRequest request) {
        if (request.getTitle() != null) problem.setTitle(request.getTitle());
        if (request.getDifficulty() != null) problem.setDifficulty(request.getDifficulty());
        if (request.getDescription() != null) problem.setDescription(request.getDescription());
        if (request.getTags() != null) problem.setTags(request.getTags());
        if (request.getConstraints() != null) problem.setConstraints(request.getConstraints());
        if (request.getExamples() != null) problem.setExamples(request.getExamples());
        if (request.getCompanyTags() != null) problem.setCompanyTags(request.getCompanyTags());
    }

    private void applyFullUpdate(Problem problem, CreateProblemRequest request) {
        problem.setTitle(request.getTitle());
        problem.setDifficulty(request.getDifficulty());
        problem.setDescription(request.getDescription());
        problem.setTags(request.getTags());
        problem.setConstraints(request.getConstraints());
        problem.setExamples(request.getExamples());
        problem.setCompanyTags(request.getCompanyTags());
    }
}
