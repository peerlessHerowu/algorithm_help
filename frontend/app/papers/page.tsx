'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { fetcher } from '@/lib/fetcher';

interface BridgeStep {
  order: number;
  title: string;
  description: string;
  connectionToNext?: string;
}

interface PaperBridge {
  id: string;
  baseAlgorithm: string;
  paperTitle: string;
  paperAuthors: string;
  paperYear: number;
  paperUrl: string;
  domain: string;
  bridgePath: BridgeStep[];
  leveledInterpretation: Record<string, string>;
  experimentUrl: string;
}

const DOMAIN_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  NLP:            { label: 'NLP',            color: '#6366F1', bg: 'bg-indigo-900/30', border: 'border-indigo-700/50' },
  CV:             { label: 'CV',             color: '#10B981', bg: 'bg-emerald-900/30',border: 'border-emerald-700/50' },
  RECOMMENDATION: { label: '推荐系统',       color: '#F59E0B', bg: 'bg-amber-900/30',  border: 'border-amber-700/50' },
  BIOINFORMATICS: { label: '生物信息学',     color: '#8B5CF6', bg: 'bg-purple-900/30', border: 'border-purple-700/50' },
  QUANTUM:        { label: '量子计算',       color: '#06B6D4', bg: 'bg-cyan-900/30',   border: 'border-cyan-700/50' },
  ROBOTICS:       { label: '机器人学',       color: '#EF4444', bg: 'bg-red-900/30',    border: 'border-red-700/50' },
};

function getDomainConf(domain: string) {
  return DOMAIN_CONFIG[domain] ?? { label: domain, color: '#6B7280', bg: 'bg-gray-800/40', border: 'border-gray-700' };
}

// ===== 路径步骤可视化 =====
function BridgePath({ steps, color }: { steps: BridgeStep[]; color: string }) {
  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={step.order} className="flex gap-3">
          {/* 序号+连线 */}
          <div className="flex flex-col items-center shrink-0">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: color }}>
              {step.order}
            </div>
            {i < steps.length - 1 && (
              <div className="w-px flex-1 my-1" style={{ backgroundColor: color + '40', minHeight: 16 }} />
            )}
          </div>
          {/* 内容 */}
          <div className="flex-1 pb-2">
            <p className="text-sm font-semibold text-gray-200 mb-1">{step.title}</p>
            <p className="text-xs text-gray-400 leading-relaxed">{step.description}</p>
            {step.connectionToNext && (
              <p className="text-[10px] text-gray-600 mt-1.5 italic">→ {step.connectionToNext}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== 论文卡片 =====
function PaperCard({ bridge }: { bridge: PaperBridge }) {
  const [expanded, setExpanded] = useState(false);
  const conf = getDomainConf(bridge.domain);
  const l3Content = bridge.leveledInterpretation?.['3'];

  return (
    <div className={`rounded-2xl border ${conf.border} ${conf.bg} overflow-hidden transition-all duration-200`}>
      {/* 卡片头 */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ color: conf.color, backgroundColor: conf.color + '20', border: `1px solid ${conf.color}50` }}>
                {conf.label}
              </span>
              {bridge.paperYear && (
                <span className="text-xs text-gray-500">{bridge.paperYear}</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-1">
              基础算法：<span className="text-gray-300 font-medium">{bridge.baseAlgorithm}</span>
            </p>
            <h3 className="text-sm font-bold text-gray-100 leading-snug line-clamp-2">
              {bridge.paperTitle}
            </h3>
            {bridge.paperAuthors && (
              <p className="text-xs text-gray-500 mt-1">{bridge.paperAuthors}</p>
            )}
          </div>
          {bridge.paperUrl && (
            <a href={bridge.paperUrl} target="_blank" rel="noopener noreferrer"
              className="shrink-0 px-2 py-1 text-[10px] rounded-lg border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200 transition-colors"
              onClick={e => e.stopPropagation()}>
              论文 ↗
            </a>
          )}
        </div>

        {/* L3 内容摘要 */}
        {l3Content && (
          <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 px-3 py-2.5 mb-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">L3 解读</p>
            <p className="text-xs text-gray-300 leading-relaxed line-clamp-3">{l3Content}</p>
          </div>
        )}

        {/* 展开/收起按钮 */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <span>{expanded ? '收起路径' : `查看 ${bridge.bridgePath?.length ?? 0} 步学习路径`}</span>
          <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* 展开的路径步骤 */}
      {expanded && bridge.bridgePath?.length > 0 && (
        <div className="border-t border-gray-800/60 px-5 py-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-4">学习路径</p>
          <BridgePath steps={bridge.bridgePath} color={conf.color} />
          {bridge.experimentUrl && (
            <a href={bridge.experimentUrl} target="_blank" rel="noopener noreferrer"
              className="mt-4 flex items-center gap-2 text-xs px-3 py-2 rounded-xl border transition-colors"
              style={{ color: conf.color, borderColor: conf.color + '50', backgroundColor: conf.color + '10' }}>
              🔬 动手实验 →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ===== 主页面 =====
export default function PapersPage() {
  const [activeDomain, setActiveDomain] = useState('ALL');

  const domains = ['ALL', ...Object.keys(DOMAIN_CONFIG)];

  const { data: nlp }  = useSWR<PaperBridge[]>('/api/paper-bridge/domain/NLP', fetcher);
  const { data: cv }   = useSWR<PaperBridge[]>('/api/paper-bridge/domain/CV', fetcher);
  const { data: rec }  = useSWR<PaperBridge[]>('/api/paper-bridge/domain/RECOMMENDATION', fetcher);
  const { data: bio }  = useSWR<PaperBridge[]>('/api/paper-bridge/domain/BIOINFORMATICS', fetcher);
  const { data: qc }   = useSWR<PaperBridge[]>('/api/paper-bridge/domain/QUANTUM', fetcher);
  const { data: rob }  = useSWR<PaperBridge[]>('/api/paper-bridge/domain/ROBOTICS', fetcher);

  const allBridges = [...(nlp||[]), ...(cv||[]), ...(rec||[]), ...(bio||[]), ...(qc||[]), ...(rob||[])];

  const filtered = activeDomain === 'ALL'
    ? allBridges
    : allBridges.filter(b => b.domain === activeDomain);

  return (
    <div className="min-h-screen bg-[#0F1117]">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* 标题 */}
        <div className="text-center mb-10 space-y-3">
          <div className="text-5xl mb-4">🔬</div>
          <h1 className="text-3xl font-black text-gray-100">论文桥梁</h1>
          <p className="text-gray-400 max-w-xl mx-auto leading-relaxed">
            从你已掌握的基础算法出发，一步步走向前沿论文。
            每座桥梁都是一条渐进式学习路径。
          </p>
        </div>

        {/* 领域筛选 */}
        <div className="flex gap-2 flex-wrap justify-center mb-8">
          {domains.map(d => {
            const conf = d === 'ALL' ? null : getDomainConf(d);
            return (
              <button key={d} onClick={() => setActiveDomain(d)}
                className={`px-3 py-1.5 text-xs rounded-xl border transition-all font-medium
                  ${activeDomain === d
                    ? 'text-white'
                    : 'border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300'
                  }`}
                style={activeDomain === d && conf ? {
                  backgroundColor: conf.color + '25',
                  borderColor: conf.color + '60',
                  color: conf.color,
                } : activeDomain === d ? {
                  backgroundColor: '#374151',
                  borderColor: '#6B7280',
                } : {}}>
                {d === 'ALL' ? '全部领域' : (conf?.label ?? d)}
                {d !== 'ALL' && <span className="ml-1.5 opacity-50">
                  {allBridges.filter(b => b.domain === d).length}
                </span>}
              </button>
            );
          })}
        </div>

        {/* 卡片网格 */}
        {filtered.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map(b => <PaperCard key={b.id} bridge={b} />)}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🔭</div>
            <p className="text-gray-500">加载中...</p>
          </div>
        )}
      </div>
    </div>
  );
}
