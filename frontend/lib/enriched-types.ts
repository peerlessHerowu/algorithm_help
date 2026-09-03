/**
 * Enriched 模块 TypeScript 类型定义
 *
 * 对应后端 enriched_solutions / enriched_feedback / enriched_votes 等数据结构
 * 以及 enrichment 任务相关的前端专用类型。
 */

// ============ 枚举 ============

/** 解析来源类型 */
export type SourceType = 'COMMUNITY' | 'AI_ORIGINAL' | 'OFFICIAL' | 'LEGACY_V1';

/** Enriched 解析状态 */
export type EnrichedStatus = 'DRAFT' | 'PUBLISHED' | 'REJECTED' | 'PENDING_REVIEW';

/** 投票类型 */
export type VoteType = 'UP' | 'DOWN';

/** 投票状态（含未投票） */
export type VoteState = 'UP' | 'DOWN' | 'NONE';

/** 纠错反馈错误类型 */
export type FeedbackErrorType =
  | 'CODE_ERROR'
  | 'LOGIC_ERROR'
  | 'UNCLEAR'
  | 'OUTDATED'
  | 'OTHER';

/** 纠错反馈处理状态 */
export type FeedbackStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED';

/** 异步任务状态（后端） */
export type TaskBackendStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

// ============ 数据模型 ============

/** Enriched 解析摘要（列表接口返回，不含 content/codeImplementations 完整内容） */
export interface EnrichedSolutionSummary {
  id: string;
  problemId: string;
  level: number;
  sourceSolutionId: string | null;
  sourceType: SourceType;
  sourceAuthor: string | null;
  sourceUrl: string | null;
  sourceVotes: number | null;
  title: string;
  summary: string | null;
  tags: string[];
  timeComplexity: string | null;
  spaceComplexity: string | null;
  qualityScore: number;
  version: number;
  recommended: boolean;
  status: EnrichedStatus;
  upvoteCount: number;
  downvoteCount: number;
  feedbackCount: number;
  createdAt: number;
  updatedAt: number;
}

/** Enriched 解析详情（展开时 lazy load） */
export interface EnrichedSolutionDetail extends EnrichedSolutionSummary {
  content: string;
  codeImplementations: Record<string, string> | null;
  aiProvider: string | null;
  processingSteps: string[] | null;
  viewCount: number;
}

/** 原始题解条目（crawled_solutions） */
export interface RawSolution {
  id: string;
  problemId: string;
  title: string;
  author: string;
  authorUrl: string | null;
  content: string;
  languages: string[];
  votes: number;
  views: number;
  publishedAt: number;
  sourceUrl: string;
  /** 是否已有对应 enriched 记录 */
  hasEnriched: boolean;
}

/** 原始题解分页响应 */
export interface RawSolutionPageResponse {
  content: RawSolution[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

/** 标签聚合项 */
export interface TagCount {
  tag: string;
  count: number;
}

// ============ 任务相关 ============

/** 任务状态响应（GET /enriched/tasks/{taskId}） */
export interface TaskStatusResponse {
  status: TaskBackendStatus;
  problemId: string;
  level: number;
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  result: string | null;
  error: string | null;
  retryCount: number;
  startedAt: number;
  createdAt: number;
}

/** 创建任务响应 */
export interface TaskCreateResponse {
  taskId: string;
}

// ============ API 错误相关 ============

/** 业务错误码定义 */
export enum EnrichmentErrorCode {
  /** 重复提交（已有活跃任务） */
  DUPLICATE_TASK = 40001,
  /** 频率超限 */
  RATE_LIMIT = 40002,
  /** 无原始题解可供丰富 */
  NO_SOURCE = 40003,
  /** 乐观锁冲突 */
  OPTIMISTIC_LOCK = 40004,
  /** 已投票（重复操作） */
  DUPLICATE_VOTE = 40005,
  /** 题目不存在 */
  PROBLEM_NOT_FOUND = 40401,
  /** enriched 记录不存在 */
  ENRICHED_NOT_FOUND = 40402,
  /** 需要登录 */
  LOGIN_REQUIRED = 40403,
  /** AI 服务不可用 */
  AI_UNAVAILABLE = 50001,
  /** 生成超时 */
  GENERATION_TIMEOUT = 50002,
}

/** 业务错误响应 data 载荷（按错误码区分） */
export interface RateLimitErrorData {
  retryAfterSeconds: number;
  usedCount: number;
  maxCount: number;
}

export interface DuplicateTaskErrorData {
  taskId: string;
}

export interface LoginRequiredErrorData {
  intent: string;
}

/** 统一业务错误类型 */
export interface EnrichmentApiError {
  code: number;
  message: string;
  data?: RateLimitErrorData | DuplicateTaskErrorData | LoginRequiredErrorData | unknown;
}

// ============ 投票相关 ============

/** 投票 API 响应 */
export interface VoteResponse {
  voteState: VoteState;
  upvoteCount: number;
  downvoteCount: number;
}

// ============ 反馈相关 ============

/** 纠错反馈提交请求 */
export interface FeedbackRequest {
  errorType: FeedbackErrorType;
  description: string;
}

/** 纠错反馈记录 */
export interface FeedbackRecord {
  id: number;
  enrichedId: string;
  userId: string | null;
  errorType: FeedbackErrorType;
  description: string;
  status: FeedbackStatus;
  resolvedBy: string | null;
  resolvedAt: number | null;
  createdAt: number;
}

// ============ 列表接口响应 ============

/** Enriched 列表接口响应 */
export interface EnrichedListResponse {
  items: EnrichedSolutionSummary[];
  source: 'enriched' | 'legacy';
  total: number;
}

/** 标签聚合接口响应 */
export interface TagsResponse {
  tags: TagCount[];
}

// ============ 频率超限倒计时 ============

/** localStorage 持久化的倒计时信息 */
export interface RateLimitPersistence {
  endTime: number;
  usedCount: number;
  maxCount: number;
}
