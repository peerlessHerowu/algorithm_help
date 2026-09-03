'use client';

/**
 * 映射管理页面
 * 功能：
 * - 映射统计（已确认/待确认/平台数）
 * - 待确认映射列表 + 确认/驳回操作
 * - 手动创建映射
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { fetcher } from '@/lib/fetcher';
import { authFetch } from '@/lib/authFetcher';
import { useAppStore } from '@/store';

// ==================== 类型定义 ====================

/** 映射条目 */
interface MappingItem {
  id: string;
  internalProblemId: string;
  internalTitle: string;
  externalPlatform: string;
  externalId: string;
  externalTitle: string;
  status: 'CONFIRMED' | 'PENDING' | 'REJECTED';
  similarity: number;
  createdAt: number;
}

/** 映射统计 */
interface MappingStats {
  confirmedCount: number;
  pendingCount: number;
  platformCount: number;
}

/** 映射列表分页响应 */
interface MappingPage {
  content: MappingItem[];
  totalElements: number;
  totalPages: number;
}

/** 手动创建映射表单数据 */
interface CreateMappingForm {
  internalProblemId: string;
  externalPlatform: string;
  externalId: string;
  externalUrl: string;
}

/** 平台选项 */
const PLATFORM_OPTIONS = [
  { value: 'LEETCODE_GLOBAL', label: 'LeetCode (Global)' },
  { value: 'LEETCODE_CN', label: 'LeetCode (CN)' },
  { value: 'CODEFORCES', label: 'Codeforces' },
  { value: 'NOWCODER', label: '牛客' },
  { value: 'ATCODER', label: 'AtCoder' },
  { value: 'HACKERRANK', label: 'HackerRank' },
] as const;

/** Mock 统计数据 */
const MOCK_STATS: MappingStats = {
  confirmedCount: 856,
  pendingCount: 23,
  platformCount: 5,
};

/** Mock 映射列表 */
const MOCK_MAPPINGS: MappingItem[] = [
  {
    id: 'map-001',
    internalProblemId: 'p-1',
    internalTitle: '两数之和',
    externalPlatform: 'LEETCODE_CN',
    externalId: '1',
    externalTitle: '两数之和',
    status: 'PENDING',
    similarity: 0.98,
    createdAt: Date.now() - 3600_000,
  },
  {
    id: 'map-002',
    internalProblemId: 'p-5',
    internalTitle: '最长回文子串',
    externalPlatform: 'LEETCODE_GLOBAL',
    externalId: '5',
    externalTitle: 'Longest Palindromic Substring',
    status: 'PENDING',
    similarity: 0.92,
    createdAt: Date.now() - 7200_000,
  },
  {
    id: 'map-003',
    internalProblemId: 'p-12',
    internalTitle: '接雨水',
    externalPlatform: 'CODEFORCES',
    externalId: 'CF-1234A',
    externalTitle: 'Trapping Rain Water',
    status: 'PENDING',
    similarity: 0.85,
    createdAt: Date.now() - 10800_000,
  },
];

/** 格式化相对时间 */
function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

/** 平台显示名称映射 */
function getPlatformLabel(value: string): string {
  const found = PLATFORM_OPTIONS.find((p) => p.value === value);
  return found?.label ?? value;
}

// ==================== 创建映射弹窗组件 ====================

interface CreateMappingModalProps {
  onClose: () => void;
  onSubmit: (form: CreateMappingForm) => void;
}

function CreateMappingModal({ onClose, onSubmit }: CreateMappingModalProps) {
  const [form, setForm] = useState<CreateMappingForm>({
    internalProblemId: '',
    externalPlatform: 'LEETCODE_CN',
    externalId: '',
    externalUrl: '',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.internalProblemId || !form.externalId) return;
    onSubmit(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            手动创建映射
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 内部题目 ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              内部题目 ID
            </label>
            <input
              type="text"
              value={form.internalProblemId}
              onChange={(e) => setForm({ ...form, internalProblemId: e.target.value })}
              placeholder="例如：p-1"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              required
            />
          </div>

          {/* 外部平台 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              外部平台
            </label>
            <select
              value={form.externalPlatform}
              onChange={(e) => setForm({ ...form, externalPlatform: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              {PLATFORM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 外部题目 ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              外部题目 ID
            </label>
            <input
              type="text"
              value={form.externalId}
              onChange={(e) => setForm({ ...form, externalId: e.target.value })}
              placeholder="例如：1 或 CF-1234A"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              required
            />
          </div>

          {/* 外部题目 URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              外部题目 URL（可选）
            </label>
            <input
              type="url"
              value={form.externalUrl}
              onChange={(e) => setForm({ ...form, externalUrl: e.target.value })}
              placeholder="https://leetcode.cn/problems/two-sum"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!form.internalProblemId || !form.externalId}
            >
              创建
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== 主页面组件 ====================

export default function MappingAdminPage() {
  const router = useRouter();
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const user = useAppStore((s) => s.user);

  // 状态
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED'>('PENDING');
  const [page, setPage] = useState(0);

  // 权限校验
  const isAdmin = isAuthenticated && user?.role === 'ADMIN';

  // 未登录跳转
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, router]);

  // 获取映射统计
  const { data: stats } = useSWR<MappingStats>(
    isAdmin ? '/api/v1/admin/mappings/stats' : null,
    fetcher,
    { fallbackData: MOCK_STATS }
  );

  // 获取映射列表
  const filterParam = statusFilter !== 'ALL' ? `&status=${statusFilter}` : '';
  const listKey = isAdmin
    ? `/api/v1/admin/mappings?page=${page}&size=10${filterParam}`
    : null;
  const { data: mappingData, isLoading } = useSWR<MappingPage>(
    listKey,
    fetcher,
    {
      fallbackData: {
        content: MOCK_MAPPINGS,
        totalElements: MOCK_MAPPINGS.length,
        totalPages: 1,
      },
    }
  );

  /** 显示提示消息 */
  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  /** 确认映射 */
  async function handleConfirm(id: string) {
    setActionLoading(id);
    try {
      const res = await authFetch(`/api/v1/admin/mappings/${id}/confirm`, {
        method: 'POST',
      });
      if (res.ok) {
        showMessage('success', '映射已确认');
        mutate(listKey);
        mutate('/api/v1/admin/mappings/stats');
      } else {
        const body = await res.json().catch(() => null);
        showMessage('error', `确认失败：${body?.message || res.statusText}`);
      }
    } catch (err) {
      showMessage('error', `请求异常：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setActionLoading(null);
    }
  }

  /** 驳回映射 */
  async function handleReject(id: string) {
    setActionLoading(id);
    try {
      const res = await authFetch(`/api/v1/admin/mappings/${id}/reject`, {
        method: 'POST',
      });
      if (res.ok) {
        showMessage('success', '映射已驳回');
        mutate(listKey);
        mutate('/api/v1/admin/mappings/stats');
      } else {
        const body = await res.json().catch(() => null);
        showMessage('error', `驳回失败：${body?.message || res.statusText}`);
      }
    } catch (err) {
      showMessage('error', `请求异常：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setActionLoading(null);
    }
  }

  /** 手动创建映射 */
  async function handleCreateMapping(form: CreateMappingForm) {
    try {
      const res = await authFetch('/api/v1/admin/mappings', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (res.ok) {
        showMessage('success', '映射创建成功');
        setShowCreateModal(false);
        mutate(listKey);
        mutate('/api/v1/admin/mappings/stats');
      } else {
        const body = await res.json().catch(() => null);
        showMessage('error', `创建失败：${body?.message || res.statusText}`);
      }
    } catch (err) {
      showMessage('error', `请求异常：${err instanceof Error ? err.message : '未知错误'}`);
    }
  }

  // 未登录 → 不渲染
  if (!isAuthenticated) return null;

  // 非 ADMIN → 无权限提示
  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-4xl">🚫</p>
          <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
            无权限访问
          </h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            此页面仅管理员可访问
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const items = mappingData?.content ?? [];
  const totalPages = mappingData?.totalPages ?? 1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* 提示消息 Toast */}
      {message && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-md px-4 py-3 text-sm font-medium shadow-lg ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
              : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 页面标题 + 创建按钮 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            映射管理
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            管理跨平台题目映射关系
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + 手动创建映射
        </button>
      </div>

      {/* 统计卡片区域 */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* 已确认数 */}
        <div className="rounded-lg border border-green-200 bg-white p-4 dark:border-green-800 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              已确认映射
            </span>
            <span className="text-lg">✅</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-green-700 dark:text-green-300">
            {stats?.confirmedCount ?? 0}
          </p>
        </div>
        {/* 待确认数 */}
        <div className="rounded-lg border border-amber-200 bg-white p-4 dark:border-amber-800 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              待确认映射
            </span>
            <span className="text-lg">⏳</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-300">
            {stats?.pendingCount ?? 0}
          </p>
        </div>
        {/* 平台数 */}
        <div className="rounded-lg border border-blue-200 bg-white p-4 dark:border-blue-800 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              覆盖平台
            </span>
            <span className="text-lg">🌐</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-700 dark:text-blue-300">
            {stats?.platformCount ?? 0}
          </p>
        </div>
      </div>

      {/* 状态筛选 Tab */}
      <div className="mb-4 flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {(['ALL', 'PENDING', 'CONFIRMED'] as const).map((tab) => {
          const labels = { ALL: '全部', PENDING: '待确认', CONFIRMED: '已确认' };
          return (
            <button
              key={tab}
              onClick={() => { setStatusFilter(tab); setPage(0); }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === tab
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* 加载态 */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-gray-200 p-6 dark:border-gray-700"
            >
              <div className="h-5 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="mt-3 h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && items.length === 0 && (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="text-center">
            <p className="text-4xl">📋</p>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              暂无映射记录
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {statusFilter === 'PENDING'
                ? '没有待确认的映射'
                : '没有匹配的映射记录'}
            </p>
          </div>
        </div>
      )}

      {/* 映射列表 */}
      {!isLoading && items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              {/* 顶部：映射对比信息 */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* 左侧：内部题目 */}
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-400 dark:text-gray-500">
                    内部题目
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {item.internalTitle}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    ID: {item.internalProblemId}
                  </p>
                </div>

                {/* 中间：箭头指示 */}
                <div className="hidden sm:flex sm:items-center sm:px-4">
                  <span className="text-xl text-gray-400">⟷</span>
                </div>

                {/* 右侧：外部题目 */}
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-400 dark:text-gray-500">
                    外部平台 · {getPlatformLabel(item.externalPlatform)}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {item.externalTitle}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    ID: {item.externalId}
                  </p>
                </div>
              </div>

              {/* 底部：相似度 + 时间 + 操作 */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-gray-700">
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  {/* 相似度标签 */}
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      item.similarity >= 0.95
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : item.similarity >= 0.85
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`}
                  >
                    相似度 {(item.similarity * 100).toFixed(0)}%
                  </span>
                  {/* 状态标签 */}
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      item.status === 'CONFIRMED'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : item.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`}
                  >
                    {item.status === 'CONFIRMED' ? '已确认' : item.status === 'PENDING' ? '待确认' : '已驳回'}
                  </span>
                  <span>{formatRelativeTime(item.createdAt)}</span>
                </div>

                {/* 操作按钮（仅待确认状态展示） */}
                {item.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleConfirm(item.id)}
                      disabled={actionLoading === item.id}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionLoading === item.id ? '处理中...' : '✓ 确认'}
                    </button>
                    <button
                      onClick={() => handleReject(item.id)}
                      disabled={actionLoading === item.id}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionLoading === item.id ? '处理中...' : '✗ 驳回'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页控制 */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            上一页
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            第 {page + 1} / {totalPages} 页
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            下一页
          </button>
        </div>
      )}

      {/* 创建映射弹窗 */}
      {showCreateModal && (
        <CreateMappingModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateMapping}
        />
      )}
    </div>
  );
}
