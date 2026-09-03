'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

// ===== 类型定义 =====

/** 推荐项 DTO */
interface RecommendItem {
  nodeId: string;
  nodeType: string;
  name: string;
  reason: string;
  score: number;
  patternName: string;
  difficulty: number;
}

/** 薄弱模式 DTO */
interface WeakPatternDTO {
  patternId: string;
  patternName: string;
  accuracy: number;
  suggestedCount: number;
}

/** 组件 Props */
interface RecommendPanelProps {
  userId: string;
  className?: string;
}

// ===== 常量 =====

const API_BASE = '/api/recommend';

// ===== 工具函数 =====

/** 渲染难度星标（1-5） */
function DifficultyStars({ level }: { level: number }) {
  const clamped = Math.max(1, Math.min(5, level));
  return (
    <span className="inline-flex items-center gap-0.5" title={`难度 ${clamped}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`w-3 h-3 ${i < clamped ? 'text-amber-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.54-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.07 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
        </svg>
      ))}
    </span>
  );
}


// ===== 主组件 =====

export default function RecommendPanel({ userId, className = '' }: RecommendPanelProps) {
  const [recommendations, setRecommendations] = useState<RecommendItem[]>([]);
  const [weakPatterns, setWeakPatterns] = useState<WeakPatternDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** 获取推荐数据和薄弱模式 */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [recRes, weakRes] = await Promise.all([
        fetch(`${API_BASE}/${userId}`),
        fetch(`${API_BASE}/${userId}/weak-patterns`),
      ]);

      if (!recRes.ok) throw new Error(`推荐接口错误: ${recRes.status}`);
      if (!weakRes.ok) throw new Error(`薄弱模式接口错误: ${weakRes.status}`);

      const recData = await recRes.json();
      const weakData = await weakRes.json();

      // 兼容 ApiResponse 包装格式（后端可能返回 { data: [...] }）
      setRecommendations(Array.isArray(recData) ? recData : recData.data ?? []);
      setWeakPatterns(Array.isArray(weakData) ? weakData : weakData.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  // ===== 加载状态 =====
  if (loading) {
    return (
      <div className={`rounded-xl border border-gray-100 bg-white p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-32 bg-gray-200 rounded" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-3/4 bg-gray-100 rounded" />
              <div className="h-3 w-1/2 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ===== 错误状态 =====
  if (error) {
    return (
      <div className={`rounded-xl border border-red-100 bg-red-50 p-6 ${className}`}>
        <p className="text-sm text-red-600">⚠️ {error}</p>
        <button
          onClick={fetchData}
          className="mt-3 text-xs text-red-500 underline hover:text-red-700"
        >
          重新加载
        </button>
      </div>
    );
  }

  // ===== 空数据状态 =====
  const isEmpty = recommendations.length === 0 && weakPatterns.length === 0;
  if (isEmpty) {
    return (
      <div className={`rounded-xl border border-gray-100 bg-white p-6 text-center ${className}`}>
        <p className="text-gray-400 text-sm">暂无推荐数据</p>
        <p className="text-gray-300 text-xs mt-1">完成更多题目后将为你生成个性化推荐</p>
      </div>
    );
  }


  // ===== 正常渲染 =====
  return (
    <div className={`rounded-xl border border-gray-100 bg-white shadow-sm ${className}`}>
      {/* 区域 1：个性化推荐 */}
      {recommendations.length > 0 && (
        <section className="p-5 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span className="text-lg">🎯</span>
            个性化推荐
          </h3>
          <ul className="space-y-3">
            {recommendations.slice(0, 10).map((item) => (
              <li
                key={item.nodeId}
                className="group flex flex-col gap-1 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                {/* 第一行：名称 + 模式标签 + 难度 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-600 transition-colors">
                    {item.name}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
                    {item.patternName}
                  </span>
                  <DifficultyStars level={item.difficulty} />
                </div>
                {/* 第二行：推荐理由 */}
                <p className="text-xs text-gray-400 leading-relaxed">
                  {item.reason}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 区域 2：薄弱模式提示 */}
      {weakPatterns.length > 0 && (
        <section className="p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            薄弱模式
          </h3>
          <ul className="space-y-2">
            {weakPatterns.map((pattern) => (
              <li
                key={pattern.patternId}
                className="flex items-center justify-between rounded-lg bg-amber-50/60 px-3 py-2"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-gray-700">
                    {pattern.patternName}
                  </span>
                  <span className="text-xs text-amber-600">
                    正确率 {Math.round(pattern.accuracy * 100)}% · 建议练习 {pattern.suggestedCount} 题
                  </span>
                </div>
                <Link
                  href="/training"
                  className="shrink-0 rounded-md bg-amber-500 px-3 py-1 text-xs font-medium text-white hover:bg-amber-600 transition-colors"
                >
                  开始训练
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
