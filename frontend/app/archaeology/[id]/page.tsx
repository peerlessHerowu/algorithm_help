'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { fetcher } from '@/lib/fetcher';

interface TimelineEvent { year: number; event: string; detail?: string; }

interface Story {
  id: string;
  algorithmName: string;
  inventorName: string;
  inventionYear: number;
  inventionPlace: string;
  story: string;
  motivation: string;
  impact: string;
  shortSummary: string;
  relatedPatternId: string;
  timeline: TimelineEvent[];
}

function getEraColor(year: number): string {
  if (year < 1950) return '#8B5CF6';
  if (year < 1970) return '#3B82F6';
  if (year < 1990) return '#10B981';
  if (year < 2000) return '#F59E0B';
  return '#6366F1';
}

export default function ArchaeologyDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: story, isLoading, error } = useSWR<Story>(
    id ? `/api/archaeology/${id}` : null,
    fetcher
  );

  if (isLoading) return (
    <div className="min-h-screen bg-[#0F1117] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-amber-700 border-t-amber-400 animate-spin" />
    </div>
  );

  if (error || !story) return (
    <div className="min-h-screen bg-[#0F1117] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="text-4xl">🏛️</div>
        <p className="text-gray-400">故事加载失败</p>
        <Link href="/archaeology" className="text-amber-400 text-sm underline">返回列表</Link>
      </div>
    </div>
  );

  const color = getEraColor(story.inventionYear ?? 0);

  return (
    <div className="min-h-screen bg-[#0F1117]">
      {/* Hero Banner */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, #0F1117 0%, ${color}20 100%)` }}>
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-4 right-8 text-[180px] font-black leading-none select-none"
            style={{ color }}>
            {story.inventionYear}
          </div>
        </div>
        <div className="relative mx-auto max-w-4xl px-4 py-12">
          <Link href="/archaeology"
            className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-6 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回算法考古
          </Link>
          <div className="flex items-start gap-4">
            <div className="text-5xl shrink-0">🏛️</div>
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="text-xs font-mono font-bold" style={{ color }}>
                  {story.inventionYear}
                </span>
                {story.inventionPlace && (
                  <span className="text-xs text-gray-500">📍 {story.inventionPlace}</span>
                )}
                {story.relatedPatternId && (
                  <Link href={`/patterns/${story.relatedPatternId.replace('pattern:', '')}`}
                    className="text-xs px-2 py-0.5 rounded-full border"
                    style={{ color, borderColor: color + '50', backgroundColor: color + '15' }}>
                    {story.relatedPatternId.replace('pattern:', '')}
                  </Link>
                )}
              </div>
              <h1 className="text-3xl font-black text-gray-100 mb-2">{story.algorithmName}</h1>
              {story.inventorName && (
                <p className="text-gray-400 text-sm">by {story.inventorName}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* 主内容：故事 */}
          <div className="lg:col-span-2 space-y-8">
            {/* 故事摘要 */}
            {story.shortSummary && (
              <div className="rounded-2xl border border-gray-800 bg-[#141820] p-5">
                <p className="text-gray-300 leading-relaxed italic text-sm">
                  "{story.shortSummary}"
                </p>
              </div>
            )}

            {/* 发明动机 */}
            {story.motivation && (
              <section>
                <h2 className="text-base font-semibold text-gray-200 mb-3 flex items-center gap-2">
                  <span>💡</span> 发明动机
                </h2>
                <div className="rounded-2xl border border-gray-800 bg-[#141820] p-5">
                  <p className="text-sm text-gray-400 leading-relaxed">{story.motivation}</p>
                </div>
              </section>
            )}

            {/* 完整故事 */}
            {story.story && (
              <section>
                <h2 className="text-base font-semibold text-gray-200 mb-3 flex items-center gap-2">
                  <span>📖</span> 完整故事
                </h2>
                <div className="rounded-2xl border border-gray-800 bg-[#141820] p-5 space-y-3">
                  {story.story.split('\n\n').map((para, i) => (
                    <p key={i} className="text-sm text-gray-400 leading-relaxed">{para}</p>
                  ))}
                </div>
              </section>
            )}

            {/* 历史影响 */}
            {story.impact && (
              <section>
                <h2 className="text-base font-semibold text-gray-200 mb-3 flex items-center gap-2">
                  <span>🌏</span> 历史影响
                </h2>
                <div className="rounded-2xl border border-gray-800 bg-[#141820] p-5">
                  <p className="text-sm text-gray-400 leading-relaxed">{story.impact}</p>
                </div>
              </section>
            )}
          </div>

          {/* 右侧：时间线 */}
          <div className="space-y-5">
            {/* 基础信息 */}
            <div className="rounded-2xl border border-gray-800 bg-[#141820] p-4 space-y-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">基础信息</p>
              {[
                { label: '发明者', value: story.inventorName },
                { label: '年份',   value: story.inventionYear?.toString() },
                { label: '地点',   value: story.inventionPlace },
              ].filter(i => i.value).map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-300 font-medium text-right max-w-[60%]">{value}</span>
                </div>
              ))}
              {story.relatedPatternId && (
                <Link href={`/patterns/${story.relatedPatternId.replace('pattern:', '')}`}
                  className="block mt-2 text-center px-3 py-1.5 rounded-xl text-xs border transition-colors"
                  style={{ color, borderColor: color + '50', backgroundColor: color + '15' }}>
                  查看算法模式 →
                </Link>
              )}
            </div>

            {/* 时间线 */}
            {(story.timeline?.length ?? 0) > 0 && (
              <div className="rounded-2xl border border-gray-800 bg-[#141820] p-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">时间线</p>
                <div className="space-y-4">
                  {story.timeline.map((event, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        {i < story.timeline.length - 1 && (
                          <div className="w-px flex-1 bg-gray-800 min-h-4" />
                        )}
                      </div>
                      <div className="pb-2 min-w-0">
                        <span className="text-[10px] font-mono font-bold" style={{ color }}>
                          {event.year}
                        </span>
                        <p className="text-xs text-gray-300 mt-0.5">{event.event}</p>
                        {event.detail && (
                          <p className="text-[10px] text-gray-600 mt-0.5 leading-relaxed">{event.detail}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
