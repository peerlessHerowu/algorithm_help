package com.algorithm.help.interactive.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.interactive.handler.SocraticGuideHandler;
import com.algorithm.help.interactive.session.InteractiveSession;
import com.algorithm.help.interactive.session.SessionManager;
import com.algorithm.help.interactive.session.SessionType;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 苏格拉底式追问 REST API
 */
@RestController
@RequestMapping("/api/v1/socratic")
@RequiredArgsConstructor
public class SocraticController {

    private final SessionManager sessionManager;
    private final SocraticGuideHandler socraticHandler;

    @PostMapping("/start")
    public ApiResponse<InteractiveSession> start(@RequestBody StartRequest request) {
        InteractiveSession session = sessionManager.createSession(
                request.getUserId(), SessionType.SOCRATIC, request.getProblemId());
        return ApiResponse.success(session);
    }

    /**
     * 请求下一级提示
     */
    @GetMapping("/{sessionId}/hint")
    public ApiResponse<String> nextHint(@PathVariable String sessionId) {
        socraticHandler.upgradeHintLevel(sessionId);
        return ApiResponse.success("提示级别已升级");
    }

    @Data
    public static class StartRequest {
        private String userId;
        private String problemId;
    }
}
