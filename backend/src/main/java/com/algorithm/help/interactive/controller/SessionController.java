package com.algorithm.help.interactive.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.common.exception.ResourceNotFoundException;
import com.algorithm.help.interactive.entity.SessionMessage;
import com.algorithm.help.interactive.repository.SessionMessageRepository;
import com.algorithm.help.interactive.session.InteractiveSession;
import com.algorithm.help.interactive.session.SessionManager;
import com.algorithm.help.interactive.session.SessionStatus;
import com.algorithm.help.interactive.session.SessionType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.experimental.Accessors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 通用交互会话 REST API
 * <p>
 * 提供跨会话类型的统一管理接口：
 * - 创建会话（支持所有 SessionType）
 * - 查询会话详情
 * - 获取消息历史
 * - 关闭/删除会话
 * - 重连（断线恢复）
 * - 用户会话列表
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionManager sessionManager;
    private final SessionMessageRepository messageRepo;

    /**
     * 创建新的交互会话
     * <p>
     * 支持所有 SessionType：FEYNMAN / SOCRATIC / DEBUG / INTERVIEW / REVERSE_FEYNMAN
     */
    @PostMapping
    public ApiResponse<SessionDTO> createSession(@RequestBody @Valid CreateSessionRequest req) {
        log.info("创建会话: userId={}, type={}, problemId={}", req.getUserId(), req.getType(), req.getProblemId());

        SessionType type;
        try {
            type = SessionType.valueOf(req.getType().toUpperCase());
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(400, "不支持的会话类型: " + req.getType());
        }

        InteractiveSession session = sessionManager.createSession(req.getUserId(), type, req.getProblemId());
        return ApiResponse.success(toDTO(session));
    }

    /**
     * 获取会话详情
     */
    @GetMapping("/{sessionId}")
    public ApiResponse<SessionDTO> getSession(@PathVariable String sessionId) {
        InteractiveSession session = sessionManager.getSession(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("会话", sessionId));
        return ApiResponse.success(toDTO(session));
    }

    /**
     * 获取会话消息历史（按时间升序）
     *
     * @param sessionId 会话 ID
     * @param limit     最多返回条数（默认 100）
     */
    @GetMapping("/{sessionId}/messages")
    public ApiResponse<List<MessageDTO>> getMessages(
            @PathVariable String sessionId,
            @RequestParam(defaultValue = "100") int limit) {
        log.info("查询会话消息: sessionId={}", sessionId);

        // 确认会话存在
        sessionManager.getSession(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("会话", sessionId));

        List<SessionMessage> messages = messageRepo.findBySessionIdOrderByCreatedAtAsc(sessionId);
        List<MessageDTO> dtos = messages.stream()
                .limit(Math.min(limit, 500))
                .map(this::toMessageDTO)
                .toList();

        return ApiResponse.success(dtos);
    }

    /**
     * 关闭会话（标记为 COMPLETED）
     */
    @PostMapping("/{sessionId}/close")
    public ApiResponse<SessionDTO> closeSession(@PathVariable String sessionId) {
        log.info("关闭会话: sessionId={}", sessionId);
        InteractiveSession session = sessionManager.getSession(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("会话", sessionId));

        if (session.getStatus() == SessionStatus.COMPLETED) {
            return ApiResponse.success(toDTO(session));
        }

        sessionManager.endSession(sessionId);
        session = sessionManager.getSession(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("会话", sessionId));
        return ApiResponse.success(toDTO(session));
    }

    /**
     * 断线重连
     * <p>
     * 恢复 ACTIVE 或 PAUSED 状态的会话，返回对话历史
     */
    @PostMapping("/{sessionId}/reconnect")
    public ApiResponse<ReconnectResponse> reconnect(@PathVariable String sessionId) {
        log.info("会话重连: sessionId={}", sessionId);
        List<Map<String, String>> context = sessionManager.reconnect(sessionId);
        if (context == null) {
            return ApiResponse.error(409, "会话不存在或状态不允许重连");
        }
        return ApiResponse.success(new ReconnectResponse()
                .setSessionId(sessionId)
                .setMessageCount(context.size()));
    }

    /**
     * 获取用户的会话列表
     *
     * @param userId 用户 ID
     * @param type   会话类型（可选，不传则返回所有类型）
     */
    @GetMapping("/user/{userId}")
    public ApiResponse<List<SessionDTO>> getUserSessions(
            @PathVariable String userId,
            @RequestParam(required = false) String type) {
        log.info("查询用户会话列表: userId={}, type={}", userId, type);

        List<InteractiveSession> sessions;
        if (type != null && !type.isBlank()) {
            try {
                sessions = sessionManager.getUserSessions(userId, SessionType.valueOf(type.toUpperCase()));
            } catch (IllegalArgumentException e) {
                return ApiResponse.error(400, "不支持的会话类型: " + type);
            }
        } else {
            // 查所有类型：逐个聚合
            sessions = java.util.Arrays.stream(SessionType.values())
                    .flatMap(t -> sessionManager.getUserSessions(userId, t).stream())
                    .sorted(java.util.Comparator.comparingLong(
                            s -> -(s.getCreatedAt() != null ? s.getCreatedAt() : 0L)))
                    .toList();
        }

        return ApiResponse.success(sessions.stream().map(this::toDTO).toList());
    }

    // ==================== 私有方法 ====================

    private SessionDTO toDTO(InteractiveSession s) {
        return new SessionDTO()
                .setSessionId(s.getSessionId())
                .setUserId(s.getUserId())
                .setType(s.getType().name())
                .setStatus(s.getStatus().name())
                .setProblemId(s.getProblemId())
                .setCreatedAt(s.getCreatedAt())
                .setLastActiveAt(s.getLastActiveAt())
                .setCompletedAt(s.getCompletedAt());
    }

    private MessageDTO toMessageDTO(SessionMessage m) {
        return new MessageDTO()
                .setId(m.getId())
                .setSessionId(m.getSessionId())
                .setRole(m.getRole())
                .setContent(m.getContent())
                .setCreatedAt(m.getCreatedAt());
    }

    // ==================== DTO 定义 ====================

    /** 创建会话请求 */
    @Data
    public static class CreateSessionRequest {
        @NotBlank
        private String userId;
        /** 会话类型：FEYNMAN / SOCRATIC / DEBUG / INTERVIEW / REVERSE_FEYNMAN */
        @NotBlank
        private String type;
        /** 关联题目 ID（可选） */
        private String problemId;
    }

    /** 会话响应 DTO */
    @Data
    @Accessors(chain = true)
    public static class SessionDTO {
        private String sessionId;
        private String userId;
        private String type;
        private String status;
        private String problemId;
        private Long createdAt;
        private Long lastActiveAt;
        private Long completedAt;
    }

    /** 消息响应 DTO */
    @Data
    @Accessors(chain = true)
    public static class MessageDTO {
        private String id;
        private String sessionId;
        private String role;
        private String content;
        private Long createdAt;
    }

    /** 重连响应 */
    @Data
    @Accessors(chain = true)
    public static class ReconnectResponse {
        private String sessionId;
        private int messageCount;
    }
}
