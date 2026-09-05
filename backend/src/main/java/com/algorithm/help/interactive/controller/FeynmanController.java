package com.algorithm.help.interactive.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.interactive.achievement.AchievementCheckService;
import com.algorithm.help.interactive.achievement.AchievementType;
import com.algorithm.help.interactive.entity.SessionMessage;
import com.algorithm.help.interactive.handler.FeynmanSessionHandler;
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
import java.util.Map;

/**
 * 费曼学习模式 REST API
 * <p>
 * 负责费曼学习会话的生命周期管理：开始、结束、获取总结、获取类比、获取历史。
 *
 * @author algorithm-help
 * @since 1.0.0
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/feynman")
@RequiredArgsConstructor
public class FeynmanController {

    private final SessionManager sessionManager;
    private final FeynmanSessionHandler feynmanHandler;
    private final AchievementCheckService achievementCheckService;

    /**
     * 开始费曼学习会话
     *
     * @param request 包含 userId、problemId
     * @return 创建的会话
     */
    @PostMapping("/start")
    public ApiResponse<InteractiveSession> start(@RequestBody @Valid StartRequest request) {
        log.info("费曼会话开始: userId={}, problemId={}", request.getUserId(), request.getProblemId());
        InteractiveSession session = sessionManager.createSession(
                request.getUserId(), SessionType.FEYNMAN, request.getProblemId());
        return ApiResponse.success(session);
    }

    /**
     * 结束会话并生成结构化总结
     *
     * @param sessionId 会话 ID
     * @param request   包含 problemTitle（可选）
     * @return 结构化总结 JSON
     */
    @PostMapping("/{sessionId}/end")
    public ApiResponse<Map<String, Object>> end(@PathVariable String sessionId,
                                                @RequestBody(required = false) EndRequest request) {
        log.info("费曼会话结束: sessionId={}", sessionId);
        String problemTitle = request != null && request.getProblemTitle() != null
                ? request.getProblemTitle() : "算法题";

        // 生成结构化总结
        String summary = feynmanHandler.generateStructuredSummary(sessionId, problemTitle);

        // 完成会话
        List<SessionMessage> messages = sessionManager.endSession(sessionId);

        // 检查费曼成就
        achievementCheckService.checkFeynmanAchievements(getUserIdFromSession(sessionId));

        return ApiResponse.success(Map.of(
                "sessionId", sessionId,
                "summary", summary,
                "totalMessages", messages.size()
        ));
    }

    /**
     * 生成多角度类比列表
     *
     * @param sessionId 会话 ID
     * @param request   包含 approach 和 problemTitle
     * @return JSON 格式类比列表
     */
    @PostMapping("/{sessionId}/analogies")
    public ApiResponse<String> analogies(@PathVariable String sessionId,
                                         @RequestBody @Valid AnalogiesRequest request) {
        String analogies = feynmanHandler.generateAnalogies(
                sessionId, request.getApproach(), request.getProblemTitle());
        return ApiResponse.success(analogies);
    }

    /**
     * 重置会话（清空上下文，保留 sessionId）
     *
     * @param sessionId 会话 ID
     */
    @PostMapping("/{sessionId}/reset")
    public ApiResponse<Void> reset(@PathVariable String sessionId) {
        log.info("费曼会话重置: sessionId={}", sessionId);
        sessionManager.resetSession(sessionId);
        return ApiResponse.success(null);
    }

    /**
     * 导出费曼学习记录为 Markdown 格式
     *
     * @param sessionId 会话 ID
     * @return Markdown 文本内容
     */
    @GetMapping("/{sessionId}/export")
    public ApiResponse<String> export(@PathVariable String sessionId) {
        log.info("导出费曼记录: sessionId={}", sessionId);

        // 获取会话信息
        String problemTitle = sessionManager.getSession(sessionId)
                .map(s -> s.getProblemId() != null ? s.getProblemId() : "算法题")
                .orElse("算法题");

        // 获取对话历史
        List<Map<String, String>> context = sessionManager.getContext(sessionId);
        int rounds = (int) context.stream().filter(m -> "user".equals(m.get("role"))).count();

        // 构建 Markdown
        StringBuilder md = new StringBuilder();
        md.append("# 费曼学习记录 · ").append(problemTitle).append("\n\n");
        md.append("> 生成时间：").append(new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm").format(new java.util.Date())).append("\n");
        md.append("> 对话轮次：").append(rounds).append(" 轮\n\n");
        md.append("---\n\n");
        md.append("## 对话记录\n\n");

        context.forEach(msg -> {
            String role = "user".equals(msg.get("role")) ? "**你**" : "**AI 教练**";
            md.append(role).append("：").append(msg.get("content")).append("\n\n");
        });

        return ApiResponse.success(md.toString());
    }

    /**
     * 获取完整对话历史
     *
     * @param sessionId 会话 ID
     * @return 消息列表
     */
    @GetMapping("/{sessionId}/history")
    public ApiResponse<List<Map<String, String>>> history(@PathVariable String sessionId) {
        return ApiResponse.success(sessionManager.getContext(sessionId));
    }

    /**
     * 获取用户历史费曼会话列表
     *
     * @param userId 用户 ID
     */
    @GetMapping("/sessions")
    public ApiResponse<List<InteractiveSession>> sessions(@RequestParam String userId) {
        return ApiResponse.success(sessionManager.getUserSessions(userId, SessionType.FEYNMAN));
    }

    // ======================== 内部 DTO ========================

    private String getUserIdFromSession(String sessionId) {
        return sessionManager.getSession(sessionId)
                .map(InteractiveSession::getUserId)
                .orElse("unknown");
    }

    @Data
    public static class StartRequest {
        @NotBlank
        private String userId;
        @NotBlank
        private String problemId;
    }

    @Data
    public static class EndRequest {
        private String problemTitle;
    }

    @Data
    public static class AnalogiesRequest {
        @NotBlank
        private String approach;
        @NotBlank
        private String problemTitle;
    }
}
