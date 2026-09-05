'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';

// ===== 类型定义 =====

export type NodeType = 'PATTERN' | 'PROBLEM' | 'MATH' | 'PAPER' | 'APPLICATION';

export type RelationType =
  | 'PREREQUISITE'
  | 'FOLLOW_UP'
  | 'HARDER_VERSION'
  | 'VARIANT'
  | 'SIMILAR_PATTERN'
  | 'MATH_FOUNDATION'
  | 'PAPER_REFERENCE'
  | 'APPLICATION_OF';

export interface GraphNodeDTO {
  id: string;
  type: NodeType;
  name: string;
  category: string;
  difficulty: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

export interface GraphEdgeDTO {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  weight: number;
  description: string;
}

export interface GraphData {
  nodes: GraphNodeDTO[];
  edges: GraphEdgeDTO[];
}

/** 用户进度数据（由父页面传入） */
export interface UserProgress {
  completedProblemIds: Set<string>;   // 已完成题目 ID
  weakPatternIds: Set<string>;        // 薄弱模式 ID
  currentNodeId?: string;             // 当前正在学习的节点
}

export interface KnowledgeGraphProps {
  data: GraphData;
  width?: number;
  height?: number;
  searchTerm?: string;
  userProgress?: UserProgress;
  onNodeSelect?: (node: GraphNodeDTO | null) => void;
  onNodeExpand?: (nodeId: string) => void;
}

// ===== 常量 =====

/** 节点类型默认颜色（无进度状态时使用） */
const NODE_BASE_COLOR: Record<NodeType, string> = {
  PATTERN:     '#4F46E5',  // 靛蓝
  PROBLEM:     '#059669',  // 翠绿
  MATH:        '#D97706',  // 琥珀
  PAPER:       '#DC2626',  // 红
  APPLICATION: '#7C3AED',  // 紫
};

/** 进度状态颜色（优先级高于 BASE_COLOR） */
const PROGRESS_COLOR = {
  completed: '#10B981',  // 翠绿 — 已完成
  weak:      '#F59E0B',  // 琥珀橙 — 薄弱
  current:   '#3B82F6',  // 亮蓝 — 当前选中
  locked:    '#94A3B8',  // 灰 — 未解锁/未接触
};

/** 实线边类型 */
const SOLID_EDGE_TYPES = new Set<RelationType>([
  'PREREQUISITE', 'FOLLOW_UP', 'HARDER_VERSION',
]);

/** 边颜色 */
const EDGE_COLOR: Record<RelationType, string> = {
  PREREQUISITE:     '#6366F1',
  FOLLOW_UP:        '#8B5CF6',
  HARDER_VERSION:   '#EF4444',
  VARIANT:          '#94A3B8',
  SIMILAR_PATTERN:  '#64748B',
  MATH_FOUNDATION:  '#F59E0B',
  PAPER_REFERENCE:  '#EC4899',
  APPLICATION_OF:   '#14B8A6',
};

/** 关系中文名 */
const RELATION_LABEL: Record<RelationType, string> = {
  PREREQUISITE:     '前置知识',
  FOLLOW_UP:        '进阶',
  HARDER_VERSION:   '困难版本',
  VARIANT:          '变体',
  SIMILAR_PATTERN:  '同模式',
  MATH_FOUNDATION:  '数学基础',
  PAPER_REFERENCE:  '论文引用',
  APPLICATION_OF:   '应用实例',
};

// ===== D3 内部类型 =====

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  type: NodeType;
  name: string;
  category: string;
  difficulty: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
  radius: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string;
  relationType: RelationType;
  weight: number;
  description: string;
}

// ===== 工具函数 =====

function calcNodeRadius(connections: number, difficulty: number): number {
  return Math.max(8, Math.min(28, 8 + connections * 1.8 + difficulty * 1.5));
}

function calcEdgeWidth(weight: number): number {
  return Math.max(1, weight * 3.5);
}

/** 获取节点填充颜色（考虑进度状态） */
function getNodeColor(
  node: SimNode,
  progress: UserProgress | undefined,
  selectedId: string | null,
): string {
  if (selectedId === node.id) return PROGRESS_COLOR.current;
  if (!progress) return NODE_BASE_COLOR[node.type];

  if (node.type === 'PROBLEM' && progress.completedProblemIds.has(node.id)) {
    return PROGRESS_COLOR.completed;
  }
  if (node.type === 'PATTERN' && progress.weakPatternIds.has(node.id)) {
    return PROGRESS_COLOR.weak;
  }
  if (progress.currentNodeId === node.id) return PROGRESS_COLOR.current;

  return NODE_BASE_COLOR[node.type];
}

/** 获取节点描边颜色 */
function getNodeStroke(
  node: SimNode,
  progress: UserProgress | undefined,
  selectedId: string | null,
): string {
  if (selectedId === node.id) return '#1D4ED8';
  if (!progress) return '#fff';
  if (node.type === 'PROBLEM' && progress.completedProblemIds.has(node.id)) return '#065F46';
  if (node.type === 'PATTERN' && progress.weakPatternIds.has(node.id)) return '#92400E';
  return '#fff';
}

function getAdjacentNodeIds(nodeId: string, links: SimLink[]): Set<string> {
  const ids = new Set<string>();
  links.forEach((link) => {
    const src = typeof link.source === 'object' ? (link.source as SimNode).id : link.source;
    const tgt = typeof link.target === 'object' ? (link.target as SimNode).id : link.target;
    if (src === nodeId) ids.add(tgt as string);
    if (tgt === nodeId) ids.add(src as string);
  });
  return ids;
}

// ===== 组件 =====

export default function KnowledgeGraph({
  data,
  width = 900,
  height = 600,
  searchTerm,
  userProgress,
  onNodeSelect,
  onNodeExpand,
}: KnowledgeGraphProps) {
  const svgRef     = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const buildSimData = useCallback(() => {
    const connCount = new Map<string, number>();
    data.nodes.forEach((n) => connCount.set(n.id, 0));
    data.edges.forEach((e) => {
      connCount.set(e.sourceId, (connCount.get(e.sourceId) ?? 0) + 1);
      connCount.set(e.targetId, (connCount.get(e.targetId) ?? 0) + 1);
    });

    const simNodes: SimNode[] = data.nodes.map((n) => ({
      ...n,
      radius: calcNodeRadius(connCount.get(n.id) ?? 0, n.difficulty),
    }));

    const simLinks: SimLink[] = data.edges.map((e) => ({
      id: e.id,
      source: e.sourceId,
      target: e.targetId,
      relationType: e.relationType,
      weight: e.weight,
      description: e.description,
    }));

    return { simNodes, simLinks };
  }, [data]);

  // ===== 搜索高亮 =====
  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;
    const svg = d3.select(svgRef.current);
    const container = svg.select<SVGGElement>('g.graph-container');
    if (container.empty()) return;

    if (!searchTerm?.trim()) {
      container.selectAll<SVGGElement, SimNode>('g.node').style('opacity', 1);
      container.selectAll<SVGLineElement, SimLink>('line').style('opacity', 0.55);
      return;
    }

    const term = searchTerm.toLowerCase();
    const matchedIds: string[] = [];

    container.selectAll<SVGGElement, SimNode>('g.node').each(function (d) {
      const match = d.name.toLowerCase().includes(term)
        || d.category.toLowerCase().includes(term);
      if (match) matchedIds.push(d.id);
      d3.select(this).style('opacity', match ? 1 : 0.12);
    });
    container.selectAll<SVGLineElement, SimLink>('line').style('opacity', 0.07);

    if (matchedIds.length > 0) {
      const first = container.selectAll<SVGGElement, SimNode>('g.node')
        .filter((d) => d.id === matchedIds[0]).datum();
      if (first?.x != null && first?.y != null && svgRef.current) {
        const t = d3.zoomTransform(svgRef.current);
        svg.transition().duration(500).call(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (d3.zoom() as any).transform,
          d3.zoomIdentity.translate(width / 2 - first.x * t.k, height / 2 - first.y * t.k).scale(t.k)
        );
      }
    }
  }, [searchTerm, data.nodes.length, width, height]);

  // ===== 主渲染 =====
  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { simNodes, simLinks } = buildSimData();

    // 箭头 marker
    const defs = svg.append('defs');
    const markerTypes: RelationType[] = ['PREREQUISITE', 'FOLLOW_UP', 'HARDER_VERSION'];
    markerTypes.forEach((rel) => {
      defs.append('marker')
        .attr('id', `arrow-${rel}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 18)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', EDGE_COLOR[rel]);
    });

    const container = svg.append('g').attr('class', 'graph-container');

    // 缩放
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 6])
      .on('zoom', (event) => container.attr('transform', event.transform));
    svg.call(zoom);
    // 初始缩放居中（大图谱默认缩小一点）
    const initScale = simNodes.length > 80 ? 0.55 : simNodes.length > 40 ? 0.75 : 1.0;
    svg.call(zoom.transform, d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(initScale)
      .translate(-width / 2, -height / 2));

    // ===== 边 =====
    const linkGroup = container.append('g').attr('class', 'links');
    const linkElements = linkGroup
      .selectAll<SVGLineElement, SimLink>('line')
      .data(simLinks)
      .enter()
      .append('line')
      .attr('stroke', (d) => EDGE_COLOR[d.relationType] ?? '#94A3B8')
      .attr('stroke-opacity', 0.55)
      .attr('stroke-width', (d) => calcEdgeWidth(d.weight))
      .attr('stroke-dasharray', (d) => SOLID_EDGE_TYPES.has(d.relationType) ? 'none' : '5,5')
      .attr('marker-end', (d) =>
        markerTypes.includes(d.relationType) ? `url(#arrow-${d.relationType})` : null);

    linkElements
      .on('mouseenter', function (event, d) {
        showEdgeTooltip(event, d);
        d3.select(this).attr('stroke-opacity', 1).attr('stroke-width', calcEdgeWidth(d.weight) + 1);
      })
      .on('mouseleave', function (_, d) {
        hideTooltip();
        d3.select(this).attr('stroke-opacity', 0.55).attr('stroke-width', calcEdgeWidth(d.weight));
      });

    // ===== 节点 =====
    const nodeGroup = container.append('g').attr('class', 'nodes');
    const nodeElements = nodeGroup
      .selectAll<SVGGElement, SimNode>('g')
      .data(simNodes)
      .enter()
      .append('g')
      .attr('class', 'node');

    // 光晕（进度状态节点的发光效果）
    nodeElements
      .filter((d) => {
        if (!userProgress) return false;
        return (
          userProgress.completedProblemIds.has(d.id) ||
          userProgress.weakPatternIds.has(d.id) ||
          userProgress.currentNodeId === d.id
        );
      })
      .append('circle')
      .attr('r', (d) => d.radius + 5)
      .attr('fill', (d) => getNodeColor(d, userProgress, selectedNodeId))
      .attr('opacity', 0.2)
      .attr('pointer-events', 'none');

    // 主圆
    nodeElements
      .append('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => getNodeColor(d, userProgress, selectedNodeId))
      .attr('stroke', (d) => getNodeStroke(d, userProgress, selectedNodeId))
      .attr('stroke-width', (d) => selectedNodeId === d.id ? 3 : 2)
      .style('cursor', 'pointer')
      .style('transition', 'r 0.15s ease');

    // 小徽标（已完成 ✓，薄弱 !）
    if (userProgress) {
      nodeElements
        .filter((d) => userProgress.completedProblemIds.has(d.id))
        .append('text')
        .text('✓')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-size', (d) => Math.max(8, d.radius * 0.8) + 'px')
        .attr('fill', '#fff')
        .attr('font-weight', 'bold')
        .attr('pointer-events', 'none');

      nodeElements
        .filter((d) => userProgress.weakPatternIds.has(d.id))
        .append('text')
        .text('!')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-size', (d) => Math.max(8, d.radius * 0.8) + 'px')
        .attr('fill', '#fff')
        .attr('font-weight', 'bold')
        .attr('pointer-events', 'none');
    }

    // 文字标签
    nodeElements
      .append('text')
      .text((d) => {
        // 超长名称截断
        const maxLen = d.type === 'PATTERN' ? 16 : 14;
        return d.name.length > maxLen ? d.name.slice(0, maxLen) + '…' : d.name;
      })
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.radius + 13)
      .attr('font-size', (d) => (d.type === 'PATTERN' ? '11px' : '10px'))
      .attr('fill', '#374151')
      .attr('font-weight', (d) => (d.type === 'PATTERN' ? '600' : '400'))
      .attr('pointer-events', 'none');

    // ===== hover tooltip =====
    nodeElements
      .on('mouseenter', function (event, d) {
        showNodeTooltip(event, d);
        d3.select(this).select('circle')
          .attr('r', d.radius + 3)
          .attr('stroke-width', 3);
      })
      .on('mousemove', function (event, d) {
        showNodeTooltip(event, d);
      })
      .on('mouseleave', function (_, d) {
        hideTooltip();
        d3.select(this).select('circle')
          .attr('r', d.radius)
          .attr('stroke-width', selectedNodeId === d.id ? 3 : 2);
      });

    // ===== 点击高亮 =====
    nodeElements.on('click', function (event, d) {
      event.stopPropagation();
      if (selectedNodeId === d.id) {
        clearHighlight(nodeElements, linkElements);
        setSelectedNodeId(null);
        onNodeSelect?.(null);
        return;
      }
      setSelectedNodeId(d.id);
      // 更新所有节点颜色（选中高亮）
      nodeElements.select('circle')
        .attr('fill', (n) => n.id === d.id
          ? PROGRESS_COLOR.current
          : getNodeColor(n, userProgress, null))
        .attr('stroke-width', (n) => n.id === d.id ? 3 : 2);

      const adj = getAdjacentNodeIds(d.id, simLinks);
      highlightNeighbors(d.id, adj, nodeElements, linkElements);
      onNodeSelect?.({
        id: d.id, type: d.type, name: d.name,
        category: d.category, difficulty: d.difficulty, metadata: d.metadata,
      });
    });

    // ===== 双击展开 =====
    nodeElements.on('dblclick', function (event, d) {
      event.stopPropagation();
      event.preventDefault();
      if (d.fx != null || d.fy != null) {
        d.fx = null; d.fy = null;
        simulation.alpha(0.3).restart();
      } else {
        onNodeExpand?.(d.id);
      }
    });

    svg.on('click', () => {
      clearHighlight(nodeElements, linkElements);
      nodeElements.select('circle')
        .attr('fill', (d) => getNodeColor(d, userProgress, null));
      setSelectedNodeId(null);
      onNodeSelect?.(null);
    });

    // ===== 拖拽 =====
    const drag = d3.drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = d.x; d.fy = d.y;
      });
    nodeElements.call(drag);

    // ===== 力导向 =====
    // 节点数大时调整参数避免过慢
    const chargeStrength = simNodes.length > 100 ? -200 : -320;
    const linkDist = simNodes.length > 100 ? 90 : 120;

    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .force('link', d3.forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(linkDist))
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('collide', d3.forceCollide<SimNode>().radius((d) => d.radius + 8))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.04))
      .force('y', d3.forceY(height / 2).strength(0.04));

    simulation.on('tick', () => {
      linkElements
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0);
      nodeElements.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    simulationRef.current = simulation;
    return () => { simulation.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, width, height, userProgress]);

  // ===== tooltip 工具函数 =====
  function showNodeTooltip(event: MouseEvent, d: SimNode) {
    const t = tooltipRef.current;
    if (!t || !svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const x = event.clientX - svgRect.left;
    const y = event.clientY - svgRect.top;

    const desc = d.metadata?.description
      ? `<div class="mt-1 text-gray-300 leading-relaxed line-clamp-3">${d.metadata.description}</div>` : '';
    const diffStars = '★'.repeat(d.difficulty) + '☆'.repeat(Math.max(0, 5 - d.difficulty));
    const progressLabel = userProgress
      ? userProgress.completedProblemIds.has(d.id) ? '<span class="text-emerald-400">✓ 已完成</span>'
      : userProgress.weakPatternIds.has(d.id) ? '<span class="text-amber-400">! 薄弱点</span>'
      : ''
      : '';

    t.innerHTML = `
      <div class="font-semibold text-white text-sm">${d.name}</div>
      <div class="flex items-center gap-2 mt-1">
        <span class="text-xs text-gray-400">${d.type}</span>
        <span class="text-xs text-yellow-400">${diffStars}</span>
        ${progressLabel}
      </div>
      <div class="text-xs text-gray-400 mt-0.5">${d.category}</div>
      ${desc}
    `;
    t.style.display = 'block';
    // 避免溢出边界
    const tw = t.offsetWidth || 200;
    const left = x + 14 + tw > (svgRef.current.clientWidth || width) ? x - tw - 8 : x + 14;
    t.style.left = `${left}px`;
    t.style.top  = `${Math.max(4, y - 30)}px`;
  }

  function showEdgeTooltip(event: MouseEvent, d: SimLink) {
    const t = tooltipRef.current;
    if (!t || !svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const label = RELATION_LABEL[d.relationType] || d.relationType;
    t.innerHTML = `
      <div class="font-semibold text-white text-sm">${label}</div>
      ${d.description ? `<div class="text-xs text-gray-300 mt-0.5">${d.description}</div>` : ''}
    `;
    t.style.display = 'block';
    t.style.left = `${event.clientX - svgRect.left + 10}px`;
    t.style.top  = `${event.clientY - svgRect.top - 12}px`;
  }

  function hideTooltip() {
    const t = tooltipRef.current;
    if (t) t.style.display = 'none';
  }

  function highlightNeighbors(
    clickedId: string, adj: Set<string>,
    nodes: d3.Selection<SVGGElement, SimNode, SVGGElement, unknown>,
    links: d3.Selection<SVGLineElement, SimLink, SVGGElement, unknown>,
  ) {
    nodes.style('opacity', (d) => (d.id === clickedId || adj.has(d.id) ? 1 : 0.2));
    links.style('opacity', (d) => {
      const s = typeof d.source === 'object' ? (d.source as SimNode).id : d.source;
      const tg = typeof d.target === 'object' ? (d.target as SimNode).id : d.target;
      return s === clickedId || tg === clickedId ? 1 : 0.08;
    });
  }

  function clearHighlight(
    nodes: d3.Selection<SVGGElement, SimNode, SVGGElement, unknown>,
    links: d3.Selection<SVGLineElement, SimLink, SVGGElement, unknown>,
  ) {
    nodes.style('opacity', 1);
    links.style('opacity', 0.55);
  }

  return (
    <div className="knowledge-graph-container w-full h-full relative overflow-hidden">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-[#0F1117] dark:bg-[#0F1117]"
        style={{ display: 'block' }}
      />

      {/* hover tooltip */}
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none bg-gray-900/95 backdrop-blur-sm
          border border-gray-700 text-white text-xs rounded-lg px-3 py-2 shadow-xl z-50
          max-w-[220px]"
        style={{ display: 'none' }}
      />

      {/* 图例 */}
      <Legend userProgress={userProgress} />
    </div>
  );
}

// ===== 图例组件 =====
function Legend({ userProgress }: { userProgress?: UserProgress }) {
  const nodeTypes = [
    { label: '模式',  color: NODE_BASE_COLOR.PATTERN },
    { label: '题目',  color: NODE_BASE_COLOR.PROBLEM },
    { label: '数学',  color: NODE_BASE_COLOR.MATH },
    { label: '论文',  color: NODE_BASE_COLOR.PAPER },
    { label: '应用',  color: NODE_BASE_COLOR.APPLICATION },
  ];

  const progressItems = userProgress ? [
    { label: '已完成',  color: PROGRESS_COLOR.completed, icon: '✓' },
    { label: '薄弱点',  color: PROGRESS_COLOR.weak,      icon: '!' },
    { label: '当前',    color: PROGRESS_COLOR.current,   icon: '●' },
  ] : [];

  return (
    <div className="absolute bottom-4 right-4 bg-gray-900/90 backdrop-blur-sm
      border border-gray-700 rounded-xl p-3 shadow-lg text-xs select-none z-10">
      <div className="text-gray-400 uppercase tracking-wider text-[10px] font-medium mb-2">节点类型</div>
      <div className="flex flex-col gap-1.5">
        {nodeTypes.map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-gray-300">{label}</span>
          </div>
        ))}
      </div>
      {progressItems.length > 0 && (
        <>
          <div className="border-t border-gray-700 my-2" />
          <div className="text-gray-400 uppercase tracking-wider text-[10px] font-medium mb-2">我的进度</div>
          <div className="flex flex-col gap-1.5">
            {progressItems.map(({ label, color, icon }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: color }}>
                  <span className="text-white font-bold" style={{ fontSize: 7 }}>{icon}</span>
                </span>
                <span className="text-gray-300">{label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
