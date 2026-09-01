package com.algorithm.help.interactive.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.interactive.session.InteractiveSession;
import com.algorithm.help.interactive.session.SessionManager;
import com.algorithm.help.interactive.session.SessionType;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 费曼学习模式 REST API
 */
@RestController
@RequestMapping("/api/v1/feynman")
@RequiredArgsConstructor
public class FeynmanController {

    private final SessionManager sessionManager;

    /**
     * 创建费曼会话
     */
    @PostMapping("/start")
    public ApiResponse<InteractiveSession> start(@RequestBody StartRequest request) {
        InteractiveSession session = sessionManager.createSession(
                request.getUserId(), SessionType.FEYNMAN, request.getProblemId());
        return ApiResponse.success(session);
    }

    /**
     * 结束会话，返回结构化总结
     */
    @PostMapping("/{sessionId}/end")
    public ApiResponse<Map<String, Object>> end(@PathVariable String sessionId) {
        sessionManager.completeSession(sessionId);
        List<Map<String, String>> context = sessionManager.getContext(sessionId);
        return ApiResponse.success(Map.of("sessionId", sessionId, "messages", context));
    }

    /**
     * 获取完整对话历史
     */
    @GetMapping("/{sessionId}/history")
    public ApiResponse<List<Map<String, String>>> history(@PathVariable String sessionId) {
        return ApiResponse.success(sessionManager.getContext(sessionId));
    }

    @Data
    public static class StartRequest {
        private String userId;
        private String problemId;
    }
}
