'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { useState } from 'react';
import { fetcher } from '@/lib/fetcher';
import CrossDomainTable from '@/components/patterns/CrossDomainTable';
import type { CrossDomainMapping } from '@/lib/types';

// ===== 类型定义 =====

interface RelatedPattern {
  id: string;
  name: string;
  category: string;
}

interface PatternDetail {
  id: string;
  name: string;
  category: string;
  template: string | null;
  signals: string | null;
  variants: string | null;
  relatedProblems: string | null;
  prerequisites: RelatedPattern[];
  followUps: RelatedPattern[];
  harderVersions: RelatedPattern[];
  similarPatterns: RelatedPattern[];
}

// ===== 工具函数 =====

function parseJsonArray(raw: string | null | string[]): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

function parseTemplate(raw: string | null | Record<string, string>): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

// 分类颜色
const CATEGORY_COLOR: Record<string, string> = {
  '动态规划': 'from-violet-600 to-purple-700',
  '图论':     'from-blue-600 to-cyan-700',
  '数据结构': 'from-emerald-600 to-teal-700',
  '双指针':   'from-orange-500 to-amber-600',
  '查找':     'from-sky-500 to-blue-600',
  '搜索':     'from-rose-500 to-pink-600',
  '贪心':     'from-lime-500 to-green-600',
  '哈希':     'from-amber-500 to-orange-600',
  '分治':     'from-indigo-500 to-violet-600',
  '位运算':   'from-slate-500 to-gray-600',
  '链表':     'from-cyan-500 to-teal-600',
  '数组':     'from-teal-500 to-emerald-600',
};
function getCategoryGradient(cat: string) {
  return CATEGORY_COLOR[cat] ?? 'from-indigo-600 to-purple-700';
}

// 语言 tab 配置
const LANG_CONFIG: { key: string; label: string; highlight: string }[] = [
  { key: 'python',     label: 'Python',     highlight: 'python' },
  { key: 'java',       label: 'Java',       highlight: 'java' },
  { key: 'cpp',        label: 'C++',        highlight: 'cpp' },
  { key: 'javascript', label: 'JavaScript', highlight: 'js' },
  { key: 'go',         label: 'Go',         highlight: 'go' },
  { key: 'core',       label: '核心逻辑',   highlight: 'text' },
  { key: 'steps',      label: '步骤说明',   highlight: 'text' },
];

// ===== 主组件 =====

export default function PatternDetailClient() {
  const params = useParams();
  const id = params.id as string;
  const [activeLang, setActiveLang] = useState<string>('python');

  const { data: crossDomain } = useSWR<CrossDomainMapping | null>(
    id ? `/api/patterns/pattern:${id}/cross-domain-table` : null,
    fetcher
  );
    id ? `/api/v1/patterns/${encodeURIComponent(id)}/detail` : null,
    fetcher
  );

  if (isLoading) return <LoadingSkeleton />;
  if (error || !pattern) return <ErrorState error={error?.message} />;

  const signals = parseJsonArray(pattern.signals);
  const variants = parseJsonArray(pattern.variants);
  const relatedProblems = parseJsonArray(pattern.relatedProblems);
  const templateMap = parseTemplate(pattern.template);

  // 找当前 tab 可用语言
  const availableLangs = LANG_CONFIG.filter(l => templateMap[l.key] !== undefined);
  const currentLang = availableLangs.find(l => l.key === activeLang) ?? availableLangs[0];

  return (
    <div className="min-h-screen bg-[#0F1117] text-gray-100">
      {/* ===== Hero Banner ===== */}
      <div className={`relative overflow-hidden bg-gradient-to-br ${getCategoryGradient(pattern.category)} py-12 px-6`}>
        {/* 背景装饰 */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-8 text-[120px] font-black leading-none select-none">
            {pattern.name.charAt(0)}
          </div>
        </div>
        <div className="relative max-w-5xl mx-auto">
          <Link
            href="/patterns"
            className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm mb-6 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回模式列表
          </Link>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-medium backdrop-blur-sm">
                  {pattern.category}
                </span>
                {pattern.prerequisites.length === 0 && (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/30 text-emerald-200 text-xs font-medium">
                    ✓ 无前置要求
                  </span>
                )}
              </div>
              <h1 className="text-4xl font-black text-white tracking-tight">{pattern.name}</h1>
              <p className="mt-2 text-white/60 text-sm">
                {signals.length} 个识别信号 · {variants.length} 个变体 · {relatedProblems.length} 道关联题目
              </p>
            </div>
            <Link
              href={`/graph?highlight=pattern:${id}`}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm transition-colors backdrop-blur-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 015.656 0l4-4a4 4 0 01-5.656-5.656l-1.1 1.1" />
              </svg>
              知识图谱中查看
            </Link>
          </div>
        </div>
      </div>

      {/* ===== 内容区 ===== */}
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* 演进路径（若有） */}
        {(pattern.prerequisites.length > 0 || pattern.followUps.length > 0 || pattern.harderVersions.length > 0) && (
          <EvolutionPath
            prerequisites={pattern.prerequisites}
            followUps={pattern.followUps}
            harderVersions={pattern.harderVersions}
            currentName={pattern.name}
          />
        )}

        {/* 识别信号 */}
        {signals.length > 0 && (
          <Section title="🔍 识别信号" subtitle="遇到这些特征时考虑使用此模式">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {signals.map((sig, i) => (
                <div key={i}
                  className="flex items-start gap-3 p-3 rounded-xl bg-gray-800/60 border border-gray-700/50">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-200 leading-relaxed">{sig}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 模板代码 */}
        {availableLangs.length > 0 && (
          <Section title="💻 代码模板" subtitle="可直接套用的框架代码">
            {/* 语言 Tabs */}
            <div className="flex gap-1 mb-4 flex-wrap">
              {availableLangs.map(lang => (
                <button
                  key={lang.key}
                  onClick={() => setActiveLang(lang.key)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-all font-medium
                    ${activeLang === lang.key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                    }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
            {currentLang && (
              <CodeDisplay
                code={Array.isArray(templateMap[currentLang.key])
                  ? (templateMap[currentLang.key] as unknown as string[]).join('\n')
                  : String(templateMap[currentLang.key] ?? '')}
                lang={currentLang.key}
              />
            )}
          </Section>
        )}

        {/* 变体 */}
        {variants.length > 0 && (
          <Section title="🔀 变体形式" subtitle="同一模式的不同变化形式">
            <div className="flex flex-wrap gap-2">
              {variants.map((v, i) => (
                <span key={i}
                  className="px-3 py-1.5 text-sm rounded-xl bg-purple-900/30 border border-purple-700/40 text-purple-300">
                  {v}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* 关联题目 */}
        {relatedProblems.length > 0 && (
          <Section title="📋 关联题目" subtitle={`${relatedProblems.length} 道经典例题`}>
            <RelatedProblemsGrid problemIds={relatedProblems} />
          </Section>
        )}

        {/* 相似模式 */}
        {pattern.similarPatterns.length > 0 && (
          <Section title="🔗 相似模式">
            <div className="flex flex-wrap gap-2">
              {pattern.similarPatterns.map(p => (
                <Link
                  key={p.id}
                  href={`/patterns/${p.id}`}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl
                    bg-gray-800 border border-gray-700 hover:border-indigo-600
                    text-sm text-gray-300 hover:text-white transition-all"
                >
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                  {p.name}
                  {p.category && (
                    <span className="text-xs text-gray-500">· {p.category}</span>
                  )}
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* 跨域迁移映射表 */}
        {crossDomain && (
          <Section title="🔄 跨域迁移映射" subtitle="同一算法思想在不同领域的应用对应关系">
            <CrossDomainTable
              mappings={[{
                id: crossDomain.id ?? '',
                leetcode: (crossDomain as unknown as { leetcodeScene?: string }).leetcodeScene ?? '',
                work:   (crossDomain as unknown as { workScene?: string }).workScene ?? '',
                aiMl:   (crossDomain as unknown as { aiScene?: string }).aiScene ?? '',
                daily:  (crossDomain as unknown as { lifeScene?: string }).lifeScene ?? '',
              }]}
              patternName={pattern.name}
            />
          </Section>
        )}
      </div>
    </div>
  );
}

// ===== 演进路径组件 =====
function EvolutionPath({ prerequisites, followUps, harderVersions, currentName }: {
  prerequisites: RelatedPattern[];
  followUps: RelatedPattern[];
  harderVersions: RelatedPattern[];
  currentName: string;
}) {
  return (
    <Section title="🛤️ 演进路径" subtitle="知识图谱中该模式的前后关联">
      <div className="flex flex-col sm:flex-row items-stretch gap-4">
        {/* 前置 */}
        {prerequisites.length > 0 && (
          <div className="flex-1 rounded-xl bg-gray-800/50 border border-gray-700/50 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-medium">先掌握</p>
            <div className="space-y-2">
              {prerequisites.map(p => (
                <Link key={p.id} href={`/patterns/${p.id}`}
                  className="flex items-center gap-2 group">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{p.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 中间：当前 */}
        <div className="flex flex-col items-center justify-center gap-2 px-2 shrink-0">
          {prerequisites.length > 0 && (
            <svg className="w-5 h-5 text-indigo-500 rotate-90 sm:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          )}
          <div className="px-4 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/50 text-center">
            <p className="text-xs text-indigo-400 mb-0.5">当前</p>
            <p className="text-sm font-semibold text-indigo-200">{currentName}</p>
          </div>
          {(followUps.length > 0 || harderVersions.length > 0) && (
            <svg className="w-5 h-5 text-indigo-500 rotate-90 sm:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          )}
        </div>

        {/* 进阶/困难 */}
        {(followUps.length > 0 || harderVersions.length > 0) && (
          <div className="flex-1 rounded-xl bg-gray-800/50 border border-gray-700/50 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-medium">进阶学习</p>
            <div className="space-y-2">
              {followUps.map(p => (
                <Link key={p.id} href={`/patterns/${p.id}`}
                  className="flex items-center gap-2 group">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{p.name}</span>
                  <span className="text-xs text-gray-600">进阶</span>
                </Link>
              ))}
              {harderVersions.map(p => (
                <Link key={p.id} href={`/patterns/${p.id}`}
                  className="flex items-center gap-2 group">
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{p.name}</span>
                  <span className="text-xs text-gray-600">困难版</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

// ===== 关联题目网格 =====
function RelatedProblemsGrid({ problemIds }: { problemIds: string[] }) {
  // 从 ID 猜测题目名（格式如 "两数之和(有序)"，或直接是 ID）
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {problemIds.map((pid, i) => {
        const isLcId = pid.startsWith('lc-');
        return (
          <Link
            key={pid}
            href={isLcId ? `/problems/${pid}` : `/problems/${pid}`}
            className="flex items-center gap-3 p-3 rounded-xl
              bg-gray-800/50 border border-gray-700/50
              hover:border-indigo-600/60 hover:bg-gray-800 transition-all group"
          >
            <span className="w-7 h-7 rounded-lg bg-indigo-900/50 text-indigo-400
              flex items-center justify-center text-xs font-bold shrink-0">
              {i + 1}
            </span>
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors line-clamp-1">
              {pid}
            </span>
            <svg className="w-4 h-4 text-gray-600 group-hover:text-indigo-400 transition-colors ml-auto shrink-0"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        );
      })}
    </div>
  );
}

// ===== 代码展示块 =====
function CodeDisplay({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-xl overflow-hidden border border-gray-700/50">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800/80 border-b border-gray-700/50">
        <span className="text-xs text-gray-500 font-mono">{lang}</span>
        <button onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-200 transition-colors">
          {copied ? (
            <><svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg><span className="text-emerald-400">已复制</span></>
          ) : (
            <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3" />
            </svg><span>复制</span></>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto bg-[#0D1117] text-gray-200 text-sm leading-relaxed font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ===== Section 包装 =====
function Section({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

// ===== 加载骨架 =====
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#0F1117]">
      <div className="h-48 bg-gray-800/60 animate-pulse" />
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {[1,2,3].map(i => (
          <div key={i} className="h-32 rounded-xl bg-gray-800/40 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// ===== 错误状态 =====
function ErrorState({ error }: { error?: string }) {
  return (
    <div className="min-h-screen bg-[#0F1117] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="text-4xl">⚠️</div>
        <p className="text-gray-300">{error ?? '模式加载失败'}</p>
        <Link href="/patterns"
          className="inline-block mt-2 text-sm text-indigo-400 hover:text-indigo-300 underline">
          返回模式列表
        </Link>
      </div>
    </div>
  );
}
