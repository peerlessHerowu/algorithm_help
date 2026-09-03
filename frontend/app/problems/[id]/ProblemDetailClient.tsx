'use client';

/**
 * 题目详情页客户端组件
 * 展示题目信息 + 4 Tab 导航（AI解析/原始题解/用户题解/评论） + 关联题目推荐
 *
 * Tab 结构：
 * - 📖 AI深度解析 (tab=ai) — EnrichedSolutionList + legacy fallback
 * - 📋 原始题解 (tab=raw) — RawSolutionList
 * - 📝 用户题解 (tab=user) — 现有 SolutionList（不修改）
 * - 💬 评论 (tab=comment) — 现有 CommentList（不修改）
 *
 * 特性：URL query 参数直达、各 Tab 数据独立缓存（mount once）
 */

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { useAppStore } from '@/store';
import { safeArray } from '@/lib/safeArray';
import type { Problem, Explanation, RelatedProblem, Difficulty, Approach, ContentSection, MathFoundation } from '@/lib/types';
import LevelTabs from '@/components/LevelTabs';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import MermaidRendererDynamic from '@/components/MermaidRendererDynamic';
import CodeBlock from '@/components/CodeBlock';
import ApproachComparison from '@/components/content/ApproachComparison';
import GenerationStatus from '@/components/common/GenerationStatus';
import ContentStatusBanner from '@/components/common/ContentStatusBanner';
import MathFoundationCard from '@/components/content/MathFoundationCard';
import AlgorithmStoryCard from '@/components/content/AlgorithmStoryCard';
import SolutionList from '@/components/solutions/SolutionList';
import CommentList from '@/components/comments/CommentList';
import RawSolutionList from '@/components/enriched/RawSolutionList';
import type { RawSolutionPageResponse } from '@/components/enriched/RawSolutionList';
import MainTabBar, { type MainTabKey, MAIN_TABS } from '@/components/enriched/MainTabBar';
import Link from 'next/link';
import ProblemHeader from '@/components/enriched/ProblemHeader';
import { useLangPreference } from '@/hooks/useLangPreference';
import { useShareLink } from '@/hooks/useShareLink';
import BackToTop from '@/components/enriched/BackToTop';
import EnrichedSolutionList from '@/components/enriched/EnrichedSolutionList';
import EmptyState from '@/components/enriched/EmptyState';
import GenerationProgress from '@/components/enriched/GenerationProgress';
import { AIAnalysisSkeleton } from '@/components/enriched/SkeletonLoader';
import { useEnrichmentTask } from '@/hooks/useEnrichmentTask';
import { enrichedApi } from '@/lib/enriched-api';

/** 校验 tab query 参数是否有效 */
function isValidTabKey(value: string | null): value is MainTabKey {
  return value !== null && MAIN_TABS.some((t) => t.key === value);
}

/** 难度颜色映射 */
const difficultyConfig: Record<Difficulty, { text: string; bg: string; label: string }> = {
  EASY: { text: 'text-green-700', bg: 'bg-green-100 dark:bg-green-900/30', label: '简单' },
  MEDIUM: { text: 'text-yellow-700', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: '中等' },
  HARD: { text: 'text-red-700', bg: 'bg-red-100 dark:bg-red-900/30', label: '困难' },
};

export default function ProblemDetailClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;

  // 从 store 获取用户偏好级别
  const { currentLevel, setLevel } = useAppStore();
  const [selectedLevel, setSelectedLevel] = useState(currentLevel);

  // 从 URL query 读取初始 Tab（?tab=ai|raw|user|comment）
  const tabFromUrl = searchParams.get('tab');
  const initialTab: MainTabKey = isValidTabKey(tabFromUrl) ? tabFromUrl : 'ai';
  const [activeTab, setActiveTab] = useState<MainTabKey>(initialTab);

  // 各 Tab 是否已挂载过（用于数据独立缓存 - mount once 模式）
  const mountedTabs = useRef<Set<MainTabKey>>(new Set([initialTab]));

  // 语言偏好（从 localStorage 持久化读写）
  const { lang, isChinese, toggleLang } = useLangPreference();

  // 分享与深度链接
  const { generateShareUrl, toastMessage, dismissToast, applyDeepLink, resolveDeepLink } = useShareLink();

  // 深度链接：从 URL 参数读取初始级别
  const deepLink = resolveDeepLink();
  const deepLinkLevelRef = useRef(deepLink.level);

  // 同步 store 中偏好级别的变化
  useEffect(() => {
    // 如果有深度链接级别参数，优先使用
    if (deepLinkLevelRef.current) {
      setSelectedLevel(deepLinkLevelRef.current);
      deepLinkLevelRef.current = null;
    } else {
      setSelectedLevel(currentLevel);
    }
  }, [currentLevel]);

  // Tab 切换处理：更新 URL query 参数（不刷新页面）
  const handleTabChange = useCallback((tab: MainTabKey) => {
    setActiveTab(tab);
    mountedTabs.current.add(tab);

    // 更新 URL query param（不触发页面 reload）
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    router.replace(url.pathname + url.search, { scroll: false });
  }, [router]);

  // 获取题目详情
  const { data: problem, error: problemError, isLoading: problemLoading } = useSWR<Problem>(
    id ? `/api/v1/problems/${encodeURIComponent(id)}` : null,
    fetcher
  );

  // 获取解析内容（根据当前级别）
  const {
    data: explanation,
    error: explanationError,
    isLoading: explanationLoading,
    mutate: mutateExplanation,
  } = useSWR<Explanation>(
    id ? `/api/v1/problems/${encodeURIComponent(id)}/explanation?level=${selectedLevel}` : null,
    fetcher,
    { keepPreviousData: true }
  );

  // 获取关联题目
  const { data: relatedProblems } = useSWR<RelatedProblem[]>(
    id ? `/api/v1/problems/${encodeURIComponent(id)}/related` : null,
    fetcher
  );

  // 切换级别处理
  const handleLevelChange = useCallback(
    (level: number) => {
      setSelectedLevel(level);
      setLevel(level); // 同步保存到 store
    },
    [setLevel]
  );

  /** 获取原始题解列表 */
  const fetchRawSolutionsData = useCallback(
    async (
      problemId: string,
      params: { sort: 'votes' | 'time'; language: string; page: number; size: number }
    ): Promise<RawSolutionPageResponse> => {
      const queryParams = new URLSearchParams({
        sort: params.sort,
        page: String(params.page),
        size: String(params.size),
      });
      if (params.language) queryParams.set('language', params.language);
      return fetcher<RawSolutionPageResponse>(
        `/api/v1/raw-solutions/${encodeURIComponent(problemId)}?${queryParams.toString()}`
      );
    },
    []
  );

  // 加载状态
  if (problemLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
      </div>
    );
  }

  // 错误状态
  if (problemError || !problem) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <p className="text-lg text-red-500">
            {problemError?.message || '题目加载失败'}
          </p>
          <Link href="/" className="mt-4 inline-block text-sm text-blue-500 hover:underline">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* 页头导航 */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/95">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ← 返回列表
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:px-6 xl:px-8">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8 xl:gap-12">
          {/* 左侧主内容 */}
          <div className="lg:col-span-2">
            {/* 题目标题区域 */}
            <ProblemHeader
              title={problem.title}
              titleCn={problem.titleCn}
              difficulty={problem.difficulty}
              tags={safeArray(problem.tags)}
              lang={lang}
              onToggleLang={toggleLang}
              hasChineseContent={!!(problem.titleCn || problem.descriptionCn)}
            />

            {/* 题目描述 */}
            <section className="mb-6 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
              <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-gray-200">
                题目描述
              </h2>
              <div
                className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: (isChinese && problem.descriptionCn ? problem.descriptionCn : problem.description) || '' }}
              />

              {/* 约束条件 */}
              {safeArray(problem.constraints).length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                    约束条件
                  </h3>
                  <ul className="list-inside list-disc space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    {safeArray(problem.constraints).map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 示例 — 仅当 description HTML 中没有 Example 时才展示（避免重复） */}
              {safeArray(problem.examples).length > 0 &&
               !(problem.description || '').includes('Example') &&
               !(problem.descriptionCn || '').includes('示例') && (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                    示例
                  </h3>
                  <div className="space-y-2">
                    {safeArray(problem.examples).map((ex, i) => (
                      <ExampleBlock key={i} index={i} raw={ex} />
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* 4 Tab 导航：AI深度解析 / 原始题解 / 用户题解 / 评论 */}
            <section className="rounded-xl bg-white shadow-sm dark:bg-gray-900">
              {/* MainTabBar 带蓝色指示条动画 */}
              <MainTabBar activeTab={activeTab} onTabChange={handleTabChange} />

              {/* Tab 内容区域 - mount once 模式实现数据缓存 */}
              <div className="p-6">
                {/* AI 深度解析 Tab - v2 enrichment system */}
                <div className={activeTab === 'ai' ? '' : 'hidden'}>
                  {mountedTabs.current.has('ai') && (
                    <EnrichedAITab
                      problemId={id}
                      level={selectedLevel}
                      onLevelChange={handleLevelChange}
                      explanation={explanation}
                      explanationLoading={explanationLoading}
                      explanationError={explanationError}
                      mutateExplanation={mutateExplanation}
                      mathFoundation={problem.mathFoundation}
                    />
                  )}
                </div>

                {/* 原始题解 Tab */}
                <div className={activeTab === 'raw' ? '' : 'hidden'}>
                  {mountedTabs.current.has('raw') && (
                    <RawSolutionList
                      problemId={id}
                      fetchRawSolutions={fetchRawSolutionsData}
                      isAdmin={false}
                    />
                  )}
                </div>

                {/* 用户题解 Tab（保持不变） */}
                <div className={activeTab === 'user' ? '' : 'hidden'}>
                  {mountedTabs.current.has('user') && (
                    <SolutionList problemId={id} />
                  )}
                </div>

                {/* 评论 Tab（保持不变） */}
                <div className={activeTab === 'comment' ? '' : 'hidden'}>
                  {mountedTabs.current.has('comment') && (
                    <CommentList targetType="PROBLEM" targetId={id} />
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* 右侧：关联题目 */}
          <aside className="mt-8 lg:mt-0">
            <div className="sticky top-8 space-y-6">
              <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
                <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-200">
                  关联题目
                </h2>
                {relatedProblems && relatedProblems.length > 0 ? (
                  <ul className="space-y-3">
                    {relatedProblems.map((rp) => (
                      <li key={rp.problemId}>
                        <Link
                          href={`/problems/${rp.problemId}`}
                          className="block rounded-lg p-3 transition-colors hover:bg-gray-50
                                     dark:hover:bg-gray-800"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                              {rp.title}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium
                                ${difficultyConfig[rp.difficulty].bg} ${difficultyConfig[rp.difficulty].text}`}
                            >
                              {difficultyConfig[rp.difficulty].label}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {rp.description}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-4 text-center">
                    <svg className="h-6 w-6 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <p className="text-xs text-gray-400 dark:text-gray-500">暂无关联题目</p>
                  </div>
                )}
              </div>

              {/* 算法故事卡片：仅当该题关联模式有考古内容时展示 */}
              {problem.relatedArchaeology && (
                <AlgorithmStoryCard
                  storyId={problem.relatedArchaeology.storyId}
                  algorithmName={problem.relatedArchaeology.algorithmName}
                  shortSummary={problem.relatedArchaeology.shortSummary}
                  inventorName={problem.relatedArchaeology.inventorName}
                  year={problem.relatedArchaeology.year}
                />
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* 回到顶部浮动按钮 */}
      <BackToTop />

      {/* 分享/复制 Toast 提示 */}
      {toastMessage && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg
            bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg
            dark:bg-gray-100 dark:text-gray-900
            animate-fade-in"
          onClick={dismissToast}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}

/**
 * EnrichedAITab - v2 AI 深度解析 Tab 内容
 *
 * 优先从 enriched API 获取数据，根据 source 字段决定渲染方式：
 * - source='enriched' → EnrichedSolutionList
 * - source='legacy' → 旧版 ExplanationContent
 * - 空数据 → EmptyState + 生成按钮
 * - 管理员可见 "🔄 重新生成" 按钮
 */
function EnrichedAITab({
  problemId,
  level,
  onLevelChange,
  explanation,
  explanationLoading,
  explanationError,
  mutateExplanation,
  mathFoundation,
}: {
  problemId: string;
  level: number;
  onLevelChange: (level: number) => void;
  explanation: Explanation | undefined;
  explanationLoading: boolean;
  explanationError: unknown;
  mutateExplanation: () => void;
  mathFoundation?: MathFoundation;
}) {
  const { user, isAuthenticated } = useAppStore();
  const isAdmin = user?.role === 'ADMIN';

  // enriched 数据加载状态
  const [enrichedLoading, setEnrichedLoading] = useState(true);
  const [enrichedSource, setEnrichedSource] = useState<'enriched' | 'legacy' | ''>('');
  const [enrichedItems, setEnrichedItems] = useState<unknown[]>([]);
  const [enrichedError, setEnrichedError] = useState<boolean>(false);
  const [regenerating, setRegenerating] = useState(false);

  // 任务管理 hook
  const {
    status: taskStatus,
    progress: taskProgress,
    estimatedRemaining,
    error: taskError,
    createTask,
    cancelTask,
    retryTask,
    reset: resetTask,
  } = useEnrichmentTask({
    onCompleted: () => {
      // 任务完成，刷新数据
      loadEnrichedData();
      mutateExplanation();
    },
    onFailed: (err) => {
      console.error('生成任务失败:', err);
    },
  });

  /** 是否正在生成中 */
  const isGenerating = ['creating', 'pending', 'processing'].includes(taskStatus);

  /** 加载 enriched 数据 */
  const loadEnrichedData = useCallback(async () => {
    setEnrichedLoading(true);
    setEnrichedError(false);
    try {
      const res = await enrichedApi.getList(problemId, level) as any;
      // 后端返回: { source: 'enriched'|'legacy', enrichedList: [...] | null, legacy: {...} | null }
      const source = res?.source || '';
      setEnrichedSource(source);
      if (source === 'enriched' && Array.isArray(res?.enrichedList)) {
        setEnrichedItems(res.enrichedList);
      } else {
        setEnrichedItems([]);
      }
    } catch {
      setEnrichedSource('');
      setEnrichedItems([]);
      setEnrichedError(true);
    } finally {
      setEnrichedLoading(false);
    }
  }, [problemId, level]);

  // 级别或题目变化时重新加载
  useEffect(() => {
    resetTask();
    loadEnrichedData();
  }, [problemId, level, loadEnrichedData, resetTask]);

  /** 触发生成（首次或重新生成） */
  const handleGenerate = useCallback(async (force = false) => {
    if (force) {
      setRegenerating(true);
    }
    try {
      await createTask(problemId, level);
    } finally {
      setRegenerating(false);
    }
  }, [createTask, problemId, level]);

  /** 登录引导 */
  const handleLoginRequired = useCallback((_intent: string) => {
    // TODO: 跳转登录或弹窗
  }, []);

  // 判断数据状态
  const hasEnrichedContent = enrichedSource === 'enriched' && enrichedItems.length > 0;
  const isLegacyFallback = enrichedSource === 'legacy';
  const isEmpty = !enrichedLoading && !enrichedError && !hasEnrichedContent && !isLegacyFallback;

  return (
    <div>
      {/* 标题栏 + 管理员重新生成按钮 */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          分级解析
        </h2>
        {isAdmin && (hasEnrichedContent || isLegacyFallback) && !isGenerating && (
          <button
            type="button"
            onClick={() => handleGenerate(true)}
            disabled={regenerating}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5
              text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800
              dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-150
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            🔄 重新生成
          </button>
        )}
      </div>

      {/* 级别切换标签 */}
      <LevelTabs
        activeLevel={level}
        onLevelChange={onLevelChange}
        loading={enrichedLoading}
      />

      {/* 内容区域 */}
      <div className="mt-6">
        {/* 生成进度态 */}
        {isGenerating && (
          <GenerationProgress
            status={taskStatus}
            progress={taskProgress}
            estimatedRemaining={estimatedRemaining}
            error={taskError}
            onCancel={cancelTask}
            onRetry={retryTask}
          />
        )}

        {/* 加载中（非生成态） */}
        {enrichedLoading && !isGenerating && (
          <AIAnalysisSkeleton />
        )}

        {/* enriched 丰富内容 */}
        {!enrichedLoading && !isGenerating && hasEnrichedContent && (
          <div className="animate-fade-in-up">
          <EnrichedSolutionList
            problemId={problemId}
            levelCounts={{ [level]: enrichedItems.length }}
            fetchList={enrichedApi.getList}
            fetchTags={enrichedApi.getTags}
            fetchDetail={async (id) => {
              const detail = await enrichedApi.getDetail(id);
              return detail as unknown as import('@/components/enriched/CollapsibleCard').EnrichedCardData;
            }}
            isLoggedIn={isAuthenticated}
            isAdmin={isAdmin}
            onLoginRequired={handleLoginRequired}
            initialLevel={level}
            hideLevelTabs={true}
          />
          </div>
        )}

        {/* legacy 回退：使用旧版 ExplanationContent */}
        {!enrichedLoading && !isGenerating && isLegacyFallback && (
          <div>
            {explanationLoading && !explanation && (
              <AIAnalysisSkeleton />
            )}
            {explanationError && (
              <GenerationStatus
                problemId={problemId}
                level={level}
                onComplete={() => mutateExplanation()}
              />
            )}
            {explanation && (
              <ExplanationContent
                explanation={explanation}
                problemId={problemId}
                level={level as 1 | 2 | 3 | 4 | 5}
                mathFoundation={mathFoundation}
                onGenerationComplete={() => mutateExplanation()}
              />
            )}
            {!explanationLoading && !explanation && !explanationError && (
              <GenerationStatus
                problemId={problemId}
                level={level}
                onComplete={() => mutateExplanation()}
              />
            )}
          </div>
        )}

        {/* 空状态：无任何内容 */}
        {!enrichedLoading && !isGenerating && isEmpty && (
          <EmptyState
            isLoggedIn={isAuthenticated}
            isCreating={taskStatus === 'creating'}
            onGenerate={() => handleGenerate(false)}
            onLoginRequired={handleLoginRequired}
          />
        )}

        {/* enriched API 错误回退到旧版 */}
        {!enrichedLoading && !isGenerating && enrichedError && (
          <div>
            {explanationLoading && !explanation && (
              <AIAnalysisSkeleton />
            )}
            {explanation && (
              <ExplanationContent
                explanation={explanation}
                problemId={problemId}
                level={level as 1 | 2 | 3 | 4 | 5}
                mathFoundation={mathFoundation}
                onGenerationComplete={() => mutateExplanation()}
              />
            )}
            {!explanationLoading && !explanation && (
              <GenerationStatus
                problemId={problemId}
                level={level}
                onComplete={() => mutateExplanation()}
              />
            )}
          </div>
        )}

        {/* 任务失败态（非进度组件内） */}
        {taskStatus === 'failed' && !isGenerating && (
          <GenerationProgress
            status={taskStatus}
            progress={taskProgress}
            estimatedRemaining={estimatedRemaining}
            error={taskError}
            onCancel={cancelTask}
            onRetry={retryTask}
          />
        )}
      </div>
    </div>
  );
}

/**
 * 解析内容展示组件
 * 根据 explanation.status 区分四种内容状态并分别展示
 */
function ExplanationContent({
  explanation,
  problemId,
  level,
  mathFoundation,
  onGenerationComplete,
}: {
  explanation: Explanation;
  problemId: string;
  level: 1 | 2 | 3 | 4 | 5;
  mathFoundation?: MathFoundation;
  onGenerationComplete: () => void;
}) {
  const { status } = explanation;
  // sections 可能是 JSON 字符串或已解析数组
  const sections: ContentSection[] = (() => {
    const raw = explanation.sections;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return []; }
    }
    return [];
  })();

  // 状态1：GENERATING - 生成中，展示进度组件
  if (status === 'GENERATING') {
    return (
      <GenerationStatus
        problemId={problemId}
        level={level}
        onComplete={onGenerationComplete}
      />
    );
  }

  // 状态2：PENDING_REVIEW - 待修正，展示审核横幅 + 降级内容
  if (status === 'PENDING_REVIEW') {
    return (
      <div className="space-y-6">
        <ContentStatusBanner status="PENDING_REVIEW" />
        <DegradedContent sections={sections} level={level} />
      </div>
    );
  }

  // 状态3：REJECTED - 已驳回
  if (status === 'REJECTED') {
    return (
      <div className="space-y-6">
        <ContentStatusBanner status="REJECTED" />
        <GenerationStatus
          problemId={problemId}
          level={level}
          onComplete={onGenerationComplete}
        />
      </div>
    );
  }

  // 状态4：PUBLISHED / ARCHIVED - 正常展示完整内容
  if (sections.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        该级别暂无解析内容
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {status === 'ARCHIVED' && <ContentStatusBanner status="ARCHIVED" />}
      <FullContent sections={sections} level={level} />
      {/* L4+ 级别底部展示数学基础关联卡片 */}
      {level >= 4 && mathFoundation && (
        <MathFoundationCard
          mathTopicName={mathFoundation.mathTopicName}
          patternName={mathFoundation.patternName}
          oneSentence={mathFoundation.oneSentence}
          mathRelationId={mathFoundation.mathRelationId}
        />
      )}
    </div>
  );
}

/**
 * 完整内容渲染：已生成状态正常渲染所有 section
 * 将当前级别传递给 MarkdownRenderer 以应用差异化样式
 */
function FullContent({ sections, level }: { sections: ContentSection[]; level: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <>
      {sections.map((section, idx) => (
        <div key={idx}>
          <h3 className="mb-2 text-base font-medium text-gray-800 dark:text-gray-200">
            {section.title}
          </h3>
          {section.contentType === 'code' ? (
            section.approaches && section.approaches.length > 0 ? (
              <div className="space-y-4">
                {section.approaches.map((approach, aIdx) => (
                  <div key={aIdx}>
                    <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                      {approach.name}
                    </p>
                    <CodeBlock code={approach.code} />
                  </div>
                ))}
              </div>
            ) : (
              <CodeBlock code={{ text: section.content }} />
            )
          ) : section.contentType === 'diagram' ? (
            <MermaidRendererDynamic code={section.content} />
          ) : (
            <MarkdownRenderer content={section.content} level={level} />
          )}
        </div>
      ))}

      {/* 解法对比区域 */}
      <ApproachComparisonSection sections={sections} />
    </>
  );
}

/**
 * 降级内容渲染：待修正状态仅展示代码和基本思路
 * 隐藏可能有误的 diagram 和详细文本内容，仅展示 code 类 section
 * 和标题中包含"思路"关键词的文本 section
 */
function DegradedContent({ sections, level }: { sections: ContentSection[]; level: 1 | 2 | 3 | 4 | 5 }) {
  // 筛选：代码段 + 包含"思路"/"idea"/"approach"关键词的文本段
  const degradedSections = sections.filter((section) => {
    if (section.contentType === 'code') return true;
    if (section.contentType === 'text') {
      const titleLower = section.title.toLowerCase();
      return (
        titleLower.includes('思路') ||
        titleLower.includes('方法') ||
        titleLower.includes('idea') ||
        titleLower.includes('approach') ||
        titleLower.includes('概述') ||
        titleLower.includes('overview')
      );
    }
    return false;
  });

  if (degradedSections.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
        审核期间暂无可展示的内容
      </div>
    );
  }

  return (
    <>
      {degradedSections.map((section, idx) => (
        <div key={idx}>
          <h3 className="mb-2 text-base font-medium text-gray-800 dark:text-gray-200">
            {section.title}
          </h3>
          {section.contentType === 'code' ? (
            section.approaches && section.approaches.length > 0 ? (
              <div className="space-y-4">
                {section.approaches.map((approach, aIdx) => (
                  <div key={aIdx}>
                    <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                      {approach.name}
                      {approach.idea && (
                        <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
                          — {approach.idea}
                        </span>
                      )}
                    </p>
                    <CodeBlock code={approach.code} />
                  </div>
                ))}
              </div>
            ) : (
              <CodeBlock code={{ text: section.content }} />
            )
          ) : (
            <MarkdownRenderer content={section.content} level={level} />
          )}
        </div>
      ))}
    </>
  );
}

/**
 * 解法对比区域子组件
 * 从 sections 中提取所有 approaches 数据并展示对比矩阵
 */
function ApproachComparisonSection({ sections }: { sections: ContentSection[] }) {
  const allApproaches = useMemo(() => {
    const result: Approach[] = [];
    for (const section of sections) {
      if (section.approaches) {
        result.push(...section.approaches);
      }
    }
    return result;
  }, [sections]);

  if (allApproaches.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="mb-3 text-base font-medium text-gray-800 dark:text-gray-200">
        解法对比
      </h3>
      <ApproachComparison approaches={allApproaches} />
    </div>
  );
}

/**
 * ExampleBlock — 示例块组件
 *
 * 兼容两种数据格式：
 * 1. "Input: ...\nOutput: ...\nExplanation: ..." 标准格式
 * 2. "[2,7,11,15]\n9\n[3,2,4]..." 原始数组拼接格式
 */
function ExampleBlock({ index, raw }: { index: number; raw: string }) {
  // 如果包含 Input/Output 关键词，按结构化方式渲染
  if (/input:|output:/i.test(raw)) {
    const lines = raw.split('\n').filter((l) => l.trim());
    return (
      <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
          示例 {index + 1}
        </div>
        <div className="p-3 space-y-1">
          {lines.map((line, i) => {
            const colonIdx = line.indexOf(':');
            if (colonIdx > 0) {
              const label = line.slice(0, colonIdx).trim();
              const value = line.slice(colonIdx + 1).trim();
              return (
                <div key={i} className="flex gap-2 text-sm">
                  <span className="text-gray-400 dark:text-gray-500 shrink-0 font-mono text-xs">{label}:</span>
                  <code className="text-gray-700 dark:text-gray-300 font-mono text-xs">{value}</code>
                </div>
              );
            }
            return <p key={i} className="text-xs text-gray-500 dark:text-gray-400">{line}</p>;
          })}
        </div>
      </div>
    );
  }

  // 原始格式：直接用 pre 但添加标题
  return (
    <div className="rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700">
      <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
        示例 {index + 1}
      </div>
      <pre className="p-3 text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 overflow-x-auto whitespace-pre-wrap">
        {raw}
      </pre>
    </div>
  );
}
