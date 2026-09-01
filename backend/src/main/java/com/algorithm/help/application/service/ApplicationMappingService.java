package com.algorithm.help.application.service;

import com.algorithm.help.application.entity.ApplicationMapping;
import com.algorithm.help.application.entity.CrossDomainMapping;
import com.algorithm.help.application.enums.ApplicationDomain;
import com.algorithm.help.application.repository.ApplicationMappingRepository;
import com.algorithm.help.application.repository.CrossDomainMappingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 实际应用映射服务
 * <p>
 * 提供算法模式的四维应用映射查询、迷你案例获取和跨域映射表功能
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApplicationMappingService {

    private final ApplicationMappingRepository mappingRepo;
    private final CrossDomainMappingRepository crossDomainRepo;

    /**
     * 获取某模式的全部应用映射，按领域分组
     *
     * @param patternId 算法模式 ID
     * @return 按 domain 分组的应用映射列表
     */
    public Map<ApplicationDomain, List<ApplicationMapping>> getApplications(String patternId) {
        List<ApplicationMapping> mappings = mappingRepo.findByPatternId(patternId);
        return mappings.stream()
                .collect(Collectors.groupingBy(ApplicationMapping::getDomain));
    }

    /**
     * 获取某模式在指定领域的应用映射列表
     *
     * @param patternId 算法模式 ID
     * @param domain    应用领域
     * @return 该领域的应用映射列表
     */
    public List<ApplicationMapping> getApplicationsByDomain(String patternId, ApplicationDomain domain) {
        return mappingRepo.findByPatternIdAndDomain(patternId, domain);
    }

    /**
     * 获取某模式的迷你案例列表（仅返回有代码的映射）
     *
     * @param patternId 算法模式 ID
     * @return 含迷你案例代码的应用映射列表
     */
    public List<ApplicationMapping> getMiniCases(String patternId) {
        List<ApplicationMapping> mappings = mappingRepo.findByPatternId(patternId);
        return mappings.stream()
                .filter(m -> m.getMiniCaseCode() != null && !m.getMiniCaseCode().isBlank())
                .collect(Collectors.toList());
    }

    /**
     * 获取某模式的跨域迁移映射表
     *
     * @param patternId 算法模式 ID
     * @return 跨域映射（可能为空）
     */
    public Optional<CrossDomainMapping> getCrossDomainTable(String patternId) {
        return crossDomainRepo.findByPatternId(patternId);
    }

    /** 迷你案例代码最大行数 */
    private static final int MAX_MINI_CASE_LINES = 50;

    /**
     * 校验迷你案例代码行数（导入时调用）
     * <p>
     * 超过 50 行则记录警告日志并抛出异常
     *
     * @param mapping 待校验的应用映射
     * @throws IllegalArgumentException 代码超过 50 行时抛出
     */
    public void validateMiniCaseCode(ApplicationMapping mapping) {
        if (mapping.getMiniCaseCode() == null || mapping.getMiniCaseCode().isBlank()) {
            return;
        }
        long lineCount = mapping.getMiniCaseCode().lines().count();
        if (lineCount > MAX_MINI_CASE_LINES) {
            log.warn("[迷你案例校验] 代码超过{}行限制: title={}, 实际行数={}",
                    MAX_MINI_CASE_LINES, mapping.getTitle(), lineCount);
            throw new IllegalArgumentException(
                    String.format("迷你案例代码超过%d行限制（实际%d行）: %s",
                            MAX_MINI_CASE_LINES, lineCount, mapping.getTitle()));
        }
    }

    /**
     * 导入应用映射（含代码行数校验）
     *
     * @param mappings 待导入的应用映射列表
     * @return 成功保存的映射列表
     */
    public List<ApplicationMapping> importMappings(List<ApplicationMapping> mappings) {
        for (ApplicationMapping mapping : mappings) {
            validateMiniCaseCode(mapping);
        }
        return mappingRepo.saveAll(mappings);
    }
}
