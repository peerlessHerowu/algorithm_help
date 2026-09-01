package com.algorithm.help.config;

import com.algorithm.help.export.Exporter;
import com.algorithm.help.export.enums.ExportFormat;
import com.algorithm.help.export.impl.AnkiExporter;
import com.algorithm.help.export.impl.MarkdownExporter;
import com.algorithm.help.export.impl.NotionExporter;
import com.algorithm.help.export.impl.PdfExporter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

/**
 * 导出器配置，构建 ExportFormat -> Exporter 映射
 */
@Configuration
public class ExporterConfig {

    @Bean
    public Map<ExportFormat, Exporter> exporterMap(MarkdownExporter markdownExporter,
                                                   PdfExporter pdfExporter,
                                                   AnkiExporter ankiExporter,
                                                   NotionExporter notionExporter) {
        return Map.of(
                ExportFormat.MARKDOWN, markdownExporter,
                ExportFormat.PDF, pdfExporter,
                ExportFormat.ANKI, ankiExporter,
                ExportFormat.NOTION, notionExporter
        );
    }
}
