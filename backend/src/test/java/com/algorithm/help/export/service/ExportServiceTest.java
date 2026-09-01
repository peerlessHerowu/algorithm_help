package com.algorithm.help.export.service;

import com.algorithm.help.export.Exporter;
import com.algorithm.help.export.dto.ExportOptions;
import com.algorithm.help.export.dto.ExportRequest;
import com.algorithm.help.export.dto.ExportResult;
import com.algorithm.help.export.dto.ExportableContent;
import com.algorithm.help.export.enums.ExportFormat;
import com.algorithm.help.export.enums.ExportScope;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * ExportService 单元测试
 */
@ExtendWith(MockitoExtension.class)
class ExportServiceTest {

    private ExportService exportService;
    private Exporter mockMarkdownExporter;
    private Exporter mockPdfExporter;

    @BeforeEach
    void setUp() {
        mockMarkdownExporter = mock(Exporter.class);
        mockPdfExporter = mock(Exporter.class);
        Map<ExportFormat, Exporter> exporterMap = Map.of(
                ExportFormat.MARKDOWN, mockMarkdownExporter,
                ExportFormat.PDF, mockPdfExporter
        );
        exportService = new ExportService(exporterMap);
    }

    @Test
    void export_路由到正确的Exporter() {
        var result = new ExportResult()
                .setFileName("test.md")
                .setFileData("# Hello".getBytes())
                .setContentType("text/markdown")
                .setFileSizeBytes(7);
        when(mockMarkdownExporter.export(any(), any())).thenReturn(result);

        var request = new ExportRequest()
                .setFormat(ExportFormat.MARKDOWN)
                .setScope(ExportScope.SINGLE_PROBLEM)
                .setProblemId("two-sum");

        ExportResult actual = exportService.export(request);

        assertThat(actual.getFileName()).isEqualTo("test.md");
        assertThat(actual.getContentType()).isEqualTo("text/markdown");
    }

    @Test
    void export_不支持的格式抛出异常() {
        var request = new ExportRequest()
                .setFormat(ExportFormat.ANKI)
                .setScope(ExportScope.ALL);

        assertThatThrownBy(() -> exportService.export(request))
                .isInstanceOf(UnsupportedOperationException.class)
                .hasMessageContaining("暂不支持的导出格式");
    }

    @Test
    void export_文件超过100MB抛出异常() {
        long oversized = 101L * 1024 * 1024;
        var result = new ExportResult()
                .setFileName("huge.pdf")
                .setFileData(new byte[0])
                .setContentType("application/pdf")
                .setFileSizeBytes(oversized);
        when(mockPdfExporter.export(any(), any())).thenReturn(result);

        var request = new ExportRequest()
                .setFormat(ExportFormat.PDF)
                .setScope(ExportScope.ALL);

        assertThatThrownBy(() -> exportService.export(request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("导出文件过大");
    }

    @Test
    void export_options为null时使用默认值() {
        var result = new ExportResult()
                .setFileName("default.md")
                .setFileData(new byte[0])
                .setContentType("text/markdown")
                .setFileSizeBytes(0);
        when(mockMarkdownExporter.export(any(), any())).thenReturn(result);

        var request = new ExportRequest()
                .setFormat(ExportFormat.MARKDOWN)
                .setScope(ExportScope.SINGLE_PROBLEM)
                .setProblemId("two-sum")
                .setOptions(null);

        ExportResult actual = exportService.export(request);
        assertThat(actual).isNotNull();
    }

    @Test
    void export_各scope正确路由收集逻辑() {
        var result = new ExportResult()
                .setFileName("out.md")
                .setFileData(new byte[0])
                .setContentType("text/markdown")
                .setFileSizeBytes(0);
        when(mockMarkdownExporter.export(any(), any())).thenReturn(result);

        // 各 scope 都不应抛异常
        for (ExportScope scope : ExportScope.values()) {
            var request = new ExportRequest()
                    .setFormat(ExportFormat.MARKDOWN)
                    .setScope(scope)
                    .setProblemId("p1")
                    .setPatternId("dp")
                    .setPathId("path1");
            assertThat(exportService.export(request)).isNotNull();
        }
    }
}
