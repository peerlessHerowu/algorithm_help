'use client';

/**
 * useVote - 投票状态管理 Hook
 *
 * 职责：
 * - 管理 voteState（UP/DOWN/NONE）per enrichedId
 * - 乐观更新：立即反映 UI 变化，API 失败时回滚
 * - 互斥逻辑：点赞取消踩，踩取消赞
 * - 调用 upvote/downvote/cancel API
 * - 获取用户初始投票状态
 *
 * 满足需求 6.6, 6.10, 27.1-27.5, 33.4
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store';

// ============ 类型定义 ============

/** 投票状态 */
export type VoteState = 'UP' | 'DOWN' | 'NONE';

/** Hook 返回值 */
export interface UseVoteReturn {
  voteState: VoteState;
  upvoteCount: number;
  downvoteCount: number;
  isLoading: boolean;
  handleUpvote: () => Promise<void>;
  handleDownvote: () => Promise<void>;
  handleCancelVote: () => Promise<void>;
}

/** Hook 配置 */
interface UseVoteOptions {
  /** enriched solution ID */
  enrichedId: string;
  /** 初始点赞数 */
  initialUpvoteCount?: number;
  /** 初始踩数 */
  initialDownvoteCount?: number;
  /** 初始投票状态（已知时可直接传入，避免额外请求） */
  initialVoteState?: VoteState;
  /** 是否已登录 */
  isLoggedIn?: boolean;
  /** 未登录时回调 */
  onLoginRequired?: (intent: string) => void;
  /** 操作失败时回调（用于 toast 展示） */
  onError?: (message: string) => void;
}

// ============ 常量 ============

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

// ============ 内部 API 工具 ============

/** 投票 API 响应 */
interface VoteResponse {
  voteState: VoteState;
  upvoteCount: number;
  downvoteCount: number;
}

/** 带认证的 API 请求（复用 useEnrichmentTask 模式） */
async function voteApiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAppStore.getState().token;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.message || `请求失败 (${res.status})`;
    throw new Error(message);
  }

  const json = await res.json();
  if (json.code !== 200) {
    throw new Error(json.message || '业务异常');
  }
  return json.data;
}

// ============ Hook 实现 ============

export function useVote(options: UseVoteOptions): UseVoteReturn {
  const {
    enrichedId,
    initialUpvoteCount = 0,
    initialDownvoteCount = 0,
    initialVoteState,
    isLoggedIn = false,
    onLoginRequired,
    onError,
  } = options;

  const [voteState, setVoteState] = useState<VoteState>(initialVoteState ?? 'NONE');
  const [upvoteCount, setUpvoteCount] = useState(initialUpvoteCount);
  const [downvoteCount, setDownvoteCount] = useState(initialDownvoteCount);
  const [isLoading, setIsLoading] = useState(false);

  // 防止组件卸载后更新状态
  const unmountedRef = useRef(false);
  // 记录上一次的状态用于回滚
  const prevStateRef = useRef<{
    voteState: VoteState;
    upvoteCount: number;
    downvoteCount: number;
  }>({ voteState: 'NONE', upvoteCount: 0, downvoteCount: 0 });

  useEffect(() => {
    unmountedRef.current = false;
    return () => { unmountedRef.current = true; };
  }, []);

  // 同步外部 initialVoteState 变化
  useEffect(() => {
    if (initialVoteState !== undefined) {
      setVoteState(initialVoteState);
    }
  }, [initialVoteState]);

  // 同步外部计数变化
  useEffect(() => {
    setUpvoteCount(initialUpvoteCount);
  }, [initialUpvoteCount]);

  useEffect(() => {
    setDownvoteCount(initialDownvoteCount);
  }, [initialDownvoteCount]);

  /** 保存当前状态到 prevStateRef（用于回滚） */
  const saveCurrentState = useCallback(() => {
    prevStateRef.current = {
      voteState,
      upvoteCount,
      downvoteCount,
    };
  }, [voteState, upvoteCount, downvoteCount]);

  /** 回滚到上一次的状态 */
  const rollback = useCallback(() => {
    if (unmountedRef.current) return;
    const prev = prevStateRef.current;
    setVoteState(prev.voteState);
    setUpvoteCount(prev.upvoteCount);
    setDownvoteCount(prev.downvoteCount);
  }, []);

  /** 乐观更新：点赞 */
  const optimisticUpvote = useCallback(() => {
    saveCurrentState();
    if (voteState === 'DOWN') {
      // 踩→赞：取消踩计数 + 增加赞计数
      setDownvoteCount((c) => Math.max(0, c - 1));
      setUpvoteCount((c) => c + 1);
    } else if (voteState === 'NONE') {
      // 无→赞：增加赞计数
      setUpvoteCount((c) => c + 1);
    }
    setVoteState('UP');
  }, [voteState, saveCurrentState]);

  /** 乐观更新：踩 */
  const optimisticDownvote = useCallback(() => {
    saveCurrentState();
    if (voteState === 'UP') {
      // 赞→踩：取消赞计数 + 增加踩计数
      setUpvoteCount((c) => Math.max(0, c - 1));
      setDownvoteCount((c) => c + 1);
    } else if (voteState === 'NONE') {
      // 无→踩：增加踩计数
      setDownvoteCount((c) => c + 1);
    }
    setVoteState('DOWN');
  }, [voteState, saveCurrentState]);

  /** 乐观更新：取消投票 */
  const optimisticCancel = useCallback(() => {
    saveCurrentState();
    if (voteState === 'UP') {
      setUpvoteCount((c) => Math.max(0, c - 1));
    } else if (voteState === 'DOWN') {
      setDownvoteCount((c) => Math.max(0, c - 1));
    }
    setVoteState('NONE');
  }, [voteState, saveCurrentState]);

  /** 取消投票（内部实现，无循环依赖） */
  const cancelVoteInternal = useCallback(async () => {
    if (!isLoggedIn || voteState === 'NONE') return;

    setIsLoading(true);
    optimisticCancel();

    try {
      await voteApiRequest<VoteResponse>(
        `/api/v1/enriched/${encodeURIComponent(enrichedId)}/vote`,
        { method: 'DELETE' }
      );
    } catch (err) {
      rollback();
      onError?.((err as Error).message || '取消投票失败，请重试');
    } finally {
      if (!unmountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [isLoggedIn, voteState, enrichedId, optimisticCancel, rollback, onError]);

  /** 点赞操作 */
  const handleUpvote = useCallback(async () => {
    // 未登录检查
    if (!isLoggedIn) {
      onLoginRequired?.('upvote');
      return;
    }

    // 已经是赞状态 → 取消
    if (voteState === 'UP') {
      await cancelVoteInternal();
      return;
    }

    setIsLoading(true);
    optimisticUpvote();

    try {
      await voteApiRequest<VoteResponse>(
        `/api/v1/enriched/${encodeURIComponent(enrichedId)}/upvote`,
        { method: 'POST' }
      );
    } catch (err) {
      rollback();
      onError?.((err as Error).message || '点赞失败，请重试');
    } finally {
      if (!unmountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [isLoggedIn, voteState, enrichedId, optimisticUpvote, cancelVoteInternal, rollback, onLoginRequired, onError]);

  /** 踩操作 */
  const handleDownvote = useCallback(async () => {
    // 未登录检查
    if (!isLoggedIn) {
      onLoginRequired?.('downvote');
      return;
    }

    // 已经是踩状态 → 取消
    if (voteState === 'DOWN') {
      await cancelVoteInternal();
      return;
    }

    setIsLoading(true);
    optimisticDownvote();

    try {
      await voteApiRequest<VoteResponse>(
        `/api/v1/enriched/${encodeURIComponent(enrichedId)}/downvote`,
        { method: 'POST' }
      );
    } catch (err) {
      rollback();
      onError?.((err as Error).message || '操作失败，请重试');
    } finally {
      if (!unmountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [isLoggedIn, voteState, enrichedId, optimisticDownvote, cancelVoteInternal, rollback, onLoginRequired, onError]);

  /** 取消投票（公开接口） */
  const handleCancelVote = cancelVoteInternal;

  return {
    voteState,
    upvoteCount,
    downvoteCount,
    isLoading,
    handleUpvote,
    handleDownvote,
    handleCancelVote,
  };
}
