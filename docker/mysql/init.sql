-- ============================================
-- 算法深度理解引擎 - MySQL 初始化脚本
-- ============================================
-- 此脚本在 MySQL 容器首次启动时自动执行
-- ============================================

-- 设置数据库字符集为 utf8mb4（支持完整 Unicode，含 emoji）
ALTER DATABASE algorithm_help CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 验证 ngram 全文解析器可用（MySQL 8.0 内置，无需安装插件）
-- ngram_token_size=2 已通过 docker-compose command 参数设置
-- 用于支持中文全文搜索分词

-- 设置默认时区为 UTC
SET GLOBAL time_zone = '+00:00';

-- 调整全文索引最小词长（配合 ngram 使用）
SET GLOBAL innodb_ft_min_token_size = 1;
SET GLOBAL ft_min_word_len = 1;

-- 注意：FULLTEXT INDEX 由 Flyway 迁移脚本 V10 创建
-- 如需手动创建：
-- ALTER TABLE problems ADD FULLTEXT INDEX idx_problems_fulltext (title, description) WITH PARSER ngram;
