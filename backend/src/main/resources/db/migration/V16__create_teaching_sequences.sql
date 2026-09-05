-- V16: 走流程教学序列表 + diagrams 表字段扩展
-- 参考设计文档：18-可视化与教学引擎设计.md

-- 1. 创建 teaching_sequences 表
CREATE TABLE IF NOT EXISTS teaching_sequences (
    id             VARCHAR(36)  NOT NULL PRIMARY KEY         COMMENT '序列ID (UUID)',
    problem_id     VARCHAR(255) NOT NULL                     COMMENT '关联题目ID',
    enriched_id    VARCHAR(36)                               COMMENT '关联解析ID（可空）',
    level          TINYINT      NOT NULL                     COMMENT '解析级别 1-5',
    scenario_type  VARCHAR(20)  NOT NULL DEFAULT 'standard'  COMMENT '场景类型: standard/boundary/counterexample',
    title          VARCHAR(200) NOT NULL                     COMMENT '序列标题',
    description    TEXT                                      COMMENT '序列描述',
    total_steps    INT          NOT NULL                     COMMENT '总步骤数',
    duration_ms    INT          NOT NULL DEFAULT 0           COMMENT '预估总时长(毫秒)',
    sequence_json  LONGTEXT     NOT NULL                     COMMENT 'TeachingSequence JSON',
    schema_version VARCHAR(10)  NOT NULL DEFAULT '1.0'       COMMENT 'JSON schema版本',
    status         VARCHAR(20)  NOT NULL DEFAULT 'generating' COMMENT '状态: generating/ready/failed',
    error_msg      TEXT                                      COMMENT '生成失败原因',
    view_count     INT          NOT NULL DEFAULT 0           COMMENT '查看次数',
    created_at     BIGINT       NOT NULL                     COMMENT 'UTC毫秒',
    updated_at     BIGINT       NOT NULL                     COMMENT 'UTC毫秒',

    INDEX idx_problem_level     (problem_id, level, scenario_type),
    INDEX idx_enriched          (enriched_id),
    INDEX idx_status            (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='算法教学走流程序列';

-- 2. 扩展 diagrams 表（现有表只有基础字段）
ALTER TABLE diagrams
    ADD COLUMN problem_id    VARCHAR(255) COMMENT '关联题目ID',
    ADD COLUMN enriched_id   VARCHAR(36)  COMMENT '关联解析ID',
    ADD COLUMN level         TINYINT      COMMENT '解析级别 1-5',
    ADD COLUMN render_engine VARCHAR(20)  COMMENT '渲染引擎: mermaid/d3/canvas/svg',
    ADD COLUMN content_json  LONGTEXT     COMMENT '图解内容JSON（渲染器特定格式）',
    ADD COLUMN preview_url   VARCHAR(500) COMMENT '预渲染缩略图URL',
    ADD COLUMN status        VARCHAR(20)  NOT NULL DEFAULT 'ready' COMMENT '状态: generating/ready/failed',
    ADD COLUMN schema_version VARCHAR(10) NOT NULL DEFAULT '1.0',
    ADD COLUMN updated_at    BIGINT       COMMENT 'UTC毫秒',
    ADD COLUMN view_count    INT NOT NULL DEFAULT 0;

-- diagram_type 字段扩展（增加 array_pointer/hash_bucket 类型）
-- 注意：MySQL ALTER TABLE MODIFY ENUM 需要包含所有旧值
ALTER TABLE diagrams MODIFY COLUMN diagram_type ENUM(
    'BAR_ANIMATION',
    'CHAR_ALIGNMENT',
    'DECISION_TREE',
    'FLOWCHART',
    'FOREST',
    'NODE_EDGE_GRAPH',
    'NODE_LINK',
    'POINTER_ANIMATION',
    'RANGE_SHRINK',
    'TABLE_FILL',
    'TREE_ARRAY_DUAL',
    'TREE_GRAPH',
    'WINDOW_SLIDE',
    'ARRAY_POINTER',
    'HASH_BUCKET',
    'DP_TABLE',
    'STACK_STATE',
    'SORT_BAR'
) COMMENT '图解类型';

-- 补充索引（忽略已存在错误）
CREATE INDEX idx_problem_level ON diagrams (problem_id, level);
