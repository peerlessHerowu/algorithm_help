'use client';

/**
 * RateLimitCountdown — 频率超限倒计时提示组件
 *
 * 展示 "已达上限(5/5次)，约 X 分钟后可再次使用"
 * localStorage 持久化 endTime，刷新页面后恢复倒计时。
 *
 * 满足需求 8.3, 8.9
 */

import { useCallback, useEffect, useState } from 'react';
import {
  loadRateLimitEndTime,
  clearRateLimitEndTime,
  persistRateLimitEndTime,
} from '@/hooks/useEnrichmentError';
import type { RateLimitPersistence } from '@/lib/enriched-types';

// ============ Props ============

export interface RateLimitCountdownProps {
  /** 直接传入的倒计时信息（从 API 错误中解析） */
  initial?: {
    seconds: number;
    usedCount: number;
    maxCount: number;
  };
  /** 倒计时结束回调 */
  onExpired?: () => void;
  /** 自定义 className */
  className?: string;
}

// ============ 组件实现 ============

export default function RateLimitCountdown({
  initial,
  onExpired,
  className = '',
}: RateLimitCountdownProps) {
  const [data, setData] = useState<RateLimitPersistence | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // 初始化：优先使用 props.initial，否则从 localStorage 恢复
  useEffect(() => {
    if (initial) {
      const endTime = Date.now() + initial.seconds * 1000;
      const persistence: RateLimitPersistence = {
        endTime,
        usedCount: initial.usedCount,
        maxCount: initial.maxCount,
      };
      persistRateLimitEndTime(persistence);
      setData(persistence);
      setRemainingSeconds(initial.seconds);
    } else {
      const stored = loadRateLimitEndTime();
      if (stored) {
        const remaining = Math.ceil((stored.endTime - Date.now()) / 1000);
        setData(stored);
        setRemainingSeconds(Math.max(0, remaining));
      }
    }
  }, [initial]);

  // 倒计时逻辑
  useEffect(() => {
    if (remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(timer);
          clearRateLimitEndTime();
          onExpired?.();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSeconds > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // 没有活跃倒计时时不渲染
  if (!data || remainingSeconds <= 0) return null;

  const minutes = Math.ceil(remainingSeconds / 60);

  return (
    <div
      className={`
        flex items-center gap-2 px-4 py-3 rounded-lg
        bg-amber-50 dark:bg-amber-900/20
        border border-amber-200 dark:border-amber-700/50
        text-amber-800 dark:text-amber-200
        text-sm
        ${className}
      `}
      role="alert"
      aria-live="polite"
    >
      <ClockIcon />
      <span>
        已达上限({data.usedCount}/{data.maxCount}次)，约{' '}
        <strong>{minutes}</strong> 分钟后可再次使用
      </span>
    </div>
  );
}

// ============ 内部组件 ============

function ClockIcon() {
  return (
    <svg
      className="w-4 h-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
