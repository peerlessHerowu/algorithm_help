package com.algorithm.help.interactive.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.interactive.interview.InterviewReport;
import com.algorithm.help.interactive.interview.InterviewReportRepository;
import com.algorithm.help.interactive.session.InteractiveSession;
import com.algorithm.help.interactive.session.SessionManager;
import com.algorithm.help.interactive.session.SessionType;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 面试模拟 REST API
 */
@RestController
@RequestMapping("/api/v1/interview")
@RequiredArgsConstructor
public class InterviewController {

    private final SessionManager sessionManager;
    private final InterviewReportRepository reportRepo;

    /**
     * 开始面试
     */
    @PostMapping("/start")
    public ApiResponse<InteractiveSession> start(@RequestBody StartInterviewRequest request) {
        InteractiveSession session = sessionManager.createSession(
                request.getUserId(), SessionType.INTERVIEW, request.getProblemId());
        return ApiResponse.success(session);
    }

    /**
     * 获取评分报告
     */
    @GetMapping("/{sessionId}/report")
    public ApiResponse<InterviewReport> getReport(@PathVariable String sessionId) {
        return reportRepo.findBySessionId(sessionId)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "报告未生成"));
    }

    /**
     * 获取历史面试报告
     */
    @GetMapping("/history")
    public ApiResponse<List<InterviewReport>> history(@RequestParam String userId) {
        return ApiResponse.success(reportRepo.findByUserIdOrderByCreatedAtDesc(userId));
    }

    @Data
    public static class StartInterviewRequest {
        private String userId;
        private String problemId;
        private Integer timeLimit;
    }
}
