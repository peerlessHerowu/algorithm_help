'use client';
import { fetcher } from '@/lib/fetcher';

import { useState, useEffect, useCallback } from 'react';
import KnowledgeGraphDynamic from '@/components/KnowledgeGraphDynamic';
import type {
  GraphData,
  GraphNodeDTO,
  NodeType,
} from '@/components/KnowledgeGraph';

// ===== 节点类型配置 =====

const NODE_TYPES: { type: NodeType; label: string; color: string }[] = [
  { type: 'PATTERN', label: '模式', color: '#4F46E5' },
  { type: 'PROBLEM', label: '题目', color: '#059669' },
  { type: 'MATH', label: '数学', color: '#D97706' },
  { type: 'PAPER', label: '论文', color: '#DC2626' },
  { type: 'APPLICATION', label: '应用', color: '#7C3AED' },
];

// ===== 布局类型 =====

type LayoutType = 'force' | 'tree' | 'radial';

const LAYOUTS: { type: LayoutType; label: string }[] = [
  { type: 'force', label: 'Force' },
  { type: 'tree', label: 'Tree' },
  { type: 'radial', label: 'Radial' },
];

// ===== 主页面组件 =====

export default function GraphPage() {
  // 图谱数据
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  // 搜索关键词
  const [searchTerm, setSearchTerm] = useState('');
  // 选中的节点
  const [selectedNode, setSelectedNode] = useState<GraphNodeDTO | null>(null);
  // 侧边栏开关
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // 节点类型筛选
  const [typeFilter, setTypeFilter] = useState<Set<NodeType>>(
    new Set<NodeType>(['PATTERN', 'PROBLEM', 'MATH', 'PAPER', 'APPLICATION'])
  );
  // 布局类型
  const [layout, setLayout] = useState<LayoutType>('force');
  // 全屏状态
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ===== 数据加载 =====

  useEffect(() => {
    async function fetchInitialData() {
      try {
        const data = await fetcher<GraphData>('/api/graph/subgraph?nodeId=pattern:dp-basic&depth=2');
        setGraphData(data);
      } catch (err) {
        console.error('加载图谱数据失败:', err);
      }
    }
    fetchInitialData();
  }, []);

  // ===== 节点展开：加载更多关联数据 =====

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
      console.error('展开节点数据加载失败:', err);
    }
  }, []);

  // ===== 类型筛选切换 =====

  const toggleTypeFilter = (type: NodeType) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // ===== 全屏切换 =====

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // ===== 筛选后的图谱数据 =====

  const filteredData: GraphData = {
    nodes: graphData.nodes.filter((n) => typeFilter.has(n.type)),
    edges: graphData.edges.filter((e) => {
      const filteredNodeIds = new Set(
        graphData.nodes.filter((n) => typeFilter.has(n.type)).map((n) => n.id)
      );
      return filteredNodeIds.has(e.sourceId) && filteredNodeIds.has(e.targetId);
    }),
  };

  // ===== 渲染 =====

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50 overflow-hidden">
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
      />

      {/* 主体区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* D3 画布区域 */}
        <main className="flex-1 relative">
          <KnowledgeGraphDynamic
            data={filteredData}
            width={typeof window !== 'undefined' ? window.innerWidth - (sidebarOpen ? 320 : 0) : 900}
            height={typeof window !== 'undefined' ? window.innerHeight - 56 : 600}
            searchTerm={searchTerm}
            onNodeSelect={(node) => {
              setSelectedNode(node);
              if (node && !sidebarOpen) setSidebarOpen(true);
            }}
            onNodeExpand={handleNodeExpand}
          />
        </main>

        {/* 右侧可收起侧边栏 */}
        <Sidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          selectedNode={selectedNode}
          onNodeExpand={handleNodeExpand}
        />
      </div>
    </div>
  );
}

// ===== 顶部工具栏组件 =====

interface ToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  typeFilter: Set<NodeType>;
  onToggleType: (type: NodeType) => void;
  layout: LayoutType;
  onLayoutChange: (layout: LayoutType) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

function Toolbar({
  searchTerm,
  onSearchChange,
  typeFilter,
  onToggleType,
  layout,
  onLayoutChange,
  isFullscreen,
  onToggleFullscreen,
}: ToolbarProps) {
  return (
    <header className="h-14 flex items-center gap-3 px-4 bg-white border-b border-gray-200 shrink-0">
      {/* 搜索框 */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索节点..."
          className="w-48 h-8 pl-8 pr-3 text-sm border border-gray-300 rounded-md
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <svg
          className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* 分隔线 */}
      <div className="w-px h-6 bg-gray-200" />

      {/* 节点类型筛选 */}
      <div className="flex items-center gap-1">
        {NODE_TYPES.map(({ type, label, color }) => (
          <button
            key={type}
            onClick={() => onToggleType(type)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors
              ${typeFilter.has(type)
                ? 'border-gray-300 bg-white text-gray-700'
                : 'border-transparent bg-gray-100 text-gray-400'
              }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: typeFilter.has(type) ? color : '#D1D5DB' }}
            />
            {label}
          </button>
        ))}
      </div>

      {/* 分隔线 */}
      <div className="w-px h-6 bg-gray-200" />

      {/* 布局切换 */}
      <div className="flex items-center gap-1">
        {LAYOUTS.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => onLayoutChange(type)}
            className={`px-2 py-1 text-xs rounded-md transition-colors
              ${layout === type
                ? 'bg-indigo-100 text-indigo-700 font-medium'
                : 'text-gray-500 hover:bg-gray-100'
              }`}
            title={type === 'force' ? '力导向布局' : '即将支持'}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 右侧：全屏按钮 */}
      <div className="ml-auto">
        <button
          onClick={onToggleFullscreen}
          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
          title={isFullscreen ? '退出全屏' : '全屏'}
        >
          {isFullscreen ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M6 18L18 6M6 6l12 12" />
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

// ===== 右侧侧边栏组件 =====

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  selectedNode: GraphNodeDTO | null;
  onNodeExpand: (nodeId: string) => void;
}

function Sidebar({ open, onToggle, selectedNode, onNodeExpand }: SidebarProps) {
  return (
    <>
      {/* 收起/展开按钮 */}
      <button
        onClick={onToggle}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10
                   w-5 h-12 bg-white border border-gray-200 rounded-l-md
                   flex items-center justify-center text-gray-400 hover:text-gray-600
                   transition-colors shadow-sm"
        style={{ right: open ? '320px' : '0' }}
      >
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-0' : 'rotate-180'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* 侧边栏面板 */}
      {open && (
        <aside className="w-80 bg-white border-l border-gray-200 overflow-y-auto shrink-0">
          <div className="p-4 space-y-6">
            {/* 节点详情卡片 */}
            <NodeDetailCard node={selectedNode} onExpand={onNodeExpand} />

            {/* 推荐列表 */}
            <RecommendSection />

            {/* 快捷操作 */}
            <QuickActions />
          </div>
        </aside>
      )}
    </>
  );
}

// ===== 节点详情卡片 =====

function NodeDetailCard({
  node,
  onExpand,
}: {
  node: GraphNodeDTO | null;
  onExpand: (nodeId: string) => void;
}) {
  if (!node) {
    return (
      <div className="rounded-lg border border-gray-200 p-4">
        <p className="text-sm text-gray-400 text-center">点击节点查看详情</p>
      </div>
    );
  }

  const typeConfig = NODE_TYPES.find((t) => t.type === node.type);

  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: typeConfig?.color ?? '#6B7280' }}
        />
        <span className="text-xs text-gray-500 uppercase">{node.type}</span>
      </div>

      <h3 className="text-base font-semibold text-gray-900">{node.name}</h3>

      <div className="space-y-1 text-sm text-gray-600">
        <p><span className="text-gray-400">分类：</span>{node.category}</p>
        <p><span className="text-gray-400">难度：</span>{'★'.repeat(node.difficulty)}{'☆'.repeat(5 - node.difficulty)}</p>
        {node.metadata?.description && (
          <p className="mt-2 text-gray-500 text-xs leading-relaxed">
            {node.metadata.description}
          </p>
        )}
      </div>

      <button
        onClick={() => onExpand(node.id)}
        className="w-full mt-2 px-3 py-1.5 text-xs text-indigo-600 border border-indigo-200
                   rounded-md hover:bg-indigo-50 transition-colors"
      >
        展开关联节点
      </button>
    </div>
  );
}

// ===== 推荐列表（占位） =====

function RecommendSection() {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-3">推荐列表</h4>
      <div className="space-y-2">
        <p className="text-xs text-gray-400">
          基于当前选中节点的图谱拓扑关系，推荐相关学习内容。
        </p>
        <div className="text-xs text-gray-300 italic">暂无推荐数据</div>
      </div>
    </div>
  );
}

// ===== 快捷操作（占位） =====

function QuickActions() {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-3">快捷操作</h4>
      <div className="space-y-2">
        <button className="w-full px-3 py-2 text-xs text-left text-gray-600 rounded-md
                           hover:bg-gray-50 border border-gray-100 transition-colors">
          📖 查看详情
        </button>
        <button className="w-full px-3 py-2 text-xs text-left text-gray-600 rounded-md
                           hover:bg-gray-50 border border-gray-100 transition-colors">
          ✅ 标记已完成
        </button>
        <button className="w-full px-3 py-2 text-xs text-left text-gray-600 rounded-md
                           hover:bg-gray-50 border border-gray-100 transition-colors">
          🛤️ 加入学习路径
        </button>
      </div>
    </div>
  );
}
