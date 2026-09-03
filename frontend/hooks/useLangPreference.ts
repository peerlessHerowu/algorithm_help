'use client';

import { useState, useCallback, useEffect } from 'react';

/** localStorage key 常量 */
const LANG_PREFERENCE_KEY = 'algorithm-help:lang-preference';

/** 语言偏好类型 */
export type LangPreference = 'cn' | 'en';

/**
 * 语言偏好 Hook
 * - 从 localStorage 读取用户偏好（默认 'cn'）
 * - 切换时写入 localStorage
 * - 仅影响题目描述，不影响解析内容
 */
export function useLangPreference() {
  const [lang, setLangState] = useState<LangPreference>('cn');
  const [hydrated, setHydrated] = useState(false);

  // 客户端 hydration 后从 localStorage 读取
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANG_PREFERENCE_KEY);
      if (stored === 'en' || stored === 'cn') {
        setLangState(stored);
      }
    } catch {
      // localStorage 不可用时静默降级
    }
    setHydrated(true);
  }, []);

  const setLang = useCallback((newLang: LangPreference) => {
    setLangState(newLang);
    try {
      localStorage.setItem(LANG_PREFERENCE_KEY, newLang);
    } catch {
      // 写入失败静默降级
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'cn' ? 'en' : 'cn');
  }, [lang, setLang]);

  /** 当前是否为中文模式 */
  const isChinese = lang === 'cn';

  return { lang, isChinese, setLang, toggleLang, hydrated };
}
