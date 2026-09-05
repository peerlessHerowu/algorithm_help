'use client';

/**
 * DiagramViewer — 图解查看器
 *
 * 从后端获取图解数据，渲染 Mermaid 图 + 图例说明。
 * 支持：缩放/平移（scroll to zoom, drag to pan）、下载 SVG。
 * 空状态：友好提示尚未生成。
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

// MermaidRenderer 懒加载，避免 SSR 问题
const MermaidRenderer = dynamic(() => import('@/components/MermaidRenderer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-32 text-gray-400 text-sm gap-2">
      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      渲染图解中...
    </div>
  ),
});

// 图解类型 → 中文名 + 图例
const DIAGRAM_TYPE_META: Record<string, { label: string; legend: LegendItem[] }> = {
  POINTER_ANIMATION: {
    label: '指针移动图',
    legend: [
      { color: '#3b82f6', label: '当前指针位置' },
      { color: '#22c55e', label: '已处理区域' },
      { color: '#e2e8f0', label: '未处理区域' },
    ],
  },
  NODE_LINK: {
    label: '链表节点图',
    legend: [
      { color: '#3b82f6', label: '当前操作节点' },
      { color: '#22c55e', label: '已完成节点' },
      { color: '#e2e8f0', label: '待处理节点' },
    ],
  },
  TREE_GRAPH: {
    label: '树形结构图',
    legend: [
      { color: '#3b82f6', label: '当前访问节点' },
      { color: '#22c55e', label: '已访问节点' },
      { color: '#f59e0b', label: '关键节点' },
    ],
  },
  TABLE_FILL: {
    label: 'DP 表格图',
    legend: [
      { color: '#3b82f6', label: '当前填充格' },
      { color: '#8b5cf6', label: '依赖的格子' },
      { color: '#e2e8f0', label: '初始值' },
    ],
  },
  FLOWCHART: {
    label: '流程图',
    legend: [
      { color: '#3b82f6', label: '执行路径' },
      { color: '#f59e0b', label: '判断节点' },
    ],
  },
  NODE_EDGE_GRAPH: {
    label: '图论结构',
    legend: [
      { color: '#3b82f6', label: '当前访问节点' },
      { color: '#22c55e', label: '已访问' },
      { color: '#e2e8f0', label: '未访问' },
    ],
  },
  DP_TABLE: {
    label: 'DP 表格',
    legend: [
      { color: '#3b82f6', label: '当前计算格' },
      { color: '#8b5cf6', label: '状态转移来源' },
    ],
  },
};

interface LegendItem {
  color: string;
  label: string;
}

interface DiagramData {
  status: 'ready' | 'not_generated';
  id?: string;
  diagramType?: string;
  renderEngine?: string;
  mermaidCode?: string;
  contentJson?: string;
  message?: string;
}

interface DiagramViewerProps {
  problemId: string;
  level: number;
  className?: string;
}

export default function DiagramViewer({ problemId, level, className = '' }: DiagramViewerProps) {
  const [data, setData]         = useState<DiagramData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom]         = useState(1);
  const containerRef            = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/enriched/${encodeURIComponent(problemId)}/diagram?level=${level}`
      );
      const json = await res.json();
      setData(json.data as DiagramData);
    } catch {
      setData({ status: 'not_generated', message: '加载图解数据失败' });
    } finally {
      setLoading(false);
    }
  }, [problemId, level]);

  useEffect(() => { load(); }, [load]);

  // 滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.5, Math.min(3, z - e.deltaY * 0.001)));
  }, []);

  // 下载 SVG
  const handleDownload = useCallback(() => {
    const svgEl = containerRef.current?.querySelector('svg');
    if (!svgEl) return;
    const blob = new Blob([svgEl.outerHTML], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `diagram-${problemId}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [problemId]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-40 ${className}`}>
        <div className="flex flex-col items-center gap-2 text-gray-400">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">加载图解...</span>
        </div>
      </div>
    );
  }

  if (!data || data.status === 'not_generated') {
    return (
      <div className={`flex flex-col items-center gap-3 py-8 text-center ${className}`}>
        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl">
          📊
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">图解尚未生成</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {data?.message ?? '请先生成解析内容，图解将自动生成'}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="text-xs text-blue-500 hover:text-blue-600 underline"
        >
          重新加载
        </button>
      </div>
    );
  }

  const mermaidCode = data.mermaidCode ?? '';
  const diagramType = data.diagramType ?? 'FLOWCHART';
  const meta        = DIAGRAM_TYPE_META[diagramType] ?? { label: '图解', legend: [] };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* 标题行：图解类型 + 操作按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
            {meta.label}
          </span>
          {/* 缩放提示 */}
          <span className="text-[10px] text-gray-400">滚轮缩放</span>
        </div>
        <div className="flex items-center gap-2">
          {/* 缩放控制 */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}
              className="w-6 h-6 rounded border border-gray-200 dark:border-gray-700
                text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800
                flex items-center justify-center"
              aria-label="缩小"
            >−</button>
            <span className="text-xs text-gray-500 w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(3, z + 0.2))}
              className="w-6 h-6 rounded border border-gray-200 dark:border-gray-700
                text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800
                flex items-center justify-center"
              aria-label="放大"
            >+</button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="text-[10px] text-gray-400 hover:text-gray-600 ml-1"
              aria-label="重置缩放"
            >重置</button>
          </div>
          {/* 下载 */}
          <button
            type="button"
            onClick={handleDownload}
            className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
              flex items-center gap-1"
            title="下载 SVG"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            SVG
          </button>
        </div>
      </div>

      {/* 图解区域 */}
      <div
        className={[
          'relative rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden',
          'bg-white dark:bg-gray-900',
          fullscreen ? 'fixed inset-4 z-50 p-4' : 'min-h-[180px]',
        ].join(' ')}
        onWheel={handleWheel}
      >
        {/* 全屏遮罩背景 */}
        {fullscreen && (
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setFullscreen(false)}
          />
        )}
        <div
          ref={containerRef}
          className={[
            'flex items-center justify-center p-4 relative',
            fullscreen ? 'z-50 h-full overflow-auto' : '',
          ].join(' ')}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center top', transition: 'transform 0.1s ease' }}
        >
          {mermaidCode ? (
            <MermaidRenderer
              code={mermaidCode}
              className="max-w-full"
            />
          ) : (
            <div className="text-sm text-gray-400 py-8">图解内容为空</div>
          )}
        </div>

        {/* 全屏按钮 */}
        <button
          type="button"
          onClick={() => setFullscreen(f => !f)}
          className="absolute top-2 right-2 w-6 h-6 rounded bg-white/80 dark:bg-gray-800/80
            border border-gray-200 dark:border-gray-700 text-gray-500
            flex items-center justify-center hover:bg-white dark:hover:bg-gray-700
            z-10"
          title={fullscreen ? '退出全屏' : '放大查看'}
        >
          {fullscreen ? (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>
      </div>

      {/* 图例说明 */}
      {meta.legend.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {meta.legend.map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-sm border border-gray-200 flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
