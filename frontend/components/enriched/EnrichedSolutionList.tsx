'use client';

/**
 * EnrichedSolutionList - 解析列表容器
 *
 * 职责：
 * - 管理级别状态、标签筛选状态、展开状态
 * - 从 API 获取列表数据（含前端级别缓存）
 * - 排序：recommended 置顶 → quality_score 降序
 * - "全部展开/收起"切换按钮
 * - 渲染 CollapsibleCard 列表
 * - legacy fallback：单张灰色标记卡片
 * - 级别切换时显示 CardSkeletonList 加载态
 *
 * 满足需求 5.5, 6.7, 6.9, 14.1-14.5, 21.1-21.4
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CollapsibleCard, { type EnrichedCardData } from './CollapsibleCard';
import { CardSkeletonList } from './SkeletonLoader';
import LevelTabs, { getSmartDefaultLevel } from './LevelTabs';
import TagFilter, { type TagCount } from './TagFilter';

/** 列表 API 响应类型 */
export interface EnrichedListResponse {
  items: EnrichedCardData[];
  source: 'enriched' | 'legacy';
  total: number;
}

/** 标签 API 响应类型 */
export type TagsResponse = TagCount[];

interface EnrichedSolutionListProps {
  /** 题目 ID */
  problemId: string;
  /** 各级别解析条数（由父组件传入或内部获取） */
  levelCounts: Record<number, number>;
  /** 获取列表数据 */
  fetchList: (problemId: string, level: number) => Promise<EnrichedListResponse>;
  /** 获取标签数据 */
  fetchTags: (problemId: string, level: number) => Promise<TagsResponse>;
  /** 获取单条详情 */
  fetchDetail: (id: string) => Promise<EnrichedCardData | null>;
  /** 投票回调 */
  onUpvote?: (id: string) => void;
  onDownvote?: (id: string) => void;
  /** 评论跳转 */
  onComment?: (id: string) => void;
  /** 纠错 */
  onReport?: (id: string) => void;
  /** 分享链接生成 */
  getShareUrl?: (id: string, level: number) => string;
  /** 是否新用户 */
  isNewUser?: boolean;
  /** 是否已登录 */
  isLoggedIn?: boolean;
  /** 是否管理员 */
  isAdmin?: boolean;
  /** 未登录时回调 */
  onLoginRequired?: (intent: string) => void;
  /** 初始级别（来自 URL 参数或阅读进度） */
  initialLevel?: number;
  /** 自定义类名 */
  className?: string;
}

/** 级别缓存结构 */
interface LevelCache {
  items: EnrichedCardData[];
  source: 'enriched' | 'legacy';
  tags: TagCount[];
  timestamp: number;
}

/** 缓存有效期：5 分钟 */
const CACHE_TTL = 5 * 60 * 1000;

export default function EnrichedSolutionList({
  problemId,
  levelCounts,
  fetchList,
  fetchTags,
  fetchDetail,
  onUpvote,
  onDownvote,
  onComment,
  onReport,
  getShareUrl,
  isNewUser = false,
  isLoggedIn = false,
  isAdmin = false,
  onLoginRequired,
  initialLevel,
  className,
}: EnrichedSolutionListProps) {
  // 智能默认级别
  const defaultLevel = useMemo(
    () => initialLevel || getSmartDefaultLevel(levelCounts),
    [initialLevel, levelCounts]
  );

  const [activeLevel, setActiveLevel] = useState(defaultLevel);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentData, setCurrentData] = useState<EnrichedCardData[]>([]);
  const [currentSource, setCurrentSource] = useState<'enriched' | 'legacy'>('enriched');
  const [currentTags, setCurrentTags] = useState<TagCount[]>([]);

  // 前端级别缓存
  const cacheRef = useRef<Map<number, LevelCache>>(new Map());

  /** 检查缓存是否有效 */
  const getCachedData = useCallback((level: number): LevelCache | null => {
    const cached = cacheRef.current.get(level);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached;
    }
    return null;
  }, []);

  /** 加载某级别数据（带缓存） */
  const loadLevelData = useCallback(
    async (level: number) => {
      // 先检查缓存
      const cached = getCachedData(level);
      if (cached) {
        setCurrentData(cached.items);
        setCurrentSource(cached.source);
        setCurrentTags(cached.tags);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [listRes, tagsRes] = await Promise.all([
          fetchList(problemId, level),
          fetchTags(problemId, level),
        ]);

        // 后端返回: { source, enrichedList, legacy } 或 { items, source, total }
        const rawRes = listRes as any;
        const items = rawRes.items ?? rawRes.enrichedList ?? [];
        const source = rawRes.source ?? 'enriched';

        // 写入缓存
        cacheRef.current.set(level, {
          items: Array.isArray(items) ? items : [],
          source,
          tags: Array.isArray(tagsRes) ? tagsRes : (tagsRes as any)?.tags ?? [],
          timestamp: Date.now(),
        });

        setCurrentData(Array.isArray(items) ? items : []);
        setCurrentSource(source);
        setCurrentTags(Array.isArray(tagsRes) ? tagsRes : (tagsRes as any)?.tags ?? []);
      } catch (err) {
        console.error('加载解析列表失败:', err);
        setCurrentData([]);
        setCurrentTags([]);
      } finally {
        setLoading(false);
      }
    },
    [problemId, fetchList, fetchTags, getCachedData]
  );

  // 初始加载 + 级别切换时加载
  useEffect(() => {
    loadLevelData(activeLevel);
  }, [activeLevel, loadLevelData]);

  /** 级别切换处理：重置标签和展开状态 */
  const handleLevelChange = useCallback((level: number) => {
    setActiveLevel(level);
    setSelectedTags([]);
    setExpandedIds(new Set());
    setAllExpanded(false);
  }, []);

  /** 标签筛选变更 */
  const handleTagsChange = useCallback((tags: string[]) => {
    setSelectedTags(tags);
  }, []);

  /** 单卡片展开/收起切换 */
  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /** 全部展开/收起 */
  const handleToggleAll = useCallback(() => {
    if (allExpanded) {
      setExpandedIds(new Set());
      setAllExpanded(false);
    } else {
      const allIds = new Set(currentData.map((item) => item.id));
      setExpandedIds(allIds);
      setAllExpanded(true);
    }
  }, [allExpanded, currentData]);

  /** 排序+筛选后的列表：recommended 置顶 → quality_score 降序 → 标签筛选 */
  const sortedAndFilteredItems = useMemo(() => {
    let items = [...currentData];

    // 标签筛选
    if (selectedTags.length > 0) {
      items = items.filter((item) =>
        item.tags?.some((tag) => selectedTags.includes(tag))
      );
    }

    // 排序：recommended 置顶，然后按 quality_score 降序
    items.sort((a, b) => {
      // recommended 置顶
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      // quality_score 降序
      return (b.qualityScore || 0) - (a.qualityScore || 0);
    });

    return items;
  }, [currentData, selectedTags]);

  /** 是否为 legacy 数据 */
  const isLegacy = currentSource === 'legacy';

  return (
    <div className={`space-y-3 ${className || ''}`}>
      {/* LevelTabs 级别选择器 */}
      <LevelTabs
        activeLevel={activeLevel}
        onLevelChange={handleLevelChange}
        counts={levelCounts}
        isNewUser={isNewUser}
      />

      {/* TagFilter 标签筛选栏 */}
      {!isLegacy && (
        <TagFilter
          tags={currentTags}
          selectedTags={selectedTags}
          onTagsChange={handleTagsChange}
          totalItems={currentData.length}
        />
      )}

      {/* 工具栏：全部展开/收起按钮 */}
      {!loading && sortedAndFilteredItems.length > 1 && !isLegacy && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleToggleAll}
            className="rounded-lg px-3 py-1 text-xs font-medium
              text-gray-500 hover:bg-gray-100 hover:text-gray-700
              dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200
              transition-colors duration-150
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {allExpanded ? '全部收起' : '全部展开'}
          </button>
        </div>
      )}

      {/* 加载态：骨架屏 */}
      {loading && <CardSkeletonList count={3} />}

      {/* 列表内容 */}
      {!loading && (
        <div className="space-y-3">
          {sortedAndFilteredItems.map((item) => (
            <CollapsibleCard
              key={item.id}
              data={item}
              expanded={expandedIds.has(item.id)}
              onToggle={handleToggle}
              onLoadDetail={fetchDetail}
              onUpvote={onUpvote}
              onDownvote={onDownvote}
              onComment={onComment}
              onReport={onReport}
              shareUrl={getShareUrl?.(item.id, activeLevel)}
              isLoggedIn={isLoggedIn}
              isAdmin={isAdmin}
              onLoginRequired={onLoginRequired}
              className={isLegacy ? 'opacity-75 border-gray-300 dark:border-gray-600' : ''}
            />
          ))}

          {/* Legacy fallback 标记 */}
          {isLegacy && sortedAndFilteredItems.length > 0 && (
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2">
              当前显示为旧版 v1 解析，暂无 AI 丰富版本
            </p>
          )}

          {/* 空状态（筛选后无结果） */}
          {!loading && sortedAndFilteredItems.length === 0 && currentData.length > 0 && (
            <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              没有匹配所选标签的解析
              <button
                type="button"
                onClick={() => setSelectedTags([])}
                className="ml-2 text-blue-500 hover:text-blue-600 dark:text-blue-400"
              >
                清除筛选
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
