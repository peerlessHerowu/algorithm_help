package com.algorithm.help.content.codegen;

import com.algorithm.help.ai.SmartRouter;
import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.content.generator.LeveledContent.Approach;
import com.algorithm.help.content.prompt.PromptTemplateEngine;
import com.algorithm.help.entity.Problem;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 多语言代码生成器
 * <p>
 * 遍历支持的语言列表，逐一调用 Prompt 模板 + SmartRouter 生成代码。
 * 单语言生成失败时记录 WARN 日志跳过，不阻断其他语言。
 */
@Slf4j
@Service
public class MultiLangCodeGenerator {

    private static final List<String> SUPPORTED_LANGUAGES = List.of("python", "java", "go", "cpp");
    private static final String TEMPLATE_PREFIX = "codegen/";
    private static final String TEMPLATE_SUFFIX = ".md";
    private static final String ADD_COMMENTS_TEMPLATE = "codegen/add-comments.md";

    /** 匹配注释行中包含中文字符的正则 */
    private static final Pattern CHINESE_IN_COMMENT = Pattern.compile(
            "(//|#|/\\*|\\*|\\*/).*[\\u4e00-\\u9fff]");

    private final PromptTemplateEngine templateEngine;
    private final SmartRouter smartRouter;

    public MultiLangCodeGenerator(PromptTemplateEngine templateEngine,
                                  SmartRouter smartRouter) {
        this.templateEngine = templateEngine;
        this.smartRouter = smartRouter;
    }

    /**
     * 为指定解法生成多语言代码片段
     *
     * @param approach 解法信息
     * @param problem  题目实体
     * @return 成功生成的代码片段列表
     */
    public List<CodeSnippet> generateForApproach(Approach approach, Problem problem) {
        List<CodeSnippet> snippets = new ArrayList<>();
        Map<String, String> variables = buildTemplateVariables(approach, problem);

        for (String language : SUPPORTED_LANGUAGES) {
            try {
                CodeSnippet snippet = generateSingleLanguage(language, variables, problem);
                snippets.add(snippet);
            } catch (Exception e) {
                log.warn("语言 [{}] 代码生成失败，跳过。题目: {}, 解法: {}, 原因: {}",
                        language, problem.getTitle(), approach.getName(), e.getMessage());
            }
        }
        return snippets;
    }

    /**
     * 生成单种语言的代码片段，若缺少中文注释则触发二次生成补充
     */
    private CodeSnippet generateSingleLanguage(String language,
                                               Map<String, String> variables,
                                               Problem problem) {
        String code = callCodeGeneration(language, variables, problem);

        // 检查是否包含中文注释，不包含则触发补充
        if (!hasChineseComments(language, code)) {
            log.info("语言 [{}] 生成代码缺少中文注释，触发二次补充", language);
            code = supplementChineseComments(language, code, problem);
        }

        return new CodeSnippet()
                .setLanguage(language)
                .setCode(code)
                .setHasComments(detectComments(language, code));
    }

    /**
     * 调用 AI 生成指定语言的代码
     */
    private String callCodeGeneration(String language,
                                      Map<String, String> variables,
                                      Problem problem) {
        String templatePath = TEMPLATE_PREFIX + language + TEMPLATE_SUFFIX;
        String prompt = templateEngine.render(templatePath, variables);

        AiRequest request = new AiRequest()
                .setType(AiRequest.RequestType.CHAT)
                .setContent(prompt)
                .setProblem(problem);

        return smartRouter.route(request).getContent();
    }

    /**
     * 使用 add-comments 模板进行二次生成，补充中文注释
     * <p>
     * 二次生成失败时不阻断，返回原始代码
     */
    private String supplementChineseComments(String language, String originalCode, Problem problem) {
        try {
            Map<String, String> vars = Map.of("language", language, "code", originalCode);
            String prompt = templateEngine.render(ADD_COMMENTS_TEMPLATE, vars);

            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.CHAT)
                    .setContent(prompt)
                    .setProblem(problem);

            String enrichedCode = smartRouter.route(request).getContent();
            // 二次生成结果校验：确保内容非空
            if (enrichedCode != null && !enrichedCode.isBlank()) {
                return enrichedCode;
            }
        } catch (Exception e) {
            log.warn("语言 [{}] 注释补充二次生成失败，使用原始代码。原因: {}", language, e.getMessage());
        }
        return originalCode;
    }

    /**
     * 构建模板变量映射
     */
    private Map<String, String> buildTemplateVariables(Approach approach, Problem problem) {
        return Map.of(
                "title", nullSafe(problem.getTitle()),
                "approach_name", nullSafe(approach.getName()),
                "approach_idea", nullSafe(approach.getIdea()),
                "time_complexity", nullSafe(approach.getTimeComplexity()),
                "space_complexity", nullSafe(approach.getSpaceComplexity())
        );
    }

    /**
     * 检测代码中是否包含注释
     */
    private boolean detectComments(String language, String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        return switch (language) {
            case "python" -> code.contains("#") || code.contains("\"\"\"");
            case "java", "go", "cpp" -> code.contains("//") || code.contains("/*");
            default -> false;
        };
    }

    /**
     * 检测代码注释中是否包含中文字符
     * <p>
     * 逐行扫描，匹配注释标记后出现中文字符的行
     */
    private boolean hasChineseComments(String language, String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        return code.lines().anyMatch(line -> {
            String trimmed = line.trim();
            return isCommentLine(language, trimmed) && containsChinese(trimmed);
        });
    }

    /**
     * 判断一行是否为注释行（以注释标记开头或包含行内注释）
     */
    private boolean isCommentLine(String language, String line) {
        return switch (language) {
            case "python" -> line.contains("#") || line.startsWith("\"\"\"");
            case "java", "go", "cpp" -> line.startsWith("//") || line.startsWith("/*")
                    || line.startsWith("*") || line.contains("//");
            default -> false;
        };
    }

    /**
     * 检测字符串中是否包含中文字符
     */
    private boolean containsChinese(String text) {
        return CHINESE_IN_COMMENT.matcher(text).find();
    }

    private String nullSafe(String value) {
        return value != null ? value : "";
    }
}
