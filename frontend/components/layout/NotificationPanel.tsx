'use client';

import Link from 'next/link';
import type { Notification, NotificationType } from '@/lib/types';

/**
 * 通知面板组件 Props
 */
interface NotificationPanelProps {
  /** 通知列表 */
  notifications: Notification[];
  /** 未读数量 */
  unreadCount: number;
  /** 标记全部已读回调 */
  onMarkAllRead: () => void;
  /** 单条点击回调 */
  onNotificationClick?: (notification: Notification) => void;
  /** 关闭面板回调 */
  onClose: () => void;
  /** 扩展 className */
  className?: string;
}

// ============ 通知类型配色映射 ============

/** 通知类型对应的颜色配置 */
const NOTIFICATION_COLORS: Record<NotificationType, {
  dot: string;
  border: string;
  label: string;
  text: string;
}> = {
  GENERATION_COMPLETE: {
    dot: 'bg-green-500',
    border: 'border-l-green-500',
    label: '生成完成',
    text: 'text-green-600 dark:text-green-400',
  },
  REVIEW_REMINDER: {
    dot: 'bg-blue-500',
    border: 'border-l-blue-500',
    label: '复习提醒',
    text: 'text-blue-600 dark:text-blue-400',
  },
  COMMENT_REPLY: {
    dot: 'bg-purple-500',
    border: 'border-l-purple-500',
    label: '评论回复',
    text: 'text-purple-600 dark:text-purple-400',
  },
  SYSTEM_ANNOUNCEMENT: {
    dot: 'bg-gray-500',
    border: 'border-l-gray-500',
    label: '系统公告',
    text: 'text-gray-600 dark:text-gray-400',
  },
};

// ============ 辅助函数 ============

/** 格式化时间距今 */
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  return '刚刚';
}

// ============ 通知列表项 ============

interface NotificationItemProps {
  notification: Notification;
  onClick?: (notification: Notification) => void;
}

/** 单条通知展示 */
function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const colors = NOTIFICATION_COLORS[notification.type];

  return (
    <button
      onClick={() => onClick?.(notification)}
      className={`w-full border-l-4 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
        notification.read
          ? 'border-l-transparent bg-white dark:bg-gray-900'
          : `${colors.border} bg-blue-50/50 dark:bg-blue-950/20`
      }`}
    >
      <div className="flex items-start gap-3">
        {/* 类型圆点 */}
        <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${colors.dot}`} />
        <div className="min-w-0 flex-1">
          {/* 类型标签 + 时间 */}
          <div className="flex items-center justify-between gap-2">
            <span className={`text-xs font-medium ${colors.text}`}>
              {colors.label}
            </span>
            <span className="flex-shrink-0 text-xs text-gray-400">
              {formatTimeAgo(notification.createdAt)}
            </span>
          </div>
          {/* 标题 */}
          <p className={`mt-0.5 text-sm ${
            notification.read
              ? 'text-gray-600 dark:text-gray-400'
              : 'font-medium text-gray-900 dark:text-gray-100'
          }`}>
            {notification.title}
          </p>
          {/* 内容摘要 */}
          {notification.content && (
            <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-500">
              {notification.content}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// ============ 主面板 ============

/**
 * 通知面板组件
 * - 顶部标题栏 + "全部标记已读"按钮
 * - 通知列表（按类型颜色区分、已读/未读状态区分）
 * - 底部"查看全部通知"链接
 */
export default function NotificationPanel({
  notifications,
  unreadCount,
  onMarkAllRead,
  onNotificationClick,
  onClose,
  className = '',
}: NotificationPanelProps) {
  return (
    <div
      className={`absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 sm:w-96 ${className}`}
    >
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          通知 {unreadCount > 0 && (
            <span className="ml-1 text-xs font-normal text-gray-500">
              ({unreadCount} 条未读)
            </span>
          )}
        </h3>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            全部标记已读
          </button>
        )}
      </div>

      {/* 通知列表 */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length > 0 ? (
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={onNotificationClick}
              />
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              暂无通知
            </p>
          </div>
        )}
      </div>

      {/* 底部查看全部链接 */}
      <div className="border-t border-gray-100 dark:border-gray-800">
        <Link
          href="/notifications"
          onClick={onClose}
          className="block px-4 py-2.5 text-center text-xs text-primary-600 hover:bg-gray-50 dark:text-primary-400 dark:hover:bg-gray-800"
        >
          查看全部通知 →
        </Link>
      </div>
    </div>
  );
}
