package com.algorithm.help.export.impl;

import com.algorithm.help.export.Exporter;
import com.algorithm.help.export.dto.ExportOptions;
import com.algorithm.help.export.dto.ExportResult;
import com.algorithm.help.export.dto.ExportableContent;
import lombok.Data;
import lombok.experimental.Accessors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Anki 卡片导出器，生成 .apkg 格式文件
 * <p>
 * .apkg 内部结构：SQLite 数据库(collection.anki2) + media JSON 文件，打包为 zip
 */
@Slf4j
@Component
public class AnkiExporter implements Exporter {

    /** 牌组名前缀 */
    private static final String DECK_PREFIX = "ADUE-";

    /** Anki 字段分隔符 */
    private static final String FIELD_SEPARATOR = "\u001f";

    @Override
    public ExportResult export(List<ExportableContent> contents, ExportOptions options) {
        var cards = buildAllCards(contents, options);
        byte[] apkgData = packageAsApkg(cards);

        String deckName = determineDeckName(contents);
        return new ExportResult()
                .setFileName(deckName + ".apkg")
                .setFileData(apkgData)
                .setContentType("application/octet-stream")
                .setFileSizeBytes(apkgData.length);
    }

    /**
     * 为所有内容构建 Anki 卡片
     */
    private List<AnkiCard> buildAllCards(List<ExportableContent> contents, ExportOptions options) {
        var cards = new ArrayList<AnkiCard>();
        for (var content : contents) {
            cards.add(buildProblemToApproachCard(content));
            cards.add(buildSignalToPatternCard(content));
            if (options.isIncludeCode() && content.getCode() != null && !content.getCode().isEmpty()) {
                cards.add(buildCodeCompletionCard(content));
            }
            cards.add(buildComplexityQuizCard(content));
        }
        return cards;
    }

    /**
     * 卡片1：题目描述 → 核心思路
     */
    private AnkiCard buildProblemToApproachCard(ExportableContent content) {
        String front = content.getProblemName() + "\n\n" + content.getDescription();
        String back = content.getApproach() != null ? content.getApproach() : "暂无思路";
        return new AnkiCard()
                .setFront(front)
                .setBack(back)
                .setTags(buildTags(content))
                .setDeckName(buildDeckName(content));
    }

    /**
     * 卡片2：模式信号识别 → 模式名称
     */
    private AnkiCard buildSignalToPatternCard(ExportableContent content) {
        String desc = shortenDescription(content.getDescription(), 200);
        String front = "识别以下题目的算法模式:\n\n" + desc;
        String back = content.getPatternName() != null ? content.getPatternName() : "未分类";
        return new AnkiCard()
                .setFront(front)
                .setBack(back)
                .setTags(buildTags(content))
                .setDeckName(buildDeckName(content));
    }

    /**
     * 卡片3：代码补全（关键部分遮掩）
     */
    private AnkiCard buildCodeCompletionCard(ExportableContent content) {
        Map.Entry<String, String> codeEntry = content.getCode().entrySet().iterator().next();
        String fullCode = codeEntry.getValue();
        String maskedCode = maskCodeKeyParts(fullCode);

        String front = "补全以下代码的关键部分:\n\n" + maskedCode;
        String back = fullCode;
        return new AnkiCard()
                .setFront(front)
                .setBack(back)
                .setTags(buildTags(content))
                .setDeckName(buildDeckName(content));
    }

    /**
     * 卡片4：复杂度选择题
     */
    private AnkiCard buildComplexityQuizCard(ExportableContent content) {
        String front = "「" + content.getProblemName() + "」的时间/空间复杂度是?";
        String back = content.getComplexity() != null ? content.getComplexity() : "暂无复杂度信息";
        return new AnkiCard()
                .setFront(front)
                .setBack(back)
                .setTags(buildTags(content))
                .setDeckName(buildDeckName(content));
    }

    /**
     * 构建标签列表：模式名 + 难度级别
     */
    private List<String> buildTags(ExportableContent content) {
        var tags = new ArrayList<String>();
        if (content.getPatternName() != null) {
            tags.add(content.getPatternName().replace(" ", "_"));
        }
        if (content.getDifficulty() != null) {
            tags.add("difficulty::" + content.getDifficulty());
        }
        return tags;
    }

    private String buildDeckName(ExportableContent content) {
        String pattern = content.getPatternName() != null ? content.getPatternName() : "General";
        return DECK_PREFIX + pattern;
    }

    /**
     * 将卡片打包为 .apkg 格式（SQLite + zip）
     */
    private byte[] packageAsApkg(List<AnkiCard> cards) {
        Path tempDb = null;
        try {
            tempDb = Files.createTempFile("anki_collection_", ".anki2");
            createAnkiDatabase(tempDb, cards);
            return zipAsApkg(tempDb);
        } catch (IOException | SQLException e) {
            log.error("生成 .apkg 文件失败", e);
            throw new RuntimeException("Anki 导出失败: " + e.getMessage(), e);
        } finally {
            deleteTempFile(tempDb);
        }
    }

    /**
     * 创建 SQLite 数据库并写入 Anki 数据
     */
    private void createAnkiDatabase(Path dbPath, List<AnkiCard> cards) throws SQLException {
        String url = "jdbc:sqlite:" + dbPath.toAbsolutePath();
        try (Connection conn = DriverManager.getConnection(url)) {
            createAnkiSchema(conn);
            insertCollectionConfig(conn, cards);
            insertNotesAndCards(conn, cards);
        }
    }

    /**
     * 创建 Anki 所需的表结构
     */
    private void createAnkiSchema(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS col (
                    id INTEGER PRIMARY KEY,
                    crt INTEGER NOT NULL,
                    mod INTEGER NOT NULL,
                    scm INTEGER NOT NULL,
                    ver INTEGER NOT NULL,
                    dty INTEGER NOT NULL,
                    usn INTEGER NOT NULL,
                    ls INTEGER NOT NULL,
                    conf TEXT NOT NULL,
                    models TEXT NOT NULL,
                    decks TEXT NOT NULL,
                    dconf TEXT NOT NULL,
                    tags TEXT NOT NULL
                )""");
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS notes (
                    id INTEGER PRIMARY KEY,
                    guid TEXT NOT NULL,
                    mid INTEGER NOT NULL,
                    mod INTEGER NOT NULL,
                    usn INTEGER NOT NULL,
                    tags TEXT NOT NULL,
                    flds TEXT NOT NULL,
                    sfld TEXT NOT NULL,
                    csum INTEGER NOT NULL,
                    flags INTEGER NOT NULL,
                    data TEXT NOT NULL
                )""");
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS cards (
                    id INTEGER PRIMARY KEY,
                    nid INTEGER NOT NULL,
                    did INTEGER NOT NULL,
                    ord INTEGER NOT NULL,
                    mod INTEGER NOT NULL,
                    usn INTEGER NOT NULL,
                    type INTEGER NOT NULL,
                    queue INTEGER NOT NULL,
                    due INTEGER NOT NULL,
                    ivl INTEGER NOT NULL,
                    factor INTEGER NOT NULL,
                    reps INTEGER NOT NULL,
                    lapses INTEGER NOT NULL,
                    left INTEGER NOT NULL,
                    odue INTEGER NOT NULL,
                    odid INTEGER NOT NULL,
                    flags INTEGER NOT NULL,
                    data TEXT NOT NULL
                )""");
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS revlog (
                    id INTEGER PRIMARY KEY,
                    cid INTEGER NOT NULL,
                    usn INTEGER NOT NULL,
                    ease INTEGER NOT NULL,
                    ivl INTEGER NOT NULL,
                    lastIvl INTEGER NOT NULL,
                    factor INTEGER NOT NULL,
                    time INTEGER NOT NULL,
                    type INTEGER NOT NULL
                )""");
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS graves (
                    usn INTEGER NOT NULL,
                    oid INTEGER NOT NULL,
                    type INTEGER NOT NULL
                )""");
        }
    }

    /**
     * 插入集合配置（col 表），包含 models 和 decks 定义
     */
    private void insertCollectionConfig(Connection conn, List<AnkiCard> cards) throws SQLException {
        long now = System.currentTimeMillis() / 1000;
        long modelId = now;
        long deckId = now + 1;

        // 收集所有牌组名生成 decks JSON
        var deckNames = cards.stream()
                .map(AnkiCard::getDeckName)
                .distinct()
                .toList();

        String decksJson = buildDecksJson(deckNames, deckId);
        String modelsJson = buildModelsJson(modelId, deckId);
        String confJson = "{\"nextPos\":1,\"estTimes\":true,\"activeDecks\":[1],\"sortType\":\"noteFld\","
                + "\"timeLim\":0,\"sortBackwards\":false,\"addToCur\":true,\"curDeck\":1,"
                + "\"newSpread\":0,\"dueCounts\":true,\"curModel\":" + modelId + ",\"collapseTime\":1200}";
        String dconfJson = "{\"1\":{\"id\":1,\"mod\":0,\"name\":\"Default\",\"usn\":0,"
                + "\"maxTaken\":60,\"autoplay\":true,\"timer\":0,\"replayq\":true,"
                + "\"new\":{\"bury\":true,\"delays\":[1,10],\"initialFactor\":2500,"
                + "\"ints\":[1,4,7],\"order\":1,\"perDay\":20},"
                + "\"rev\":{\"bury\":true,\"ease4\":1.3,\"fuzz\":0.05,"
                + "\"ivlFct\":1,\"maxIvl\":36500,\"perDay\":100,\"minSpace\":1},"
                + "\"lapse\":{\"delays\":[10],\"leechAction\":0,"
                + "\"leechFails\":8,\"minInt\":1,\"mult\":0}}}";

        String sql = "INSERT INTO col VALUES(1,?,?,?,11,0,-1,0,?,?,?,?,?)";
        try (var ps = conn.prepareStatement(sql)) {
            ps.setLong(1, now);
            ps.setLong(2, now);
            ps.setLong(3, now * 1000);
            ps.setString(4, confJson);
            ps.setString(5, modelsJson);
            ps.setString(6, decksJson);
            ps.setString(7, dconfJson);
            ps.setString(8, "{}");
            ps.executeUpdate();
        }
    }

    /**
     * 构建 decks JSON（牌组配置）
     */
    private String buildDecksJson(List<String> deckNames, long baseDeckId) {
        var sb = new StringBuilder("{");
        // 默认牌组
        sb.append("\"1\":{\"id\":1,\"mod\":0,\"name\":\"Default\",\"usn\":0,")
          .append("\"lrnToday\":[0,0],\"revToday\":[0,0],\"newToday\":[0,0],")
          .append("\"timeToday\":[0,0],\"collapsed\":false,\"desc\":\"\",")
          .append("\"dyn\":0,\"conf\":1,\"extendNew\":10,\"extendRev\":50}");

        long deckId = baseDeckId;
        for (String name : deckNames) {
            sb.append(",\"").append(deckId).append("\":{")
              .append("\"id\":").append(deckId)
              .append(",\"mod\":0,\"name\":\"").append(escapeJson(name))
              .append("\",\"usn\":0,\"lrnToday\":[0,0],\"revToday\":[0,0],")
              .append("\"newToday\":[0,0],\"timeToday\":[0,0],\"collapsed\":false,")
              .append("\"desc\":\"\",\"dyn\":0,\"conf\":1,")
              .append("\"extendNew\":10,\"extendRev\":50}");
            deckId++;
        }
        sb.append("}");
        return sb.toString();
    }

    /**
     * 构建 models JSON（笔记类型定义，基础正反面模型）
     */
    private String buildModelsJson(long modelId, long deckId) {
        return "{\"" + modelId + "\":{"
                + "\"id\":" + modelId
                + ",\"name\":\"ADUE-Basic\""
                + ",\"type\":0,\"mod\":0,\"usn\":0"
                + ",\"sortf\":0,\"did\":" + deckId
                + ",\"tmpls\":[{\"name\":\"Card 1\",\"ord\":0,"
                + "\"qfmt\":\"{{Front}}\",\"afmt\":\"{{FrontSide}}<hr id=answer>{{Back}}\","
                + "\"bqfmt\":\"\",\"bafmt\":\"\",\"did\":null,\"bfont\":\"\",\"bsize\":0}]"
                + ",\"flds\":[{\"name\":\"Front\",\"ord\":0,\"sticky\":false,"
                + "\"rtl\":false,\"font\":\"Arial\",\"size\":20,\"media\":[]},"
                + "{\"name\":\"Back\",\"ord\":1,\"sticky\":false,"
                + "\"rtl\":false,\"font\":\"Arial\",\"size\":20,\"media\":[]}]"
                + ",\"css\":\".card {font-family:arial;font-size:20px;"
                + "text-align:center;color:black;background-color:white;}\""
                + ",\"latexPre\":\"\\\\documentclass[12pt]{article}\\n"
                + "\\\\special{papersize=3in,5in}\\n\\\\usepackage{amssymb,amsmath}\\n"
                + "\\\\pagestyle{empty}\\n\\\\setlength{\\\\parindent}{0in}\\n"
                + "\\\\begin{document}\\n\""
                + ",\"latexPost\":\"\\\\end{document}\""
                + ",\"latexsvg\":false,\"req\":[[0,\"any\",[0]]]"
                + "}}";
    }

    /**
     * 插入笔记和卡片数据
     */
    private void insertNotesAndCards(Connection conn, List<AnkiCard> cards) throws SQLException {
        long now = System.currentTimeMillis() / 1000;
        long modelId = now;
        long baseDeckId = now + 1;

        // 建立 deckName -> deckId 映射
        var deckNames = cards.stream().map(AnkiCard::getDeckName).distinct().toList();
        var deckIdMap = new java.util.HashMap<String, Long>();
        long deckId = baseDeckId;
        for (String name : deckNames) {
            deckIdMap.put(name, deckId++);
        }

        String noteSql = "INSERT INTO notes VALUES(?,?,?,?,?,?,?,?,?,?,?)";
        String cardSql = "INSERT INTO cards VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

        try (var notePs = conn.prepareStatement(noteSql);
             var cardPs = conn.prepareStatement(cardSql)) {

            long noteId = now * 1000;
            long cardId = now * 1000;

            for (var card : cards) {
                noteId++;
                cardId++;
                insertSingleNote(notePs, noteId, modelId, now, card);
                long did = deckIdMap.getOrDefault(card.getDeckName(), 1L);
                insertSingleCard(cardPs, cardId, noteId, did, now);
            }
        }
    }

    private void insertSingleNote(java.sql.PreparedStatement ps, long noteId,
                                  long modelId, long now, AnkiCard card) throws SQLException {
        String guid = generateGuid();
        String tags = buildTagsString(card.getTags());
        String flds = card.getFront() + FIELD_SEPARATOR + card.getBack();
        long csum = fieldChecksum(card.getFront());

        ps.setLong(1, noteId);
        ps.setString(2, guid);
        ps.setLong(3, modelId);
        ps.setLong(4, now);
        ps.setInt(5, -1);
        ps.setString(6, tags);
        ps.setString(7, flds);
        ps.setString(8, card.getFront().substring(0, Math.min(card.getFront().length(), 100)));
        ps.setLong(9, csum);
        ps.setInt(10, 0);
        ps.setString(11, "");
        ps.executeUpdate();
    }

    private void insertSingleCard(java.sql.PreparedStatement ps, long cardId,
                                  long noteId, long deckId, long now) throws SQLException {
        ps.setLong(1, cardId);
        ps.setLong(2, noteId);
        ps.setLong(3, deckId);
        ps.setInt(4, 0);       // ord
        ps.setLong(5, now);    // mod
        ps.setInt(6, -1);      // usn
        ps.setInt(7, 0);       // type: new
        ps.setInt(8, 0);       // queue: new
        ps.setInt(9, 0);       // due
        ps.setInt(10, 0);      // ivl
        ps.setInt(11, 0);      // factor
        ps.setInt(12, 0);      // reps
        ps.setInt(13, 0);      // lapses
        ps.setInt(14, 0);      // left
        ps.setInt(15, 0);      // odue
        ps.setInt(16, 0);      // odid
        ps.setInt(17, 0);      // flags
        ps.setString(18, "");  // data
        ps.executeUpdate();
    }

    /**
     * 将 SQLite 数据库文件打包为 .apkg（zip 格式）
     */
    private byte[] zipAsApkg(Path dbPath) throws IOException {
        var baos = new ByteArrayOutputStream();
        try (var zos = new ZipOutputStream(baos)) {
            // 写入 collection.anki2
            zos.putNextEntry(new ZipEntry("collection.anki2"));
            zos.write(Files.readAllBytes(dbPath));
            zos.closeEntry();

            // 写入 media 文件（空 JSON 对象）
            zos.putNextEntry(new ZipEntry("media"));
            zos.write("{}".getBytes());
            zos.closeEntry();
        }
        return baos.toByteArray();
    }

    // ===== 工具方法 =====

    /**
     * 截短描述文本
     */
    private String shortenDescription(String description, int maxLength) {
        if (description == null) return "";
        if (description.length() <= maxLength) return description;
        return description.substring(0, maxLength) + "...";
    }

    /**
     * 遮掩代码关键部分（将代码行中的赋值/return 部分替换为 ___）
     */
    private String maskCodeKeyParts(String code) {
        if (code == null || code.isEmpty()) return "";
        String[] lines = code.split("\n");
        var masked = new StringBuilder();
        int maskCount = 0;
        for (String line : lines) {
            if (shouldMaskLine(line) && maskCount < 3) {
                masked.append(maskLine(line)).append("\n");
                maskCount++;
            } else {
                masked.append(line).append("\n");
            }
        }
        return masked.toString().trim();
    }

    /**
     * 判断是否需要遮掩该行（包含关键逻辑的行）
     */
    private boolean shouldMaskLine(String line) {
        String trimmed = line.trim();
        return trimmed.contains("return ")
                || trimmed.contains(" = ")
                || trimmed.contains("+=")
                || trimmed.contains("-=");
    }

    /**
     * 遮掩行中等号右侧或 return 后面的内容
     */
    private String maskLine(String line) {
        if (line.contains("return ")) {
            int idx = line.indexOf("return ") + 7;
            return line.substring(0, idx) + "___";
        }
        if (line.contains(" = ")) {
            int idx = line.indexOf(" = ") + 3;
            return line.substring(0, idx) + "___";
        }
        return line.replaceFirst("[+\\-]= .+", "+= ___");
    }

    /**
     * 确定牌组文件名
     */
    private String determineDeckName(List<ExportableContent> contents) {
        if (contents.isEmpty()) return DECK_PREFIX + "Empty";
        String pattern = contents.get(0).getPatternName();
        return DECK_PREFIX + (pattern != null ? pattern : "Mixed");
    }

    /**
     * 生成 8 字符 Base62 GUID（Anki 格式）
     */
    private String generateGuid() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }

    /**
     * 构建空格分隔的 tags 字符串
     */
    private String buildTagsString(List<String> tags) {
        if (tags == null || tags.isEmpty()) return "";
        return " " + String.join(" ", tags) + " ";
    }

    /**
     * 计算字段校验和（Anki 使用 SHA1 前 8 字节的整数）
     */
    private long fieldChecksum(String field) {
        try {
            var md = java.security.MessageDigest.getInstance("SHA-1");
            byte[] digest = md.digest(field.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return ((long) (digest[0] & 0xFF) << 24)
                    | ((long) (digest[1] & 0xFF) << 16)
                    | ((long) (digest[2] & 0xFF) << 8)
                    | (digest[3] & 0xFF);
        } catch (java.security.NoSuchAlgorithmException e) {
            return field.hashCode() & 0xFFFFFFFFL;
        }
    }

    /**
     * 简单 JSON 转义
     */
    private String escapeJson(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    /**
     * 安全删除临时文件
     */
    private void deleteTempFile(Path path) {
        if (path != null) {
            try {
                Files.deleteIfExists(path);
            } catch (IOException e) {
                log.warn("删除临时文件失败: {}", path, e);
            }
        }
    }

    /**
     * Anki 卡片内部模型
     */
    @Data
    @Accessors(chain = true)
    static class AnkiCard {
        private String front;
        private String back;
        private List<String> tags;
        private String deckName;
    }
}
