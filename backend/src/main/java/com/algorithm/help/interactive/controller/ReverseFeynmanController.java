package com.algorithm.help.interactive.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.interactive.session.InteractiveSession;
import com.algorithm.help.interactive.session.SessionManager;
import com.algorithm.help.interactive.session.SessionType;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 反向费曼 REST API
 */
@RestController
@RequestMapping("/api/v1/reverse-feynman")
@RequiredArgsConstructor
public class ReverseFeynmanController {

    private final SessionManager sessionManager;

    @PostMapping("/start")
    public ApiResponse<InteractiveSession> start(@RequestBody StartRequest request) {
        InteractiveSession session = sessionManager.createSession(
                request.getUserId(), SessionType.REVERSE_FEYNMAN, request.getProblemId());
        return ApiResponse.success(session);
    }

    @Data
    public static class StartRequest {
        private String userId;
        private String problemId;
    }
}
