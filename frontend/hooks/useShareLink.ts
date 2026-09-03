'use client';

/**
 * useShareLink - 分享与深度链接 Hook
 *
 * 职责：
 * - generateShareUrl：生成指定解析的直达 URL
 * - copyShareLink：复制直达链接到剪贴板 + toast 提示
 * - copyCodeContent：复制代码块内容到剪贴板 + toast 提示
 * - resolveDeepLink：页面加载时解析 URL 参数，自动定位 Tab+级别+卡片+滚动
 * - 无效 solutionId 容错：fallback 到列表页 + toast 提示
 *
 * 满足需求 17.1-17.4
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// ============ 类型定义 ============

/** 深度链接解析结果 */
export interface DeepLinkResult {
  /** 目标 Tab */
  tab: string | null;
  /** 目标级别 */
  level: number | null;
  /** 目标 solution ID */
  solutionId: string | null;
}

/** Hook 返回值 */
export interface UseShareLinkReturn {
  /** 生成分享 URL */
  generateShareUrl: (problemId: string, level: number, solutionId: string) => string;
  /** 复制分享链接到剪贴板 */
  copyShareLink: (problemId: string, level: number, solutionId: string) => Promise<boolean>;
  /** 复制代码内容到剪贴板 */
  copyCodeContent: (content: string) => Promise<boolean>;
  /** 解析 URL 深度链接参数 */
  resolveDeepLink: () => DeepLinkResult;
  /** 执行深度链接定位（在列表加载完成后调用） */
  applyDeepLink: (options: ApplyDeepLinkOptions) => void;
  /** toast 提示状态 */
  toastMessage: string | null;
  /** 隐藏 toast */
  dismissToast: () => void;
}


/** 深度链接定位选项 */
export interface ApplyDeepLinkOptions {
  /** 当前列表中所有 solution ID */
  availableIds: string[];
  /** 切换 Tab 回调 */
  setActiveTab: (tab: string) => void;
  /** 切换级别回调 */
  setLevel: (level: number) => void;
  /** 展开卡片回调 */
  expandCard: (id: string) => void;
  /** 滚动到卡片回调 */
  scrollToCard: (id: string) => void;
}

// ============ 常量 ============

/** toast 自动消失时间（ms） */
const TOAST_DURATION = 2500;

// ============ Hook 实现 ============

export function useShareLink(): UseShareLinkReturn {
  const searchParams = useSearchParams();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 确保 deep link 只应用一次
  const deepLinkAppliedRef = useRef(false);

  // 清除 toast 定时器
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  /** 展示 toast 提示 */
  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, TOAST_DURATION);
  }, []);

  /** 隐藏 toast */
  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToastMessage(null);
  }, []);


  /** 生成分享 URL（完整绝对路径） */
  const generateShareUrl = useCallback(
    (problemId: string, level: number, solutionId: string): string => {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const params = new URLSearchParams({
        tab: 'ai',
        level: String(level),
        solution: solutionId,
      });
      return `${origin}/problems/${encodeURIComponent(problemId)}?${params.toString()}`;
    },
    []
  );

  /** 复制分享链接到剪贴板 */
  const copyShareLink = useCallback(
    async (problemId: string, level: number, solutionId: string): Promise<boolean> => {
      try {
        const url = generateShareUrl(problemId, level, solutionId);
        await navigator.clipboard.writeText(url);
        showToast('✓ 链接已复制');
        return true;
      } catch {
        showToast('复制失败，请手动复制');
        return false;
      }
    },
    [generateShareUrl, showToast]
  );

  /** 复制代码内容到剪贴板 */
  const copyCodeContent = useCallback(
    async (content: string): Promise<boolean> => {
      try {
        await navigator.clipboard.writeText(content);
        showToast('✓ 代码已复制');
        return true;
      } catch {
        showToast('复制失败，请手动复制');
        return false;
      }
    },
    [showToast]
  );


  /** 解析 URL 深度链接参数 */
  const resolveDeepLink = useCallback((): DeepLinkResult => {
    const tab = searchParams.get('tab');
    const levelParam = searchParams.get('level');
    const solutionId = searchParams.get('solution');

    const level = levelParam ? parseInt(levelParam, 10) : null;
    const validLevel = level && level >= 1 && level <= 5 ? level : null;

    return {
      tab: tab || null,
      level: validLevel,
      solutionId: solutionId || null,
    };
  }, [searchParams]);

  /** 执行深度链接定位（在列表数据加载完成后调用） */
  const applyDeepLink = useCallback(
    (options: ApplyDeepLinkOptions) => {
      // 防止重复应用
      if (deepLinkAppliedRef.current) return;

      const { tab, level, solutionId } = resolveDeepLink();

      // 没有 solution 参数则无需定位
      if (!solutionId) return;

      deepLinkAppliedRef.current = true;

      const { availableIds, setActiveTab, setLevel, expandCard, scrollToCard } = options;

      // 1. 切换到 AI Tab
      if (tab === 'ai') {
        setActiveTab('ai');
      }

      // 2. 切换级别
      if (level) {
        setLevel(level);
      }

      // 3. 检查 solutionId 是否存在
      if (availableIds.includes(solutionId)) {
        // 存在 → 展开 + 滚动
        expandCard(solutionId);
        // 延迟滚动，等 DOM 渲染完成
        requestAnimationFrame(() => {
          setTimeout(() => scrollToCard(solutionId), 100);
        });
      } else {
        // 不存在 → toast 提示 + 保持列表页
        showToast('该解析已不存在');
      }
    },
    [resolveDeepLink, showToast]
  );

  return {
    generateShareUrl,
    copyShareLink,
    copyCodeContent,
    resolveDeepLink,
    applyDeepLink,
    toastMessage,
    dismissToast,
  };
}
