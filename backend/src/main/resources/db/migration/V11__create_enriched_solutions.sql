-- ============================================
-- V11: 创建 enriched_solutions 表
-- AI 丰富后的解析内容存储，支持一题一级别多条解析
-- ============================================

CREATE TABLE enriched_solutions (
    id VARCHAR(64) PRIMARY KEY,
    problem_id VARCHAR(64) NOT NULL,
    level INT NOT NULL COMMENT '1-5 分级',
    source_solution_id VARCHAR(64) COMMENT '来源的原始题解 ID',
    source_type ENUM('COMMUNITY','AI_ORIGINAL','OFFICIAL','LEGACY_V1') NOT NULL DEFAULT 'COMMUNITY',
    source_author VARCHAR(128),
    source_url VARCHAR(512),
    source_votes INT DEFAULT 0 COMMENT '来源题解原始点赞数',

    -- 内容
    title VARCHAR(256) NOT NULL,
    summary VARCHAR(500),
    content MEDIUMTEXT,
    code_implementations JSON COMMENT '多语言代码 {"python":"...","java":"..."}',
    tags JSON COMMENT '解法标签 ["哈希表","O(n)"]',
    time_complexity VARCHAR(32) COMMENT '时间复杂度',
    space_complexity VARCHAR(32) COMMENT '空间复杂度',

    -- AI 处理元数据
    ai_provider VARCHAR(32),
    processing_steps JSON COMMENT '管线已执行步骤',
    quality_score FLOAT DEFAULT 0 COMMENT '质量评分 0-1',

    -- 版本管理（version 同时用于乐观锁并发控制）
    version INT DEFAULT 1,
    is_latest BOOLEAN DEFAULT TRUE,

    -- 展示控制
    sort_order INT DEFAULT 0,
    recommended BOOLEAN DEFAULT FALSE,
    status ENUM('DRAFT','PUBLISHED','REJECTED','PENDING_REVIEW') DEFAULT 'DRAFT',

    -- 用户反馈统计
    view_count INT DEFAULT 0,
    upvote_count INT DEFAULT 0,
    downvote_count INT DEFAULT 0 COMMENT '踩计数',
    feedback_count INT DEFAULT 0 COMMENT '纠错反馈计数，>= 3 触发复核',

    -- 时间（UTC 毫秒时间戳）
    created_at BIGINT,
    updated_at BIGINT,

    -- 索引
    INDEX idx_problem_level (problem_id, level, status),
    INDEX idx_status (status),
    INDEX idx_recommended (problem_id, level, recommended),
    INDEX idx_version (problem_id, level, source_solution_id, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI 丰富后的解析内容';
