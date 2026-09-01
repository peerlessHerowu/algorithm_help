package com.algorithm.help.ai.impl;

import com.algorithm.help.ai.AIProvider;
import com.algorithm.help.ai.model.AiResponse;
import com.algorithm.help.ai.model.ChatMessage;
import com.algorithm.help.ai.model.GenerateOptions;
import com.algorithm.help.entity.Problem;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;

/**
 * Kiro CLI AI Provider
 * 通过 kiro-cli 子进程调用 AI 模型，复用 Kiro 的认证能力
 * Prompt 通过 stdin 安全传入（防止 Shell 注入）
 */
@Slf4j
@Component
public class KiroCliProvider implements AIProvider {

    private static final Pattern ANSI_PATTERN =
            Pattern.compile("\\u001B\\[[;?\\d]*[a-zA-Z]|\\[\\?25[lh]");

    private static final ScheduledExecutorService WATCHDOG =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "kiro-watchdog");
                t.setDaemon(true);
                return t;
            });

    @Value("${ai.kiro-cli.path:/Users/peerlesswu/.local/bin/kiro-cli}")
    private String kiroCliPath;

    @Value("${ai.kiro-cli.model:claude-sonnet-4.5}")
    private String defaultModel;

    @Value("${ai.kiro-cli.timeout:60}")
    private int timeoutSeconds;

    @Override
    public String getName() {
        return "kiro-cli";
    }

    @Override
    public boolean isAvailable() {
        try {
            ProcessBuilder pb = new ProcessBuilder(kiroCliPath, "--version");
            pb.redirectErrorStream(true);
            Process p = pb.start();
            boolean finished = p.waitFor(5, TimeUnit.SECONDS);
            if (finished) {
                p.destroy();
                return p.exitValue() == 0;
            }
            p.destroyForcibly();
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public AiResponse generateExplanation(Problem problem, GenerateOptions options) {
        String prompt = buildExplanationPrompt(problem, options);
        return callKiro(prompt);
    }

    @Override
    public AiResponse transformUserInput(String userInput, Problem problem) {
        String prompt = "将以下用户对题目「" + problem.getTitle() + "」的思路转化为结构化答案：\n\n" + userInput;
        return callKiro(prompt);
    }

    @Override
    public String generateDiagram(String algorithmType, String diagramType, String inputData) {
        String prompt = "生成 " + algorithmType + " 的 " + diagramType + " Mermaid 图表代码。输入数据：" + inputData
                + "\n\n只输出 Mermaid 代码，不要其他文字。";
        AiResponse resp = callKiro(prompt);
        return resp.getContent();
    }

    @Override
    public AiResponse interactiveChat(List<ChatMessage> context, String message) {
        StringBuilder prompt = new StringBuilder();
        if (context != null) {
            for (ChatMessage msg : context) {
                prompt.append(msg.getRole()).append(": ").append(msg.getContent()).append("\n");
            }
            prompt.append("user: ").append(message).append("\nassistant:");
        } else {
            prompt.append(message);
        }
        return callKiro(prompt.toString());
    }

    @Override
    public AiResponse detectErrors(String content) {
        String prompt = "检查以下算法题解内容中的错误（逻辑错误、代码错误、复杂度标注错误等），用中文列出所有问题：\n\n" + content;
        return callKiro(prompt);
    }

    @Override
    public AiResponse generateLeveledExplanation(String topic, int level) {
        String prompt = buildLevelPrompt(topic, level);
        return callKiro(prompt);
    }

    // ---- 核心：调用 kiro-cli 子进程 ----

    private AiResponse callKiro(String prompt) {
        long start = System.currentTimeMillis();
        try {
            String output = executeProcess(prompt);
            long duration = System.currentTimeMillis() - start;
            log.info("kiro-cli 调用完成，耗时 {}ms，输出长度 {}", duration, output.length());
            return AiResponse.of(output, "kiro-cli", duration);
        } catch (Exception e) {
            log.error("kiro-cli 调用失败: {}", e.getMessage());
            long duration = System.currentTimeMillis() - start;
            return new AiResponse()
                    .setContent("AI 调用失败：" + e.getMessage())
                    .setProvider("kiro-cli")
                    .setDurationMs(duration)
                    .setFromCache(false);
        }
    }

    private String executeProcess(String prompt) throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(
                kiroCliPath, "chat", "--no-interactive",
                "--trust-all-tools", "--model", defaultModel
        );
        pb.redirectErrorStream(true);
        Process process = pb.start();

        // watchdog 超时控制
        AtomicBoolean timedOut = new AtomicBoolean(false);
        ScheduledFuture<?> watchdog = WATCHDOG.schedule(() -> {
            if (process.isAlive()) {
                timedOut.set(true);
                log.warn("kiro-cli 超时 ({}s)，强制终止", timeoutSeconds);
                process.destroyForcibly();
            }
        }, timeoutSeconds, TimeUnit.SECONDS);

        try {
            // 通过 stdin 传入 prompt（安全，不经过 shell）
            OutputStream stdin = process.getOutputStream();
            stdin.write(prompt.getBytes(StandardCharsets.UTF_8));
            stdin.flush();
            stdin.close();

            // 读取 stdout
            String output = readOutput(process);

            if (timedOut.get()) {
                throw new IOException("kiro-cli 超时 (" + timeoutSeconds + "s)");
            }

            process.waitFor();
            return output;
        } finally {
            watchdog.cancel(false);
            if (process.isAlive()) {
                process.destroyForcibly();
            }
        }
    }

    private String readOutput(Process process) throws IOException {
        StringBuilder sb = new StringBuilder();
        boolean preambleFinished = false;

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String clean = stripAnsi(line);

                // 移除 kiro-cli 可能残留的 prompt 指示符
                clean = clean.replaceAll("^\\s*>\\s*", "");

                // 跳过 kiro-cli 启动提示
                if (!preambleFinished) {
                    if (isKiroPreamble(clean)) continue;
                    preambleFinished = true;
                }

                // 跳过 Credits 行
                if (clean.contains("▸") && clean.contains("Credits")) continue;
                if (clean.contains("▸") && clean.contains("Time")) continue;

                sb.append(clean).append("\n");
            }
        }
        return sb.toString().trim();
    }

    private String stripAnsi(String text) {
        return ANSI_PATTERN.matcher(text).replaceAll("");
    }

    private boolean isKiroPreamble(String line) {
        if (line.isBlank()) return true;
        String s = line.trim();
        return s.startsWith("All tools are now trusted")
                || s.contains("Kiro will execute tools without asking")
                || s.contains("Agents can sometimes do unexpected")
                || s.contains("understand the risks")
                || s.contains("Learn more at")
                || s.contains("kiro.dev/docs/cli")
                || s.startsWith("!")
                || s.startsWith("⚠️")
                || s.contains("WARNING:")
                || s.contains("Failed to retrieve MCP")
                || s.contains("MCP functionality disabled")
                || s.contains("Try running")
                || s.startsWith(">");
    }

    // ---- Prompt 构建 ----

    private String buildExplanationPrompt(Problem problem, GenerateOptions options) {
        int level = options != null ? options.getLevel() : 3;
        return """
                你是一个算法教学专家。请为以下 LeetCode 题目生成 L%d 级别的解析。
                
                题目：%s
                难度：%s
                描述：%s
                
                请用中文输出，格式为 Markdown，包含以下部分：
                1. 核心思路（用简洁的语言描述解题关键）
                2. 解法详解（含代码，用 Python 和 Java）
                3. 复杂度分析
                4. 关联模式（该题属于什么算法模式）
                """.formatted(
                level,
                problem.getTitle(),
                problem.getDifficulty(),
                problem.getDescription() != null ? problem.getDescription().substring(0, Math.min(500, problem.getDescription().length())) : ""
        );
    }

    private String buildLevelPrompt(String topic, int level) {
        String style = switch (level) {
            case 1 -> "用生活类比，完全不用代码，故事化讲解";
            case 2 -> "用具体例子 + 伪代码 + 逐步图解";
            case 3 -> "标准解法 + 模式框架 + 多解法对比";
            case 4 -> "边界分析 + 复杂度证明 + 面试追问";
            case 5 -> "数学推导 + 论文引用 + 前沿应用";
            default -> "标准解法讲解";
        };
        return "请用中文为以下算法主题生成 L" + level + " 级别的解释。\n"
                + "风格要求：" + style + "\n\n"
                + "主题：" + topic;
    }
}
