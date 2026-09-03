'use client';

/**
 * useEnrichmentError — 统一错误码处理 Hook
 *
 * 将 enriched API 的业务错误码映射为前端操作指令，
 * 供各组件根据 action 类型执行对应 UI 反馈。
 *
 * 满足需求 8.3、错误处理、40004 冲突处理
 */

import { useCallback, useRef } from 'react';
import { ApiError } from '@/lib/api';
import { parseEnrichmentError } from '@/lib/enriched-api';
import {
  EnrichmentErrorCode,
  type RateLimitErrorData,
  type DuplicateTaskErrorData,
  type LoginRequiredErrorData,
  type RateLimitPersistence,
} from '@/lib/enriched-types';

// ============ 类型定义 ============

/** 错误处理动作 */
export type ErrorAction =
  | { action: 'showProgress'; taskId: string }
  | { action: 'showCountdown'; seconds: number; message: string }
  | { action: 'refreshAndToast'; message: string }
  | { action: 'showLoginModal'; intent: string }
  | { action: 'showRetry'; message: string }
  | { action: 'showBackgroundHint' }
  | { action: 'showToast'; message: string }
  | { action: 'ignore' };

/** Hook 配置 */
export interface UseEnrichmentErrorOptions {
  /** 乐观锁冲突时的自动刷新回调 */
  onRefresh?: () => void;
  /** 显示 toast 回调 */
  onToast?: (message: string) => void;
  /** 显示登录弹窗回调 */
  onShowLogin?: (intent: string) => void;
}

// ============ localStorage 持久化 ============

const RATE_LIMIT_KEY = 'algorithm-help:rate-limit-endtime';

/** 将频率超限倒计时 endTime 持久化到 localStorage */
export function persistRateLimitEndTime(data: RateLimitPersistence): void {
  try {
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
  } catch {
    // localStorage 不可用时静默忽略
  }
}

/** 从 localStorage 恢复倒计时信息，过期则返回 null */
export function loadRateLimitEndTime(): RateLimitPersistence | null {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as RateLimitPersistence;
    if (data.endTime <= Date.now()) {
      localStorage.removeItem(RATE_LIMIT_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/** 清除 localStorage 中的倒计时记录 */
export function clearRateLimitEndTime(): void {
  try {
    localStorage.removeItem(RATE_LIMIT_KEY);
  } catch {
    // 静默忽略
  }
}

// ============ 核心处理函数 ============

/**
 * 将 API 错误映射为前端操作指令（纯函数，不依赖 React 状态）
 */
export function resolveErrorAction(error: unknown): ErrorAction {
  const parsed = parseEnrichmentError(error);
  if (!parsed) {
    // 非 ApiError（网络错误等）
    const msg = error instanceof Error ? error.message : '未知错误';
    return { action: 'showToast', message: msg };
  }

  switch (parsed.code) {
    case EnrichmentErrorCode.DUPLICATE_TASK: {
      const data = parsed.data as DuplicateTaskErrorData | undefined;
      if (data?.taskId) {
        return { action: 'showProgress', taskId: data.taskId };
      }
      return { action: 'showToast', message: parsed.message };
    }

    case EnrichmentErrorCode.RATE_LIMIT: {
      const data = parsed.data as RateLimitErrorData | undefined;
      const seconds = data?.retryAfterSeconds ?? 60;
      const used = data?.usedCount ?? 5;
      const max = data?.maxCount ?? 5;
      // 持久化到 localStorage
      persistRateLimitEndTime({
        endTime: Date.now() + seconds * 1000,
        usedCount: used,
        maxCount: max,
      });
      return {
        action: 'showCountdown',
        seconds,
        message: `已达上限(${used}/${max}次)`,
      };
    }

    case EnrichmentErrorCode.OPTIMISTIC_LOCK:
      return { action: 'refreshAndToast', message: '内容已更新，请查看最新版本' };

    case EnrichmentErrorCode.LOGIN_REQUIRED: {
      const data = parsed.data as LoginRequiredErrorData | undefined;
      return { action: 'showLoginModal', intent: data?.intent ?? 'unknown' };
    }

    case EnrichmentErrorCode.AI_UNAVAILABLE:
      return { action: 'showRetry', message: 'AI 服务暂时不可用' };

    case EnrichmentErrorCode.GENERATION_TIMEOUT:
      return { action: 'showBackgroundHint' };

    case EnrichmentErrorCode.NO_SOURCE:
      return { action: 'showToast', message: '当前无可用原始题解，将使用纯 AI 生成' };

    case EnrichmentErrorCode.PROBLEM_NOT_FOUND:
      return { action: 'showToast', message: '题目不存在' };

    case EnrichmentErrorCode.ENRICHED_NOT_FOUND:
      return { action: 'showToast', message: '该解析已不存在' };

    case EnrichmentErrorCode.DUPLICATE_VOTE:
      return { action: 'ignore' };

    default:
      return { action: 'showToast', message: parsed.message };
  }
}

// ============ Hook 实现 ============

/**
 * useEnrichmentError — 统一错误处理 Hook
 *
 * 使用方式：
 * ```tsx
 * const { handleError } = useEnrichmentError({
 *   onRefresh: () => mutate(),
 *   onToast: (msg) => toast(msg),
 *   onShowLogin: (intent) => setLoginModal({ open: true, intent }),
 * });
 *
 * try { await enrichedApi.upvote(id); }
 * catch (err) { handleError(err); }
 * ```
 */
export function useEnrichmentError(options: UseEnrichmentErrorOptions = {}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleError = useCallback((error: unknown): ErrorAction => {
    const action = resolveErrorAction(error);
    const { onRefresh, onToast, onShowLogin } = optionsRef.current;

    switch (action.action) {
      case 'refreshAndToast':
        onToast?.(action.message);
        onRefresh?.();
        break;
      case 'showLoginModal':
        onShowLogin?.(action.intent);
        break;
      case 'showToast':
        onToast?.(action.message);
        break;
      case 'showRetry':
        onToast?.(action.message);
        break;
      case 'showBackgroundHint':
        onToast?.('生成时间较长，已转为后台处理');
        break;
      case 'ignore':
        break;
      // showProgress / showCountdown 由调用方自行处理
      default:
        break;
    }

    return action;
  }, []);

  return { handleError, resolveErrorAction };
}
