'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'algorithm-help-favorites';

/**
 * 收藏功能 Hook
 * 使用 localStorage 存储收藏的 problemId 列表
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  // 初始化：从 localStorage 读取收藏列表
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch {
      // localStorage 解析失败时忽略
    }
  }, []);

  /** 持久化到 localStorage */
  const persist = useCallback((list: string[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }, []);

  /** 判断某题目是否已收藏 */
  const isFavorite = useCallback(
    (id: string) => favorites.includes(id),
    [favorites]
  );

  /** 切换收藏状态 */
  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];
      persist(next);
      return next;
    });
  }, [persist]);

  /** 清空所有收藏 */
  const clearAll = useCallback(() => {
    setFavorites([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { favorites, isFavorite, toggleFavorite, clearAll };
}
