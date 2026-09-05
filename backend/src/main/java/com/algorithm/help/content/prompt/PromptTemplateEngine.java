package com.algorithm.help.content.prompt;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Prompt 模板引擎：加载模板文件、替换 {{variable}} 占位符
 * <p>
 * - 支持 classpath 和外部挂载卷两种路径
 * - 使用 ConcurrentHashMap 缓存模板，基于文件修改时间戳热更新
 * - 变量未填充时抛出 TemplateRenderException
 */
@Slf4j
@Component
public class PromptTemplateEngine {

    /** 占位符正则：匹配 {{variableName}} */
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{(\\w+)}}");

    /** 外部挂载卷路径 */
    private static final String EXTERNAL_DIR = "/app/prompts";

    /** classpath 资源路径 */
    private static final String CLASSPATH_DIR = "prompts";

    /** 模板缓存：key=模板路径, value=缓存条目 */
    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();

    /**
     * 检查模板文件是否存在
     *
     * @param templatePath 模板相对路径
     * @return 是否存在
     */
    public boolean exists(String templatePath) {
        Path filePath = resolveTemplatePath(templatePath);
        return filePath != null && Files.exists(filePath);
    }

    /**
     * 渲染模板：加载模板文件并替换变量占位符
     *
     * @param templatePath 模板相对路径，如 "explain/deep-analysis.txt"
     * @param variables    变量映射表
     * @return 渲染后的文本
     */
    public String render(String templatePath, Map<String, String> variables) {
        String template = loadTemplate(templatePath);
        return replaceVariables(template, variables, templatePath);
    }

    /**
     * 加载模板：优先外部卷，其次 classpath；带缓存和热更新
     */
    private String loadTemplate(String templatePath) {
        Path filePath = resolveTemplatePath(templatePath);
        if (filePath == null || !Files.exists(filePath)) {
            throw new TemplateRenderException("模板文件不存在: " + templatePath);
        }
        long lastModified = getLastModified(filePath);
        CacheEntry cached = cache.get(templatePath);

        // 缓存命中且未修改，直接返回
        if (cached != null && cached.lastModified == lastModified) {
            return cached.content;
        }

        // 加载文件并更新缓存
        String content = readFile(filePath, templatePath);
        cache.put(templatePath, new CacheEntry(content, lastModified));
        log.info("模板已加载: {} (lastModified={})", templatePath, lastModified);
        return content;
    }

    /**
     * 替换模板中的变量占位符，未填充则抛异常
     */
    private String replaceVariables(String template, Map<String, String> variables, String templatePath) {
        Matcher matcher = PLACEHOLDER.matcher(template);
        StringBuilder result = new StringBuilder();

        while (matcher.find()) {
            String varName = matcher.group(1);
            String value = variables.get(varName);
            if (value == null) {
                throw new TemplateRenderException(
                    String.format("模板 [%s] 中变量 {{%s}} 未提供值", templatePath, varName));
            }
            matcher.appendReplacement(result, Matcher.quoteReplacement(value));
        }
        matcher.appendTail(result);
        return result.toString();
    }

    /**
     * 解析模板路径：优先外部卷，其次 classpath 资源目录
     */
    private Path resolveTemplatePath(String templatePath) {
        // 优先检查外部挂载卷
        Path external = Path.of(EXTERNAL_DIR, templatePath);
        if (Files.exists(external)) {
            return external;
        }
        // 其次检查 classpath 资源目录
        var resource = getClass().getClassLoader().getResource(CLASSPATH_DIR + "/" + templatePath);
        if (resource != null) {
            try {
                return Path.of(resource.toURI());
            } catch (Exception e) {
                log.warn("解析 classpath 模板路径失败: {}", templatePath, e);
            }
        }
        return null;
    }

    /**
     * 读取文件内容
     */
    private String readFile(Path filePath, String templatePath) {
        try {
            return Files.readString(filePath);
        } catch (IOException e) {
            throw new TemplateRenderException("模板文件读取失败: " + templatePath, e);
        }
    }

    /**
     * 获取文件最后修改时间戳（毫秒）
     */
    private long getLastModified(Path filePath) {
        try {
            return Files.getLastModifiedTime(filePath).toMillis();
        } catch (IOException e) {
            return -1L;
        }
    }

    /**
     * 缓存条目：模板内容 + 文件修改时间戳
     */
    private record CacheEntry(String content, long lastModified) {}
}
