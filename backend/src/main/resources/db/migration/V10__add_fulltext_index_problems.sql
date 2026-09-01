-- ============================================
-- V10: 为 Problem 表添加 FULLTEXT 索引（ngram 分词）
-- 支持中英文全文搜索
-- ============================================

-- 创建 FULLTEXT 索引，使用 ngram parser 支持中文分词
-- ngram_token_size=2 已在 MySQL 启动参数中配置
ALTER TABLE problems
    ADD FULLTEXT INDEX idx_problems_fulltext (title, description) WITH PARSER ngram;
