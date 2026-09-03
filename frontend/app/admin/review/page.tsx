'use client';

/**
 * 管理后台审核队列页面
 *
 * 展示所有 PENDING_REVIEW 状态的 enriched 解析内容
 * 支持：按题目搜索、按 quality_score 排序、内容预览、通过/拒绝操作
 * 拒绝时要求输入拒绝原因，操作后失效对应缓存
 *
 * Requirements: 28.1-28.6
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store';
import { authFetch } from '@/lib/authFetcher';

// ============ 类型定义 ============

/** 审核队列条目 */
interface ReviewItem {
  id: string;
  problemId: string;
  problemTitle: string;
  level: number;
  title: string;
  qualityScore: number;
  summary: string;
  content: string;
  feedbackCount: number;
  createdAt: number;
  sourceType: string;
}

/** 排序方向 */
type SortOrder = 'asc' | 'desc';

// ============ 工具函数 ============

/** 格式化时间为相对时间 */
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

/** 质量分颜色 */
function scoreColor(score: number): string {
  if (score >= 0.7) return 'text-green-600 dark:text-green-400';
  if (score >= 0.5) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

/** 截断文本 */
function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

// ============ 拒绝原因弹窗组件 ============

interface RejectModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}

function RejectModal({ open, onClose, onConfirm, loading }: RejectModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setError('');
    }
  }, [open]);

  function handleSubmit() {
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setError('拒绝原因至少 5 个字');
      return;
    }
    onConfirm(trimmed);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          拒绝发布
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          请输入拒绝原因，将通知内容生成者进行修改
        </p>

        <textarea
          value={reason}
          onChange={(e) => { setReason(e.target.value); setError(''); }}
          rows={4}
          placeholder="请描述拒绝原因（至少 5 个字）..."
          className="mt-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                     dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200
                     focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700
                       hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white
                       hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '处理中...' : '确认拒绝'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 内容预览弹窗组件 ============

interface PreviewModalProps {
  open: boolean;
  item: ReviewItem | null;
  onClose: () => void;
}

function PreviewModal({ open, item, onClose }: PreviewModalProps) {
  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题区 */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {item.title}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {item.problemTitle} · L{item.level} · 质量分 {item.qualityScore.toFixed(2)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600
                       dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        {/* 摘要 */}
        {item.summary && (
          <div className="mb-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
            {item.summary}
          </div>
        )}

        {/* 内容正文 */}
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <pre className="whitespace-pre-wrap rounded-md bg-gray-50 p-4 text-sm text-gray-800
                          dark:bg-gray-900 dark:text-gray-200">
            {item.content || '暂无内容'}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ============ 主页面组件 ============

export default function AdminReviewPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const [hydrated, setHydrated] = useState(false);

  // 列表数据
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // 搜索和排序
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // 操作状态
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 弹窗状态
  const [rejectTarget, setRejectTarget] = useState<ReviewItem | null>(null);
  const [previewTarget, setPreviewTarget] = useState<ReviewItem | null>(null);

  // hydrate 检测
  useEffect(() => {
    setHydrated(true);
  }, []);

  const isAdmin = isAuthenticated && user?.role === 'ADMIN';

  // 加载审核队列数据
  const fetchReviewItems = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await authFetch('/api/v1/admin/enriched/pending-review');
      if (!res.ok) {
        throw new Error(`请求失败 (${res.status})`);
      }
      const json = await res.json();
      const data = json.data ?? json.content ?? json;
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : '加载失败');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchReviewItems();
    }
  }, [isAdmin, fetchReviewItems]);

  // 搜索过滤 + 排序
  const filteredItems = items
    .filter((item) => {
      if (!searchKeyword.trim()) return true;
      const kw = searchKeyword.toLowerCase();
      return (
        item.problemTitle?.toLowerCase().includes(kw) ||
        item.title?.toLowerCase().includes(kw)
      );
    })
    .sort((a, b) => {
      const diff = a.qualityScore - b.qualityScore;
      return sortOrder === 'asc' ? diff : -diff;
    });

  /** 通过发布操作 */
  async function handleApprove(item: ReviewItem) {
    setActionLoading(item.id);
    try {
      const res = await authFetch(`/api/v1/admin/enriched/${item.id}/approve`, {
        method: 'PUT',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || '审核通过失败');
      }
      // 从列表移除已处理项
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setActionLoading(null);
    }
  }

  /** 拒绝操作（弹窗确认后触发） */
  async function handleRejectConfirm(reason: string) {
    if (!rejectTarget) return;
    setActionLoading(rejectTarget.id);
    try {
      const res = await authFetch(`/api/v1/admin/enriched/${rejectTarget.id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || '拒绝操作失败');
      }
      // 从列表移除已处理项
      setItems((prev) => prev.filter((i) => i.id !== rejectTarget.id));
      setRejectTarget(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setActionLoading(null);
    }
  }

  // ============ 渲染条件判断 ============

  // hydrate 未完成
  if (!hydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  // 未登录
  if (!isAuthenticated) {
    router.push('/auth/login');
    return null;
  }

  // 非管理员
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

  // ============ 主渲染 ============

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          审核队列
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          审核待发布的 AI 解析内容，共 {filteredItems.length} 条待处理
        </p>
      </div>

      {/* 搜索和排序控制栏 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* 搜索框 */}
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="搜索题目名称或标题..."
            className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm
                       dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200
                       focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        </div>

        {/* 质量分排序 */}
        <button
          onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
          className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm
                     text-gray-700 hover:bg-gray-50
                     dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          质量分
          {sortOrder === 'asc' ? ' ↑' : ' ↓'}
        </button>

        {/* 刷新按钮 */}
        <button
          onClick={fetchReviewItems}
          disabled={loading}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700
                     hover:bg-gray-50 disabled:opacity-50
                     dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          🔄 刷新
        </button>
      </div>

      {/* 加载态 */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-gray-200 p-5 dark:border-gray-700"
            >
              <div className="h-4 w-1/4 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="mt-3 h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="mt-2 h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      )}

      {/* 错误态 */}
      {!loading && fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
          <p className="text-red-600 dark:text-red-400">加载失败：{fetchError}</p>
          <button
            onClick={fetchReviewItems}
            className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >
            重试
          </button>
        </div>
      )}

      {/* 空状态 */}
      {!loading && !fetchError && filteredItems.length === 0 && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <p className="text-4xl">✅</p>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              {searchKeyword ? '未找到匹配内容' : '暂无待审核内容'}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchKeyword ? '尝试调整搜索关键词' : '所有内容已审核完毕'}
            </p>
          </div>
        </div>
      )}

      {/* 审核列表 - 表格 */}
      {!loading && !fetchError && filteredItems.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  题目
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  级别
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  标题
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  质量分
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  创建时间
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  纠错数
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  操作
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  {/* 题目名称 */}
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {truncate(item.problemTitle || item.problemId, 20)}
                  </td>

                  {/* 级别 */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700
                                     dark:bg-blue-900/30 dark:text-blue-300">
                      L{item.level}
                    </span>
                  </td>

                  {/* 标题 */}
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    <button
                      onClick={() => setPreviewTarget(item)}
                      className="text-left hover:text-blue-600 hover:underline dark:hover:text-blue-400"
                      title="点击预览内容"
                    >
                      {truncate(item.title, 30)}
                    </button>
                  </td>

                  {/* 质量分 */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`text-sm font-mono font-medium ${scoreColor(item.qualityScore)}`}>
                      {item.qualityScore.toFixed(2)}
                    </span>
                  </td>

                  {/* 创建时间 */}
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {formatRelativeTime(item.createdAt)}
                  </td>

                  {/* 纠错反馈数 */}
                  <td className="whitespace-nowrap px-4 py-3">
                    {item.feedbackCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5
                                       text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                        🐛 {item.feedbackCount}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">0</span>
                    )}
                  </td>

                  {/* 操作按钮 */}
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* 预览 */}
                      <button
                        onClick={() => setPreviewTarget(item)}
                        className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-gray-600
                                   hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                        title="预览内容"
                      >
                        👁 预览
                      </button>

                      {/* 通过发布 */}
                      <button
                        onClick={() => handleApprove(item)}
                        disabled={actionLoading === item.id}
                        className="rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white
                                   hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actionLoading === item.id ? '...' : '✓ 通过发布'}
                      </button>

                      {/* 拒绝 */}
                      <button
                        onClick={() => setRejectTarget(item)}
                        disabled={actionLoading === item.id}
                        className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white
                                   hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actionLoading === item.id ? '...' : '✗ 拒绝'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 拒绝原因弹窗 */}
      <RejectModal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleRejectConfirm}
        loading={actionLoading === rejectTarget?.id}
      />

      {/* 内容预览弹窗 */}
      <PreviewModal
        open={!!previewTarget}
        item={previewTarget}
        onClose={() => setPreviewTarget(null)}
      />
    </div>
  );
}
