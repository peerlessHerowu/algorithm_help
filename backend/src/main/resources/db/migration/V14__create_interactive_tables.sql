-- ============================================================
-- V14: 交互式功能相关表
-- 覆盖：会话管理、消息、复习卡片、面试报告、Debug记录、成就
-- ============================================================

-- 交互式学习会话表
CREATE TABLE IF NOT EXISTS interactive_sessions (
    session_id   VARCHAR(64)  NOT NULL COMMENT '会话 ID（UUID）',
    user_id      VARCHAR(64)  NOT NULL COMMENT '用户 ID',
    problem_id   VARCHAR(64)  COMMENT '关联题目 ID',
    type         VARCHAR(32)  NOT NULL COMMENT '会话类型：FEYNMAN/INTERVIEW/SOCRATIC/DEBUG/REVERSE_FEYNMAN',
    status       VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/PAUSED/COMPLETED/EXPIRED',
    created_at   BIGINT       NOT NULL COMMENT '创建时间（毫秒时间戳）',
    last_active_at BIGINT     COMMENT '最后活跃时间（毫秒时间戳）',
    PRIMARY KEY (session_id),
    INDEX idx_user_status (user_id, status),
    INDEX idx_last_active (last_active_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='交互式学习会话';

-- 会话消息表（聊天历史持久化）
CREATE TABLE IF NOT EXISTS session_messages (
    id         VARCHAR(64)   NOT NULL COMMENT '消息 ID',
    session_id VARCHAR(64)   NOT NULL COMMENT '关联会话 ID',
    role       VARCHAR(16)   NOT NULL COMMENT '角色：user/assistant/system',
    content    MEDIUMTEXT    NOT NULL COMMENT '消息内容',
    created_at BIGINT        NOT NULL COMMENT '创建时间（毫秒时间戳）',
    PRIMARY KEY (id),
    INDEX idx_session (session_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会话消息记录';

-- 间隔重复复习卡片表
CREATE TABLE IF NOT EXISTS spaced_repetition_cards (
    id             VARCHAR(64)    NOT NULL COMMENT '卡片 ID',
    user_id        VARCHAR(64)    NOT NULL COMMENT '用户 ID',
    problem_id     VARCHAR(64)    NOT NULL COMMENT '题目 ID',
    pattern_id     VARCHAR(64)    COMMENT '算法模式 ID',
    card_type      VARCHAR(32)    NOT NULL DEFAULT 'EXPLAIN' COMMENT '卡片类型：EXPLAIN/PATTERN/COMPLEXITY/CODE',
    repetitions    INT            NOT NULL DEFAULT 0 COMMENT 'SM-2 重复次数',
    ease_factor    DOUBLE         NOT NULL DEFAULT 2.5 COMMENT 'SM-2 难度因子',
    interval_days  INT            NOT NULL DEFAULT 1 COMMENT '下次复习间隔天数',
    next_review_at BIGINT         COMMENT '下次复习时间（毫秒）',
    last_review_at BIGINT         COMMENT '最后复习时间（毫秒）',
    metadata       TEXT           COMMENT '扩展元数据（JSON）',
    created_at     BIGINT         NOT NULL COMMENT '创建时间（毫秒）',
    updated_at     BIGINT         COMMENT '更新时间（毫秒）',
    PRIMARY KEY (id),
    INDEX idx_user_next (user_id, next_review_at),
    INDEX idx_user_pattern (user_id, pattern_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='间隔重复复习卡片';

-- 面试评分报告表
CREATE TABLE IF NOT EXISTS interview_reports (
    id                  VARCHAR(64)  NOT NULL COMMENT '报告 ID',
    user_id             VARCHAR(64)  NOT NULL COMMENT '用户 ID',
    session_id          VARCHAR(64)  NOT NULL COMMENT '关联会话 ID',
    problem_id          VARCHAR(64)  COMMENT '题目 ID',
    correctness_score   INT          COMMENT '正确性得分（1-10）',
    efficiency_score    INT          COMMENT '效率得分（1-10）',
    communication_score INT          COMMENT '沟通得分（1-10）',
    code_quality_score  INT          COMMENT '代码质量得分（1-10）',
    total_score         INT          COMMENT '总分（0-100）',
    grade               VARCHAR(4)   COMMENT '评级（A+/A/B+/B/C/D）',
    strengths           TEXT         COMMENT '优点（JSON 数组）',
    improvements        TEXT         COMMENT '改进建议（JSON）',
    summary             TEXT         COMMENT '综合评价',
    created_at          BIGINT       NOT NULL COMMENT '创建时间（毫秒）',
    PRIMARY KEY (id),
    INDEX idx_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='面试模拟评分报告';

-- Debug 训练记录表
CREATE TABLE IF NOT EXISTS debug_training_records (
    id          VARCHAR(64)  NOT NULL COMMENT '记录 ID',
    user_id     VARCHAR(64)  NOT NULL COMMENT '用户 ID',
    session_id  VARCHAR(64)  COMMENT '关联会话 ID',
    problem_id  VARCHAR(64)  COMMENT '题目 ID',
    bug_type    VARCHAR(32)  COMMENT 'Bug 类型：OFF_BY_ONE/BOUNDARY/CONDITION/INIT',
    found       TINYINT(1)   DEFAULT 0 COMMENT '是否找到 Bug',
    hint_count  INT          DEFAULT 0 COMMENT '使用提示次数',
    duration_ms BIGINT       COMMENT '耗时（毫秒）',
    created_at  BIGINT       NOT NULL COMMENT '创建时间（毫秒）',
    PRIMARY KEY (id),
    INDEX idx_user (user_id, created_at),
    INDEX idx_user_type (user_id, bug_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Debug 训练记录';

-- 用户成就表
CREATE TABLE IF NOT EXISTS user_achievements (
    id            VARCHAR(64)  NOT NULL COMMENT '成就记录 ID',
    user_id       VARCHAR(64)  NOT NULL COMMENT '用户 ID',
    type          VARCHAR(64)  NOT NULL COMMENT '成就类型枚举值',
    unlocked_at   BIGINT       NOT NULL COMMENT '解锁时间（毫秒）',
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_type (user_id, type),
    INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户成就记录';

-- 错误类型统计表（费曼 adaptive 错误选择器）
CREATE TABLE IF NOT EXISTS error_type_stats (
    id             VARCHAR(64)  NOT NULL COMMENT '统计 ID',
    user_id        VARCHAR(64)  NOT NULL COMMENT '用户 ID',
    error_type     VARCHAR(32)  NOT NULL COMMENT '错误类型',
    occurrence_count INT        NOT NULL DEFAULT 0 COMMENT '出现次数',
    updated_at     BIGINT       COMMENT '最后更新时间（毫秒）',
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_type (user_id, error_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户错误类型统计';

-- 训练记录表（模式识别训练）
CREATE TABLE IF NOT EXISTS training_records (
    id          VARCHAR(64)  NOT NULL COMMENT '记录 ID',
    user_id     VARCHAR(64)  NOT NULL COMMENT '用户 ID',
    pattern_id  VARCHAR(64)  COMMENT '模式 ID',
    problem_id  VARCHAR(64)  COMMENT '题目 ID',
    correct     TINYINT(1)   DEFAULT 0 COMMENT '是否回答正确',
    created_at  BIGINT       NOT NULL COMMENT '创建时间（毫秒）',
    PRIMARY KEY (id),
    INDEX idx_user (user_id, created_at),
    INDEX idx_user_pattern (user_id, pattern_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模式识别训练记录';
