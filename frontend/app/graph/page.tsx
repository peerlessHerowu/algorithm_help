'use client';

import { fetcher } from '@/lib/fetcher';
import { useState, useEffect, useCallback, useRef } from 'react';
import KnowledgeGraphDynamic from '@/components/KnowledgeGraphDynamic';
import type { GraphData, GraphNodeDTO, NodeType, UserProgress } from '@/components/KnowledgeGraph';
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

// 视口尺寸 hook
function useWindowSize() {
  const [size, setSize] = useState({ w: 1200, h: 800 });
  useEffect(() => {
    function update() { setSize({ w: window.innerWidth, h: window.innerHeight }); }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return size;
}

// ===== 主页面 =====
export default function GraphPage() {
  const [graphData, setGraphData]       = useState<GraphData>({ nodes: [], edges: [] });
  const [searchTerm, setSearchTerm]     = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNodeDTO | null>(null);
  const [sidebarOpen, setSidebarOpen]   = useState(true);
  const [typeFilter, setTypeFilter]     = useState<Set<NodeType>>(
    new Set<NodeType>(['PATTERN', 'PROBLEM', 'MATH', 'PAPER', 'APPLICATION'])
  );
  const [layout, setLayout]             = useState<LayoutType>('force');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [myLocationActive, setMyLocationActive] = useState(false);
  const [userProgress, setUserProgress] = useState<UserProgress | undefined>(undefined);
  const [progressLoading, setProgressLoading]   = useState(false);
  const { w: winW, h: winH } = useWindowSize();

  // 加载全量图谱
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetcher<GraphData>('/api/graph/export');
        setGraphData(data);
      } catch (err) {
        console.error('加载图谱数据失败:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // 节点展开（从子图追加）
  const handleNodeExpand = useCallback(async (nodeId: string) => {
    try {
      const newData = await fetcher<GraphData>(
        `/api/graph/subgraph?nodeId=${encodeURIComponent(nodeId)}&depth=1`
      );
      setGraphData((prev) => {
        const existIds  = new Set(prev.nodes.map((n) => n.id));
        const existEdge = new Set(prev.edges.map((e) => e.id));
        return {
          nodes: [...prev.nodes, ...newData.nodes.filter((n) => !existIds.has(n.id))],
          edges: [...prev.edges, ...newData.edges.filter((e) => !existEdge.has(e.id))],
        };
      });
    } catch (err) {
      console.error('展开节点失败:', err);
    }
  }, []);

  // 「我的位置」— 加载用户进度
  const handleMyLocation = useCallback(async () => {
    if (myLocationActive) {
      // 再次点击取消高亮
      setMyLocationActive(false);
      setUserProgress(undefined);
      return;
    }
    setProgressLoading(true);
    try {
      const data = await fetcher<{
        completedProblemIds: string[];
        weakPatternIds: string[];
        currentNodeId?: string;
      }>('/api/v1/user/progress/graph');
      setUserProgress({
        completedProblemIds: new Set(data.completedProblemIds),
        weakPatternIds: new Set(data.weakPatternIds),
        currentNodeId: data.currentNodeId,
      });
      setMyLocationActive(true);
    } catch {
      // 如果接口不存在，用本地 mock 数据演示
      setUserProgress({
        completedProblemIds: new Set<string>(),
        weakPatternIds: new Set<string>(),
      });
      setMyLocationActive(true);
    } finally {
      setProgressLoading(false);
    }
  }, [myLocationActive]);

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
  const graphW   = Math.max(600, winW - 220 - (sidebarOpen ? sidebarW : 0) - 4);
  const graphH   = Math.max(400, winH - 56 - 56);

  return (
    <div className="h-[calc(100vh-4rem)] w-full flex flex-col bg-[#0F1117] overflow-hidden">
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
        myLocationActive={myLocationActive}
        progressLoading={progressLoading}
        onMyLocation={handleMyLocation}
      />

      {/* 主体 */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* 画布 */}
        <main className="flex-1 relative overflow-hidden">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full border-2 border-indigo-700 border-t-indigo-400 animate-spin" />
                <p className="text-sm text-gray-400">加载知识图谱...</p>
                <p className="text-xs text-gray-600">141 节点 · 224 关系边</p>
              </div>
            </div>
          ) : filteredData.nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-gray-500 mb-2">没有符合条件的节点</p>
                <button
                  onClick={() => setTypeFilter(new Set(['PATTERN','PROBLEM','MATH','PAPER','APPLICATION']))}
                  className="text-indigo-400 text-sm hover:text-indigo-300 underline"
                >
                  重置筛选
                </button>
              </div>
            </div>
          ) : (
            <KnowledgeGraphDynamic
              data={filteredData}
              width={graphW}
              height={graphH}
              searchTerm={searchTerm}
              userProgress={userProgress}
              onNodeSelect={(node) => {
                setSelectedNode(node);
                if (node && !sidebarOpen) setSidebarOpen(true);
              }}
              onNodeExpand={handleNodeExpand}
            />
          )}
        </main>

        {/* 侧边栏折叠按钮 */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="absolute top-1/2 z-20 -translate-y-1/2 w-5 h-12
            bg-gray-800 border border-gray-700 rounded-l-md
            flex items-center justify-center text-gray-500
            hover:text-gray-200 transition-all duration-200 shadow-lg"
          style={{ right: sidebarOpen ? `${sidebarW}px` : '0px' }}
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
          className="shrink-0 overflow-hidden transition-all duration-200
            border-l border-gray-800 bg-[#141820]"
          style={{ width: sidebarOpen ? `${sidebarW}px` : '0px' }}
        >
          {sidebarOpen && (
            <div className="w-full h-full overflow-y-auto p-4 space-y-4">
              <NodeDetailCard node={selectedNode} onExpand={handleNodeExpand} />
              <GraphStats
                nodes={filteredData.nodes.length}
                edges={filteredData.edges.length}
                totalNodes={graphData.nodes.length}
                totalEdges={graphData.edges.length}
                myLocationActive={myLocationActive}
                userProgress={userProgress}
              />
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
  myLocationActive: boolean;
  progressLoading: boolean;
  onMyLocation: () => void;
}

function Toolbar({
  searchTerm, onSearchChange, typeFilter, onToggleType,
  layout, onLayoutChange, isFullscreen, onToggleFullscreen,
  nodeCount, edgeCount,
  myLocationActive, progressLoading, onMyLocation,
}: ToolbarProps) {
  return (
    <header className="h-14 flex items-center gap-3 px-4 shrink-0
      bg-[#141820] border-b border-gray-800">

      {/* 搜索框 */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索节点..."
          className="w-44 h-8 pl-8 pr-3 text-sm
            border border-gray-700 rounded-lg
            bg-gray-800 text-gray-200
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
            placeholder:text-gray-600"
        />
        <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {searchTerm && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="w-px h-6 bg-gray-700" />

      {/* 节点类型筛选 */}
      <div className="flex items-center gap-1 flex-wrap">
        {NODE_TYPES.map(({ type, label, color }) => (
          <button
            key={type}
            onClick={() => onToggleType(type)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-all
              ${typeFilter.has(type)
                ? 'border-gray-600 bg-gray-800 text-gray-200'
                : 'border-transparent bg-gray-900 text-gray-600'
              }`}
          >
            <span className="w-2 h-2 rounded-full"
              style={{ backgroundColor: typeFilter.has(type) ? color : '#374151' }} />
            {label}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-gray-700" />

      {/* 布局切换 */}
      <div className="flex items-center gap-1">
        {(['force','tree','radial'] as LayoutType[]).map((t) => (
          <button
            key={t}
            onClick={() => onLayoutChange(t)}
            className={`px-2 py-1 text-xs rounded-md transition-colors capitalize
              ${layout === t
                ? 'bg-indigo-900/60 text-indigo-300 font-medium'
                : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
              }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-gray-700" />

      {/* 「我的位置」按钮 */}
      <button
        onClick={onMyLocation}
        disabled={progressLoading}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg
          border transition-all font-medium
          ${myLocationActive
            ? 'border-indigo-500 bg-indigo-900/40 text-indigo-300'
            : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-indigo-700 hover:text-indigo-400'
          }
          disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {progressLoading ? (
          <div className="w-3 h-3 rounded-full border border-indigo-400 border-t-transparent animate-spin" />
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
        我的位置
      </button>

      {/* 统计 */}
      <div className="ml-1 flex items-center gap-2 text-xs text-gray-600">
        <span className="text-gray-400">{nodeCount}</span> 节点
        <span>·</span>
        <span className="text-gray-400">{edgeCount}</span> 边
      </div>

      {/* 全屏 */}
      <div className="ml-auto">
        <button
          onClick={onToggleFullscreen}
          className="p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300 rounded-md transition-colors"
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
  const typeConf = NODE_TYPES.find((t) => t.type === node?.type);

  if (!node) {
    return (
      <div className="rounded-xl border border-dashed border-gray-700 p-5
        flex flex-col items-center justify-center gap-2 text-center min-h-[120px]">
        <svg className="w-7 h-7 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
        </svg>
        <p className="text-xs text-gray-600">点击节点查看详情</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
          style={{ backgroundColor: typeConf?.color ?? '#6B7280' }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">{node.type}</p>
          <h3 className="text-sm font-semibold text-gray-100 leading-snug">{node.name}</h3>
        </div>
      </div>

      <div className="space-y-1.5 text-xs text-gray-400">
        <div className="flex justify-between">
          <span className="text-gray-500">分类</span>
          <span className="font-medium text-gray-300 truncate max-w-[140px]">{node.category}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">难度</span>
          <span className="font-medium text-yellow-400">
            {'★'.repeat(node.difficulty)}{'☆'.repeat(Math.max(0, 5 - node.difficulty))}
          </span>
        </div>
      </div>

      {node.metadata?.description && (
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-4">
          {node.metadata.description}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onExpand(node.id)}
          className="flex-1 rounded-lg border border-indigo-800 px-2.5 py-1.5 text-xs
            text-indigo-400 hover:bg-indigo-900/30 transition-colors"
        >
          展开关联
        </button>
        {node.type === 'PROBLEM' && (
          <Link
            href={`/problems/${node.id}`}
            className="flex-1 rounded-lg border border-gray-700 px-2.5 py-1.5 text-xs
              text-gray-400 hover:bg-gray-800 transition-colors text-center"
          >
            查看题目
          </Link>
        )}
        {node.type === 'PATTERN' && (
          <Link
            href={`/patterns/${node.id.replace('pattern:', '')}`}
            className="flex-1 rounded-lg border border-gray-700 px-2.5 py-1.5 text-xs
              text-gray-400 hover:bg-gray-800 transition-colors text-center"
          >
            查看模式
          </Link>
        )}
      </div>
    </div>
  );
}

// ===== 图谱统计 =====
interface GraphStatsProps {
  nodes: number; edges: number;
  totalNodes: number; totalEdges: number;
  myLocationActive: boolean;
  userProgress?: UserProgress;
}

function GraphStats({ nodes, edges, totalNodes, totalEdges, myLocationActive, userProgress }: GraphStatsProps) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-3 space-y-3">
      <p className="text-xs font-medium text-gray-400">📊 图谱概览</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: '当前节点', value: nodes,      color: 'text-indigo-400' },
          { label: '关联边数', value: edges,      color: 'text-emerald-400' },
          { label: '全部节点', value: totalNodes, color: 'text-gray-400' },
          { label: '全部边数', value: totalEdges, color: 'text-gray-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg bg-gray-800 p-2 text-center">
            <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
            <p className="text-[10px] text-gray-600">{label}</p>
          </div>
        ))}
      </div>
      {myLocationActive && userProgress && (
        <div className="pt-1 space-y-1 border-t border-gray-800">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">我的进度</p>
          <div className="flex gap-2 text-xs">
            <span className="text-emerald-400">✓ {userProgress.completedProblemIds.size} 已完成</span>
            <span className="text-amber-400">! {userProgress.weakPatternIds.size} 薄弱</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 快捷操作 =====
function QuickActions({ selectedNode }: { selectedNode: GraphNodeDTO | null }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-3">
      <p className="text-xs font-medium text-gray-400 mb-2">⚡ 快捷操作</p>
      <div className="space-y-1.5">
        {selectedNode ? (
          <>
            {selectedNode.type === 'PROBLEM' && (
              <Link
                href={`/problems/${selectedNode.id}`}
                className="block w-full px-3 py-2 text-xs text-left text-gray-400
                  rounded-lg border border-gray-800 hover:bg-gray-800 transition-colors"
              >
                📖 查看题目详情
              </Link>
            )}
            {selectedNode.type === 'PATTERN' && (
              <Link
                href={`/patterns/${selectedNode.id.replace('pattern:', '')}`}
                className="block w-full px-3 py-2 text-xs text-left text-gray-400
                  rounded-lg border border-gray-800 hover:bg-gray-800 transition-colors"
              >
                🧩 查看模式详情
              </Link>
            )}
            <button className="w-full px-3 py-2 text-xs text-left text-gray-400
              rounded-lg border border-gray-800 hover:bg-gray-800 transition-colors">
              ✅ 标记已完成
            </button>
            <button className="w-full px-3 py-2 text-xs text-left text-gray-400
              rounded-lg border border-gray-800 hover:bg-gray-800 transition-colors">
              🛤️ 加入学习路径
            </button>
          </>
        ) : (
          <p className="text-xs text-gray-600 py-2 text-center">选中节点后可操作</p>
        )}
      </div>
    </div>
  );
}
