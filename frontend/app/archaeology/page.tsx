'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { fetcher } from '@/lib/fetcher';

interface Story {
  id: string;
  algorithmName: string;
  inventorName: string;
  inventionYear: number;
  inventionPlace: string;
  shortSummary: string;
  relatedPatternId: string;
}

interface PageResponse {
  content: Story[];
  totalElements: number;
}

// 年代色彩
function getEraColor(year: number): string {
  if (year < 1950) return '#8B5CF6'; // 紫 — 远古
  if (year < 1970) return '#3B82F6'; // 蓝 — 经典
  if (year < 1990) return '#10B981'; // 绿 — 成长
  if (year < 2000) return '#F59E0B'; // 琥珀 — 互联网
  return '#6366F1';                  // 靛 — 现代
}

function getEraLabel(year: number): string {
  if (year < 1950) return '远古';
  if (year < 1970) return '黎明';
  if (year < 1990) return '发展';
  if (year < 2000) return '互联网';
  return '现代';
}

export default function ArchaeologyPage() {
  const { data, isLoading } = useSWR<PageResponse>(
    '/api/archaeology/list?page=0&size=20',
    fetcher
  );

  const stories = data?.content ?? [];

  return (
    <div className="min-h-screen bg-[#0F1117]">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* 标题 */}
        <div className="text-center mb-10 space-y-3">
          <div className="text-5xl mb-4">🏛️</div>
          <h1 className="text-3xl font-black text-gray-100">算法考古</h1>
          <p className="text-gray-400 max-w-xl mx-auto leading-relaxed">
            每一个算法背后都有一段故事。探索那些改变计算机科学的发明时刻，
            从 Dijkstra 的咖啡馆灵感到 Huffman 的博士论文挑战。
          </p>
        </div>

        {/* 时间轴统计 */}
        {stories.length > 0 && (
          <div className="flex items-center gap-4 mb-8 px-2">
            <div className="h-px flex-1 bg-gray-800" />
            <span className="text-xs text-gray-500 shrink-0">{stories.length} 个传奇故事</span>
            <div className="h-px flex-1 bg-gray-800" />
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-gray-800/40 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {stories
              .sort((a, b) => (a.inventionYear ?? 0) - (b.inventionYear ?? 0))
              .map(story => {
                const color = getEraColor(story.inventionYear ?? 0);
                const era = getEraLabel(story.inventionYear ?? 0);
                return (
                  <Link key={story.id} href={`/archaeology/${story.id}`}>
                    <div className="group rounded-2xl border border-gray-800 bg-[#141820]
                      hover:border-gray-700/80 hover:-translate-y-0.5 hover:shadow-xl
                      transition-all duration-200 overflow-hidden h-full flex flex-col">
                      {/* 顶部色条 */}
                      <div className="h-1 w-full" style={{ backgroundColor: color }} />
                      <div className="p-5 flex-1">
                        {/* 年份 + 时代 */}
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs font-mono font-bold tabular-nums"
                            style={{ color }}>
                            {story.inventionYear}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border"
                            style={{ color, borderColor: color + '50', backgroundColor: color + '15' }}>
                            {era}
                          </span>
                        </div>
                        {/* 算法名称 */}
                        <h3 className="text-base font-bold text-gray-100 mb-1
                          group-hover:text-white transition-colors">
                          {story.algorithmName}
                        </h3>
                        {/* 发明者 */}
                        {story.inventorName && (
                          <p className="text-xs text-gray-500 mb-2">
                            by {story.inventorName}
                            {story.inventionPlace && ` · ${story.inventionPlace}`}
                          </p>
                        )}
                        {/* 摘要 */}
                        <p className="text-sm text-gray-400 leading-relaxed line-clamp-2">
                          {story.shortSummary}
                        </p>
                      </div>
                      {/* 底部 */}
                      <div className="px-5 py-3 border-t border-gray-800/60 flex items-center justify-between">
                        <span className="text-[10px] text-gray-600">
                          {story.relatedPatternId?.replace('pattern:', '') ?? ''}
                        </span>
                        <span className="text-xs text-gray-600 group-hover:text-gray-400 transition-colors">
                          阅读故事 →
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
