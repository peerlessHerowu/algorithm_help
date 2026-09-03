'use client';

/**
 * FeedbackModal - 纠错反馈弹窗
 *
 * 职责：
 * - 展开态操作栏"🐛 纠错"按钮触发
 * - 错误类型下拉选择 + 描述文本框
 * - 表单校验：描述 10-500 字
 * - 提交成功后 toast 提示
 * - 未登录时触发 LoginGuideModal（由父组件控制）
 *
 * 满足需求 22.1-22.4
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** 错误类型枚举 */
export type FeedbackErrorType =
  | 'CODE_ERROR'
  | 'LOGIC_ERROR'
  | 'UNCLEAR'
  | 'OUTDATED'
  | 'OTHER';

/** 错误类型中文标签 */
const ERROR_TYPE_LABELS: Record<FeedbackErrorType, string> = {
  CODE_ERROR: '代码错误',
  LOGIC_ERROR: '逻辑错误',
  UNCLEAR: '表述不清',
  OUTDATED: '内容过时',
  OTHER: '其他',
};

/** 提交数据结构 */
export interface FeedbackRequest {
  errorType: FeedbackErrorType;
  description: string;
}

/** 描述字数限制 */
const MIN_DESCRIPTION_LENGTH = 10;
const MAX_DESCRIPTION_LENGTH = 500;

interface FeedbackModalProps {
  /** 弹窗是否可见 */
  isOpen: boolean;
  /** 关联的 enriched solution ID */
  enrichedId: string;
  /** 提交回调（由父组件处理 API 调用） */
  onSubmit: (data: FeedbackRequest) => Promise<void>;
  /** 关闭弹窗回调 */
  onClose: () => void;
}

export default function FeedbackModal({
  isOpen,
  enrichedId,
  onSubmit,
  onClose,
}: FeedbackModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLSelectElement>(null);
  const lastFocusRef = useRef<HTMLButtonElement>(null);

  const [errorType, setErrorType] = useState<FeedbackErrorType>('CODE_ERROR');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  /** 校验描述文本 */
  const validate = useCallback((text: string): string => {
    const len = text.trim().length;
    if (len < MIN_DESCRIPTION_LENGTH) {
      return `描述至少 ${MIN_DESCRIPTION_LENGTH} 字（当前 ${len} 字）`;
    }
    if (len > MAX_DESCRIPTION_LENGTH) {
      return `描述不能超过 ${MAX_DESCRIPTION_LENGTH} 字（当前 ${len} 字）`;
    }
    return '';
  }, []);

  /** 提交处理 */
  const handleSubmit = useCallback(async () => {
    const error = validate(description);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError('');
    setSubmitting(true);
    try {
      await onSubmit({ errorType, description: description.trim() });
      setToastMessage('反馈已提交，感谢你的贡献！');
      setTimeout(() => {
        setToastMessage('');
        setDescription('');
        setErrorType('CODE_ERROR');
        onClose();
      }, 1500);
    } catch {
      setToastMessage('提交失败，请稍后重试');
      setTimeout(() => setToastMessage(''), 3000);
    } finally {
      setSubmitting(false);
    }
  }, [description, errorType, onSubmit, onClose, validate]);

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

  /** 打开时自动聚焦错误类型选择器 */
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

  /** 描述变化时清除校验错误 */
  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value);
      if (validationError) {
        setValidationError('');
      }
    },
    [validationError]
  );

  /** 重置表单（弹窗关闭时） */
  useEffect(() => {
    if (!isOpen) {
      setValidationError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const charCount = description.trim().length;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50
        backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
    >
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl bg-white p-6
          shadow-xl dark:bg-gray-800 animate-scale-in"
      >
        {/* 关闭按钮 */}
        <button
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

        {/* 标题 */}
        <h2
          id="feedback-modal-title"
          className="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-100"
        >
          🐛 纠错反馈
        </h2>

        {/* 错误类型选择 */}
        <div className="mb-4">
          <label
            htmlFor="feedback-error-type"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            错误类型
          </label>
          <select
            ref={firstFocusRef}
            id="feedback-error-type"
            value={errorType}
            onChange={(e) => setErrorType(e.target.value as FeedbackErrorType)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2
              text-sm text-gray-800
              focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100
              dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200
              dark:focus:border-blue-500 dark:focus:ring-blue-900/30
              transition-colors"
          >
            {(Object.keys(ERROR_TYPE_LABELS) as FeedbackErrorType[]).map((type) => (
              <option key={type} value={type}>
                {ERROR_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        {/* 描述文本框 */}
        <div className="mb-4">
          <label
            htmlFor="feedback-description"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            错误描述
          </label>
          <textarea
            id="feedback-description"
            value={description}
            onChange={handleDescriptionChange}
            placeholder="请描述你发现的错误（10-500 字）"
            rows={4}
            maxLength={MAX_DESCRIPTION_LENGTH}
            className={`w-full resize-none rounded-lg border px-3 py-2
              text-sm text-gray-800 placeholder:text-gray-400
              focus:outline-none focus:ring-2
              dark:bg-gray-700 dark:text-gray-200 dark:placeholder:text-gray-500
              transition-colors
              ${validationError
                ? 'border-red-400 focus:border-red-400 focus:ring-red-100 dark:border-red-500 dark:focus:ring-red-900/30'
                : 'border-gray-200 focus:border-blue-400 focus:ring-blue-100 dark:border-gray-600 dark:focus:border-blue-500 dark:focus:ring-blue-900/30'
              }`}
          />
          {/* 字数统计 + 校验提示 */}
          <div className="mt-1 flex items-center justify-between">
            {validationError ? (
              <span className="text-xs text-red-500 dark:text-red-400">
                {validationError}
              </span>
            ) : (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {charCount < MIN_DESCRIPTION_LENGTH
                  ? `还需 ${MIN_DESCRIPTION_LENGTH - charCount} 字`
                  : ''}
              </span>
            )}
            <span
              className={`text-xs ${
                charCount > MAX_DESCRIPTION_LENGTH
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {charCount}/{MAX_DESCRIPTION_LENGTH}
            </span>
          </div>
        </div>

        {/* 按钮组 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm
              font-medium text-gray-600 hover:bg-gray-50
              focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300
              focus-visible:ring-offset-2
              dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700
              dark:focus-visible:ring-offset-gray-800
              transition-colors duration-150"
          >
            取消
          </button>
          <button
            ref={lastFocusRef}
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium
              text-white shadow-sm hover:bg-blue-700
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
              focus-visible:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-50
              dark:bg-blue-500 dark:hover:bg-blue-600
              dark:focus-visible:ring-offset-gray-800
              transition-colors duration-150"
          >
            {submitting ? '提交中...' : '提交反馈'}
          </button>
        </div>
      </div>

      {/* Toast 提示 */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg
          bg-gray-900 px-4 py-2 text-sm text-white shadow-lg
          dark:bg-gray-100 dark:text-gray-900 animate-fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

// ============ 内部图标组件 ============

function CloseIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
