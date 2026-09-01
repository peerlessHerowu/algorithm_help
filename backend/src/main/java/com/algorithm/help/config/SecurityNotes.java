package com.algorithm.help.config;

/**
 * 安全与权限设计说明
 *
 * 权限模型已在 auth.config.SecurityConfig 中实现:
 * - /api/v1/admin/** 需要 ADMIN 角色(包括 AI 用量查询)
 * - POST solutions 需要 USER 或 ADMIN 认证
 * - GET 公开端点(problems, patterns) 允许匿名访问
 * - 内部 API 由 InternalTokenFilter 鉴权
 *
 * 新增端点权限:
 * - GET /api/v1/admin/ai/usage - ADMIN only(已被通配符规则覆盖)
 *
 * @see com.algorithm.help.auth.config.SecurityConfig
 */
public final class SecurityNotes {
    private SecurityNotes() {
        // 仅文档用途
    }
}
