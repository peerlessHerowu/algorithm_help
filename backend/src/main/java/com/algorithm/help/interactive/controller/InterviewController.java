package com.algorithm.help.interactive.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.interactive.interview.InterviewReport;
import com.algorithm.help.interactive.interview.InterviewReportRepository;
import com.algorithm.help.interactive.interview.InterviewScoreService;
import com.algorithm.help.interactive.session.InteractiveSession;
import com.algorithm.help.interactive.session.SessionManager;
import com.algorithm.help.interactive.session.SessionType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 面试模拟 REST API
 * <p>
 * 提供面试会话的生命周期管理：开始、结束、获取报告、历史查询。
 * 实际的多轮对话通过 WebSocket 处理。
 *
 * @author algorithm-help
 * @since 1.0.0
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/interview")
@RequiredArgsConstructor
public class InterviewController {

    private final SessionManager sessionManager;
    private final InterviewReportRepository reportRepo;
    private final InterviewScoreService scoreService;

    /**
     * 开始面试（创建会话，返回 sessionId）
     * <p>
     * 真正的开场白通过 WebSocket START_INTERVIEW 消息触发，这里只创建会话。
     *
     * @param request 面试配置
     * @return 创建的会话
     */
    @PostMapping("/start")
    public ApiResponse<InteractiveSession> start(@RequestBody @Valid StartInterviewRequest request) {
        log.info("面试会话创建: userId={}, problemId={}, timeLimit={}min",
                request.getUserId(), request.getProblemId(), request.getTimeLimit());
        InteractiveSession session = sessionManager.createSession(
                request.getUserId(), SessionType.INTERVIEW, request.getProblemId());
        return ApiResponse.success(session);
    }

    /**
     * 手动结束面试并生成评分报告
     *
     * @param sessionId 会话 ID
     * @param request   包含 userId 和 problemId
     * @return 评分报告
     */
    @PostMapping("/{sessionId}/end")
    public ApiResponse<InterviewReport> end(@PathVariable String sessionId,
                                            @RequestBody @Valid EndRequest request) {
        log.info("面试手动结束: sessionId={}", sessionId);
        InterviewReport report = scoreService.generateReport(
                sessionId, request.getUserId(), request.getProblemId());
        sessionManager.endSession(sessionId);
        return ApiResponse.success(report);
    }

    /**
     * 获取评分报告
     *
     * @param sessionId 会话 ID
     * @return 评分报告
     */
    @GetMapping("/{sessionId}/report")
    public ApiResponse<InterviewReport> getReport(@PathVariable String sessionId) {
        return reportRepo.findBySessionId(sessionId)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "评分报告尚未生成"));
    }

    /**
     * 获取历史面试报告列表
     *
     * @param userId       用户 ID
     * @param includeTrend 是否包含得分趋势数据
     */
    @GetMapping("/history")
    public ApiResponse<List<InterviewReport>> history(
            @RequestParam String userId,
            @RequestParam(defaultValue = "false") boolean includeTrend) {
        List<InterviewReport> reports = reportRepo.findByUserIdOrderByCreatedAtDesc(userId);
        // includeTrend=true 时返回最近 10 条（前端绘制趋势图用）
        if (includeTrend && reports.size() > 10) {
            reports = reports.subList(0, 10);
        }
        return ApiResponse.success(reports);
    }

    // ======================== DTO ========================

    @Data
    public static class StartInterviewRequest {
        @NotBlank
        private String userId;
        @NotBlank
        private String problemId;
        private Integer timeLimit = 45;
        private String difficulty = "MEDIUM";
        private String companyStyle = "GENERAL";
    }

    @Data
    public static class EndRequest {
        @NotBlank
        private String userId;
        private String problemId = "";
    }
}
