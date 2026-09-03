'use client';

/**
 * 管理后台审计日志查看页面
 *
 * 展示所有管理操作记录，支持按操作人和时间范围筛选
 * 90 天保留策略（后端自动清理）
 *
 * Requirements: 32.1-32.4
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store';
import { authFetch } from '@/lib/authFetcher';

// ============ 类型定义 ============

interface AuditLogEntry {
  id: number;
  operatorId: string;
  operatorName: string;
  actionType: string;
  targetId: string;
  targetType: string;
  beforeState: string | null;
  afterState: string | null;
  remark: string | null;
  createdAt: number;
}

interface AuditLogsResponse {
  content: AuditLogEntry[];
  totalElements: number;
  page: number;
  size: number;
}

// ============ 工具函数 ============

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function actionLabel(actionType: string): { text: string; color: string } {
  const map: Record<string, { text: string; color: string }> = {
    APPROVE: { text: '通过发布', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    REJECT: { text: '拒绝', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    DELETE: { text: '删除', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
    BATCH_GENERATE: { text: '批量生成', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    SET_RECOMMENDED: { text: '标记推荐', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    RESOLVE_FEEDBACK: { text: '处理反馈', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  };
  return map[actionType] ?? { text: actionType, color: 'bg-gray-100 text-gray-600' };
}

// ============ 主页面组件 ============

export default function AdminAuditPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const [hydrated, setHydrated] = useState(false);

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // 筛选条件
  const [operatorId, setOperatorId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => { setHydrated(true); }, []);

  const isAdmin = isAuthenticated && user?.role === 'ADMIN';

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(pageSize));
      if (operatorId.trim()) params.set('operatorId', operatorId.trim());
      if (startDate) params.set('startTime', String(new Date(startDate).getTime()));
      if (endDate) params.set('endTime', String(new Date(endDate + 'T23:59:59').getTime()));

      const res = await authFetch(`/api/v1/admin/enriched/audit-logs?${params}`);
      if (!res.ok) throw new Error(`请求失败 (${res.status})`);
      const json = await res.json();
      const data: AuditLogsResponse = json.data ?? json;
      setLogs(data.content ?? []);
      setTotal(data.totalElements ?? 0);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, operatorId, startDate, endDate]);

  useEffect(() => {
    if (isAdmin) fetchLogs();
  }, [isAdmin, fetchLogs]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) { router.push('/auth/login'); return null; }
  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-4xl">🚫</p>
          <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">无权限访问</h2>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">操作审计日志</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          所有管理操作记录，保留 90 天 · 共 {total} 条
        </p>
      </div>

      {/* 筛选栏 */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">操作人</label>
          <input type="text" value={operatorId}
            onChange={(e) => { setOperatorId(e.target.value); setPage(0); }}
            placeholder="操作人 ID"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm
                       dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">开始日期</label>
          <input type="date" value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm
                       dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">结束日期</label>
          <input type="date" value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm
                       dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200" />
        </div>
        <button onClick={fetchLogs}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
          查询
        </button>
      </div>

      {/* 加载态/错误态 */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse rounded border border-gray-200 p-4 dark:border-gray-700">
              <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="mt-2 h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      )}

      {!loading && fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-900/20">
          <p className="text-red-600 dark:text-red-400">{fetchError}</p>
          <button onClick={fetchLogs}
            className="mt-2 rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700">
            重试
          </button>
        </div>
      )}

      {/* 日志列表 */}
      {!loading && !fetchError && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">操作人</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">操作</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">目标</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {logs.map(entry => {
                const action = actionLabel(entry.actionType);
                return (
                  <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {formatTime(entry.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {entry.operatorName || entry.operatorId}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${action.color}`}>
                        {action.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 font-mono">
                      {entry.targetId ? `${entry.targetType}:${entry.targetId.slice(0, 8)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                      {entry.remark || '-'}
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    暂无审计日志
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 分页 */}
      {!loading && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            第 {page + 1}/{totalPages} 页
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm
                         disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
            >
              上一页
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm
                         disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
