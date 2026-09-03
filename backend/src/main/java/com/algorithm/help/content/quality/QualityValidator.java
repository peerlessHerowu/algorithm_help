package com.algorithm.help.content.quality;

import com.algorithm.help.ai.SmartRouter;
import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.ai.model.AiResponse;
import com.algorithm.help.content.generator.ComplianceResult;
import com.algorithm.help.content.generator.LevelComplianceChecker;
import com.algorithm.help.content.generator.LeveledContent;
import com.algorithm.help.content.prompt.PromptTemplateEngine;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 内容质量校验服务
 * <p>
 * 依次执行：格式校验 → 级别合规校验 → Mermaid 语法校验 → AI 自审
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class QualityValidator {

    private static final Pattern CODE_BLOCK = Pattern.compile("```");
    private static final Pattern HEADING = Pattern.compile("^(#{1,6})\\s", Pattern.MULTILINE);
    private static final Pattern MERMAID_BLOCK = Pattern.compile(
            "```mermaid\\s*\\n([\\s\\S]*?)```", Pattern.MULTILINE);
    private static final Pattern MERMAID_KEYWORD = Pattern.compile(
            "^\\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph)",
            Pattern.MULTILINE);

    /** 匹配 [Author, Year] 格式引用 */
    private static final Pattern CITATION_BRACKET = Pattern.compile(
            "\\[([A-Z][a-zA-Z\\s,\\.]+(?:et\\s+al\\.?)?),?\\s*(\\d{4})\\]");

    /** 匹配 Author et al. (Year) 格式引用 */
    private static final Pattern CITATION_PAREN = Pattern.compile(
            "([A-Z][a-zA-Z]+(?:\\s+et\\s+al\\.?)?)\\s*\\((\\d{4})\\)");

    private final LevelComplianceChecker complianceChecker;
    private final PromptTemplateEngine templateEngine;
    private final SmartRouter smartRouter;
    private final ObjectMapper objectMapper;
    private final KnownReferenceRegistry referenceRegistry;

    /**
     * 执行完整质量校验流水线
     *
     * @param explanation 待校验的 Markdown 内容
     * @param level       内容层级（1-5）
     * @return 校验报告
     */
    public ValidationReport validate(String explanation, int level) {
        ValidationReport report = new ValidationReport();

        // 1. 格式校验
        checkFormat(explanation, report);

        // 2. 级别合规校验
        checkLevelCompliance(explanation, level, report);

        // 3. Mermaid 语法校验
        checkMermaidSyntax(explanation, report);

        // 4. AI 自审
        checkWithAi(explanation, level, report);

        // 5. L5 论文引用校验（仅 level==5 时执行）
        if (level == 5) {
            checkCitationVerification(explanation, report);
        }

        log.info("质量校验完成: passed={}, issues={}, warnings={}",
                report.isPassed(), report.getIssues().size(), report.hasWarnings());
        return report;
    }

    /**
     * 格式校验：标题层级连续性、代码块闭合、列表格式、代码块语言标注
     */
    private void checkFormat(String content, ValidationReport report) {
        checkHeadingContinuity(content, report);
        checkCodeBlocksClosed(content, report);
        checkCodeBlockLanguage(content, report);
        checkListFormat(content, report);
    }

    /**
     * 检查 Markdown 标题层级连续性（不允许跳级，如 # 直接到 ###）
     */
    private void checkHeadingContinuity(String content, ValidationReport report) {
        int prevLevel = 0;
        int lineNum = 0;

        for (String line : content.split("\n")) {
            lineNum++;
            Matcher lineMatcher = HEADING.matcher(line);
            if (lineMatcher.find()) {
                int currentLevel = lineMatcher.group(1).length();
                if (prevLevel > 0 && currentLevel > prevLevel + 1) {
                    report.addIssue(new ValidationIssue()
                            .setType("format")
                            .setSeverity("error")
                            .setLocation("第 " + lineNum + " 行")
                            .setMessage("标题层级跳跃：从 H" + prevLevel + " 直接到 H" + currentLevel)
                            .setSuggestion("标题层级应连续递增，不要跳级"));
                }
                prevLevel = currentLevel;
            }
        }
    }

    /**
     * 检查代码块是否闭合（``` 成对出现）
     */
    private void checkCodeBlocksClosed(String content, ValidationReport report) {
        Matcher matcher = CODE_BLOCK.matcher(content);
        int count = 0;
        while (matcher.find()) {
            count++;
        }
        if (count % 2 != 0) {
            report.addIssue(new ValidationIssue()
                    .setType("format")
                    .setSeverity("error")
                    .setLocation("全文")
                    .setMessage("代码块未闭合：检测到 " + count + " 个 ``` 标记（应为偶数）")
                    .setSuggestion("确保每个代码块的开始 ``` 都有对应的结束 ```"));
        }
    }

    /**
     * 检查代码块是否标注了语言
     */
    private void checkCodeBlockLanguage(String content, ValidationReport report) {
        Pattern openBlock = Pattern.compile("^```\\s*$", Pattern.MULTILINE);
        Matcher matcher = openBlock.matcher(content);
        int count = 0;
        while (matcher.find()) {
            count++;
        }
        // 只有当存在无语言标注的开始代码块时才告警（排除结束 ```）
        // 简化判断：无语言标注的 ``` 在奇数位置才是开始块
        if (count > 0) {
            report.addIssue(new ValidationIssue()
                    .setType("format")
                    .setSeverity("warning")
                    .setLocation("全文")
                    .setMessage("发现 " + count + " 处代码块未标注语言")
                    .setSuggestion("为代码块添加语言标注，如 ```java、```python"));
        }
    }

    /**
     * 检查列表格式（混用 - 和 * 视为警告）
     */
    private void checkListFormat(String content, ValidationReport report) {
        boolean hasDash = Pattern.compile("^\\s*- ", Pattern.MULTILINE).matcher(content).find();
        boolean hasAsterisk = Pattern.compile("^\\s*\\* ", Pattern.MULTILINE).matcher(content).find();
        if (hasDash && hasAsterisk) {
            report.addIssue(new ValidationIssue()
                    .setType("format")
                    .setSeverity("warning")
                    .setLocation("全文")
                    .setMessage("无序列表标记混用（同时使用 - 和 *）")
                    .setSuggestion("统一使用 - 作为无序列表标记"));
        }
    }

    /**
     * 级别合规校验：委托给 LevelComplianceChecker
     */
    private void checkLevelCompliance(String content, int level, ValidationReport report) {
        LeveledContent leveledContent = new LeveledContent()
                .setLevel(level)
                .setRawJson(content);

        ComplianceResult result = complianceChecker.check(leveledContent);
        if (!result.isCompliant()) {
            for (String violation : result.getViolations()) {
                report.addIssue(new ValidationIssue()
                        .setType("compliance")
                        .setSeverity("error")
                        .setLocation("L" + level)
                        .setMessage(violation)
                        .setSuggestion("请根据 L" + level + " 规范调整内容"));
            }
        }
    }

    /**
     * Mermaid 语法校验：关键字检查 + 括号匹配
     */
    private void checkMermaidSyntax(String content, ValidationReport report) {
        Matcher blockMatcher = MERMAID_BLOCK.matcher(content);
        while (blockMatcher.find()) {
            String mermaidCode = blockMatcher.group(1);
            checkMermaidKeyword(mermaidCode, report);
            checkBracketBalance(mermaidCode, report);
        }
    }

    /**
     * 检查 Mermaid 代码块是否包含有效关键字
     */
    private void checkMermaidKeyword(String mermaidCode, ValidationReport report) {
        if (!MERMAID_KEYWORD.matcher(mermaidCode).find()) {
            report.addIssue(new ValidationIssue()
                    .setType("mermaid")
                    .setSeverity("error")
                    .setLocation("mermaid 代码块")
                    .setMessage("Mermaid 代码块缺少有效图类型关键字")
                    .setSuggestion("开头应声明图类型，如 flowchart TD、sequenceDiagram 等"));
        }
    }

    /**
     * 检查括号匹配（圆括号、方括号、花括号）
     */
    private void checkBracketBalance(String mermaidCode, ValidationReport report) {
        int round = 0, square = 0, curly = 0;
        for (char c : mermaidCode.toCharArray()) {
            switch (c) {
                case '(' -> round++;
                case ')' -> round--;
                case '[' -> square++;
                case ']' -> square--;
                case '{' -> curly++;
                case '}' -> curly--;
            }
        }
        if (round != 0 || square != 0 || curly != 0) {
            report.addIssue(new ValidationIssue()
                    .setType("mermaid")
                    .setSeverity("error")
                    .setLocation("mermaid 代码块")
                    .setMessage("括号不匹配：() " + round + ", [] " + square + ", {} " + curly)
                    .setSuggestion("检查 Mermaid 图中的括号是否成对闭合"));
        }
    }

    /**
     * AI 自审：调用 quality/ai-review.md 模板，解析审查结果
     */
    private void checkWithAi(String content, int level, ValidationReport report) {
        try {
            String prompt = templateEngine.render("quality/ai-review.md", Map.of(
                    "title", extractTitle(content),
                    "level", String.valueOf(level),
                    "content", content
            ));

            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.DETECT_ERRORS)
                    .setContent(prompt);

            AiResponse response = smartRouter.route(request);
            parseAiReviewResult(response.getContent(), report);
        } catch (Exception e) {
            log.warn("AI 自审失败，添加 warning: {}", e.getMessage());
            report.addIssue(new ValidationIssue()
                    .setType("logic")
                    .setSeverity("warning")
                    .setLocation("AI 自审")
                    .setMessage("AI 自审未能完成: " + e.getMessage())
                    .setSuggestion("可稍后重试或手动审查逻辑正确性"));
        }
    }

    /**
     * 从内容中提取第一个标题作为 title 变量
     */
    private String extractTitle(String content) {
        Matcher matcher = HEADING.matcher(content);
        if (matcher.find()) {
            int start = matcher.end();
            int end = content.indexOf('\n', start);
            if (end < 0) end = content.length();
            return content.substring(start, end).trim();
        }
        return "未知标题";
    }

    /**
     * 解析 AI 返回的 JSON 审查结果，转换为 ValidationIssue
     */
    private void parseAiReviewResult(String aiContent, ValidationReport report) {
        try {
            List<Map<String, String>> issues = objectMapper.readValue(
                    extractJsonArray(aiContent),
                    new TypeReference<>() {});

            for (Map<String, String> item : issues) {
                report.addIssue(new ValidationIssue()
                        .setType("logic")
                        .setSeverity(item.getOrDefault("severity", "warning"))
                        .setLocation(item.getOrDefault("location", ""))
                        .setMessage(item.getOrDefault("message", ""))
                        .setSuggestion(item.getOrDefault("suggestion", "")));
            }
        } catch (Exception e) {
            log.warn("解析 AI 审查结果失败: {}", e.getMessage());
            report.addIssue(new ValidationIssue()
                    .setType("logic")
                    .setSeverity("warning")
                    .setLocation("AI 自审结果解析")
                    .setMessage("AI 返回结果无法解析为 JSON")
                    .setSuggestion("AI 返回格式异常，建议人工审查"));
        }
    }

    /**
     * 从 AI 响应中提取 JSON 数组部分（兼容包裹在 markdown 代码块中的情况）
     */
    private String extractJsonArray(String text) {
        // 尝试提取 ```json ... ``` 或 ``` ... ``` 中的内容
        Pattern jsonBlock = Pattern.compile("```(?:json)?\\s*\\n?([\\s\\S]*?)\\n?```");
        Matcher matcher = jsonBlock.matcher(text);
        if (matcher.find()) {
            String inner = matcher.group(1).trim();
            // 确保提取的内容是数组
            if (inner.startsWith("[")) return inner;
        }
        // 尝试直接找 [ ... ]
        int start = text.indexOf('[');
        int end = text.lastIndexOf(']');
        if (start >= 0 && end > start) {
            return text.substring(start, end + 1);
        }
        return text;
    }

    /**
     * L5 论文引用校验：从内容中提取引用，校验是否匹配已知权威来源
     * <p>
     * 未验证的引用生成 WARNING 级别 issue（不阻止发布）
     */
    private void checkCitationVerification(String content, ValidationReport report) {
        List<String> citations = extractCitations(content);
        if (citations.isEmpty()) {
            report.addIssue(new ValidationIssue()
                    .setType("citation")
                    .setSeverity("warning")
                    .setLocation("全文")
                    .setMessage("L5 内容未检测到学术引用")
                    .setSuggestion("L5 级别内容应包含论文或教材的学术引用"));
            return;
        }

        List<ReferenceCheckResult> results = referenceRegistry.checkAll(citations);
        for (ReferenceCheckResult result : results) {
            if (!result.isVerified()) {
                report.addIssue(new ValidationIssue()
                        .setType("citation")
                        .setSeverity("warning")
                        .setLocation("引用")
                        .setMessage("未验证的引用: " + result.getCitation())
                        .setSuggestion("该引用未匹配到已知权威来源，请确认引用准确性"));
            }
        }

        long verified = results.stream().filter(ReferenceCheckResult::isVerified).count();
        log.info("L5 引用校验完成: 总引用 {} 条，已验证 {} 条", citations.size(), verified);
    }

    /**
     * 从内容中提取引用文本
     * <p>
     * 支持格式：[Author, Year] 和 Author et al. (Year)
     */
    private List<String> extractCitations(String content) {
        List<String> citations = new ArrayList<>();

        // 匹配 [Author, Year] 格式
        Matcher bracketMatcher = CITATION_BRACKET.matcher(content);
        while (bracketMatcher.find()) {
            String author = bracketMatcher.group(1).trim();
            String year = bracketMatcher.group(2);
            citations.add(author + ", " + year);
        }

        // 匹配 Author et al. (Year) 格式
        Matcher parenMatcher = CITATION_PAREN.matcher(content);
        while (parenMatcher.find()) {
            String author = parenMatcher.group(1).trim();
            String year = parenMatcher.group(2);
            citations.add(author + ", " + year);
        }

        return citations.stream().distinct().toList();
    }
}
