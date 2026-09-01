package com.algorithm.help.content.enrichment.pipeline.steps;

import com.algorithm.help.content.codegen.CodeSnippet;
import com.algorithm.help.content.codegen.MultiLangCodeGenerator;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentContext;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentResult;
import com.algorithm.help.content.generator.LeveledContent.Approach;
import com.algorithm.help.entity.Problem;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * MultiLangStep 单元测试
 */
class MultiLangStepTest {

    private MultiLangCodeGenerator codeGenerator;
    private MultiLangStep step;

    @BeforeEach
    void setUp() {
        codeGenerator = mock(MultiLangCodeGenerator.class);
        step = new MultiLangStep(codeGenerator, List.of("python", "java", "go", "cpp"));
    }

    @Test
    @DisplayName("步骤名称为 multi-lang")
    void getName_returnsMultiLang() {
        assertEquals("multi-lang", step.getName());
    }

    @Test
    @DisplayName("非核心步骤")
    void isCritical_returnsFalse() {
        assertFalse(step.isCritical());
    }

    @Test
    @DisplayName("L1 级别时 isApplicable 返回 false")
    void isApplicable_level1_returnsFalse() {
        EnrichmentContext ctx = buildContext(1);
        assertFalse(step.isApplicable(ctx));
    }

    @Test
    @DisplayName("L2-L5 级别时 isApplicable 返回 true")
    void isApplicable_level2to5_returnsTrue() {
        for (int level = 2; level <= 5; level++) {
            EnrichmentContext ctx = buildContext(level);
            assertTrue(step.isApplicable(ctx), "Level " + level + " should be applicable");
        }
    }

    @Test
    @DisplayName("所有目标语言已存在时直接返回成功")
    void process_allLanguagesPresent_returnsOk() {
        EnrichmentContext ctx = buildContext(3);
        Map<String, String> codes = new HashMap<>();
        codes.put("python", "print('hello')");
        codes.put("java", "System.out.println(\"hello\");");
        codes.put("go", "fmt.Println(\"hello\")");
        codes.put("cpp", "cout << \"hello\";");
        ctx.setCodeImplementations(codes);

        EnrichmentResult result = step.process(ctx);

        assertTrue(result.isFailed() == false);
        verifyNoInteractions(codeGenerator);
    }

    @Test
    @DisplayName("缺失语言时调用代码生成器补全")
    void process_missingLanguages_callsGenerator() {
        EnrichmentContext ctx = buildContext(3);
        ctx.setPolishedContent("两数之和的哈希表解法...");
        Map<String, String> codes = new HashMap<>();
        codes.put("python", "# python impl");
        ctx.setCodeImplementations(codes);

        // 模拟生成器返回 java 和 go 的代码
        when(codeGenerator.generateForApproach(any(Approach.class), any(Problem.class)))
                .thenReturn(List.of(
                        new CodeSnippet().setLanguage("java").setCode("// java impl"),
                        new CodeSnippet().setLanguage("go").setCode("// go impl"),
                        new CodeSnippet().setLanguage("cpp").setCode("// cpp impl")
                ));

        EnrichmentResult result = step.process(ctx);

        assertTrue(!result.isFailed());
        assertEquals("// java impl", ctx.getCodeImplementations().get("java"));
        assertEquals("// go impl", ctx.getCodeImplementations().get("go"));
        assertEquals("// cpp impl", ctx.getCodeImplementations().get("cpp"));
        // python 保持不变
        assertEquals("# python impl", ctx.getCodeImplementations().get("python"));
    }

    @Test
    @DisplayName("代码生成器全部失败时返回 fail")
    void process_allGenerationsFail_returnsFail() {
        EnrichmentContext ctx = buildContext(3);
        ctx.setPolishedContent("解法内容...");
        ctx.setCodeImplementations(new HashMap<>());

        // 模拟生成器返回空列表（全部失败）
        when(codeGenerator.generateForApproach(any(Approach.class), any(Problem.class)))
                .thenReturn(List.of());

        EnrichmentResult result = step.process(ctx);

        assertTrue(result.isFailed());
        assertEquals("所有缺失语言均生成失败", result.getError());
    }

    @Test
    @DisplayName("生成器返回 null code 的片段不被采纳")
    void process_nullCodeSnippet_notAdded() {
        EnrichmentContext ctx = buildContext(3);
        ctx.setPolishedContent("解法内容...");
        ctx.setCodeImplementations(new HashMap<>());

        when(codeGenerator.generateForApproach(any(Approach.class), any(Problem.class)))
                .thenReturn(List.of(
                        new CodeSnippet().setLanguage("python").setCode(null),
                        new CodeSnippet().setLanguage("java").setCode("// java impl")
                ));

        EnrichmentResult result = step.process(ctx);

        assertTrue(!result.isFailed());
        assertNull(ctx.getCodeImplementations().get("python"));
        assertEquals("// java impl", ctx.getCodeImplementations().get("java"));
    }

    // ===== 辅助方法 =====

    private EnrichmentContext buildContext(int level) {
        Problem problem = new Problem();
        problem.setId("two-sum");
        problem.setTitle("Two Sum");
        problem.setTitleCn("两数之和");
        problem.setTags("[\"hash-table\"]");

        return new EnrichmentContext()
                .setProblem(problem)
                .setTargetLevel(level);
    }
}
