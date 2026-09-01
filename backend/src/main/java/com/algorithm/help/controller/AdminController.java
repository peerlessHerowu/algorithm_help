package com.algorithm.help.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.internal.entity.UserSolution;
import com.algorithm.help.internal.repository.UserSolutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 管理员通用操作控制器
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UserSolutionRepository solutionRepo;

    /** 手动触发数据库备份（记录日志，实际备份由 Docker 容器的 backup 服务执行） */
    @PostMapping("/backup/trigger")
    public ResponseEntity<ApiResponse<Map<String, String>>> triggerBackup() {
        log.info("管理员手动触发数据库备份");
        Map<String, String> result = Map.of(
                "status", "triggered",
                "message", "备份任务已触发，请查看 ./backups/ 目录"
        );
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * 合规与来源下架
     * 将指定平台 + platformId 关联的 UserSolution 标记为 HIDDEN
     */
    @DeleteMapping("/sources/{platform}/{platformId}")
    public ApiResponse<Map<String, Object>> takedownBySource(
            @PathVariable String platform,
            @PathVariable String platformId) {
        List<UserSolution> solutions = solutionRepo
                .findByPlatformAndSourceUrlContainingAndDeletedFalse(platform, platformId);

        int count = 0;
        for (UserSolution solution : solutions) {
            solution.setStatus("HIDDEN");
            solutionRepo.save(solution);
            count++;
        }

        log.info("合规下架: platform={}, platformId={}, 影响题解数={}", platform, platformId, count);
        return ApiResponse.success(Map.of(
                "platform", platform,
                "platformId", platformId,
                "hiddenCount", count
        ));
    }
}
