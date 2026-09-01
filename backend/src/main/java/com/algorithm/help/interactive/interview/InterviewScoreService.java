package com.algorithm.help.interactive.interview;

import com.algorithm.help.ai.SmartRouter;
import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.content.prompt.PromptTemplateEngine;
import com.algorithm.help.interactive.session.SessionManager;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 面试评分报告生成服务
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InterviewScoreService {

    private final SessionManager sessionManager;
    private final PromptTemplateEngine templateEngine;
    private final SmartRouter smartRouter;
    private final ObjectMapper objectMapper;
    private final InterviewReportRepository reportRepo;

    /**
     * 生成面试评分报告
     */
    public InterviewReport generateReport(String sessionId, String userId, String problemId) {
        List<Map<String, String>> context = sessionManager.getContext(sessionId);
        String history = context.stream()
                .map(m -> m.get("role") + ": " + m.get("content"))
                .collect(Collectors.joining("\n"));

        try {
            String prompt = templateEngine.render("interactive/interview-scoring.md", Map.of(
                    "title", "面试题目",
                    "history", history
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.CHAT)
                    .setContent(prompt);
            String aiResult = smartRouter.route(request).getContent();
            return parseAndSaveReport(aiResult, sessionId, userId, problemId);
        } catch (Exception e) {
            log.error("面试评分生成失败: {}", e.getMessage());
            return buildDefaultReport(sessionId, userId, problemId);
        }
    }

    /**
     * 获取面试得分趋势
     */
    public List<InterviewReport> getScoreTrend(String userId) {
        return reportRepo.findByUserIdOrderByCreatedAtDesc(userId);
    }

    private InterviewReport parseAndSaveReport(String aiResult, String sessionId,
                                               String userId, String problemId) {
        InterviewReport report = new InterviewReport()
                .setSessionId(sessionId)
                .setUserId(userId)
                .setProblemId(problemId);
        try {
            JsonNode root = objectMapper.readTree(extractJson(aiResult));
            JsonNode scores = root.get("scores");
            if (scores != null) {
                report.setCorrectnessScore(scores.path("correctness").asInt(5));
                report.setEfficiencyScore(scores.path("efficiency").asInt(5));
                report.setCommunicationScore(scores.path("communication").asInt(5));
                report.setCodeQualityScore(scores.path("codeQuality").asInt(5));
            }
            report.setTotalScore(root.path("totalScore").asInt(50));
            report.setGrade(root.path("grade").asText("C"));
            report.setSummary(root.path("summary").asText(""));
        } catch (Exception e) {
            log.warn("解析面试评分 JSON 失败: {}", e.getMessage());
            report.setTotalScore(50).setGrade("C").setSummary("评分解析异常");
        }
        return reportRepo.save(report);
    }

    private InterviewReport buildDefaultReport(String sessionId, String userId, String problemId) {
        InterviewReport report = new InterviewReport()
                .setSessionId(sessionId)
                .setUserId(userId)
                .setProblemId(problemId)
                .setTotalScore(0)
                .setGrade("N/A")
                .setSummary("评分生成失败，请重试");
        return reportRepo.save(report);
    }

    private String extractJson(String text) {
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return text.substring(start, end + 1);
        }
        return text;
    }
}
