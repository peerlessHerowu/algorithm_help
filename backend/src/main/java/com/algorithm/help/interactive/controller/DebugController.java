package com.algorithm.help.interactive.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.interactive.session.InteractiveSession;
import com.algorithm.help.interactive.session.SessionManager;
import com.algorithm.help.interactive.session.SessionType;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * Debug 训练 REST API
 */
@RestController
@RequestMapping("/api/v1/debug")
@RequiredArgsConstructor
public class DebugController {

    private final SessionManager sessionManager;

    /**
     * 获取 Debug 挑战
     */
    @PostMapping("/challenge")
    public ApiResponse<InteractiveSession> challenge(@RequestBody ChallengeRequest request) {
        InteractiveSession session = sessionManager.createSession(
                request.getUserId(), SessionType.DEBUG, request.getProblemId());
        return ApiResponse.success(session);
    }

    @Data
    public static class ChallengeRequest {
        private String userId;
        private String problemId;
        private String difficulty;
    }
}
