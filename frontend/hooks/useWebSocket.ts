/**
 * WebSocket 全局管理 Hook
 *
 * 功能：
 * - 自动重连（指数退避：1s → 2s → 4s → 8s → 16s → 30s，最大 30s）
 * - 心跳检测（每 30s 发送 ping，5s 内未收到 pong 则触发重连）
 * - 连接建立后首条消息为认证消息 {type:"AUTH", payload: token}
 * - 支持按消息类型订阅和分发
 *
 * Requirements: 9.5
 */
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/store';

// ============ 类型定义 ============

/** WebSocket 消息基础结构 */
export interface WsMessage<T = unknown> {
  type: string;
  payload: T;
}

/** 心跳消息 */
export interface WsPingMessage extends WsMessage<null> {
  type: 'PING';
}

/** 心跳响应 */
export interface WsPongMessage extends WsMessage<null> {
  type: 'PONG';
}

/** 认证消息 */
export interface WsAuthMessage extends WsMessage<string> {
  type: 'AUTH';
}

/** 连接状态 */
export type WsConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

/** 消息订阅回调 */
export type WsMessageHandler<T = unknown> = (payload: T) => void;

/** Hook 配置选项 */
export interface UseWebSocketOptions {
  /** WebSocket 服务地址，默认从环境变量或 API 基地址推导 */
  url?: string;
  /** 是否自动连接，默认 true */
  autoConnect?: boolean;
  /** 心跳间隔（毫秒），默认 30000 */
  heartbeatInterval?: number;
  /** 心跳超时（毫秒），默认 5000 */
  heartbeatTimeout?: number;
  /** 最大重连间隔（毫秒），默认 30000 */
  maxReconnectInterval?: number;
}

/** Hook 返回值 */
export interface UseWebSocketReturn {
  /** 当前连接状态 */
  state: WsConnectionState;
  /** 手动发送消息 */
  send: (message: WsMessage) => void;
  /** 订阅某类型消息，返回取消订阅函数 */
  subscribe: <T = unknown>(type: string, handler: WsMessageHandler<T>) => () => void;
  /** 手动连接 */
  connect: () => void;
  /** 手动断开 */
  disconnect: () => void;
}

// ============ 常量 ============

/** 初始重连间隔 1s */
const INITIAL_RECONNECT_INTERVAL = 1000;

/** 默认最大重连间隔 30s */
const DEFAULT_MAX_RECONNECT_INTERVAL = 30000;

/** 默认心跳间隔 30s */
const DEFAULT_HEARTBEAT_INTERVAL = 30000;

/** 默认心跳超时 5s */
const DEFAULT_HEARTBEAT_TIMEOUT = 5000;

// ============ 工具函数 ============

/** 从 API 基地址推导 WebSocket 地址，并可附带 token 参数 */
function deriveWsUrl(token?: string | null): string {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  const base = wsUrl || (() => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
    const protocol = apiBase.startsWith('https') ? 'wss' : 'ws';
    const host = apiBase.replace(/^https?:\/\//, '');
    return `${protocol}://${host}/ws/interactive`;
  })();

  // 将 token 附加到 URL 参数（后端 WsAuthInterceptor 从此处读取）
  if (token) {
    return `${base}?token=${encodeURIComponent(token)}`;
  }
  return base;
}

/** 计算指数退避延迟，最大不超过 maxInterval */
function getReconnectDelay(attempt: number, maxInterval: number): number {
  // 1s, 2s, 4s, 8s, 16s, 30s, 30s...
  const delay = INITIAL_RECONNECT_INTERVAL * Math.pow(2, attempt);
  return Math.min(delay, maxInterval);
}

// ============ Hook 实现 ============

/**
 * WebSocket 全局管理 Hook
 *
 * 使用方式：
 * ```tsx
 * const { state, send, subscribe, connect, disconnect } = useWebSocket();
 *
 * useEffect(() => {
 *   const unsubscribe = subscribe<ChatMessage>('CHAT', (payload) => {
 *     console.log('收到聊天消息', payload);
 *   });
 *   return unsubscribe;
 * }, [subscribe]);
 * ```
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    url,
    autoConnect = true,
    heartbeatInterval = DEFAULT_HEARTBEAT_INTERVAL,
    heartbeatTimeout = DEFAULT_HEARTBEAT_TIMEOUT,
    maxReconnectInterval = DEFAULT_MAX_RECONNECT_INTERVAL,
  } = options;

  // 使用 ref 维护内部状态，避免闭包陈旧问题
  const wsRef = useRef<WebSocket | null>(null);
  const stateRef = useRef<WsConnectionState>('disconnected');
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscribersRef = useRef<Map<string, Set<WsMessageHandler>>>(new Map());
  const intentionalCloseRef = useRef(false);
  // 用于触发组件重渲染的简易 state
  const forceUpdateRef = useRef(0);

  // 获取 token 的方式：直接从 zustand store 读取
  const getToken = useCallback(() => useAppStore.getState().token, []);

  /** 清除所有定时器 */
  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearTimeout(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (pongTimerRef.current) {
      clearTimeout(pongTimerRef.current);
      pongTimerRef.current = null;
    }
  }, []);

  /** 启动心跳检测 */
  const startHeartbeat = useCallback(() => {
    // 清除之前的心跳定时器
    if (heartbeatTimerRef.current) {
      clearTimeout(heartbeatTimerRef.current);
    }

    heartbeatTimerRef.current = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // 发送 PING
        const pingMsg: WsPingMessage = { type: 'PING', payload: null };
        wsRef.current.send(JSON.stringify(pingMsg));

        // 设置 pong 超时检测
        pongTimerRef.current = setTimeout(() => {
          // 超时未收到 PONG，关闭连接触发重连
          console.warn('[WebSocket] 心跳超时，未收到 PONG，触发重连');
          wsRef.current?.close(4000, 'Heartbeat timeout');
        }, heartbeatTimeout);
      }
    }, heartbeatInterval);
  }, [heartbeatInterval, heartbeatTimeout]);

  /** 分发消息给订阅者 */
  const dispatch = useCallback((type: string, payload: unknown) => {
    const handlers = subscribersRef.current.get(type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[WebSocket] 消息处理器异常 (type=${type}):`, err);
        }
      });
    }
  }, []);

  /** 调度重连（使用 ref 引用 connectInternal 避免循环依赖） */
  const connectInternalRef = useRef<() => void>(() => {});

  const scheduleReconnect = useCallback(() => {
    if (intentionalCloseRef.current) return;

    const delay = getReconnectDelay(reconnectAttemptRef.current, maxReconnectInterval);
    stateRef.current = 'reconnecting';
    forceUpdateRef.current += 1;

    console.info(`[WebSocket] 将在 ${delay}ms 后重连（第 ${reconnectAttemptRef.current + 1} 次）`);

    reconnectTimerRef.current = setTimeout(() => {
      reconnectAttemptRef.current += 1;
      connectInternalRef.current();
    }, delay);
  }, [maxReconnectInterval]);

  /** 内部连接逻辑 */
  const connectInternal = useCallback(() => {
    // 如果已有连接，先关闭
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // token 必须存在才能连接（后端握手需要 token 参数）
    const token = getToken();
    const wsUrl = url ? url : deriveWsUrl(token);
    stateRef.current = 'connecting';

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.info('[WebSocket] 连接成功');
        stateRef.current = 'connected';
        reconnectAttemptRef.current = 0;
        forceUpdateRef.current += 1;

        // 连接建立后发送认证消息
        const token = getToken();
        if (token) {
          const authMsg: WsAuthMessage = { type: 'AUTH', payload: token };
          ws.send(JSON.stringify(authMsg));
        }

        // 启动心跳
        startHeartbeat();
      };

      ws.onmessage = (event) => {
        try {
          const message: WsMessage = JSON.parse(event.data);

          // 处理 PONG 响应：取消超时定时器，重启心跳
          if (message.type === 'PONG') {
            if (pongTimerRef.current) {
              clearTimeout(pongTimerRef.current);
              pongTimerRef.current = null;
            }
            // 收到 PONG 后重新开始下一轮心跳
            startHeartbeat();
            return;
          }

          // 分发给订阅者
          dispatch(message.type, message.payload);
        } catch {
          console.warn('[WebSocket] 消息解析失败:', event.data);
        }
      };

      ws.onclose = (event) => {
        console.info(`[WebSocket] 连接关闭 (code=${event.code}, reason=${event.reason})`);
        clearTimers();
        stateRef.current = 'disconnected';
        wsRef.current = null;

        // 非主动关闭时触发重连
        if (!intentionalCloseRef.current) {
          scheduleReconnect();
        }
      };

      ws.onerror = (event) => {
        console.error('[WebSocket] 连接错误:', event);
        // onerror 之后通常会触发 onclose，重连逻辑在 onclose 中处理
      };
    } catch (err) {
      console.error('[WebSocket] 创建连接失败:', err);
      stateRef.current = 'disconnected';
      scheduleReconnect();
    }
  }, [url, getToken, startHeartbeat, clearTimers, dispatch, scheduleReconnect]);

  // 保持 ref 同步
  connectInternalRef.current = connectInternal;

  /** 手动连接 */
  const connect = useCallback(() => {
    intentionalCloseRef.current = false;
    reconnectAttemptRef.current = 0;
    connectInternal();
  }, [connectInternal]);

  /** 手动断开 */
  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearTimers();
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    stateRef.current = 'disconnected';
  }, [clearTimers]);

  /** 发送消息 */
  const send = useCallback((message: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] 连接未就绪，无法发送消息:', message.type);
    }
  }, []);

  /** 订阅指定类型消息 */
  const subscribe = useCallback(<T = unknown>(
    type: string,
    handler: WsMessageHandler<T>
  ): (() => void) => {
    if (!subscribersRef.current.has(type)) {
      subscribersRef.current.set(type, new Set());
    }
    const handlers = subscribersRef.current.get(type)!;
    handlers.add(handler as WsMessageHandler);

    // 返回取消订阅函数
    return () => {
      handlers.delete(handler as WsMessageHandler);
      if (handlers.size === 0) {
        subscribersRef.current.delete(type);
      }
    };
  }, []);

  // 自动连接/清理
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state: stateRef.current,
    send,
    subscribe,
    connect,
    disconnect,
  };
}
