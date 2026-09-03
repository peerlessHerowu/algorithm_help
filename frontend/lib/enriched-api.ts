/**
 * Enriched 模块统一 API 调用层
 *
 * 类型安全的 fetch wrapper，复用全局 ApiError 类，
 * 同时保留业务错误码 (code) 以支持 useEnrichmentError 精确处理。
 */

import { ApiError } from './api';
import { useAppStore } from '@/store';
import type {
  EnrichedSolutionSummary,
  EnrichedSolutionDetail,
  EnrichedListResponse,
  TagsResponse,
  RawSolutionPageResponse,
  TaskStatusResponse,
  TaskCreateResponse,
  VoteResponse,
  FeedbackRequest,
  EnrichmentApiError,
} from './enriched-types';

// ============ 基础配置 ============

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

// ============ 内部工具 ============

/**
 * 类型安全 fetch wrapper
 *
 * 与全局 api.ts 的 request() 类似，但：
 * - 返回原始业务错误码（error.status = 业务 code，如 40002）
 * - error.raw 保留完整响应体（含 data 字段），供 useEnrichmentError 使用
 */
async function enrichedRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAppStore.getState().token;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, '网络连接失败，请检查网络后重试');
  }

  // 401 自动清除认证状态
  if (res.status === 401) {
    useAppStore.getState().logout();
  }

  const body = await res.json().catch(() => null);

  // HTTP 错误或业务错误统一抛出
  if (!res.ok) {
    const code = body?.code ?? res.status;
    const message = body?.message ?? `请求失败 (${res.status})`;
    throw new ApiError(code, message, body);
  }

  // 业务层 code !== 200 也视为错误
  if (body?.code !== undefined && body.code !== 200) {
    throw new ApiError(body.code, body.message || '业务异常', body);
  }

  return body?.data as T;
}

/** 将查询参数对象转为 URL 查询字符串 */
function toQuery(params: Record<string, unknown>): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => [k, String(v)]);
  return entries.length > 0 ? `?${new URLSearchParams(entries)}` : '';
}

// ============ Enriched 解析 API ============

export const enrichedApi = {
  /** 获取 enriched 解析列表（某题某级别） */
  getList(problemId: string, level: number): Promise<EnrichedListResponse> {
    return enrichedRequest(
      `/api/v1/enriched/${enc(problemId)}/level/${level}`
    );
  },

  /** 获取单条 enriched 解析详情 */
  getDetail(id: string): Promise<EnrichedSolutionDetail> {
    return enrichedRequest(`/api/v1/enriched/${enc(id)}/detail`);
  },

  /** 获取标签聚合 */
  getTags(problemId: string, level: number): Promise<TagsResponse> {
    return enrichedRequest(
      `/api/v1/enriched/${enc(problemId)}/level/${level}/tags`
    );
  },

  /** 触发生成任务 */
  generate(problemId: string, level: number): Promise<TaskCreateResponse> {
    return enrichedRequest(
      `/api/v1/enriched/${enc(problemId)}/generate`,
      { method: 'POST', body: JSON.stringify({ level }) }
    );
  },

  /** 查询任务状态 */
  getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
    return enrichedRequest(`/api/v1/enriched/tasks/${enc(taskId)}`);
  },

  /** 取消任务 */
  cancelTask(taskId: string): Promise<void> {
    return enrichedRequest(`/api/v1/enriched/tasks/${enc(taskId)}/cancel`, {
      method: 'POST',
    });
  },

  /** 点赞 */
  upvote(enrichedId: string): Promise<VoteResponse> {
    return enrichedRequest(
      `/api/v1/enriched/${enc(enrichedId)}/upvote`,
      { method: 'POST' }
    );
  },

  /** 踩 */
  downvote(enrichedId: string): Promise<VoteResponse> {
    return enrichedRequest(
      `/api/v1/enriched/${enc(enrichedId)}/downvote`,
      { method: 'POST' }
    );
  },

  /** 取消投票 */
  cancelVote(enrichedId: string): Promise<VoteResponse> {
    return enrichedRequest(
      `/api/v1/enriched/${enc(enrichedId)}/vote`,
      { method: 'DELETE' }
    );
  },

  /** 提交纠错反馈 */
  submitFeedback(enrichedId: string, data: FeedbackRequest): Promise<void> {
    return enrichedRequest(
      `/api/v1/enriched/${enc(enrichedId)}/feedback`,
      { method: 'POST', body: JSON.stringify(data) }
    );
  },
};

// ============ 原始题解 API ============

export interface RawSolutionQuery {
  page?: number;
  size?: number;
  sort?: 'votes' | 'time';
  language?: string;
}

export const rawSolutionsApi = {
  /** 获取原始题解列表（分页+排序+筛选） */
  getList(problemId: string, query: RawSolutionQuery = {}): Promise<RawSolutionPageResponse> {
    const qs = toQuery(query as Record<string, unknown>);
    return enrichedRequest(`/api/v1/raw-solutions/${enc(problemId)}${qs}`);
  },
};

// ============ 辅助 ============

function enc(s: string): string {
  return encodeURIComponent(s);
}

// ============ 错误解析辅助 ============

/**
 * 从 ApiError 中提取业务错误结构
 * 方便 useEnrichmentError 使用
 */
export function parseEnrichmentError(err: unknown): EnrichmentApiError | null {
  if (err instanceof ApiError) {
    const raw = err.raw as Record<string, unknown> | null;
    return {
      code: err.status,
      message: err.userMessage,
      data: raw?.data,
    };
  }
  return null;
}
