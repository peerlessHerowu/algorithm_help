'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';

// ===== 类型定义 =====

/** 图谱节点类型 */
export type NodeType = 'PATTERN' | 'PROBLEM' | 'MATH' | 'PAPER' | 'APPLICATION';

/** 图谱边关系类型 */
export type RelationType =
  | 'PREREQUISITE'
  | 'FOLLOW_UP'
  | 'HARDER_VERSION'
  | 'VARIANT'
  | 'SIMILAR_PATTERN'
  | 'MATH_FOUNDATION'
  | 'PAPER_REFERENCE'
  | 'APPLICATION_OF';

/** 后端返回的节点 DTO */
export interface GraphNodeDTO {
  id: string;
  type: NodeType;
  name: string;
  category: string;
  difficulty: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

/** 后端返回的边 DTO */
export interface GraphEdgeDTO {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  weight: number;
  description: string;
}

/** 组件接受的图谱数据 */
export interface GraphData {
  nodes: GraphNodeDTO[];
  edges: GraphEdgeDTO[];
}

/** 组件 Props（含交互回调） */
export interface KnowledgeGraphProps {
  data: GraphData;
  width?: number;
  height?: number;
  searchTerm?: string;
  onNodeSelect?: (node: GraphNodeDTO | null) => void;
  onNodeExpand?: (nodeId: string) => void;
}

// ===== 常量配置 =====

/** 节点类型→颜色映射 */
const NODE_COLOR_MAP: Record<NodeType, string> = {
  PATTERN: '#4F46E5',     // 靛蓝
  PROBLEM: '#059669',     // 翠绿
  MATH: '#D97706',        // 琥珀
  PAPER: '#DC2626',       // 红色
  APPLICATION: '#7C3AED', // 紫色
};

/** 实线边类型（前置/进阶/困难版本） */
const SOLID_EDGE_TYPES = new Set<RelationType>([
  'PREREQUISITE',
  'FOLLOW_UP',
  'HARDER_VERSION',
]);

/** 关系类型中文名 */
const RELATION_TYPE_LABEL: Record<RelationType, string> = {
  PREREQUISITE: '前置知识',
  FOLLOW_UP: '进阶',
  HARDER_VERSION: '困难版本',
  VARIANT: '变体',
  SIMILAR_PATTERN: '同模式',
  MATH_FOUNDATION: '数学基础',
  PAPER_REFERENCE: '论文引用',
  APPLICATION_OF: '应用实例',
};

// ===== D3 仿真用的内部类型 =====

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

/** 计算节点半径：基于连接数和难度 */
function calcNodeRadius(connections: number, difficulty: number): number {
  return Math.max(8, Math.min(30, 10 + connections * 2 + difficulty * 2));
}

/** 计算边线宽度：基于权重 */
function calcEdgeWidth(weight: number): number {
  return Math.max(1, weight * 4);
}

/** 判断边是否为虚线样式 */
function isDashedEdge(relationType: RelationType): boolean {
  return !SOLID_EDGE_TYPES.has(relationType);
}

/** 获取节点的相邻节点 ID 集合 */
function getAdjacentNodeIds(nodeId: string, links: SimLink[]): Set<string> {
  const adjacentIds = new Set<string>();
  links.forEach((link) => {
    const sourceId = typeof link.source === 'object' ? (link.source as SimNode).id : link.source;
    const targetId = typeof link.target === 'object' ? (link.target as SimNode).id : link.target;
    if (sourceId === nodeId) adjacentIds.add(targetId as string);
    if (targetId === nodeId) adjacentIds.add(sourceId as string);
  });
  return adjacentIds;
}

// ===== 组件 =====

export default function KnowledgeGraph({
  data,
  width = 900,
  height = 600,
  searchTerm,
  onNodeSelect,
  onNodeExpand,
}: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  /** 构建仿真节点数据，计算每个节点的连接数 */
  const buildSimData = useCallback(() => {
    const connectionCount = new Map<string, number>();
    data.nodes.forEach((n) => connectionCount.set(n.id, 0));
    data.edges.forEach((e) => {
      connectionCount.set(e.sourceId, (connectionCount.get(e.sourceId) ?? 0) + 1);
      connectionCount.set(e.targetId, (connectionCount.get(e.targetId) ?? 0) + 1);
    });

    const simNodes: SimNode[] = data.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      name: n.name,
      category: n.category,
      difficulty: n.difficulty,
      metadata: n.metadata,
      radius: calcNodeRadius(connectionCount.get(n.id) ?? 0, n.difficulty),
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

  // ===== 搜索高亮逻辑 =====
  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;
    const svg = d3.select(svgRef.current);
    const container = svg.select<SVGGElement>('g.graph-container');
    if (container.empty()) return;

    if (!searchTerm || searchTerm.trim() === '') {
      // 清除搜索高亮，恢复所有节点/边
      container.selectAll<SVGGElement, SimNode>('g.node')
        .style('opacity', 1);
      container.selectAll<SVGLineElement, SimLink>('line')
        .style('opacity', 0.6);
      return;
    }

    const term = searchTerm.toLowerCase();
    const matchedIds: string[] = [];

    container.selectAll<SVGGElement, SimNode>('g.node').each(function (d) {
      const isMatch = d.name.toLowerCase().includes(term);
      if (isMatch) matchedIds.push(d.id);
      d3.select(this).style('opacity', isMatch ? 1 : 0.2);
    });

    container.selectAll<SVGLineElement, SimLink>('line')
      .style('opacity', 0.1);

    // 画布平移居中到第一个匹配节点
    if (matchedIds.length > 0) {
      const firstMatch = container.selectAll<SVGGElement, SimNode>('g.node')
        .filter((d) => d.id === matchedIds[0])
        .datum();
      if (firstMatch && firstMatch.x != null && firstMatch.y != null) {
        const zoom = d3.zoomTransform(svgRef.current);
        const targetX = width / 2 - firstMatch.x * zoom.k;
        const targetY = height / 2 - firstMatch.y * zoom.k;
        svg.transition().duration(500).call(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (d3.zoom() as any).transform,
          d3.zoomIdentity.translate(targetX, targetY).scale(zoom.k)
        );
      }
    }
  }, [searchTerm, data.nodes.length, width, height]);

  // ===== 主渲染 Effect =====
  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { simNodes, simLinks } = buildSimData();

    // 创建缩放容器
    const container = svg.append('g').attr('class', 'graph-container');

    // 缩放行为
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });
    svg.call(zoom);

    // ===== 绘制边 =====
    const linkGroup = container.append('g').attr('class', 'links');
    const linkElements = linkGroup
      .selectAll<SVGLineElement, SimLink>('line')
      .data(simLinks)
      .enter()
      .append('line')
      .attr('stroke', '#94A3B8')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d) => calcEdgeWidth(d.weight))
      .attr('stroke-dasharray', (d) => (isDashedEdge(d.relationType) ? '5,5' : 'none'));

    // ===== 边 hover tooltip =====
    linkElements
      .on('mouseenter', function (event, d) {
        showTooltip(event, d);
        d3.select(this).attr('stroke', '#3B82F6').attr('stroke-opacity', 1);
      })
      .on('mouseleave', function () {
        hideTooltip();
        d3.select(this).attr('stroke', '#94A3B8').attr('stroke-opacity', 0.6);
      });

    // ===== 绘制节点 =====
    const nodeGroup = container.append('g').attr('class', 'nodes');
    const nodeElements = nodeGroup
      .selectAll<SVGGElement, SimNode>('g')
      .data(simNodes)
      .enter()
      .append('g')
      .attr('class', 'node');

    // 节点圆形
    nodeElements
      .append('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => NODE_COLOR_MAP[d.type])
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer');

    // 节点文字标签
    nodeElements
      .append('text')
      .text((d) => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.radius + 14)
      .attr('font-size', '11px')
      .attr('fill', '#374151')
      .attr('pointer-events', 'none');

    // ===== 节点点击：高亮相邻节点和边 =====
    nodeElements.on('click', function (event, d) {
      event.stopPropagation();
      const clickedId = d.id;

      if (selectedNodeId === clickedId) {
        // 再次点击取消选中
        clearHighlight(nodeElements, linkElements);
        setSelectedNodeId(null);
        onNodeSelect?.(null);
        return;
      }

      setSelectedNodeId(clickedId);
      const adjacentIds = getAdjacentNodeIds(clickedId, simLinks);
      highlightNeighbors(clickedId, adjacentIds, nodeElements, linkElements);
      // 传递节点数据给父组件
      const nodeDTO: GraphNodeDTO = {
        id: d.id, type: d.type, name: d.name,
        category: d.category, difficulty: d.difficulty, metadata: d.metadata,
      };
      onNodeSelect?.(nodeDTO);
    });

    // ===== 节点双击：展开加载更多 + 取消固定位置 =====
    nodeElements.on('dblclick', function (event, d) {
      event.stopPropagation();
      event.preventDefault();
      // 如果节点被固定，双击取消固定
      if (d.fx != null || d.fy != null) {
        d.fx = null;
        d.fy = null;
        simulation.alpha(0.3).restart();
        return;
      }
      // 否则触发展开回调
      onNodeExpand?.(d.id);
    });

    // 点击空白区域取消选中
    svg.on('click', () => {
      clearHighlight(nodeElements, linkElements);
      setSelectedNodeId(null);
      onNodeSelect?.(null);
    });

    // ===== 拖拽行为（释放后固定位置） =====
    const drag = d3.drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        // 释放后固定位置（不再设为 null）
        d.fx = d.x;
        d.fy = d.y;
      });

    nodeElements.call(drag);

    // ===== 力导向仿真 =====
    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .force('link', d3.forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.id)
        .distance(120)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('collide', d3.forceCollide<SimNode>().radius((d) => d.radius + 10))
      .force('center', d3.forceCenter(width / 2, height / 2));

    // tick 更新位置
    simulation.on('tick', () => {
      linkElements
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0);

      nodeElements.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
    };
  }, [data, width, height, buildSimData, onNodeSelect, onNodeExpand, selectedNodeId]);

  // ===== Tooltip 工具函数 =====
  function showTooltip(event: MouseEvent, d: SimLink) {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    const label = RELATION_TYPE_LABEL[d.relationType] || d.relationType;
    tooltip.innerHTML = `<strong>${label}</strong>${d.description ? `<br/>${d.description}` : ''}`;
    tooltip.style.display = 'block';
    tooltip.style.left = `${event.offsetX + 10}px`;
    tooltip.style.top = `${event.offsetY - 10}px`;
  }

  function hideTooltip() {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    tooltip.style.display = 'none';
  }

  // ===== 高亮/清除工具函数 =====
  function highlightNeighbors(
    clickedId: string,
    adjacentIds: Set<string>,
    nodes: d3.Selection<SVGGElement, SimNode, SVGGElement, unknown>,
    links: d3.Selection<SVGLineElement, SimLink, SVGGElement, unknown>,
  ) {
    // 降低非相邻节点透明度
    nodes.style('opacity', (d) =>
      d.id === clickedId || adjacentIds.has(d.id) ? 1 : 0.2
    );
    // 高亮相连边
    links.style('opacity', (d) => {
      const srcId = typeof d.source === 'object' ? (d.source as SimNode).id : d.source;
      const tgtId = typeof d.target === 'object' ? (d.target as SimNode).id : d.target;
      return srcId === clickedId || tgtId === clickedId ? 1 : 0.1;
    });
  }

  function clearHighlight(
    nodes: d3.Selection<SVGGElement, SimNode, SVGGElement, unknown>,
    links: d3.Selection<SVGLineElement, SimLink, SVGGElement, unknown>,
  ) {
    nodes.style('opacity', 1);
    links.style('opacity', 0.6);
  }

  return (
    <div className="knowledge-graph-container w-full h-full relative overflow-hidden">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-white dark:bg-gray-900"
        style={{ display: 'block' }}
      />
      {/* 边 hover tooltip */}
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg z-50"
        style={{ display: 'none' }}
      />
      {/* 图例 - 右下角避开侧边栏 */}
      <div className="absolute bottom-4 right-4 bg-white/95 dark:bg-gray-800/95 rounded-lg p-3 shadow-sm border border-gray-100 dark:border-gray-700 text-xs backdrop-blur-sm">
        <div className="font-medium text-gray-600 dark:text-gray-300 mb-2 text-[10px] uppercase tracking-wider">节点类型</div>
        <div className="flex flex-col gap-1.5">
          {Object.entries(NODE_COLOR_MAP).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-gray-500 dark:text-gray-400">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
