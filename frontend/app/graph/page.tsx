'use client';

import { fetcher } from '@/lib/fetcher';
import { useState, useEffect, useCallback } from 'react';
import KnowledgeGraphDynamic from '@/components/KnowledgeGraphDynamic';
import type { GraphData, GraphNodeDTO, NodeType } from '@/components/KnowledgeGraph';
import Link from 'next/link';

// ===== 节点类型配置 =====
const NODE_TYPES: { type: NodeType; label: string; color: string }[] = [
  { type: 'PATTERN',     label: '模式', color: '#4F46E5' },
  { type: 'PROBLEM',     label: '题目', color: '#059669' },
  { type: 'MATH',        label: '数学', color: '#D97706' },
  { type: 'PAPER',       label: '论文', color: '#DC2626' },
  { type: 'APPLICATION', label: '应用', color: '#7C3AED' },
];

type LayoutType = 'force' | 'tree' | 'radial';
const LAYOUTS: { type: LayoutType; label: string }[] = [
  { type: 'force',  label: 'Force' },
  { type: 'tree',   label: 'Tree' },
  { type: 'radial', label: 'Radial' },
];

// ===== 主页面组件 =====
export default function GraphPage() {
  const [graphData, setGraphData]   = useState<GraphData>({ nodes: [], edges: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNodeDTO | null>(null);
  const [sidebarOpen, setSidebarOpen]   = useState(true);
  const [typeFilter, setTypeFilter] = useState<Set<NodeType>>(
    new Set<NodeType>(['PATTERN', 'PROBLEM', 'MATH', 'PAPER', 'APPLICATION'])
  );
  const [layout, setLayout]             = useState<LayoutType>('force');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading]           = useState(true);

  // 数据加载
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetcher<GraphData>('/api/graph/subgraph?nodeId=pattern:dp-basic&depth=2');
        setGraphData(data);
      } catch (err) {
        console.error('加载图谱数据失败:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // 节点展开
  const handleNodeExpand = useCallback(async (nodeId: string) => {
    try {
      const newData = await fetcher<GraphData>(`/api/graph/subgraph?nodeId=${encodeURIComponent(nodeId)}&depth=1`);
      setGraphData((prev) => {
        const existingNodeIds = new Set(prev.nodes.map((n) => n.id));
        const existingEdgeIds = new Set(prev.edges.map((e) => e.id));
        return {
          nodes: [...prev.nodes, ...newData.nodes.filter((n) => !existingNodeIds.has(n.id))],
          edges: [...prev.edges, ...newData.edges.filter((e) => !existingEdgeIds.has(e.id))],
        };
      });
    } catch (err) {
      console.error('展开节点失败:', err);
    }
  }, []);

  const toggleTypeFilter = (type: NodeType) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const filteredData: GraphData = {
    nodes: graphData.nodes.filter((n) => typeFilter.has(n.type)),
    edges: graphData.edges.filter((e) => {
      const ids = new Set(graphData.nodes.filter((n) => typeFilter.has(n.type)).map((n) => n.id));
      return ids.has(e.sourceId) && ids.has(e.targetId);
    }),
  };

  const sidebarW = sidebarOpen ? 300 : 0;

  return (
    <div className="h-[calc(100vh-4rem)] w-full flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* 顶部工具栏 */}
      <Toolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        typeFilter={typeFilter}
        onToggleType={toggleTypeFilter}
        layout={layout}
        onLayoutChange={setLayout}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        nodeCount={filteredData.nodes.length}
        edgeCount={filteredData.edges.length}
      />

      {/* 主体：图谱 + 侧边栏 */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* D3 画布 */}
        <main className="flex-1 relative overflow-hidden">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 animate-spin-slow rounded-full border-2 border-indigo-200 border-t-indigo-500" />
                <p className="text-sm text-gray-400">加载知识图谱...</p>
              </div>
            </div>
          ) : (
            <KnowledgeGraphDynamic
              data={filteredData}
              width={typeof window !== 'undefined' ? Math.max(600, window.innerWidth - 220 - (sidebarOpen ? sidebarW : 0) - 20) : 900}
              height={typeof window !== 'undefined' ? Math.max(400, window.innerHeight - 56 - 56) : 600}
              searchTerm={searchTerm}
              onNodeSelect={(node) => {
                setSelectedNode(node);
                if (node && !sidebarOpen) setSidebarOpen(true);
              }}
              onNodeExpand={handleNodeExpand}
            />
          )}
        </main>

        {/* 侧边栏收起/展开按钮 */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="absolute top-1/2 z-20 -translate-y-1/2
            w-5 h-12 bg-white dark:bg-gray-800
            border border-gray-200 dark:border-gray-700
            rounded-l-md flex items-center justify-center
            text-gray-400 hover:text-gray-600 dark:hover:text-gray-200
            transition-all duration-200 shadow-sm"
          style={{ right: sidebarOpen ? `${sidebarW}px` : '0px' }}
          title={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}
        >
          <svg
            className={`w-3 h-3 transition-transform duration-200 ${sidebarOpen ? '' : 'rotate-180'}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* 右侧侧边栏 */}
        <div
          className="shrink-0 overflow-hidden transition-all duration-200 ease-in-out
            border-l border-gray-200 dark:border-gray-700
            bg-white dark:bg-gray-900"
          style={{ width: sidebarOpen ? `${sidebarW}px` : '0px' }}
        >
          {sidebarOpen && (
            <div className="w-full h-full overflow-y-auto p-4 space-y-4 animate-fade-in">
              <NodeDetailCard node={selectedNode} onExpand={handleNodeExpand} />
              <GraphStats nodes={filteredData.nodes.length} edges={filteredData.edges.length} />
              <QuickActions selectedNode={selectedNode} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== 顶部工具栏 =====
interface ToolbarProps {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  typeFilter: Set<NodeType>;
  onToggleType: (t: NodeType) => void;
  layout: LayoutType;
  onLayoutChange: (l: LayoutType) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  nodeCount: number;
  edgeCount: number;
}

function Toolbar({
  searchTerm, onSearchChange, typeFilter, onToggleType,
  layout, onLayoutChange, isFullscreen, onToggleFullscreen,
  nodeCount, edgeCount,
}: ToolbarProps) {
  return (
    <header className="h-14 flex items-center gap-3 px-4
      bg-white dark:bg-gray-900
      border-b border-gray-200 dark:border-gray-700 shrink-0">

      {/* 搜索框 */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索节点..."
          className="w-44 h-8 pl-8 pr-3 text-sm
            border border-gray-300 dark:border-gray-600 rounded-lg
            bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
            placeholder:text-gray-400"
        />
        <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

      {/* 节点类型筛选 */}
      <div className="flex items-center gap-1 flex-wrap">
        {NODE_TYPES.map(({ type, label, color }) => (
          <button
            key={type}
            onClick={() => onToggleType(type)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors
              ${typeFilter.has(type)
                ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                : 'border-transparent bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
              }`}
          >
            <span className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: typeFilter.has(type) ? color : '#9CA3AF' }} />
            {label}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

      {/* 布局切换 */}
      <div className="flex items-center gap-1">
        {LAYOUTS.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => onLayoutChange(type)}
            className={`px-2 py-1 text-xs rounded-md transition-colors
              ${layout === type
                ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 统计数字 */}
      <div className="ml-2 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
        <span>{nodeCount} 节点</span>
        <span>·</span>
        <span>{edgeCount} 边</span>
      </div>

      {/* 全屏 */}
      <div className="ml-auto">
        <button
          onClick={onToggleFullscreen}
          className="p-1.5 text-gray-500 dark:text-gray-400
            hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          title={isFullscreen ? '退出全屏' : '全屏'}
        >
          {isFullscreen ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}

// ===== 节点详情卡片 =====
function NodeDetailCard({ node, onExpand }: { node: GraphNodeDTO | null; onExpand: (id: string) => void }) {
  const typeConfig = NODE_TYPES.find((t) => t.type === node?.type);

  if (!node) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-5
        flex flex-col items-center justify-center gap-2 text-center min-h-[120px]">
        <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
        </svg>
        <p className="text-xs text-gray-400 dark:text-gray-500">点击节点查看详情</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700
      bg-white dark:bg-gray-900 p-4 space-y-3 animate-fade-in-up">
      {/* 类型标签 + 名称 */}
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: typeConfig?.color ?? '#6B7280' }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
            {node.type}
          </p>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
            {node.name}
          </h3>
        </div>
      </div>

      {/* 元信息 */}
      <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex justify-between">
          <span className="text-gray-400 dark:text-gray-500">分类</span>
          <span className="font-medium truncate max-w-[140px]">{node.category}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400 dark:text-gray-500">难度</span>
          <span className="font-medium">
            {'★'.repeat(node.difficulty)}{'☆'.repeat(Math.max(0, 5 - node.difficulty))}
          </span>
        </div>
      </div>

      {node.metadata?.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3">
          {node.metadata.description}
        </p>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onExpand(node.id)}
          className="flex-1 rounded-lg border border-indigo-200 dark:border-indigo-800
            px-2.5 py-1.5 text-xs text-indigo-600 dark:text-indigo-400
            hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
        >
          展开关联
        </button>
        {node.type === 'PROBLEM' && (
          <Link
            href={`/problems/${node.id}`}
            className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700
              px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-400
              hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-center"
          >
            查看题目
          </Link>
        )}
      </div>
    </div>
  );
}

// ===== 图谱统计 =====
function GraphStats({ nodes, edges }: { nodes: number; edges: number }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">📊 图谱概览</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: '节点数', value: nodes, color: 'text-indigo-600 dark:text-indigo-400' },
          { label: '关联边', value: edges, color: 'text-emerald-600 dark:text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
            <p className={`text-lg font-bold ${color}`}>{value}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== 快捷操作 =====
function QuickActions({ selectedNode }: { selectedNode: GraphNodeDTO | null }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">⚡ 快捷操作</p>
      <div className="space-y-1.5">
        {selectedNode ? (
          <>
            <button className="w-full px-3 py-2 text-xs text-left text-gray-600 dark:text-gray-400
              rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800
              border border-gray-100 dark:border-gray-700 transition-colors">
              📖 查看详情
            </button>
            <button className="w-full px-3 py-2 text-xs text-left text-gray-600 dark:text-gray-400
              rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800
              border border-gray-100 dark:border-gray-700 transition-colors">
              ✅ 标记已完成
            </button>
            <button className="w-full px-3 py-2 text-xs text-left text-gray-600 dark:text-gray-400
              rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800
              border border-gray-100 dark:border-gray-700 transition-colors">
              🛤️ 加入学习路径
            </button>
          </>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500 py-2 text-center">
            选中节点后可操作
          </p>
        )}
      </div>
    </div>
  );
}
