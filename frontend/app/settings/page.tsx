'use client';

import { useAppStore } from '@/store';
import { useTheme, type Theme } from '@/hooks/useTheme';
import { userApi } from '@/lib/api';
import { useState, useCallback } from 'react';
import type { NotificationPreferences } from '@/lib/types';

const LEVELS = [1, 2, 3, 4, 5] as const;
const LANGUAGES = ['python', 'java', 'go', 'cpp'] as const;
const LANGUAGE_LABELS: Record<string, string> = {
  python: 'Python',
  java: 'Java',
  go: 'Go',
  cpp: 'C++',
};
const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: '亮色' },
  { value: 'dark', label: '暗色' },
  { value: 'system', label: '跟随系统' },
];

/** 通知设置项定义 */
const NOTIFICATION_ITEMS: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
}[] = [
  { key: 'generationComplete', label: '生成完成', description: '内容生成完毕时通知我' },
  { key: 'reviewReminder', label: '复习提醒', description: '到达复习时间时提醒我' },
  { key: 'systemAnnouncement', label: '系统公告', description: '平台重要更新和公告' },
  { key: 'marquee', label: '全服飘屏', description: '全局飘屏消息展示' },
];

/**
 * 设置页面
 * - 默认解析级别选择（L1-L5 单选）
 * - 默认代码语言选择（Python/Java/Go/C++ 单选）
 * - 主题偏好切换（亮色/暗色/跟随系统）
 * - 通知设置（生成/复习/公告/飘屏 独立开关）
 * - 数据导出（下载 JSON）
 * - 学习水平自测入口
 * - 危险区域：删除账户（二次确认弹窗）
 */
export default function SettingsPage() {
  const currentLevel = useAppStore((s) => s.currentLevel);
  const setLevel = useAppStore((s) => s.setLevel);
  const preferredLanguage = useAppStore((s) => s.preferredLanguage);
  const setPreferredLanguage = useAppStore((s) => s.setPreferredLanguage);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const logout = useAppStore((s) => s.logout);
  const { theme, setTheme } = useTheme();

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 通知偏好状态
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    generationComplete: true,
    reviewReminder: true,
    systemAnnouncement: true,
    marquee: false,
  });

  // 数据导出状态
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // 删除账户确认弹窗状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /** 切换单个通知开关 */
  const toggleNotification = useCallback(
    async (key: keyof NotificationPreferences) => {
      const updated = { ...notificationPrefs, [key]: !notificationPrefs[key] };
      setNotificationPrefs(updated);
      if (isAuthenticated) {
        try {
          await userApi.updateNotificationPreferences({ [key]: updated[key] });
        } catch {
          // 回滚本地状态
          setNotificationPrefs(notificationPrefs);
        }
      }
    },
    [notificationPrefs, isAuthenticated]
  );

  /** 保存偏好设置 */
  const handleSave = useCallback(async () => {
    if (!isAuthenticated) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await userApi.updatePreferences({
        defaultLevel: currentLevel,
        defaultLanguage: preferredLanguage,
        theme,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '保存失败，请重试';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }, [isAuthenticated, currentLevel, preferredLanguage, theme]);

  /** 导出学习数据 */
  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportError(null);
    try {
      const { downloadUrl } = await userApi.exportData();
      // 创建隐藏链接触发下载
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'my-learning-data.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '导出失败，请重试';
      setExportError(message);
    } finally {
      setExporting(false);
    }
  }, []);

  /** 删除账户 */
  const handleDeleteAccount = useCallback(async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await userApi.deleteAccount();
      // 清除本地数据并退出登录
      localStorage.clear();
      logout();
      // 跳转首页
      window.location.href = '/';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '删除失败，请重试';
      setDeleteError(message);
    } finally {
      setDeleting(false);
    }
  }, [logout]);

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-16">
      <h1 className="text-2xl font-bold">设置</h1>

      {/* 默认解析级别 */}
      <section className="rounded-lg border border-gray-200 p-6 dark:border-gray-700">
        <h2 className="mb-1 text-lg font-semibold">默认解析级别</h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          选择查看题目解析时的默认深度级别
        </p>
        <div className="flex gap-3">
          {LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => setLevel(level)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                currentLevel === level
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              L{level}
            </button>
          ))}
        </div>
      </section>

      {/* 默认代码语言 */}
      <section className="rounded-lg border border-gray-200 p-6 dark:border-gray-700">
        <h2 className="mb-1 text-lg font-semibold">默认代码语言</h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          查看解法代码时优先展示的编程语言
        </p>
        <div className="flex flex-wrap gap-3">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              onClick={() => setPreferredLanguage(lang)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                preferredLanguage === lang
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {LANGUAGE_LABELS[lang] || lang}
            </button>
          ))}
        </div>
      </section>

      {/* 主题偏好 */}
      <section className="rounded-lg border border-gray-200 p-6 dark:border-gray-700">
        <h2 className="mb-1 text-lg font-semibold">主题偏好</h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          选择界面的显示主题
        </p>
        <div className="flex gap-3">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                theme === opt.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* 保存按钮 + 状态反馈 */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? '保存中...' : '保存设置'}
        </button>
        {saveSuccess && (
          <span className="text-sm text-green-600 dark:text-green-400">✓ 保存成功</span>
        )}
        {saveError && (
          <span className="text-sm text-red-600 dark:text-red-400">{saveError}</span>
        )}
        {!isAuthenticated && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            未登录，设置仅保存在本地
          </span>
        )}
      </div>

      {/* 🔔 通知设置 */}
      <section className="rounded-lg border border-gray-200 p-6 dark:border-gray-700">
        <h2 className="mb-1 text-lg font-semibold">🔔 通知设置</h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          按类型控制接收哪些通知
        </p>
        <div className="space-y-4">
          {NOTIFICATION_ITEMS.map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {item.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {item.description}
                </p>
              </div>
              <button
                onClick={() => toggleNotification(item.key)}
                role="switch"
                aria-checked={notificationPrefs[item.key]}
                aria-label={`${item.label}通知开关`}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                  notificationPrefs[item.key]
                    ? 'bg-primary-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    notificationPrefs[item.key] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 📥 数据管理 */}
      <section className="rounded-lg border border-gray-200 p-6 dark:border-gray-700">
        <h2 className="mb-1 text-lg font-semibold">📥 数据管理</h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          导出你的学习数据（收藏、进度、复习记录）
        </p>
        <button
          onClick={handleExport}
          disabled={exporting || !isAuthenticated}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {exporting ? '导出中...' : '导出我的学习数据'}
        </button>
        {!isAuthenticated && (
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            请先登录后再导出数据
          </p>
        )}
        {exportError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{exportError}</p>
        )}
      </section>

      {/* 🎯 学习水平自测 */}
      <section className="rounded-lg border border-gray-200 p-6 dark:border-gray-700">
        <h2 className="mb-1 text-lg font-semibold">🎯 学习水平自测</h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          通过 5 道快速判断题评估你的算法水平，自动推荐默认解析级别
        </p>
        <a
          href="/training/level-test"
          className="inline-flex items-center gap-2 rounded-lg border border-primary-300 px-4 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-50 dark:border-primary-700 dark:text-primary-400 dark:hover:bg-primary-900/20"
        >
          开始自测
          <span aria-hidden="true">→</span>
        </a>
      </section>

      {/* ⚠️ 危险区域 */}
      <section className="rounded-lg border border-red-200 p-6 dark:border-red-900">
        <h2 className="mb-1 text-lg font-semibold text-red-700 dark:text-red-400">
          ⚠️ 危险区域
        </h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          以下操作不可逆，请谨慎操作
        </p>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={!isAuthenticated}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          删除我的账户
        </button>
        {!isAuthenticated && (
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            请先登录后操作
          </p>
        )}
      </section>

      {/* 删除账户二次确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 遮罩层 */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDeleteConfirm(false)}
          />
          {/* 弹窗内容 */}
          <div className="relative z-10 mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
              确认删除账户？
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              删除后 30 天内可联系客服恢复。超过 30 天后，你的所有数据（收藏、学习记录、复习进度）将被永久删除，无法找回。
            </p>
            {deleteError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{deleteError}</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                取消
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
