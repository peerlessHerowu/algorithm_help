'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ===== 数据类型定义 =====

interface LearningPath {
  id: string;
  name: string;
  description: string;
  category: string;
  estimatedHours: number;
  totalNodes: number;
}

// ===== 分类颜色映射 =====

const CATEGORY_COLORS: Record<string, string> = {
  '动态规划': 'bg-indigo-100 text-indigo-700',
  '图论': 'bg-emerald-100 text-emerald-700',
  '双指针': 'bg-amber-100 text-amber-700',
  '分治': 'bg-rose-100 text-rose-700',
  '贪心': 'bg-cyan-100 text-cyan-700',
};

function getCategoryStyle(category: string): string {
  return CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-700';
}

// ===== 主页面组件 =====

export default function LearningPathListPage() {
  const router = useRouter();
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ===== 数据加载 =====

  useEffect(() => {
    async function fetchPaths() {
      try {
        setLoading(true);
        const res = await fetch('/api/learning-path');
        if (!res.ok) throw new Error(`请求失败: ${res.status}`);
        const data: LearningPath[] = await res.json();
        setPaths(data);
      } catch (err) {
        console.error('加载学习路径失败:', err);
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    }
    fetchPaths();
  }, []);

  // ===== 加载中状态 =====

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-sm">加载学习路径...</span>
        </div>
      </div>
    );
  }

  // ===== 错误状态 =====

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-red-500">⚠️ {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // ===== 渲染 =====

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面头部 */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold text-gray-900">学习路径</h1>
          <p className="mt-2 text-sm text-gray-500">
            选择一条适合你的学习路径，从入门到精通有序推进
          </p>
        </div>
      </header>

      {/* 路径卡片列表 */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {paths.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in-up">
            <div className="flex h-16 w-16 items-center justify-center rounded-full
              bg-indigo-50 dark:bg-indigo-900/20">
              <svg className="h-8 w-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">暂无学习路径</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">学习路径将自动根据你的进度生成</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paths.map((path) => (
              <PathCard
                key={path.id}
                path={path}
                onClick={() => router.push(`/learning-path/${path.id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ===== 路径卡片组件 =====

interface PathCardProps {
  path: LearningPath;
  onClick: () => void;
}

function PathCard({ path, onClick }: PathCardProps) {
  return (
    <button
      onClick={onClick}
      className="text-left w-full p-6 bg-white rounded-xl border border-gray-200
                 hover:border-indigo-300 hover:shadow-md transition-all duration-200
                 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
    >
      {/* 分类标签 */}
      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${getCategoryStyle(path.category)}`}>
        {path.category}
      </span>

      {/* 路径名称 */}
      <h3 className="mt-3 text-lg font-semibold text-gray-900 line-clamp-1">
        {path.name}
      </h3>

      {/* 描述 */}
      <p className="mt-2 text-sm text-gray-500 line-clamp-2">
        {path.description}
      </p>

      {/* 底部信息 */}
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          📚 {path.totalNodes} 个节点
        </span>
        <span className="flex items-center gap-1">
          ⏱️ 约 {path.estimatedHours} 小时
        </span>
      </div>
    </button>
  );
}
