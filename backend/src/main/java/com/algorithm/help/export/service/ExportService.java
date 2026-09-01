package com.algorithm.help.export.service;

import com.algorithm.help.export.Exporter;
import com.algorithm.help.export.dto.ExportOptions;
import com.algorithm.help.export.dto.ExportRequest;
import com.algorithm.help.export.dto.ExportResult;
import com.algorithm.help.export.dto.ExportableContent;
import com.algorithm.help.export.enums.ExportFormat;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * 统一导出服务，路由到对应 Exporter 实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExportService {

    /** 最大导出文件大小：100MB */
    private static final long MAX_FILE_SIZE = 100L * 1024 * 1024;

    /** 格式 -> Exporter 实现映射 */
    private final Map<ExportFormat, Exporter> exporterMap;

    /**
     * 统一导出入口
     */
    public ExportResult export(ExportRequest request) {
        var options = resolveOptions(request.getOptions());
        var contents = collectContents(request);

        var exporter = routeExporter(request.getFormat());
        var result = exporter.export(contents, options);

        validateFileSize(result);
        return result;
    }

    /**
     * 路由到对应 Exporter 实现
     */
    private Exporter routeExporter(ExportFormat format) {
        var exporter = exporterMap.get(format);
        if (exporter == null) {
            throw new UnsupportedOperationException(
                    "暂不支持的导出格式: " + format);
        }
        return exporter;
    }

    /**
     * 确保 options 不为 null，提供默认值
     */
    private ExportOptions resolveOptions(ExportOptions options) {
        return options != null ? options : new ExportOptions();
    }

    /**
     * 根据 scope 收集待导出内容
     * <p>
     * 当前为 stub 实现，后续集成 Repository 后填充真实数据
     */
    private List<ExportableContent> collectContents(ExportRequest request) {
        return switch (request.getScope()) {
            case SINGLE_PROBLEM -> loadProblemContent(request.getProblemId());
            case BY_PATTERN -> loadPatternContents(request.getPatternId());
            case BY_LEARNING_PATH -> loadPathContents(request.getPathId());
            case ALL -> loadAllContents();
        };
    }

    /**
     * 校验导出文件大小不超过 100MB
     */
    private void validateFileSize(ExportResult result) {
        if (result.getFileSizeBytes() > MAX_FILE_SIZE) {
            throw new IllegalStateException(
                    "导出文件过大（" + result.getFileSizeBytes() / (1024 * 1024)
                            + "MB），请缩小导出范围");
        }
    }

    // ===== Stub 方法，后续集成 Repository 后替换 =====

    private List<ExportableContent> loadProblemContent(String problemId) {
        log.debug("加载单题内容: {}", problemId);
        return Collections.emptyList();
    }

    private List<ExportableContent> loadPatternContents(String patternId) {
        log.debug("加载模式内容: {}", patternId);
        return Collections.emptyList();
    }

    private List<ExportableContent> loadPathContents(String pathId) {
        log.debug("加载学习路径内容: {}", pathId);
        return Collections.emptyList();
    }

    private List<ExportableContent> loadAllContents() {
        log.debug("加载全部内容");
        return Collections.emptyList();
    }
}
