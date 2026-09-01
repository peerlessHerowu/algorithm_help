package com.algorithm.help.content;

import com.algorithm.help.content.dto.CreateSolutionRequest;
import com.algorithm.help.content.dto.SolutionDTO;
import com.algorithm.help.content.dto.UpdateSolutionRequest;
import com.algorithm.help.internal.entity.UserSolution;
import com.algorithm.help.internal.repository.UserSolutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * 用户题解业务逻辑
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SolutionService {

    private final UserSolutionRepository solutionRepo;

    /**
     * 创建题解
     */
    public SolutionDTO create(String problemId, String userId, CreateSolutionRequest request) {
        UserSolution solution = new UserSolution()
                .setId(UUID.randomUUID().toString())
                .setProblemId(problemId)
                .setUserId(userId)
                .setTitle(request.getTitle())
                .setLanguage(request.getLanguage())
                .setSourceType(request.getSourceType());

        // 根据 sourceType 决定内容处理方式
        applyContentBySourceType(solution, request);

        solutionRepo.save(solution);
        log.info("用户 {} 创建题解 {} (problemId={}, sourceType={})",
                userId, solution.getId(), problemId, request.getSourceType());
        return toDTO(solution);
    }

    /**
     * 分页查询题解列表
     *
     * @param sort latest=按createdAt降序, hot=按upvotes降序, featured=筛选status=FEATURED
     */
    public Page<SolutionDTO> list(String problemId, int page, int size, String sort) {
        Pageable pageable = buildPageable(page, size, sort);

        Page<UserSolution> solutions;
        if ("featured".equalsIgnoreCase(sort)) {
            solutions = solutionRepo.findByProblemIdAndStatusAndDeletedFalse(
                    problemId, "FEATURED", pageable);
        } else {
            solutions = solutionRepo.findByProblemIdAndDeletedFalse(problemId, pageable);
        }
        return solutions.map(this::toDTO);
    }

    /**
     * 更新题解（仅作者可操作）
     */
    public SolutionDTO update(String solutionId, String userId, UpdateSolutionRequest request) {
        UserSolution solution = findByIdOrThrow(solutionId);
        checkOwnership(solution, userId);

        if (request.getTitle() != null) {
            solution.setTitle(request.getTitle());
        }
        if (request.getContent() != null) {
            solution.setContent(request.getContent());
        }
        if (request.getLanguage() != null) {
            solution.setLanguage(request.getLanguage());
        }
        solutionRepo.save(solution);
        log.info("用户 {} 更新题解 {}", userId, solutionId);
        return toDTO(solution);
    }

    /**
     * 软删除题解（仅作者可操作）
     */
    public void delete(String solutionId, String userId) {
        UserSolution solution = findByIdOrThrow(solutionId);
        checkOwnership(solution, userId);

        solution.setDeleted(true);
        solutionRepo.save(solution);
        log.info("用户 {} 软删除题解 {}", userId, solutionId);
    }

    /**
     * 标记精选
     */
    public SolutionDTO feature(String solutionId) {
        UserSolution solution = findByIdOrThrow(solutionId);
        solution.setStatus("FEATURED");
        solutionRepo.save(solution);
        log.info("管理员标记题解 {} 为精选", solutionId);
        return toDTO(solution);
    }

    /**
     * 提升为官方解析（当前仅记录日志，实际复制到 Explanation 表留作 TODO）
     */
    public void promote(String solutionId) {
        UserSolution solution = findByIdOrThrow(solutionId);
        log.info("管理员提升题解 {} 为官方解析 (problemId={}, title={})。TODO: 复制到 Explanation 表",
                solutionId, solution.getProblemId(), solution.getTitle());
    }

    // ======================== 私有方法 ========================

    /**
     * 根据 sourceType 决定内容如何存储
     * - USER_INPUT: 直接存入 content，状态 PUBLISHED
     * - URL_IMPORT: 存入 rawContent，content 为空，状态 DRAFT（待 AI 处理）
     * - FEYNMAN_OUTPUT: 存入 rawContent，content 为空，状态 DRAFT（待 AI 处理）
     */
    private void applyContentBySourceType(UserSolution solution, CreateSolutionRequest request) {
        String sourceType = request.getSourceType();
        switch (sourceType) {
            case "URL_IMPORT" -> {
                solution.setRawContent(request.getContent());
                solution.setSourceUrl(request.getSourceUrl());
                solution.setStatus("DRAFT");
            }
            case "FEYNMAN_OUTPUT" -> {
                solution.setRawContent(request.getContent());
                solution.setStatus("DRAFT");
            }
            default -> {
                // USER_INPUT：直接发布
                solution.setContent(request.getContent());
                solution.setStatus("PUBLISHED");
            }
        }
    }

    private Pageable buildPageable(int page, int size, String sort) {
        Sort ordering = switch (sort != null ? sort.toLowerCase() : "latest") {
            case "hot" -> Sort.by(Sort.Direction.DESC, "upvotes");
            case "featured" -> Sort.by(Sort.Direction.DESC, "createdAt");
            default -> Sort.by(Sort.Direction.DESC, "createdAt");
        };
        return PageRequest.of(page, size, ordering);
    }

    private UserSolution findByIdOrThrow(String id) {
        return solutionRepo.findById(id)
                .filter(s -> !s.getDeleted())
                .orElseThrow(() -> new IllegalArgumentException("题解不存在: " + id));
    }

    private void checkOwnership(UserSolution solution, String userId) {
        if (solution.getUserId() == null || !solution.getUserId().equals(userId)) {
            throw new IllegalArgumentException("无权操作他人的题解");
        }
    }

    private SolutionDTO toDTO(UserSolution entity) {
        return new SolutionDTO()
                .setId(entity.getId())
                .setProblemId(entity.getProblemId())
                .setTitle(entity.getTitle())
                .setContent(entity.getContent())
                .setLanguage(entity.getLanguage())
                .setSourceType(entity.getSourceType())
                .setStatus(entity.getStatus())
                .setAuthorName(entity.getAuthorName())
                .setUpvotes(entity.getUpvotes())
                .setViewCount(entity.getViewCount())
                .setUserId(entity.getUserId())
                .setCreatedAt(entity.getCreatedAt())
                .setUpdatedAt(entity.getUpdatedAt());
    }
}
