-- ============================================
-- V12: 创建 enriched_feedback 和 enriched_votes 表
-- enriched_feedback: 用户纠错反馈记录
-- enriched_votes: 用户投票（点赞/踩）记录
-- ============================================

CREATE TABLE enriched_feedback (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    enriched_id VARCHAR(64) NOT NULL COMMENT '关联 enriched_solutions.id',
    user_id VARCHAR(64) COMMENT '反馈用户（可匿名）',
    error_type ENUM('CODE_ERROR','LOGIC_ERROR','UNCLEAR','OUTDATED','OTHER') NOT NULL COMMENT '错误类型',
    description TEXT COMMENT '错误描述',
    status ENUM('PENDING','RESOLVED','DISMISSED') DEFAULT 'PENDING' COMMENT '处理状态',
    resolved_by VARCHAR(64) COMMENT '处理人',
    resolved_at BIGINT COMMENT '处理时间（UTC 毫秒）',
    created_at BIGINT COMMENT '创建时间（UTC 毫秒）',

    INDEX idx_enriched (enriched_id, status),
    INDEX idx_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='纠错反馈记录';

CREATE TABLE enriched_votes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    enriched_id VARCHAR(64) NOT NULL COMMENT '关联 enriched_solutions.id',
    user_id VARCHAR(64) NOT NULL COMMENT '投票用户',
    vote_type ENUM('UP','DOWN') NOT NULL COMMENT '投票类型',
    created_at BIGINT COMMENT '创建时间（UTC 毫秒）',
    updated_at BIGINT COMMENT '更新时间（UTC 毫秒）',

    UNIQUE INDEX uk_user_enriched (enriched_id, user_id),
    INDEX idx_enriched (enriched_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='投票记录';
