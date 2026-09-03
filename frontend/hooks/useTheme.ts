'use client';

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'algorithm-help-theme';

/** 获取系统偏好 */
function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/** 应用主题到 document */
function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const resolved = theme === 'system' ? getSystemPreference() : theme;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * 主题管理 Hook
 * 支持 light / dark / system 三种模式
 * 自动持久化到 localStorage，system 模式下监听系统变化
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem(STORAGE_KEY) as Theme) || 'system';
  });

  const [isDark, setIsDark] = useState(false);

  /** 更新 isDark 状态 */
  const updateIsDark = useCallback((t: Theme) => {
    const resolved = t === 'system' ? getSystemPreference() : t;
    setIsDark(resolved === 'dark');
  }, []);

  /** 设置主题并持久化 */
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    applyTheme(newTheme);
    updateIsDark(newTheme);
  }, [updateIsDark]);

  // 初始化：应用主题
  useEffect(() => {
    applyTheme(theme);
    updateIsDark(theme);
  }, [theme, updateIsDark]);

  // system 模式下监听系统偏好变化
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      applyTheme('system');
      updateIsDark('system');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, updateIsDark]);

  return { theme, setTheme, isDark };
}
