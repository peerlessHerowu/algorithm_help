'use client';

/**
 * LoginGuideModal - 登录引导弹窗
 *
 * 职责：
 * - 未登录用户触发需要登录的操作时弹出引导
 * - 展示操作说明（如"登录后即可点赞"）+ 登录按钮 + 关闭按钮
 * - 支持 intent 参数，登录成功后自动执行原操作（sessionStorage 恢复）
 * - 全局复用：点赞/踩/生成/纠错 统一调用
 *
 * 满足需求 26.1-26.4
 */

import { useCallback, useEffect, useRef } from 'react';

/** 操作意图类型 */
export type LoginIntent = 'upvote' | 'downvote' | 'generate' | 'feedback';

/** sessionStorage 中存储的 intent 数据 */
export interface StoredIntent {
  intent: LoginIntent;
  /** 关联的 enrichedId（投票/纠错时需要） */
  targetId?: string;
  /** 记录时间戳（超时清理用） */
  timestamp: number;
}

/** sessionStorage key */
const INTENT_STORAGE_KEY = 'algorithm-help:login-intent';

/** intent 超时时间（5 分钟） */
const INTENT_TTL_MS = 5 * 60 * 1000;

/** intent 对应的中文提示消息 */
const INTENT_MESSAGES: Record<LoginIntent, string> = {
  upvote: '登录后即可点赞',
  downvote: '登录后即可点踩',
  generate: '登录后即可使用 AI 生成',
  feedback: '登录后即可提交纠错反馈',
};

/** intent 对应的图标 */
const INTENT_ICONS: Record<LoginIntent, string> = {
  upvote: '👍',
  downvote: '👎',
  generate: '✨',
  feedback: '🐛',
};

interface LoginGuideModalProps {
  /** 弹窗是否可见 */
  isOpen: boolean;
  /** 操作意图 */
  intent: LoginIntent;
  /** 自定义提示消息（不传则使用默认） */
  message?: string;
  /** 关联目标 ID（投票/纠错时传入 enrichedId） */
  targetId?: string;
  /** 点击登录按钮回调 */
  onLogin: () => void;
  /** 关闭弹窗回调 */
  onClose: () => void;
}

export default function LoginGuideModal({
  isOpen,
  intent,
  message,
  targetId,
  onLogin,
  onClose,
}: LoginGuideModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const lastFocusRef = useRef<HTMLButtonElement>(null);

  const displayMessage = message || INTENT_MESSAGES[intent];
  const icon = INTENT_ICONS[intent];

  /** 记录 intent 到 sessionStorage 并触发登录 */
  const handleLogin = useCallback(() => {
    saveIntent(intent, targetId);
    onLogin();
  }, [intent, targetId, onLogin]);

  /** Escape 关闭 */
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  /** Focus trap：Tab 循环在弹窗内部 */
  useEffect(() => {
    if (!isOpen) return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const first = firstFocusRef.current;
      const last = lastFocusRef.current;
      if (!first || !last) return;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  /** 打开时自动聚焦登录按钮 */
  useEffect(() => {
    if (isOpen) {
      firstFocusRef.current?.focus();
    }
  }, [isOpen]);

  /** 点击遮罩关闭 */
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50
        backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-guide-title"
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl bg-white p-6
          shadow-xl dark:bg-gray-800 animate-scale-in"
      >
        {/* 关闭按钮 */}
        <button
          ref={lastFocusRef}
          type="button"
          onClick={onClose}
          aria-label="关闭弹窗"
          className="absolute right-3 top-3 rounded-full p-1.5
            text-gray-400 hover:bg-gray-100 hover:text-gray-600
            dark:hover:bg-gray-700 dark:hover:text-gray-300
            transition-colors"
        >
          <CloseIcon />
        </button>

        {/* 图标 */}
        <div className="mb-4 flex justify-center">
          <span className="text-4xl" role="img" aria-hidden="true">
            {icon}
          </span>
        </div>

        {/* 标题 */}
        <h2
          id="login-guide-title"
          className="mb-2 text-center text-lg font-semibold text-gray-800
            dark:text-gray-100"
        >
          需要登录
        </h2>

        {/* 操作说明 */}
        <p className="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">
          {displayMessage}
        </p>

        {/* 按钮组 */}
        <div className="flex flex-col gap-3">
          {/* 登录按钮 */}
          <button
            ref={firstFocusRef}
            type="button"
            onClick={handleLogin}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium
              text-white shadow-sm hover:bg-blue-700
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
              focus-visible:ring-offset-2
              dark:bg-blue-500 dark:hover:bg-blue-600
              dark:focus-visible:ring-offset-gray-800
              transition-colors duration-150"
          >
            去登录
          </button>

          {/* 取消按钮 */}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-gray-200 py-2.5 text-sm
              font-medium text-gray-600 hover:bg-gray-50
              focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300
              focus-visible:ring-offset-2
              dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700
              dark:focus-visible:ring-offset-gray-800
              transition-colors duration-150"
          >
            暂不登录
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 工具函数：Intent 持久化 ============

/** 保存 intent 到 sessionStorage */
export function saveIntent(intent: LoginIntent, targetId?: string): void {
  try {
    const data: StoredIntent = {
      intent,
      targetId,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(INTENT_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage 不可用时静默失败
  }
}

/** 读取并消费 intent（读取后自动清除） */
export function consumeIntent(): StoredIntent | null {
  try {
    const raw = sessionStorage.getItem(INTENT_STORAGE_KEY);
    if (!raw) return null;

    const data: StoredIntent = JSON.parse(raw);
    // 超时检查
    if (Date.now() - data.timestamp > INTENT_TTL_MS) {
      sessionStorage.removeItem(INTENT_STORAGE_KEY);
      return null;
    }

    // 消费后清除
    sessionStorage.removeItem(INTENT_STORAGE_KEY);
    return data;
  } catch {
    sessionStorage.removeItem(INTENT_STORAGE_KEY);
    return null;
  }
}

/** 清除 intent（取消登录时调用） */
export function clearIntent(): void {
  try {
    sessionStorage.removeItem(INTENT_STORAGE_KEY);
  } catch {
    // 静默失败
  }
}

// ============ 内部图标组件 ============

function CloseIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
