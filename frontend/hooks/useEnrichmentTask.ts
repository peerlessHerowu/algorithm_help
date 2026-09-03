'use client';

/**
 * useEnrichmentTask - AI 生成任务管理 Hook
 *
 * 职责：
 * - 创建生成任务（POST /enriched/{problemId}/generate）
 * - 轮询任务状态（GET /enriched/tasks/{taskId}）
 * - 取消任务（POST /enriched/tasks/{taskId}/cancel）
 * - 轮询策略：前 10s 每 2s，10-60s 每 5s，>60s 每 30s（不停止）
 * - 任务完成：自动刷新 / toast 提示
 * - 任务失败：暴露 error + retry 方法
 *
 * 满足需求 11.1-11.7, 13.3
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import { useAppStore } from '@/store';

// ============ 类型定义 ============

/** 任务状态枚举 */
export type EnrichmentTaskStatus =
  | 'idle'
  | 'creating'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** 进度信息（来自后端轮询） */
export interface TaskProgress {
  currentStep: string;
  completedSteps: number;
  totalSteps: number;
}

/** API 返回的任务状态 */
interface TaskStatusResponse {
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  problemId: string;
  level: number;
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  result: string | null;
  error: string | null;
  retryCount: number;
  startedAt: number;
  createdAt: number;
}

/** Hook 返回值 */
export interface UseEnrichmentTaskReturn {
  taskId: string | null;
  status: EnrichmentTaskStatus;
  progress: TaskProgress | null;
  error: string | null;
  /** 预计剩余秒数 */
  estimatedRemaining: number | null;
  createTask: (problemId: string, level: number) => Promise<void>;
  cancelTask: () => Promise<void>;
  retryTask: () => Promise<void>;
  /** 重置为 idle 状态 */
  reset: () => void;
}

/** Hook 配置 */
interface UseEnrichmentTaskOptions {
  /** 任务完成回调（用户仍在当前级别时调用） */
  onCompleted?: () => void;
  /** 任务完成但用户已切走时回调（显示 toast） */
  onCompletedBackground?: (level: number) => void;
  /** 任务失败回调 */
  onFailed?: (error: string) => void;
}

// ============ 常量 ============

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

/** 平均每步耗时预估（秒） */
const AVG_STEP_DURATION = 8;

// ============ 内部工具函数 ============

/** 获取轮询间隔（ms），基于任务已运行时长 */
function getPollingInterval(elapsedMs: number): number {
  if (elapsedMs < 10_000) return 2000;   // 前 10s: 每 2s
  if (elapsedMs < 60_000) return 5000;   // 10-60s: 每 5s
  return 30_000;                          // >60s: 每 30s
}

/** 带认证的 API 请求 */
async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
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
    throw new ApiError(res.status, body?.message || `请求失败 (${res.status})`, body);
  }

  const json = await res.json();
  if (json.code !== 200) {
    throw new ApiError(json.code, json.message || '业务异常', json);
  }
  return json.data;
}

// ============ Hook 实现 ============

export function useEnrichmentTask(options: UseEnrichmentTaskOptions = {}): UseEnrichmentTaskReturn {
  const { onCompleted, onCompletedBackground, onFailed } = options;

  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<EnrichmentTaskStatus>('idle');
  const [progress, setProgress] = useState<TaskProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estimatedRemaining, setEstimatedRemaining] = useState<number | null>(null);

  // 记录任务创建时的参数用于重试
  const taskParamsRef = useRef<{ problemId: string; level: number } | null>(null);
  // 轮询 timer
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 任务开始时间
  const startTimeRef = useRef<number>(0);
  // 是否已卸载
  const unmountedRef = useRef(false);
  // 当前活跃级别（判断用户是否切走）
  const activeLevelRef = useRef<number>(0);

  // 清理轮询定时器
  const clearPolling = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      clearPolling();
    };
  }, [clearPolling]);

  // 回调 ref（避免 useCallback 循环依赖 + 始终访问最新回调）
  const callbacksRef = useRef({ onCompleted, onCompletedBackground, onFailed });
  useEffect(() => {
    callbacksRef.current = { onCompleted, onCompletedBackground, onFailed };
  }, [onCompleted, onCompletedBackground, onFailed]);

  // pollStatus ref：解决 pollStatus ↔ scheduleNextPoll 循环引用
  const pollStatusRef = useRef<(id: string) => void>(() => {});

  /** 安排下一次轮询 */
  const scheduleNextPoll = useCallback((id: string) => {
    clearPolling();
    const elapsed = Date.now() - startTimeRef.current;
    const interval = getPollingInterval(elapsed);
    timerRef.current = setTimeout(() => pollStatusRef.current(id), interval);
  }, [clearPolling]);

  /** 轮询任务状态 */
  const pollStatus = useCallback(async (id: string) => {
    if (unmountedRef.current) return;

    try {
      const data = await apiRequest<TaskStatusResponse>(
        `/api/v1/enriched/tasks/${encodeURIComponent(id)}`
      );

      if (unmountedRef.current) return;

      const taskProgress: TaskProgress = {
        currentStep: data.currentStep || '',
        completedSteps: data.completedSteps || 0,
        totalSteps: data.totalSteps || 7,
      };
      setProgress(taskProgress);

      // 计算预计剩余时间
      if (taskProgress.totalSteps > 0 && taskProgress.completedSteps < taskProgress.totalSteps) {
        const remaining = (taskProgress.totalSteps - taskProgress.completedSteps) * AVG_STEP_DURATION;
        setEstimatedRemaining(remaining);
      } else {
        setEstimatedRemaining(null);
      }

      switch (data.status) {
        case 'COMPLETED': {
          setStatus('completed');
          clearPolling();
          if (activeLevelRef.current === data.level) {
            callbacksRef.current.onCompleted?.();
          } else {
            callbacksRef.current.onCompletedBackground?.(data.level);
          }
          break;
        }
        case 'FAILED': {
          setStatus('failed');
          setError(data.error || '生成失败，请重试');
          clearPolling();
          callbacksRef.current.onFailed?.(data.error || '生成失败');
          break;
        }
        case 'CANCELLED': {
          setStatus('cancelled');
          clearPolling();
          break;
        }
        default: {
          // PENDING / PROCESSING → 继续轮询
          const mappedStatus = data.status === 'PENDING' ? 'pending' : 'processing';
          setStatus(mappedStatus);
          scheduleNextPoll(id);
        }
      }
    } catch (err) {
      // 轮询出错不中断，继续下次
      console.error('轮询任务状态失败:', err);
      if (!unmountedRef.current) {
        scheduleNextPoll(id);
      }
    }
  }, [clearPolling, scheduleNextPoll]);

  // 保持 pollStatusRef 指向最新的 pollStatus
  useEffect(() => {
    pollStatusRef.current = pollStatus;
  }, [pollStatus]);

  /** 开始轮询 */
  const startPolling = useCallback((id: string, level: number) => {
    startTimeRef.current = Date.now();
    activeLevelRef.current = level;
    pollStatus(id);
  }, [pollStatus]);

  /** 创建生成任务 */
  const createTask = useCallback(async (problemId: string, level: number) => {
    setStatus('creating');
    setError(null);
    setProgress(null);
    setEstimatedRemaining(null);
    taskParamsRef.current = { problemId, level };

    try {
      const data = await apiRequest<{ taskId: string }>(
        `/api/v1/enriched/${encodeURIComponent(problemId)}/generate?level=${level}&force=true`,
        {
          method: 'POST',
        }
      );

      if (unmountedRef.current) return;

      setTaskId(data.taskId);
      setStatus('pending');
      startPolling(data.taskId, level);
    } catch (err) {
      if (unmountedRef.current) return;

      const apiErr = err as ApiError;
      // 40001: 已有活跃任务 → 使用已有 taskId 轮询
      if (apiErr.status === 409 && (apiErr.raw as { data?: { taskId?: string } })?.data?.taskId) {
        const existingTaskId = (apiErr.raw as { data: { taskId: string } }).data.taskId;
        setTaskId(existingTaskId);
        setStatus('processing');
        startPolling(existingTaskId, level);
        return;
      }

      setStatus('failed');
      setError(apiErr.userMessage || '创建任务失败');
    }
  }, [startPolling]);

  /** 取消任务 */
  const cancelTask = useCallback(async () => {
    if (!taskId) return;
    clearPolling();

    try {
      await apiRequest<void>(
        `/api/v1/enriched/tasks/${encodeURIComponent(taskId)}/cancel`,
        { method: 'POST' }
      );
    } catch {
      // 取消失败也切回 idle
    }

    if (!unmountedRef.current) {
      setStatus('idle');
      setTaskId(null);
      setProgress(null);
      setEstimatedRemaining(null);
      setError(null);
    }
  }, [taskId, clearPolling]);

  /** 重试任务 */
  const retryTask = useCallback(async () => {
    const params = taskParamsRef.current;
    if (!params) return;
    await createTask(params.problemId, params.level);
  }, [createTask]);

  /** 重置状态 */
  const reset = useCallback(() => {
    clearPolling();
    setTaskId(null);
    setStatus('idle');
    setProgress(null);
    setError(null);
    setEstimatedRemaining(null);
  }, [clearPolling]);

  return {
    taskId,
    status,
    progress,
    error,
    estimatedRemaining,
    createTask,
    cancelTask,
    retryTask,
    reset,
  };
}
