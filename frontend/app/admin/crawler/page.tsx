'use client';

/**
 * 采集管理页面
 * 功能：平台状态总览、触发采集任务、任务列表（进度/完成/失败+重试）
 * Requirements: 33.1-33.3
 */

import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { authFetch } from '@/lib/authFetcher';
import { fetcher } from '@/lib/fetcher';
import ProgressBar from '@/components/common/ProgressBar';

// ==================== 类型定义 ====================

/** 平台选项 */
const PLATFORMS = [
  'LEETCODE_GLOBAL',
  'LEETCODE_CN',
  'CODEFORCES',
  'NOWCODER',
  'ATCODER',
] as const;

type Platform = (typeof PLATFORMS)[number];

/** 任务类型选项 */
const TASK_TYPES = [
  { value: 'PROBLEM_SYNC', label: '题目同步' },
  { value: 'SOLUTION_SYNC', label: '题解采集' },
  { value: 'SINGLE_PROBLEM', label: '单题采集' },
] as const;

type TaskType = (typeof TASK_TYPES)[number]['value'];

/** 平台状态 */
interface PlatformStatus {
  platform: Platform;
  status: 'NORMAL' | 'CIRCUIT_BROKEN' | 'RATE_LIMITED';
  problemCount: number;
  lastSyncAt: number | null;
}

/** 采集任务 */
interface CrawlerTask {
  id: string;
  platform: Platform;
  taskType: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  currentStep: string;
  createdAt: number;
  completedAt: number | null;
  errorMessage: string | null;
}

/** 触发采集请求体 */
interface TriggerCrawlRequest {
  platform: Platform;
  taskType: TaskType;
  problemId?: string;
}

// ==================== 常量映射 ====================

/** 平台显示名称映射 */
const PLATFORM_LABELS: Record<Platform, string> = {
  LEETCODE_GLOBAL: 'LeetCode',
  LEETCODE_CN: '力扣',
  CODEFORCES: 'Codeforces',
  NOWCODER: '牛客',
  ATCODER: 'AtCoder',
};

/** 状态图标和颜色映射 */
const STATUS_CONFIG: Record<PlatformStatus['status'], { icon: string; color: string; label: string }> = {
  NORMAL: { icon: '🟢', color: 'border-green-200 dark:border-green-800', label: '正常' },
  CIRCUIT_BROKEN: { icon: '🔴', color: 'border-red-200 dark:border-red-800', label: '已熔断' },
  RATE_LIMITED: { icon: '⚠️', color: 'border-yellow-200 dark:border-yellow-800', label: '限速' },
};

/** 任务类型标签映射 */
const TASK_TYPE_LABELS: Record<string, string> = {
  PROBLEM_SYNC: '题目同步',
  SOLUTION_SYNC: '题解采集',
  SINGLE_PROBLEM: '单题采集',
};

// ==================== 平台状态卡片组件 ====================

interface PlatformStatusCardProps {
  data: PlatformStatus;
  className?: string;
}

/** 单个平台状态卡片 */
function PlatformStatusCard({ data, className = '' }: PlatformStatusCardProps) {
  const config = STATUS_CONFIG[data.status];
  const lastSync = data.lastSyncAt
    ? new Date(data.lastSyncAt).toLocaleString('zh-CN')
    : '从未同步';

  return (
    <div className={`rounded-lg border-2 p-4 ${config.color} ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {PLATFORM_LABELS[data.platform]}
        </span>
        <span className="text-lg" title={config.label}>{config.icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {data.problemCount.toLocaleString()}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">题目数量</p>
      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
        上次同步：{lastSync}
      </p>
    </div>
  );
}

// ==================== 触发采集表单组件 ====================

interface TriggerFormProps {
  onSubmit: (data: TriggerCrawlRequest) => void;
  isSubmitting: boolean;
  className?: string;
}

/** 触发采集表单 */
function TriggerForm({ onSubmit, isSubmitting, className = '' }: TriggerFormProps) {
  const [platform, setPlatform] = useState<Platform>('LEETCODE_CN');
  const [taskType, setTaskType] = useState<TaskType>('PROBLEM_SYNC');
  const [problemId, setProblemId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const request: TriggerCrawlRequest = { platform, taskType };
    // 单题采集时需要填写题号
    if (taskType === 'SINGLE_PROBLEM' && problemId.trim()) {
      request.problemId = problemId.trim();
    }
    onSubmit(request);
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      {/* 平台选择 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          平台
        </label>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
            dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200
            focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
          ))}
        </select>
      </div>

      {/* 任务类型选择 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          采集类型
        </label>
        <select
          value={taskType}
          onChange={(e) => setTaskType(e.target.value as TaskType)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
            dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200
            focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {TASK_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* 单题采集时的题号输入 */}
      {taskType === 'SINGLE_PROBLEM' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            题号 / Slug
          </label>
          <input
            type="text"
            value={problemId}
            onChange={(e) => setProblemId(e.target.value)}
            placeholder="例如：two-sum 或 1"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
              dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200
              focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {/* 提交按钮 */}
      <button
        type="submit"
        disabled={isSubmitting || (taskType === 'SINGLE_PROBLEM' && !problemId.trim())}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white
          hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50
          transition-colors"
      >
        {isSubmitting ? '提交中...' : '🚀 触发采集'}
      </button>
    </form>
  );
}

// ==================== 任务状态标签组件 ====================

/** 任务状态标签 */
function TaskStatusBadge({ status }: { status: CrawlerTask['status'] }) {
  const styles: Record<CrawlerTask['status'], string> = {
    RUNNING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  const labels: Record<CrawlerTask['status'], string> = {
    RUNNING: '运行中',
    COMPLETED: '已完成',
    FAILED: '失败',
    CANCELLED: '已取消',
  };

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

// ==================== 单个任务条目组件 ====================

interface TaskItemProps {
  task: CrawlerTask;
  onRetry: () => void;
  onCancel: () => void;
}

/** 单个采集任务条目 */
function TaskItem({ task, onRetry, onCancel }: TaskItemProps) {
  const createdTime = new Date(task.createdAt).toLocaleString('zh-CN');
  const completedTime = task.completedAt
    ? new Date(task.completedAt).toLocaleString('zh-CN')
    : null;

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      {/* 头部：平台 + 类型 + 状态 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {PLATFORM_LABELS[task.platform]}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {TASK_TYPE_LABELS[task.taskType] || task.taskType}
          </span>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>

      {/* 运行中：进度条 */}
      {task.status === 'RUNNING' && (
        <div className="mt-3">
          <ProgressBar progress={task.progress} status={task.currentStep} />
        </div>
      )}

      {/* 失败：错误信息 */}
      {task.status === 'FAILED' && task.errorMessage && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          ❌ {task.errorMessage}
        </p>
      )}

      {/* 底部：时间 + 操作按钮 */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-gray-400 dark:text-gray-500">
          <span>创建：{createdTime}</span>
          {completedTime && <span className="ml-3">完成：{completedTime}</span>}
        </div>
        <div className="flex gap-2">
          {/* 运行中：取消按钮 */}
          {task.status === 'RUNNING' && (
            <button
              onClick={onCancel}
              className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100
                dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
            >
              取消
            </button>
          )}
          {/* 失败：重试按钮 */}
          {task.status === 'FAILED' && (
            <button
              onClick={onRetry}
              className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50
                dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
            >
              🔄 重试
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== 任务列表组件 ====================

interface TaskListProps {
  tasks: CrawlerTask[];
  onRetry: (taskId: string) => void;
  onCancel: (taskId: string) => void;
  className?: string;
}

/** 采集任务列表 */
function TaskList({ tasks, onRetry, onCancel, className = '' }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-gray-400 dark:text-gray-500">
        <span className="text-3xl mb-2">📭</span>
        <p className="text-sm">暂无采集任务记录</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onRetry={() => onRetry(task.id)}
          onCancel={() => onCancel(task.id)}
        />
      ))}
    </div>
  );
}

// ==================== 主页面组件 ====================

/** API 路径 */
const API_CRAWLER_STATUS = '/api/v1/admin/crawler/status';
const API_CRAWLER_TASKS = '/api/v1/admin/crawler/tasks';
const API_CRAWLER_TRIGGER = '/api/v1/admin/crawler/trigger';

export default function CrawlerManagementPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 获取平台状态
  const { data: platformStatuses } = useSWR<PlatformStatus[]>(
    API_CRAWLER_STATUS,
    fetcher,
    { refreshInterval: 30000, fallbackData: [] }
  );

  // 获取采集任务列表（运行中的任务自动刷新）
  const { data: tasks } = useSWR<CrawlerTask[]>(
    API_CRAWLER_TASKS,
    fetcher,
    { refreshInterval: 5000, fallbackData: [] }
  );

  /** 显示 Toast 提示 */
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  /** 触发采集任务 */
  const handleTrigger = useCallback(async (data: TriggerCrawlRequest) => {
    setIsSubmitting(true);
    try {
      const res = await authFetch(API_CRAWLER_TRIGGER, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        showToast(`触发失败：${body?.message || res.statusText}`);
        return;
      }
      showToast('✅ 采集任务已触发');
      // 刷新任务列表
      mutate(API_CRAWLER_TASKS);
    } catch {
      showToast('触发失败，请检查网络');
    } finally {
      setIsSubmitting(false);
    }
  }, [showToast]);

  /** 重试失败任务 */
  const handleRetry = useCallback(async (taskId: string) => {
    try {
      const res = await authFetch(`${API_CRAWLER_TASKS}/${taskId}/retry`, {
        method: 'POST',
      });
      if (!res.ok) {
        showToast('重试失败');
        return;
      }
      showToast('🔄 已重新触发');
      mutate(API_CRAWLER_TASKS);
    } catch {
      showToast('重试失败，请检查网络');
    }
  }, [showToast]);

  /** 取消运行中的任务 */
  const handleCancel = useCallback(async (taskId: string) => {
    try {
      const res = await authFetch(`${API_CRAWLER_TASKS}/${taskId}/cancel`, {
        method: 'POST',
      });
      if (!res.ok) {
        showToast('取消失败');
        return;
      }
      showToast('任务已取消');
      mutate(API_CRAWLER_TASKS);
    } catch {
      showToast('取消失败，请检查网络');
    }
  }, [showToast]);

  // 按状态分组任务
  const runningTasks = (tasks || []).filter((t) => t.status === 'RUNNING');
  const completedTasks = (tasks || []).filter((t) => t.status === 'COMPLETED');
  const failedTasks = (tasks || []).filter((t) => t.status === 'FAILED');
  const cancelledTasks = (tasks || []).filter((t) => t.status === 'CANCELLED');

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* 页面标题 */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        🕷️ 采集管理
      </h1>

      {/* 平台状态总览 */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          平台状态总览
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {(platformStatuses || []).map((ps) => (
            <PlatformStatusCard key={ps.platform} data={ps} />
          ))}
          {/* 无数据时展示占位 */}
          {(!platformStatuses || platformStatuses.length === 0) && (
            <p className="col-span-full text-sm text-gray-400 dark:text-gray-500">
              加载平台状态中...
            </p>
          )}
        </div>
      </section>

      {/* 主体区域：左侧触发表单 + 右侧任务列表 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左侧：触发采集表单 */}
        <section className="lg:col-span-1">
          <div className="rounded-lg border border-gray-200 p-5 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              触发采集
            </h2>
            <TriggerForm onSubmit={handleTrigger} isSubmitting={isSubmitting} />
          </div>
        </section>

        {/* 右侧：任务列表 */}
        <section className="lg:col-span-2">
          <div className="rounded-lg border border-gray-200 p-5 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              采集任务列表
              {runningTasks.length > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {runningTasks.length} 运行中
                </span>
              )}
            </h2>

            {/* 运行中任务 */}
            {runningTasks.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
                  ⏳ 运行中
                </h3>
                <TaskList
                  tasks={runningTasks}
                  onRetry={handleRetry}
                  onCancel={handleCancel}
                />
              </div>
            )}

            {/* 失败任务 */}
            {failedTasks.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                  ❌ 失败（可重试）
                </h3>
                <TaskList
                  tasks={failedTasks}
                  onRetry={handleRetry}
                  onCancel={handleCancel}
                />
              </div>
            )}

            {/* 已完成任务 */}
            {completedTasks.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">
                  ✅ 已完成
                </h3>
                <TaskList
                  tasks={completedTasks}
                  onRetry={handleRetry}
                  onCancel={handleCancel}
                />
              </div>
            )}

            {/* 已取消任务 */}
            {cancelledTasks.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  ⊘ 已取消
                </h3>
                <TaskList
                  tasks={cancelledTasks}
                  onRetry={handleRetry}
                  onCancel={handleCancel}
                />
              </div>
            )}

            {/* 全部为空时 */}
            {(tasks || []).length === 0 && (
              <div className="flex flex-col items-center py-8 text-gray-400 dark:text-gray-500">
                <span className="text-3xl mb-2">📭</span>
                <p className="text-sm">暂无采集任务记录</p>
                <p className="text-xs mt-1">使用左侧表单触发新的采集任务</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Toast 提示 */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-gray-100 dark:text-gray-900">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
