-- 管理操作审计日志表
-- 记录所有管理员敏感操作，保留 90 天

CREATE TABLE admin_audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    operator_id VARCHAR(64) NOT NULL COMMENT '操作人 ID',
    operator_name VARCHAR(128) COMMENT '操作人名称',
    action_type VARCHAR(32) NOT NULL COMMENT '操作类型: APPROVE/REJECT/DELETE/BATCH_GENERATE/SET_RECOMMENDED/RESOLVE_FEEDBACK',
    target_id VARCHAR(64) COMMENT '操作目标 ID',
    target_type VARCHAR(32) COMMENT '目标类型: ENRICHED_SOLUTION/FEEDBACK/BATCH',
    before_state JSON COMMENT '操作前状态快照',
    after_state JSON COMMENT '操作后状态快照',
    remark TEXT COMMENT '备注信息',
    created_at BIGINT NOT NULL COMMENT '操作时间（UTC 毫秒时间戳）',

    INDEX idx_operator (operator_id, created_at),
    INDEX idx_action (action_type, created_at),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理操作审计日志';
