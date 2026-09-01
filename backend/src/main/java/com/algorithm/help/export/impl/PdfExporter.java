package com.algorithm.help.export.impl;

import com.algorithm.help.export.Exporter;
import com.algorithm.help.export.dto.ExportOptions;
import com.algorithm.help.export.dto.ExportResult;
import com.algorithm.help.export.dto.ExportableContent;
import com.algorithm.help.export.enums.ExportFormat;
import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * PDF 导出器，使用 OpenPDF 生成排版精美的算法笔记 PDF。
 * <p>
 * 包含：封面页、目录页、正文（代码块+图解）、页眉页脚
 * 支持中文字体（STSong-Light），最大 500 页限制。
 */
@Slf4j
@Component
public class PdfExporter implements Exporter {

    /** 最大页数限制 */
    private static final int MAX_PAGES = 500;

    /** PDF 标题 */
    private static final String TITLE = "算法学习笔记";

    /** 日期格式 */
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @Override
    public ExportResult export(List<ExportableContent> contents, ExportOptions options) {
        log.info("开始 PDF 导出，内容数量: {}", contents.size());

        try (var baos = new ByteArrayOutputStream()) {
            var document = new Document(PageSize.A4, 60, 60, 72, 72);
            var writer = PdfWriter.getInstance(document, baos);

            // 设置页眉页脚
            writer.setPageEvent(new HeaderFooterPageEvent(TITLE));

            document.open();
            addMetadata(document);
            writeCoverPage(document);
            writeTocPage(document, contents);
            writeContentPages(document, contents, options);
            document.close();

            // 校验页数限制
            validatePageCount(writer.getPageNumber());

            byte[] data = baos.toByteArray();
            return buildResult(data);
        } catch (DocumentException | IOException e) {
            log.error("PDF 导出失败", e);
            throw new RuntimeException("PDF 导出失败: " + e.getMessage(), e);
        }
    }

    /**
     * 获取支持的导出格式
     */
    public ExportFormat getFormat() {
        return ExportFormat.PDF;
    }

    // ===== 字体工厂 =====

    /**
     * 获取中文基础字体
     */
    private BaseFont getChineseBaseFont() {
        try {
            return BaseFont.createFont("STSong-Light", "UniGB-UCS2-H", BaseFont.NOT_EMBEDDED);
        } catch (Exception e) {
            log.warn("中文字体加载失败，回退到 Helvetica: {}", e.getMessage());
            try {
                return BaseFont.createFont(BaseFont.HELVETICA, BaseFont.WINANSI, BaseFont.NOT_EMBEDDED);
            } catch (Exception ex) {
                throw new RuntimeException("字体加载失败", ex);
            }
        }
    }

    /**
     * 获取等宽字体（代码块用）
     */
    private BaseFont getMonoBaseFont() {
        try {
            return BaseFont.createFont(BaseFont.COURIER, BaseFont.WINANSI, BaseFont.NOT_EMBEDDED);
        } catch (Exception e) {
            throw new RuntimeException("等宽字体加载失败", e);
        }
    }

    private Font titleFont() {
        return new Font(getChineseBaseFont(), 28, Font.BOLD, new Color(33, 33, 33));
    }

    private Font subtitleFont() {
        return new Font(getChineseBaseFont(), 14, Font.NORMAL, new Color(100, 100, 100));
    }

    private Font h2Font() {
        return new Font(getChineseBaseFont(), 16, Font.BOLD, new Color(50, 50, 50));
    }

    private Font h3Font() {
        return new Font(getChineseBaseFont(), 13, Font.BOLD, new Color(70, 70, 70));
    }

    private Font bodyFont() {
        return new Font(getChineseBaseFont(), 11, Font.NORMAL, Color.BLACK);
    }

    private Font codeFont() {
        return new Font(getMonoBaseFont(), 9, Font.NORMAL, new Color(40, 40, 40));
    }

    private Font tocFont() {
        return new Font(getChineseBaseFont(), 12, Font.NORMAL, new Color(60, 60, 60));
    }

    // ===== 页面渲染 =====

    /**
     * 设置 PDF 元数据
     */
    private void addMetadata(Document document) {
        document.addTitle(TITLE);
        document.addAuthor("算法深度理解引擎");
        document.addSubject("算法学习笔记导出");
        document.addCreator("Algorithm Help - PDF Exporter");
    }

    /**
     * 写入封面页：居中标题 + 副标题（日期）
     */
    private void writeCoverPage(Document document) throws DocumentException {
        document.newPage();

        // 上方留白
        for (int i = 0; i < 8; i++) {
            document.add(new Paragraph(" "));
        }

        // 主标题
        var titlePara = new Paragraph(TITLE, titleFont());
        titlePara.setAlignment(Element.ALIGN_CENTER);
        document.add(titlePara);

        // 间距
        document.add(new Paragraph(" "));
        document.add(new Paragraph(" "));

        // 副标题（日期）
        String dateStr = "导出日期：" + LocalDate.now().format(DATE_FMT);
        var datePara = new Paragraph(dateStr, subtitleFont());
        datePara.setAlignment(Element.ALIGN_CENTER);
        document.add(datePara);

        // 引擎标识
        document.add(new Paragraph(" "));
        var enginePara = new Paragraph("算法深度理解引擎 · 自动生成", subtitleFont());
        enginePara.setAlignment(Element.ALIGN_CENTER);
        document.add(enginePara);
    }

    /**
     * 写入目录页：列出所有题目名称
     */
    private void writeTocPage(Document document, List<ExportableContent> contents)
            throws DocumentException {
        document.newPage();

        var tocTitle = new Paragraph("目 录", h2Font());
        tocTitle.setAlignment(Element.ALIGN_CENTER);
        tocTitle.setSpacingAfter(20f);
        document.add(tocTitle);

        for (int i = 0; i < contents.size(); i++) {
            var content = contents.get(i);
            String entry = (i + 1) + ". " + content.getProblemName();
            if (content.getPatternName() != null) {
                entry += "  [" + content.getPatternName() + "]";
            }
            var para = new Paragraph(entry, tocFont());
            para.setSpacingAfter(6f);
            document.add(para);
        }
    }

    /**
     * 写入正文内容页
     */
    private void writeContentPages(Document document, List<ExportableContent> contents,
                                   ExportOptions options) throws DocumentException {
        for (int i = 0; i < contents.size(); i++) {
            document.newPage();
            writeSection(document, contents.get(i), i + 1, options);
        }
    }

    /**
     * 写入单个题目的完整内容段落
     */
    private void writeSection(Document document, ExportableContent content,
                              int index, ExportOptions options) throws DocumentException {
        // 段落标题：序号 + 题目名称 + 模式 + 难度
        String heading = buildSectionHeading(content, index);
        var headingPara = new Paragraph(heading, h2Font());
        headingPara.setSpacingAfter(12f);
        document.add(headingPara);

        // 题目描述
        writeSubSection(document, "题目描述", content.getDescription());

        // 解题思路
        writeSubSection(document, "解题思路", content.getApproach());

        // 代码实现
        if (options.isIncludeCode() && content.getCode() != null) {
            writeCodeBlocks(document, content.getCode(), options.getLanguages());
        }

        // 复杂度分析
        writeSubSection(document, "复杂度分析", content.getComplexity());

        // Mermaid 图解（作为代码块展示源码）
        if (options.isIncludeDiagrams() && content.getDiagramMermaid() != null) {
            writeMermaidBlock(document, content.getDiagramMermaid());
        }
    }

    /**
     * 构建段落标题文本
     */
    private String buildSectionHeading(ExportableContent content, int index) {
        var sb = new StringBuilder();
        sb.append(index).append(". ").append(content.getProblemName());
        if (content.getPatternName() != null) {
            sb.append("  [").append(content.getPatternName()).append("]");
        }
        if (content.getDifficulty() != null) {
            sb.append("  难度: ").append("★".repeat(content.getDifficulty()));
        }
        return sb.toString();
    }

    /**
     * 写入子标题 + 正文段落
     */
    private void writeSubSection(Document document, String title, String text)
            throws DocumentException {
        if (text == null || text.isBlank()) {
            return;
        }

        var titlePara = new Paragraph(title, h3Font());
        titlePara.setSpacingBefore(10f);
        titlePara.setSpacingAfter(4f);
        document.add(titlePara);

        var bodyPara = new Paragraph(text, bodyFont());
        bodyPara.setSpacingAfter(8f);
        bodyPara.setLeading(18f);
        document.add(bodyPara);
    }

    /**
     * 写入代码块（灰色背景框 + 等宽字体）
     */
    private void writeCodeBlocks(Document document, Map<String, String> codeMap,
                                 List<String> languages) throws DocumentException {
        var titlePara = new Paragraph("代码实现", h3Font());
        titlePara.setSpacingBefore(10f);
        titlePara.setSpacingAfter(4f);
        document.add(titlePara);

        for (var entry : codeMap.entrySet()) {
            String lang = entry.getKey();
            // 如果指定了语言过滤，仅输出指定的语言
            if (languages != null && !languages.isEmpty() && !languages.contains(lang)) {
                continue;
            }
            writeCodeBlock(document, lang, entry.getValue());
        }
    }

    /**
     * 写入单个代码块：语言标签 + 灰色背景代码区域
     */
    private void writeCodeBlock(Document document, String language, String code)
            throws DocumentException {
        // 语言标签
        var langPara = new Paragraph("▸ " + language.toUpperCase(), subtitleFont());
        langPara.setSpacingBefore(6f);
        document.add(langPara);

        // 代码内容包裹在带灰色背景的 PdfPTable 中
        var table = new PdfPTable(1);
        table.setWidthPercentage(100f);
        table.setSpacingBefore(4f);
        table.setSpacingAfter(8f);

        var cell = new PdfPCell();
        cell.setBackgroundColor(new Color(245, 245, 245));
        cell.setPadding(10f);
        cell.setBorderColor(new Color(220, 220, 220));

        var codePara = new Paragraph(code, codeFont());
        codePara.setLeading(14f);
        cell.addElement(codePara);
        table.addCell(cell);

        document.add(table);
    }

    /**
     * 写入 Mermaid 图解（MVP 阶段以源码形式展示）
     */
    private void writeMermaidBlock(Document document, String mermaidSource)
            throws DocumentException {
        var titlePara = new Paragraph("图解 (Mermaid)", h3Font());
        titlePara.setSpacingBefore(10f);
        titlePara.setSpacingAfter(4f);
        document.add(titlePara);

        writeCodeBlock(document, "mermaid", mermaidSource);
    }

    // ===== 工具方法 =====

    /**
     * 校验页数不超过 500 页
     */
    private void validatePageCount(int pageCount) {
        if (pageCount > MAX_PAGES) {
            throw new IllegalStateException(
                    "PDF 页数超过限制（" + pageCount + "/" + MAX_PAGES
                            + "），请缩小导出范围");
        }
    }

    /**
     * 构建导出结果
     */
    private ExportResult buildResult(byte[] data) {
        return new ExportResult()
                .setFileName("algorithm-notes.pdf")
                .setFileData(data)
                .setContentType("application/pdf")
                .setFileSizeBytes(data.length);
    }

    // ===== 页眉页脚处理器 =====

    /**
     * 页眉页脚事件处理器：页眉显示标题，页脚显示页码
     */
    private static class HeaderFooterPageEvent extends PdfPageEventHelper {

        private final String headerText;
        private BaseFont baseFont;

        HeaderFooterPageEvent(String headerText) {
            this.headerText = headerText;
        }

        @Override
        public void onOpenDocument(PdfWriter writer, Document document) {
            try {
                baseFont = BaseFont.createFont("STSong-Light", "UniGB-UCS2-H", BaseFont.NOT_EMBEDDED);
            } catch (Exception e) {
                try {
                    baseFont = BaseFont.createFont(BaseFont.HELVETICA, BaseFont.WINANSI, BaseFont.NOT_EMBEDDED);
                } catch (Exception ex) {
                    throw new RuntimeException("页眉页脚字体加载失败", ex);
                }
            }
        }

        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            int pageNum = writer.getPageNumber();
            // 封面页不显示页眉页脚
            if (pageNum <= 1) {
                return;
            }
            writeHeader(writer, document);
            writeFooter(writer, document, pageNum);
        }

        private void writeHeader(PdfWriter writer, Document document) {
            var cb = writer.getDirectContent();
            cb.saveState();
            cb.setFontAndSize(baseFont, 9);
            cb.setColorFill(new Color(150, 150, 150));
            cb.beginText();
            cb.showTextAligned(Element.ALIGN_LEFT, headerText,
                    document.leftMargin(), document.top() + 20, 0);
            cb.endText();
            // 页眉分隔线
            cb.setColorStroke(new Color(220, 220, 220));
            cb.setLineWidth(0.5f);
            cb.moveTo(document.leftMargin(), document.top() + 12);
            cb.lineTo(document.right() - document.rightMargin() + document.leftMargin(),
                    document.top() + 12);
            cb.stroke();
            cb.restoreState();
        }

        private void writeFooter(PdfWriter writer, Document document, int pageNum) {
            var cb = writer.getDirectContent();
            cb.saveState();
            cb.setFontAndSize(baseFont, 9);
            cb.setColorFill(new Color(150, 150, 150));
            cb.beginText();
            String footer = "- " + (pageNum - 1) + " -";
            cb.showTextAligned(Element.ALIGN_CENTER, footer,
                    (document.right() + document.left()) / 2,
                    document.bottom() - 20, 0);
            cb.endText();
            cb.restoreState();
        }
    }
}
