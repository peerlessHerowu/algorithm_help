'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** localStorage key */
const STORAGE_KEY = 'algorithm-help:reading-progress';

/** LRU 最大条目数 */
const MAX_ENTRIES = 200;

/** 单条进度记录 */
interface ProgressEntry {
  lastLevel: number;
  lastVisitAt: number;
}

/** 完整进度数据结构 */
interface ReadingProgress {
  [problemId: string]: ProgressEntry;
}

/**
 * 阅读进度 Hook — LRU 200 条
 *
 * 功能：
 * - getLastLevel(problemId) — 返回上次阅读级别（或 null）
 * - recordLevel(problemId, level) — 记录当前级别，LRU 淘汰
 * - 自动在 level 变化时持久化
 *
 * 满足需求 18.1-18.4
 */
export function useReadingProgress() {
  const [progress, setProgress] = useState<ReadingProgress>({});
  const [hydrated, setHydrated] = useState(false);
  const progressRef = useRef<ReadingProgress>({});

  // 客户端 hydration：从 localStorage 读取
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: ReadingProgress = JSON.parse(stored);
        setProgress(parsed);
        progressRef.current = parsed;
      }
    } catch {
      // 解析失败静默降级
    }
    setHydrated(true);
  }, []);

  /** 持久化到 localStorage（带 LRU 淘汰） */
  const persist = useCallback((data: ReadingProgress) => {
    try {
      const entries = Object.entries(data);
      let trimmed = data;

      // LRU 淘汰：超过 200 条时移除 lastVisitAt 最旧的
      if (entries.length > MAX_ENTRIES) {
        const sorted = entries.sort(
          ([, a], [, b]) => b.lastVisitAt - a.lastVisitAt
        );
        trimmed = Object.fromEntries(sorted.slice(0, MAX_ENTRIES));
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      return trimmed;
    } catch {
      // 写入失败静默降级
      return data;
    }
  }, []);

  /** 获取某题目上次阅读的级别，不存在返回 null */
  const getLastLevel = useCallback(
    (problemId: string): number | null => {
      const entry = progressRef.current[problemId];
      return entry ? entry.lastLevel : null;
    },
    []
  );

  /** 记录阅读级别（更新 lastVisitAt + LRU 淘汰） */
  const recordLevel = useCallback(
    (problemId: string, level: number) => {
      setProgress((prev) => {
        const next: ReadingProgress = {
          ...prev,
          [problemId]: {
            lastLevel: level,
            lastVisitAt: Date.now(),
          },
        };
        const trimmed = persist(next);
        progressRef.current = trimmed;
        return trimmed;
      });
    },
    [persist]
  );

  /** 判断某题目某级别是否已阅读 */
  const isRead = useCallback(
    (problemId: string, level?: number): boolean => {
      const entry = progressRef.current[problemId];
      if (!entry) return false;
      if (level !== undefined) return entry.lastLevel === level;
      return true;
    },
    []
  );

  /** 获取已记录的题目总数 */
  const getRecordCount = useCallback(
    () => Object.keys(progressRef.current).length,
    []
  );

  /** 获取 localStorage 中阅读进度的字节大小（用于总量控制） */
  const getStorageSize = useCallback((): number => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? new Blob([stored]).size : 0;
    } catch {
      return 0;
    }
  }, []);

  return {
    getLastLevel,
    recordLevel,
    isRead,
    getRecordCount,
    getStorageSize,
    hydrated,
  };
}
