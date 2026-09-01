package com.algorithm.help.content.generator;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;

import java.util.List;

/**
 * 分层内容合规校验器
 * <p>
 * 根据 level 对 AI 生成的内容做合规性检查，
 * 确保各层内容满足对应深度要求。
 */
@Slf4j
@Component
public class LevelComplianceChecker {

    /**
     * 对分层内容执行合规校验
     *
     * @param content 分层内容
     * @return 校验结果
     */
    public ComplianceResult check(LeveledContent content) {
        ComplianceResult result = new ComplianceResult();

        switch (content.getLevel()) {
            case 1 -> checkL1(content, result);
            case 2 -> checkL2(content, result);
            case 3 -> checkL3(content, result);
            case 4 -> checkL4(content, result);
            case 5 -> checkL5(content, result);
            default -> result.getViolations().add("未知层级: " + content.getLevel());
        }

        result.setCompliant(result.getViolations().isEmpty());
        log.debug("层级 L{} 合规校验完成，合规={}, 违规项={}", 
                content.getLevel(), result.isCompliant(), result.getViolations().size());
        return result;
    }

    /**
     * L1 校验：内容中不得包含代码块（检测 ``` 标记）
     */
    private void checkL1(LeveledContent content, ComplianceResult result) {
        List<LeveledContent.Section> sections = content.getSections();
        if (CollectionUtils.isEmpty(sections)) {
            return;
        }
        for (LeveledContent.Section section : sections) {
            if (section.getContent() != null && section.getContent().contains("```")) {
                result.getViolations().add("L1 内容不得包含代码块，但在段落 [" 
                        + section.getHeading() + "] 中检测到 ``` 标记");
            }
        }
    }

    /**
     * L2 校验：必须包含伪代码段和逐步图解
     * （检查 sections 中 contentType 含 pseudocode 和 diagram）
     */
    private void checkL2(LeveledContent content, ComplianceResult result) {
        List<LeveledContent.Section> sections = content.getSections();
        if (CollectionUtils.isEmpty(sections)) {
            result.getViolations().add("L2 必须包含 sections，但当前为空");
            return;
        }

        boolean hasPseudocode = sections.stream()
                .anyMatch(s -> "pseudocode".equalsIgnoreCase(s.getContentType()));
        boolean hasDiagram = sections.stream()
                .anyMatch(s -> "diagram".equalsIgnoreCase(s.getContentType()));

        if (!hasPseudocode) {
            result.getViolations().add("L2 必须包含伪代码段（contentType=pseudocode）");
        }
        if (!hasDiagram) {
            result.getViolations().add("L2 必须包含逐步图解（contentType=diagram）");
        }
    }

    /**
     * L3 校验：必须包含模式框架和至少2种解法
     */
    private void checkL3(LeveledContent content, ComplianceResult result) {
        List<LeveledContent.Approach> approaches = content.getApproaches();
        if (CollectionUtils.isEmpty(approaches) || approaches.size() < 2) {
            int actual = approaches == null ? 0 : approaches.size();
            result.getViolations().add("L3 必须包含至少2种解法，当前仅有 " + actual + " 种");
        }
    }

    /**
     * L4 校验：必须包含复杂度推导过程（proofs 不为空）
     */
    private void checkL4(LeveledContent content, ComplianceResult result) {
        if (content.getProofs() == null) {
            result.getViolations().add("L4 必须包含复杂度推导过程（proofs 不为空）");
        }
    }

    /**
     * L5 校验：必须包含至少1条论文引用（references 不为空且 size >= 1）
     */
    private void checkL5(LeveledContent content, ComplianceResult result) {
        List<LeveledContent.Reference> refs = content.getReferences();
        if (CollectionUtils.isEmpty(refs)) {
            result.getViolations().add("L5 必须包含至少1条论文引用（references 不为空）");
        }
    }
}
