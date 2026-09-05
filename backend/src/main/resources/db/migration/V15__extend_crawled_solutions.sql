-- V15: 扩展 crawled_solutions 表字段，统一 collation，让 Pipeline 能正确查询素材
-- 参考设计文档：19-内容质量与素材引擎设计.md

-- 1. 统一 collation：将 crawled_solutions 所有 varchar/text 字段改为与 problems 表一致的 utf8mb4_unicode_ci
--    根因：crawled_solutions (utf8mb4_0900_ai_ci) JOIN problems (utf8mb4_unicode_ci) 时报 ERROR 1267
ALTER TABLE crawled_solutions
    MODIFY COLUMN id          VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '题解唯一ID',
    MODIFY COLUMN problem_id  VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '关联题目ID (slug格式)',
    MODIFY COLUMN topic_id    VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci     NULL COMMENT '平台内部帖子ID',
    MODIFY COLUMN title       VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci     NULL COMMENT '题解标题',
    MODIFY COLUMN author      VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci     NULL COMMENT '作者用户名',
    MODIFY COLUMN source      VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci     NULL COMMENT '来源平台',
    MODIFY COLUMN content     MEDIUMTEXT   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci     NULL COMMENT '题解正文（Markdown/HTML）';

-- 2. 新增字段（设计文档要求）——用 IGNORE 模拟 IF NOT EXISTS
ALTER TABLE crawled_solutions
    ADD COLUMN platform       VARCHAR(20)  NULL COMMENT '来源平台(leetcode-cn/leetcode-en/nowcoder/manual)';
ALTER TABLE crawled_solutions
    ADD COLUMN source_url     VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '原帖 URL';
ALTER TABLE crawled_solutions
    ADD COLUMN solution_lang  VARCHAR(20)  NULL COMMENT '题解编程语言(py/java/cpp等)';
ALTER TABLE crawled_solutions
    ADD COLUMN approach_tag   VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '解法标签(hash/dp/greedy等)';
ALTER TABLE crawled_solutions
    ADD COLUMN crawl_quality  FLOAT        NULL COMMENT '爬取质量预评分 0-1';
ALTER TABLE crawled_solutions
    ADD COLUMN content_hash   CHAR(64)     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT 'SHA256内容哈希（去重）';
ALTER TABLE crawled_solutions
    ADD COLUMN crawled_at     BIGINT       NULL COMMENT '爬取时间(UTC毫秒)';

-- 3. 补充索引（用 ALTER TABLE 兼容方式，忽略 Duplicate key name 错误）
ALTER IGNORE TABLE crawled_solutions ADD INDEX idx_problem_votes (problem_id, vote_count);
ALTER IGNORE TABLE crawled_solutions ADD INDEX idx_content_hash (content_hash);
ALTER IGNORE TABLE crawled_solutions ADD INDEX idx_platform (platform);

-- 4. 修正表级 COLLATE
ALTER TABLE crawled_solutions
    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
