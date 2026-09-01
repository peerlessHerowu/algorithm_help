package com.algorithm.help.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.common.exception.ResourceNotFoundException;
import com.algorithm.help.entity.Explanation;
import com.algorithm.help.entity.ExplanationStatus;
import com.algorithm.help.repository.ExplanationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 管理员解析内容管理控制器
 * 版本历史查询、审批、驳回、回滚
 */
@RestController
@RequiredArgsConstructor
public class AdminExplanationController {

    private final ExplanationRepository explanationRepo;

    /** 查询题目解析版本历史 */
    @GetMapping("/api/v1/problems/{problemId}/explanation/history")
    public ResponseEntity<ApiResponse<List<Explanation>>> history(
            @PathVariable String problemId) {
        List<Explanation> versions = explanationRepo
                .findByProblemIdOrderByLevelAscVersionDesc(problemId);
        return ResponseEntity.ok(ApiResponse.success(versions));
    }

    /** 管理员批准待审核内容 → PUBLISHED */
    @PostMapping("/api/v1/admin/explanations/{id}/approve")
    public ResponseEntity<ApiResponse<Explanation>> approve(@PathVariable String id) {
        Explanation exp = findById(id);
        exp.setStatus(ExplanationStatus.PUBLISHED);
        explanationRepo.save(exp);
        return ResponseEntity.ok(ApiResponse.success(exp));
    }

    /** 管理员驳回内容 → REJECTED */
    @PostMapping("/api/v1/admin/explanations/{id}/reject")
    public ResponseEntity<ApiResponse<Explanation>> reject(@PathVariable String id) {
        Explanation exp = findById(id);
        exp.setStatus(ExplanationStatus.REJECTED);
        explanationRepo.save(exp);
        return ResponseEntity.ok(ApiResponse.success(exp));
    }

    /** 管理员回滚到指定版本 */
    @PutMapping("/api/v1/admin/explanations/{id}/rollback")
    public ResponseEntity<ApiResponse<Explanation>> rollback(
            @PathVariable String id,
            @RequestParam int version) {
        Explanation current = findById(id);
        String problemId = current.getProblemId();
        int level = current.getLevel();

        // 找到目标版本
        List<Explanation> allVersions = explanationRepo
                .findByProblemIdAndLevelOrderByVersionDesc(problemId, level);
        Explanation target = allVersions.stream()
                .filter(e -> e.getVersion() == version)
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("版本 " + version + " 不存在"));

        // 所有版本 isLatest=false
        allVersions.forEach(e -> e.setIsLatest(false));
        explanationRepo.saveAll(allVersions);

        // 目标版本设为最新
        target.setIsLatest(true);
        target.setStatus(ExplanationStatus.PUBLISHED);
        explanationRepo.save(target);

        return ResponseEntity.ok(ApiResponse.success(target));
    }

    private Explanation findById(String id) {
        return explanationRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("解析不存在: " + id));
    }
}
