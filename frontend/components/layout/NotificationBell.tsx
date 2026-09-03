'use client';

import { useState, useRef, useEffect } from 'react';
import NotificationPanel from './NotificationPanel';
import type { Notification } from '@/lib/types';

/**
 * 通知铃铛组件 Props
 */
interface NotificationBellProps {
  /** 通知列表 */
  notifications: Notification[];
  /** 未读数量 */
  unreadCount: number;
  /** 标记全部已读回调 */
  onMarkAllRead: () => void;
  /** 单条点击回调 */
  onNotificationClick?: (notification: Notification) => void;
  /** 扩展 className */
  className?: string;
}

/** 铃铛图标 SVG */
function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

/**
 * 通知铃铛组件
 * - 铃铛图标 + 未读数量红色徽章
 * - 点击展开/收起通知面板
 * - 点击外部区域自动关闭面板
 */
export default function NotificationBell({
  notifications,
  unreadCount,
  onMarkAllRead,
  onNotificationClick,
  className = '',
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭面板
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* 铃铛按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        aria-label="通知"
      >
        <BellIcon />
        {/* 未读数量徽章 */}
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 通知面板（下拉） */}
      {isOpen && (
        <NotificationPanel
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllRead={onMarkAllRead}
          onNotificationClick={(notification) => {
            onNotificationClick?.(notification);
            setIsOpen(false);
          }}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
