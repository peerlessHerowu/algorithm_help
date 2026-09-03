'use client';

/**
 * 题目 CRUD 管理页面
 * 功能：题目列表表格（搜索/平台筛选/状态筛选）、手动创建/编辑表单弹窗、批量导入弹窗
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { fetcher } from '@/lib/fetcher';
import { authFetch } from '@/lib/authFetcher';
import { safeArray } from '@/lib/safeArray';
import { useAppStore } from '@/store';
import type { Difficulty } from '@/lib/types';

// ============ 类型定义 ============

/** 题目列表项 */
interface ProblemItem {
  id: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  status: string;
  platforms: string[];
}

/** 分页响应 */
interface ProblemPage {
  content: ProblemItem[];
  totalElements: number;
  totalPages: number;
}

/** 创建/编辑表单数据 */
interface ProblemFormData {
  title: string;
  difficulty: Difficulty;
  tags: string;
  description: string;
  constraints: string;
  platforms: string;
}

/** 批量导入模式 */
type ImportMode = 'skip' | 'update';

/** 批量导入结果 */
interface ImportResultItem {
  title: string;
  status: 'created' | 'updated' | 'skipped' | 'error';
  message?: string;
}

// ============ 常量 ============

const DIFFICULTY_OPTIONS: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

const PLATFORM_OPTIONS = ['LEETCODE_GLOBAL', 'LEETCODE_CN', 'CODEFORCES', 'NOWCODER', 'ATCODER'];
const STATUS_OPTIONS = ['all', 'generated', 'not_generated'] as const;

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  EASY: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30',
  MEDIUM: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30',
  HARD: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30',
};

const STATUS_LABELS: Record<string, string> = {
  all: '全部',
  generated: '已生成',
  not_generated: '未生成',
};

// ============ 弹窗组件：创建/编辑表单 ============

interface ProblemFormModalProps {
  /** 是否显示 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 提交成功回调 */
  onSuccess: () => void;
  /** 编辑模式下的题目 ID（为空表示新建） */
  editId?: string | null;
  /** 编辑模式下的初始数据 */
  initialData?: ProblemFormData;
}

function ProblemFormModal({ open, onClose, onSuccess, editId, initialData }: ProblemFormModalProps) {
  const [form, setForm] = useState<ProblemFormData>(
    initialData || { title: '', difficulty: 'MEDIUM', tags: '', description: '', constraints: '', platforms: '' }
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 当 initialData 变化时同步表单
  useEffect(() => {
    if (initialData) {
      setForm(initialData);
    } else {
      setForm({ title: '', difficulty: 'MEDIUM', tags: '', description: '', constraints: '', platforms: '' });
    }
    setError('');
  }, [initialData, open]);

  /** 提交创建或编辑 */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('标题不能为空');
      return;
    }
    setSubmitting(true);
    setError('');

    const body = {
      title: form.title.trim(),
      difficulty: form.difficulty,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      description: form.description.trim(),
      constraints: form.constraints.split('\n').filter(Boolean),
      platforms: form.platforms.split(',').map((p) => p.trim()).filter(Boolean),
    };

    try {
      const url = editId
        ? `/api/v1/admin/problems/${editId}`
        : '/api/v1/admin/problems';
      const method = editId ? 'PUT' : 'POST';
      const res = await authFetch(url, { method, body: JSON.stringify(body) });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const json = await res.json().catch(() => null);
        setError(json?.message || `操作失败 (${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {editId ? '编辑题目' : '新建题目'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 标题 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              标题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="如：两数之和"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            />
          </div>

          {/* 难度 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">难度</label>
            <select
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value as Difficulty })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            >
              {DIFFICULTY_OPTIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* 标签 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              算法标签（逗号分隔）
            </label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="如：数组, 哈希表, 双指针"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            />
          </div>

          {/* 描述 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">题目描述</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="题目描述内容..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            />
          </div>

          {/* 约束条件 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              约束条件（每行一条）
            </label>
            <textarea
              value={form.constraints}
              onChange={(e) => setForm({ ...form, constraints: e.target.value })}
              rows={2}
              placeholder={'1 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            />
          </div>

          {/* 平台 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              来源平台（逗号分隔）
            </label>
            <input
              type="text"
              value={form.platforms}
              onChange={(e) => setForm({ ...form, platforms: e.target.value })}
              placeholder="如：LEETCODE_GLOBAL, CODEFORCES"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            />
            <p className="mt-1 text-xs text-gray-400">
              可选：{PLATFORM_OPTIONS.join(', ')}
            </p>
          </div>

          {/* 错误提示 */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

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
              disabled={submitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? '提交中...' : editId ? '保存修改' : '创建题目'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============ 弹窗组件：批量导入 ============

interface ImportModalProps {
  /** 是否显示 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 导入成功回调 */
  onSuccess: () => void;
}

function ImportModal({ open, onClose, onSuccess }: ImportModalProps) {
  const [mode, setMode] = useState<ImportMode>('skip');
  const [jsonText, setJsonText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<ImportResultItem[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 重置状态
  useEffect(() => {
    if (open) {
      setJsonText('');
      setError('');
      setResults(null);
    }
  }, [open]);

  /** 文件上传处理 */
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setError('请选择 .json 格式文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setJsonText(text);
      setError('');
    };
    reader.onerror = () => setError('文件读取失败');
    reader.readAsText(file);
  }

  /** 校验 JSON 格式 */
  function validateJson(text: string): boolean {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        setError('JSON 必须是数组格式，如 [{"title": "...", "difficulty": "EASY", ...}]');
        return false;
      }
      if (parsed.length === 0) {
        setError('数组不能为空');
        return false;
      }
      return true;
    } catch {
      setError('JSON 解析失败，请检查格式');
      return false;
    }
  }

  /** 提交导入 */
  async function handleImport() {
    if (!jsonText.trim()) {
      setError('请粘贴 JSON 内容或上传文件');
      return;
    }
    if (!validateJson(jsonText)) return;

    setSubmitting(true);
    setError('');
    setResults(null);

    try {
      const res = await authFetch('/api/v1/admin/problems/batch-import', {
        method: 'POST',
        body: JSON.stringify({
          mode,
          problems: JSON.parse(jsonText),
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const importResults = json.data as ImportResultItem[] | undefined;
        setResults(importResults || []);
        onSuccess();
      } else {
        const json = await res.json().catch(() => null);
        setError(json?.message || `导入失败 (${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          批量导入题目
        </h2>

        {/* 导入模式选择 */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            冲突处理模式
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="importMode"
                value="skip"
                checked={mode === 'skip'}
                onChange={() => setMode('skip')}
                className="text-blue-600"
              />
              <span>跳过已存在</span>
              <span className="text-xs text-gray-400">（同名题目不覆盖）</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="importMode"
                value="update"
                checked={mode === 'update'}
                onChange={() => setMode('update')}
                className="text-blue-600"
              />
              <span>更新已存在</span>
              <span className="text-xs text-gray-400">（同名题目覆盖更新）</span>
            </label>
          </div>
        </div>

        {/* 文件上传 */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            上传 JSON 文件
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              选择文件
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <span className="text-xs text-gray-400">或在下方直接粘贴 JSON</span>
          </div>
        </div>

        {/* JSON 输入区域 */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            JSON 内容
          </label>
          <textarea
            value={jsonText}
            onChange={(e) => { setJsonText(e.target.value); setError(''); }}
            rows={10}
            placeholder={'[\n  {\n    "title": "两数之和",\n    "difficulty": "EASY",\n    "tags": ["数组", "哈希表"],\n    "description": "给定一个整数数组...",\n    "constraints": ["2 <= nums.length <= 10^4"]\n  }\n]'}
            className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          />
        </div>

        {/* 错误提示 */}
        {error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* 导入结果展示 */}
        {results && (
          <div className="mb-4 rounded-md border border-gray-200 p-4 dark:border-gray-700">
            <h4 className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              导入结果
            </h4>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {results.map((r, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <span
                    className={
                      r.status === 'created' ? 'text-green-600' :
                      r.status === 'updated' ? 'text-blue-600' :
                      r.status === 'skipped' ? 'text-gray-400' :
                      'text-red-600'
                    }
                  >
                    {r.status === 'created' && '✓ 新建'}
                    {r.status === 'updated' && '↻ 更新'}
                    {r.status === 'skipped' && '⊘ 跳过'}
                    {r.status === 'error' && '✗ 失败'}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">{r.title}</span>
                  {r.message && <span className="text-gray-400">({r.message})</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            关闭
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={submitting || !jsonText.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? '导入中...' : '开始导入'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ Mock 数据 ============

const MOCK_PROBLEMS: ProblemItem[] = [
  { id: 'p-1', title: '两数之和', difficulty: 'EASY', tags: ['数组', '哈希表'], status: 'generated', platforms: ['LEETCODE_GLOBAL'] },
  { id: 'p-2', title: '两数相加', difficulty: 'MEDIUM', tags: ['链表', '数学'], status: 'generated', platforms: ['LEETCODE_GLOBAL', 'LEETCODE_CN'] },
  { id: 'p-3', title: '无重复字符的最长子串', difficulty: 'MEDIUM', tags: ['哈希表', '字符串', '滑动窗口'], status: 'not_generated', platforms: ['LEETCODE_GLOBAL'] },
  { id: 'p-4', title: '寻找两个正序数组的中位数', difficulty: 'HARD', tags: ['数组', '二分查找'], status: 'generated', platforms: ['LEETCODE_GLOBAL'] },
  { id: 'p-5', title: '最长回文子串', difficulty: 'MEDIUM', tags: ['字符串', '动态规划'], status: 'not_generated', platforms: ['LEETCODE_CN'] },
];

// ============ 主页面组件 ============

export default function AdminProblemsPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const [hydrated, setHydrated] = useState(false);

  // 等待客户端 hydrate 完成后再做权限判断，避免 SSG 预渲染时访问 location
  useEffect(() => {
    setHydrated(true);
  }, []);

  // 搜索与筛选状态
  const [keyword, setKeyword] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_OPTIONS[number]>('all');
  const [page, setPage] = useState(0);

  // 弹窗状态
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<ProblemFormData | undefined>(undefined);

  // 权限校验
  const isAdmin = isAuthenticated && user?.role === 'ADMIN';

  // 构建查询参数
  const queryParams = new URLSearchParams();
  if (keyword) queryParams.set('keyword', keyword);
  if (platformFilter) queryParams.set('platform', platformFilter);
  if (statusFilter !== 'all') queryParams.set('status', statusFilter);
  queryParams.set('page', String(page));
  queryParams.set('size', '20');

  const apiPath = `/api/v1/admin/problems?${queryParams.toString()}`;

  // 获取题目列表
  const { data, isLoading } = useSWR<ProblemPage>(
    isAdmin ? apiPath : null,
    fetcher,
    {
      onError: () => {},
      fallbackData: {
        content: MOCK_PROBLEMS,
        totalElements: MOCK_PROBLEMS.length,
        totalPages: 1,
      },
    }
  );

  /** 打开新建弹窗 */
  function handleCreate() {
    setEditId(null);
    setEditData(undefined);
    setFormOpen(true);
  }

  /** 打开编辑弹窗 */
  function handleEdit(item: ProblemItem) {
    setEditId(item.id);
    setEditData({
      title: item.title,
      difficulty: item.difficulty,
      tags: item.tags.join(', '),
      description: '',
      constraints: '',
      platforms: item.platforms.join(', '),
    });
    setFormOpen(true);
  }

  /** 删除题目 */
  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`确定删除「${title}」？此操作不可恢复。`)) return;
    try {
      const res = await authFetch(`/api/v1/admin/problems/${id}`, { method: 'DELETE' });
      if (res.ok) {
        mutate(apiPath);
      }
    } catch {
      // 静默处理
    }
  }

  /** 表单提交成功后刷新列表 */
  function handleFormSuccess() {
    mutate(apiPath);
  }

  // hydrate 未完成前显示加载态，避免 SSG 预渲染时访问 location
  if (!hydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  // 未登录 → 跳转登录页
  if (!isAuthenticated) {
    router.push('/auth/login');
    return null;
  }

  // 非 ADMIN 角色 → 无权限提示
  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-4xl">🚫</p>
          <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">无权限访问</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400">此页面仅管理员可访问</p>
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

  const items = data?.content ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalElements = data?.totalElements ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* 页面标题与操作栏 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">题目管理</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            共 {totalElements} 道题目
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setImportOpen(true)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            📥 批量导入
          </button>
          <button
            onClick={handleCreate}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            ＋ 新建题目
          </button>
        </div>
      </div>

      {/* 搜索与筛选栏 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* 关键词搜索 */}
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(0); }}
            placeholder="搜索题目标题..."
            className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        </div>

        {/* 平台筛选 */}
        <select
          value={platformFilter}
          onChange={(e) => { setPlatformFilter(e.target.value); setPage(0); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
        >
          <option value="">全部平台</option>
          {PLATFORM_OPTIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* 状态筛选 */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as typeof STATUS_OPTIONS[number]); setPage(0); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
          ))}
        </select>
      </div>

      {/* 加载态 */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse rounded border border-gray-200 p-4 dark:border-gray-700">
              <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      )}

      {/* 列表表格 */}
      {!isLoading && items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  标题
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  难度
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  标签
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  平台
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  状态
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  操作
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {item.title}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${DIFFICULTY_COLORS[item.difficulty]}`}>
                      {item.difficulty}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {safeArray(item.tags).slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                        >
                          {tag}
                        </span>
                      ))}
                      {safeArray(item.tags).length > 3 && (
                        <span className="text-xs text-gray-400">+{safeArray(item.tags).length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {safeArray(item.platforms).join(', ')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {item.status === 'generated' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <span className="h-2 w-2 rounded-full bg-green-500" />已生成
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />未生成
                      </span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, item.title)}
                        className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && items.length === 0 && (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="text-center">
            <p className="text-4xl">📋</p>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">暂无题目</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              点击「新建题目」或「批量导入」添加题目
            </p>
          </div>
        </div>
      )}

      {/* 分页控件 */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            第 {page + 1} / {totalPages} 页
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              上一页
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* 弹窗挂载 */}
      <ProblemFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={handleFormSuccess}
        editId={editId}
        initialData={editData}
      />
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
