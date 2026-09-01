package com.algorithm.help.content.enrichment;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * 管理操作审计服务
 * <p>
 * 记录所有管理员敏感操作，支持按操作人/时间范围查询。
 * 90 天自动清理过期日志。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminAuditService {

    /** 90 天保留期（毫秒） */
    private static final long RETENTION_MS = 90L * 24 * 60 * 60 * 1000;

    private final AdminAuditLogRepository auditRepo;
    private final ObjectMapper objectMapper;

    /**
     * 记录审计日志
     */
    public void record(String operatorId, String operatorName,
                       String actionType, String targetId, String targetType,
                       Object beforeState, Object afterState, String remark) {
        try {
            AdminAuditLog auditLog = new AdminAuditLog()
                    .setOperatorId(operatorId)
                    .setOperatorName(operatorName)
                    .setActionType(actionType)
                    .setTargetId(targetId)
                    .setTargetType(targetType)
                    .setBeforeState(toJson(beforeState))
                    .setAfterState(toJson(afterState))
                    .setRemark(remark);
            auditRepo.save(auditLog);
        } catch (Exception e) {
            log.error("记录审计日志失败: action={}, target={}", actionType, targetId, e);
        }
    }

    /**
     * 查询审计日志（按操作人+时间范围）
     */
    public Page<AdminAuditLog> query(String operatorId, Long startTime, Long endTime,
                                     int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);

        boolean hasOperator = operatorId != null && !operatorId.isBlank();
        boolean hasTimeRange = startTime != null && endTime != null;

        if (hasOperator && hasTimeRange) {
            return auditRepo.findByOperatorIdAndCreatedAtBetweenOrderByCreatedAtDesc(
                    operatorId, startTime, endTime, pageable);
        }
        if (hasOperator) {
            return auditRepo.findByOperatorIdOrderByCreatedAtDesc(operatorId, pageable);
        }
        if (hasTimeRange) {
            return auditRepo.findByCreatedAtBetweenOrderByCreatedAtDesc(
                    startTime, endTime, pageable);
        }
        return auditRepo.findAll(pageable);
    }

    /**
     * 90 天自动清理（每天凌晨 3 点执行）
     */
    @Scheduled(cron = "0 0 3 * * ?")
    public void cleanExpiredLogs() {
        long cutoff = System.currentTimeMillis() - RETENTION_MS;
        int deleted = auditRepo.deleteByCreatedAtBefore(cutoff);
        if (deleted > 0) {
            log.info("审计日志清理完成, 删除 {} 条过期记录", deleted);
        }
    }

    private String toJson(Object obj) {
        if (obj == null) return null;
        if (obj instanceof String s) return s;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return obj.toString();
        }
    }
}
