'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';

// ===== 数据类型定义 =====

type NodeType = 'PATTERN' | 'PROBLEM' | 'MATH' | 'PAPER' | 'APPLICATION';

interface PathNode {
  nodeId: string;
  nodeType: NodeType;
  order: number;
  optional: boolean;
  unlockCondition: string | null;
  milestone: string | null;
}

interface LearningPath {
  id: string;
  name: string;
  description: string;
  category: string;
  estimatedHours: number;
  totalNodes: number;
  nodes: PathNode[];
}

interface MilestoneProgress {
  milestoneName: string;
  nodeId: string;
  completed: boolean;
}

interface PathProgress {
  pathId: string;
  pathName: string;
  totalNodes: number;
  completedNodes: number;
  progressPercent: number;
  milestones: MilestoneProgress[];
}

// ===== 节点状态枚举 =====

type NodeStatus = 'completed' | 'current' | 'locked';

// ===== 节点类型标签配置 =====

const NODE_TYPE_LABELS: Record<NodeType, { label: string; emoji: string }> = {
  PATTERN: { label: '模式', emoji: '🧩' },
  PROBLEM: { label: '题目', emoji: '📝' },
  MATH: { label: '数学', emoji: '📐' },
  PAPER: { label: '论文', emoji: '📄' },
  APPLICATION: { label: '应用', emoji: '🔧' },
};

// ===== 硬编码用户 ID（MVP 阶段） =====

const USER_ID = 'user1';

// ===== 主页面组件 =====

export default function LearningPathDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathId = params.id as string;

  const [pathData, setPathData] = useState<LearningPath | null>(null);
  const [progress, setProgress] = useState<PathProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ===== 数据加载 =====

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [pathRes, progressRes] = await Promise.all([
          fetch(`/api/learning-path/${pathId}`),
          fetch(`/api/learning-path/${pathId}/progress/${USER_ID}`),
        ]);

        if (!pathRes.ok) throw new Error(`路径请求失败: ${pathRes.status}`);
        const pathJson: LearningPath = await pathRes.json();
        setPathData(pathJson);

        if (progressRes.ok) {
          const progressJson: PathProgress = await progressRes.json();
          setProgress(progressJson);
        }
      } catch (err) {
        console.error('加载路径详情失败:', err);
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [pathId]);

  // ===== 计算每个节点的状态 =====

  const completedNodeIds = useMemo(() => {
    if (!progress || !pathData) return new Set<string>();
    // 根据 completedNodes 数量，前 N 个节点为已完成
    const completed = new Set<string>();
    const sortedNodes = [...(pathData.nodes || [])].sort((a, b) => a.order - b.order);
    for (let i = 0; i < progress.completedNodes && i < sortedNodes.length; i++) {
      completed.add(sortedNodes[i].nodeId);
    }
    return completed;
  }, [progress, pathData]);

  const getNodeStatus = (node: PathNode): NodeStatus => {
    if (completedNodeIds.has(node.nodeId)) return 'completed';
    // 当前节点：第一个未完成的节点
    const sortedNodes = [...(pathData?.nodes || [])].sort((a, b) => a.order - b.order);
    const firstIncomplete = sortedNodes.find((n) => !completedNodeIds.has(n.nodeId));
    if (firstIncomplete?.nodeId === node.nodeId) return 'current';
    return 'locked';
  };

  // ===== 里程碑完成状态映射 =====

  const milestoneMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (progress?.milestones) {
      progress.milestones.forEach((m) => map.set(m.nodeId, m.completed));
    }
    return map;
  }, [progress]);

  // ===== 加载中状态 =====

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-sm">加载路径详情...</span>
        </div>
      </div>
    );
  }

  // ===== 错误状态 =====

  if (error || !pathData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-red-500">⚠️ {error || '路径不存在'}</p>
          <button
            onClick={() => router.push('/learning-path')}
            className="px-4 py-2 text-sm text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const sortedNodes = [...pathData.nodes].sort((a, b) => a.order - b.order);
  const progressPercent = progress?.progressPercent ?? 0;
  const completedCount = progress?.completedNodes ?? 0;
  const totalCount = progress?.totalNodes ?? pathData.totalNodes;

  // ===== 渲染 =====

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面头部 */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* 返回按钮 */}
          <button
            onClick={() => router.push('/learning-path')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 mb-4 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回列表
          </button>

          {/* 路径标题 */}
          <h1 className="text-2xl font-bold text-gray-900">{pathData.name}</h1>
          <p className="mt-2 text-sm text-gray-500">{pathData.description}</p>

          {/* 进度条区域 */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                学习进度
              </span>
              <span className="text-sm text-gray-500">
                {completedCount}/{totalCount} 个节点已完成
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-400 text-right">
              {progressPercent}%
            </p>
          </div>
        </div>
      </header>

      {/* 节点列表 */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-1">
          {sortedNodes.map((node, index) => {
            const status = getNodeStatus(node);
            const isMilestone = node.milestone !== null;
            const milestoneCompleted = milestoneMap.get(node.nodeId) ?? false;

            return (
              <NodeItem
                key={node.nodeId}
                node={node}
                status={status}
                isMilestone={isMilestone}
                milestoneCompleted={milestoneCompleted}
                isLast={index === sortedNodes.length - 1}
              />
            );
          })}
        </div>
      </main>
    </div>
  );
}

// ===== 节点列表项组件 =====

interface NodeItemProps {
  node: PathNode;
  status: NodeStatus;
  isMilestone: boolean;
  milestoneCompleted: boolean;
  isLast: boolean;
}

function NodeItem({ node, status, isMilestone, milestoneCompleted, isLast }: NodeItemProps) {
  const typeInfo = NODE_TYPE_LABELS[node.nodeType] || { label: '未知', emoji: '❓' };

  // 状态图标
  const statusIcon = getStatusIcon(status);
  // 状态样式
  const statusStyle = getStatusStyle(status);

  return (
    <div className="relative flex items-stretch">
      {/* 左侧时间线 */}
      <div className="flex flex-col items-center w-10 shrink-0">
        {/* 状态圆圈 */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm
                        ${statusStyle.circle} z-10`}>
          {statusIcon}
        </div>
        {/* 连接线 */}
        {!isLast && (
          <div className={`flex-1 w-0.5 ${status === 'completed' ? 'bg-indigo-300' : 'bg-gray-200'}`} />
        )}
      </div>

      {/* 右侧节点内容 */}
      <div
        className={`flex-1 ml-3 mb-4 p-4 rounded-lg border transition-colors cursor-pointer
                    ${statusStyle.card}`}
        onClick={() => {
          // 未来跳转到对应题目/模式详情页
          if (status !== 'locked') {
            console.log('跳转到节点详情:', node.nodeId);
          }
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* 节点类型 emoji */}
            <span className="text-base">{typeInfo.emoji}</span>
            {/* 节点 ID（名称） */}
            <span className={`text-sm font-medium ${statusStyle.text}`}>
              {node.nodeId}
            </span>
            {/* 类型标签 */}
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              {typeInfo.label}
            </span>
            {/* 可选标记 */}
            {node.optional && (
              <span className="text-xs text-gray-400 italic">可选</span>
            )}
          </div>

          {/* 里程碑标记 */}
          {isMilestone && (
            <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
                            ${milestoneCompleted
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-500'}`}>
              🏆 {node.milestone}
            </span>
          )}
        </div>

        {/* 解锁条件提示 */}
        {status === 'locked' && node.unlockCondition && (
          <p className="mt-2 text-xs text-gray-400">
            🔒 解锁条件: {node.unlockCondition}
          </p>
        )}
      </div>
    </div>
  );
}

// ===== 状态图标 =====

function getStatusIcon(status: NodeStatus): string {
  switch (status) {
    case 'completed': return '✅';
    case 'current': return '🔵';
    case 'locked': return '🔒';
  }
}

// ===== 状态样式配置 =====

interface StatusStyle {
  circle: string;
  card: string;
  text: string;
}

function getStatusStyle(status: NodeStatus): StatusStyle {
  switch (status) {
    case 'completed':
      return {
        circle: 'bg-green-100',
        card: 'bg-white border-gray-200 hover:border-gray-300',
        text: 'text-gray-700',
      };
    case 'current':
      return {
        circle: 'bg-indigo-100 ring-2 ring-indigo-400',
        card: 'bg-indigo-50 border-indigo-300 hover:border-indigo-400 shadow-sm',
        text: 'text-indigo-700 font-semibold',
      };
    case 'locked':
      return {
        circle: 'bg-gray-100',
        card: 'bg-gray-50 border-gray-100 opacity-60',
        text: 'text-gray-400',
      };
  }
}
