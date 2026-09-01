package com.algorithm.help.interactive.ws;

/**
 * WebSocket 消息类型枚举
 * <p>
 * 用于标识消息归属的业务场景，路由到对应 handler 处理
 */
public enum WsMessageType {

    /** 费曼学习法对话 */
    FEYNMAN_CHAT,

    /** 模拟面试对话 */
    INTERVIEW_CHAT,

    /** 苏格拉底式提问对话 */
    SOCRATIC_CHAT,

    /** Debug 挑战提交 */
    DEBUG_SUBMIT,

    /** 反向费曼对话 */
    REVERSE_FEYNMAN_CHAT,

    /** AI 响应（服务端 → 客户端） */
    AI_RESPONSE,

    /** 错误消息 */
    ERROR,

    /** 认证消息 */
    AUTH,

    /** 会话创建确认 */
    SESSION_CREATED,

    /** 会话过期通知 */
    SESSION_EXPIRED,

    /** 心跳请求 */
    PING,

    /** 心跳响应 */
    PONG,

    /** 系统消息（提醒、状态通知） */
    SYSTEM_MESSAGE,

    /** 费曼总结生成完成 */
    FEYNMAN_SUMMARY,

    /** 苏格拉底总结生成完成 */
    SOCRATIC_SUMMARY,

    /** 面试时间警告 */
    INTERVIEW_TIME_WARNING,

    /** 面试评分报告 */
    INTERVIEW_REPORT,

    /** 提示已提供 */
    HINT_PROVIDED,

    /** 会话暂停 */
    SESSION_PAUSED
}
