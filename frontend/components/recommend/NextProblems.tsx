'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { fetcher } from '@/lib/fetcher';

// ===== 类型 =====

interface RecommendItem {
  nodeId: string;
  name: string;
  relationType: string;
  description: string;
  difficulty: number;
  category: string;
}

interface RecommendGroupResponse {
  followUps: RecommendItem[];
  variants: RecommendItem[];
  harderVersions: RecommendItem[];
  samePattern: RecommendItem[];
  prerequisites: RecommendItem[];
  sourceNodeId: string | null;
}

// ===== 关系类型配置 =====

const RELATION_CONFIG: Record<string, {
  label: string; emoji: string;
  dotColor: string; badgeClass: string;
}> = {
  FOLLOW_UP: {
    label: '进阶题',
    emoji: '🚀',
    dotColor: '#6366F1',
    badgeClass: 'bg-indigo-900/40 text-indigo-300 border-indigo-700/50',
  },
  HARDER_VERSION: {
    label: '困难版本',
    emoji: '🔥',
    dotColor: '#EF4444',
    badgeClass: 'bg-red-900/40 text-red-300 border-red-700/50',
  },
  VARIANT: {
    label: '变体',
    emoji: '🔀',
    dotColor: '#8B5CF6',
    badgeClass: 'bg-purple-900/40 text-purple-300 border-purple-700/50',
  },
  SIMILAR_PATTERN: {
    label: '同模式',
    emoji: '🧩',
    dotColor: '#10B981',
    badgeClass: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  },
  PREREQUISITE: {
    label: '先做这题',
    emoji: '📚',
    dotColor: '#F59E0B',
    badgeClass: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
  },
};

// 难度颜色
function difficultyColor(d: number): string {
  if (d <= 2) return '#10B981';
  if (d <= 3) return '#F59E0B';
  return '#EF4444';
}

// ===== 主组件 =====

export default function NextProblems({ problemId }: { problemId: string }) {
  const { data, error, isLoading } = useSWR<RecommendGroupResponse>(
    problemId ? `/api/v1/problems/${encodeURIComponent(problemId)}/recommend` : null,
    fetcher
  );

  if (isLoading) return <Skeleton />;
  if (error || !data) return null;

  // 构建分组列表（只展示非空的组）
  const groups: { key: string; items: RecommendItem[] }[] = [
    { key: 'FOLLOW_UP',       items: data.followUps      ?? [] },
    { key: 'HARDER_VERSION',  items: data.harderVersions ?? [] },
    { key: 'VARIANT',         items: data.variants       ?? [] },
    { key: 'SIMILAR_PATTERN', items: data.samePattern    ?? [] },
    { key: 'PREREQUISITE',    items: data.prerequisites  ?? [] },
  ].filter(g => g.items.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gray-800 bg-[#141820] overflow-hidden">
      {/* 标题 */}
      <div className="px-5 py-3.5 border-b border-gray-800 flex items-center gap-2">
        <span className="text-base">💡</span>
        <h3 className="text-sm font-semibold text-gray-200">做完这题还应做</h3>
        <span className="ml-auto text-xs text-gray-600">
          {groups.reduce((sum, g) => sum + g.items.length, 0)} 道推荐
        </span>
      </div>

      {/* 分组列表 */}
      <div className="divide-y divide-gray-800/60">
        {groups.map(({ key, items }) => {
          const conf = RELATION_CONFIG[key] ?? { label: key, emoji: '•', dotColor: '#6B7280', badgeClass: 'bg-gray-800 text-gray-400' };
          return (
            <div key={key} className="px-5 py-4">
              {/* 分组标题 */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">{conf.emoji}</span>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {conf.label}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${conf.badgeClass}`}>
                  {items.length}
                </span>
              </div>

              {/* 题目列表 */}
              <div className="space-y-2">
                {items.map(item => (
                  <ProblemLink key={item.nodeId} item={item} conf={conf} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部：查看知识图谱 */}
      <div className="px-5 py-3 border-t border-gray-800 bg-gray-900/30">
        <Link
          href="/graph"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-400 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          在知识图谱中查看完整关系
        </Link>
      </div>
    </div>
  );
}

// ===== 题目链接卡片 =====

function ProblemLink({ item, conf }: {
  item: RecommendItem;
  conf: { dotColor: string; badgeClass: string };
}) {
  // 尝试从 nodeId 推断 problem ID（graph node ID 格式如 problem:two-sum）
  // 无法精确映射时跳转到搜索页
  const plainId = item.nodeId.replace('problem:', '');
  const href = `/problems/${plainId}`;

  return (
    <Link
      href={href}
      className="group flex items-start gap-3 p-3 rounded-xl
        bg-gray-800/30 border border-gray-800/60
        hover:border-indigo-700/50 hover:bg-gray-800/60
        transition-all duration-150"
    >
      {/* 圆点 */}
      <span className="mt-1.5 w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: conf.dotColor }} />

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-300 group-hover:text-white transition-colors leading-snug line-clamp-1">
          {item.name}
        </p>
        {item.description && (
          <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{item.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {item.category && (
            <span className="text-[10px] text-gray-600">{item.category}</span>
          )}
          {item.difficulty > 0 && (
            <span className="text-[10px] font-mono tabular-nums"
              style={{ color: difficultyColor(item.difficulty) }}>
              {'★'.repeat(item.difficulty)}{'☆'.repeat(Math.max(0, 5 - item.difficulty))}
            </span>
          )}
        </div>
      </div>

      <svg className="w-4 h-4 text-gray-700 group-hover:text-indigo-400 transition-colors shrink-0 mt-0.5"
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

// ===== 骨架屏 =====

function Skeleton() {
  return (
    <div className="rounded-2xl border border-gray-800 bg-[#141820] p-5 space-y-3 animate-pulse">
      <div className="h-4 w-32 bg-gray-700 rounded" />
      {[1,2,3].map(i => (
        <div key={i} className="h-14 bg-gray-800/60 rounded-xl" />
      ))}
    </div>
  );
}
