'use client';

/**
 * 管理后台批量任务总览页面
 *
 * 展示批量生成任务的整体进度、成功/失败/进行中数量
 * 支持查看失败任务错误详情和重试按钮
 * 后端 batch_id 管理 + 并发度控制（默认 3）
 *
 * Requirements: 24.1-24.4
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store';
import { authFetch } from '@/lib/authFetcher';

// ============ 类型定义 ============

interface BatchTask {
  taskId: string;
  problemId: string;
  level: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  error?: string;
  currentStep?: string;
  completedSteps: number;
  totalSteps: number;
  startedAt?: number;
}

interface BatchOverview {
  batchId: string;
  concurrency: number;
  total: number;
  completed: number;
  failed: number;
  processing: number;
  pending: number;
  cancelled: number;
  tasks: BatchTask[];
  createdAt: number;
}

// ============ 工具函数 ============

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

function statusLabel(status: BatchTask['status']): { text: string; color: string } {
  switch (status) {
    case 'COMPLETED': return { text: '✅ 成功', color: 'text-green-600 dark:text-green-400' };
    case 'FAILED': return { text: '❌ 失败', color: 'text-red-600 dark:text-red-400' };
    case 'PROCESSING': return { text: '⏳ 进行中', color: 'text-blue-600 dark:text-blue-400' };
    case 'PENDING': return { text: '⏸ 待处理', color: 'text-gray-500 dark:text-gray-400' };
    case 'CANCELLED': return { text: '🚫 已取消', color: 'text-gray-400 dark:text-gray-500' };
    default: return { text: status, color: 'text-gray-500' };
  }
}

function progressPercent(overview: BatchOverview): number {
  if (overview.total === 0) return 0;
  return Math.round((overview.completed / overview.total) * 100);
}

// ============ 主页面组件 ============

export default function AdminBatchPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const [hydrated, setHydrated] = useState(false);

  const [overview, setOverview] = useState<BatchOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [retryLoading, setRetryLoading] = useState<string | null>(null);
  const [showFailed, setShowFailed] = useState(true);

  useEffect(() => { setHydrated(true); }, []);

  const isAdmin = isAuthenticated && user?.role === 'ADMIN';

  /** 加载批量任务总览 */
  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await authFetch('/api/v1/admin/enriched/batch/overview');
      if (!res.ok) throw new Error(`请求失败 (${res.status})`);
      const json = await res.json();
      setOverview(json.data ?? json);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : '加载失败');
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchOverview();
  }, [isAdmin, fetchOverview]);

  // 自动轮询进行中的任务
  useEffect(() => {
    if (!overview || overview.processing === 0) return;
    const timer = setInterval(fetchOverview, 5000);
    return () => clearInterval(timer);
  }, [overview, fetchOverview]);

  /** 重试单个失败任务 */
  async function handleRetry(task: BatchTask) {
    setRetryLoading(task.taskId);
    try {
      const res = await authFetch(`/api/v1/enriched/${task.problemId}/generate?level=${task.level}&force=true`, {
        method: 'POST',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || '重试失败');
      }
      // 刷新总览
      await fetchOverview();
    } catch (err) {
      alert(err instanceof Error ? err.message : '重试失败');
    } finally {
      setRetryLoading(null);
    }
  }

  // ============ 渲染条件 ============

  if (!hydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push('/auth/login');
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-4xl">🚫</p>
          <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">无权限访问</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400">此页面仅管理员可访问</p>
        </div>
      </div>
    );
  }

  // ============ 主渲染 ============

  const failedTasks = overview?.tasks.filter(t => t.status === 'FAILED') ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">批量任务总览</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          查看批量生成任务的执行状态和进度
        </p>
      </div>

      {/* 加载态 */}
      {loading && (
        <div className="space-y-4">
          <div className="animate-pulse rounded-lg border border-gray-200 p-6 dark:border-gray-700">
            <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="mt-4 h-6 w-full rounded bg-gray-200 dark:bg-gray-700" />
            <div className="mt-4 flex gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 w-1/4 rounded bg-gray-200 dark:bg-gray-700" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 错误态 */}
      {!loading && fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
          <p className="text-red-600 dark:text-red-400">加载失败：{fetchError}</p>
          <button onClick={fetchOverview}
            className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">
            重试
          </button>
        </div>
      )}

      {/* 空状态 */}
      {!loading && !fetchError && !overview && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <p className="text-4xl">📋</p>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">暂无批量任务</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              使用"批量生成"功能后，任务进度将在此展示
            </p>
          </div>
        </div>
      )}

      {/* 有数据时展示 */}
      {!loading && !fetchError && overview && (
        <div className="space-y-6">
          {/* 概览卡片 */}
          <div className="rounded-lg border border-gray-200 p-6 dark:border-gray-700 dark:bg-gray-800/50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  批量任务 #{overview.batchId.slice(0, 8)}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  并发度: {overview.concurrency} · 创建于 {formatRelativeTime(overview.createdAt)}
                </p>
              </div>
              <button onClick={fetchOverview}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700
                           hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                🔄 刷新
              </button>
            </div>

            {/* 进度条 */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">总进度</span>
                <span className="font-mono text-gray-900 dark:text-gray-100">
                  {overview.completed}/{overview.total} ({progressPercent(overview)}%)
                </span>
              </div>
              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${progressPercent(overview)}%` }}
                />
              </div>
            </div>

            {/* 状态统计 */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="成功" value={overview.completed} icon="✅" color="bg-green-50 dark:bg-green-900/20" />
              <StatCard label="失败" value={overview.failed} icon="❌" color="bg-red-50 dark:bg-red-900/20" />
              <StatCard label="进行中" value={overview.processing} icon="⏳" color="bg-blue-50 dark:bg-blue-900/20" />
              <StatCard label="待处理" value={overview.pending} icon="⏸" color="bg-gray-50 dark:bg-gray-800" />
            </div>
          </div>

          {/* 失败任务列表 */}
          {failedTasks.length > 0 && (
            <div className="rounded-lg border border-red-200 dark:border-red-800/50">
              <button
                onClick={() => setShowFailed(!showFailed)}
                className="flex w-full items-center justify-between rounded-t-lg bg-red-50 px-4 py-3
                           dark:bg-red-900/20"
              >
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  失败任务 ({failedTasks.length})
                </span>
                <span className="text-red-500">{showFailed ? '▼' : '▶'}</span>
              </button>

              {showFailed && (
                <div className="divide-y divide-red-100 dark:divide-red-800/30">
                  {failedTasks.map(task => (
                    <div key={task.taskId}
                      className="flex items-center justify-between px-4 py-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {task.problemId} · L{task.level}
                        </p>
                        <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                          {task.error || '未知错误'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRetry(task)}
                        disabled={retryLoading === task.taskId}
                        className="ml-3 rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium
                                   text-red-700 hover:bg-red-50 disabled:opacity-50
                                   dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/30"
                      >
                        {retryLoading === task.taskId ? '...' : '🔄 重试'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============ 子组件 ============

function StatCard({ label, value, icon, color }: {
  label: string; value: number; icon: string; color: string;
}) {
  return (
    <div className={`rounded-lg p-3 ${color}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</span>
      </div>
      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{label}</p>
    </div>
  );
}
