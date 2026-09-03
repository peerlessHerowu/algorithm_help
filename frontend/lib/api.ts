/**
 * 统一 API 调用层
 * 封装 problems、patterns、content 三组 API 调用方法
 * 含统一错误处理和 HTTP 状态码分类提示
 */

import type {
  ApiResponse,
  PageResponse,
  Problem,
  ProblemListItem,
  ProblemListParams,
  Explanation,
  ExplanationVersion,
  RelatedProblem,
  Pattern,
  GenerateOptions,
  TaskStatus,
  ImportResult,
  CompanyTag,
  UserPreferences,
} from './types';
import { useAppStore } from '@/store';

// ============ 基础配置 ============

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

// ============ 自定义错误类 ============

/** API 请求错误，携带 HTTP 状态码和用户友好提示 */
export class ApiError extends Error {
  status: number;
  userMessage: string;
  raw?: unknown;

  constructor(status: number, userMessage: string, raw?: unknown) {
    super(userMessage);
    this.name = 'ApiError';
    this.status = status;
    this.userMessage = userMessage;
    this.raw = raw;
  }
}

// ============ 统一错误处理 ============

/** 根据 HTTP 状态码返回用户友好的中文提示 */
function getErrorMessage(status: number, serverMessage?: string): string {
  switch (status) {
    case 400:
      return serverMessage || '请求参数有误';
    case 401:
      return '请重新登录';
    case 403:
      return '没有权限执行此操作';
    case 404:
      return serverMessage || '请求的资源不存在';
    case 429:
      return '请求过快，请稍后再试';
    case 500:
      return '服务器内部错误，请稍后重试';
    case 503:
      return '服务繁忙，请稍后再试';
    default:
      return serverMessage || `请求失败 (${status})`;
  }
}

/**
 * 统一的 fetch 封装
 * - 自动附加 Authorization header
 * - 解析 JSON 响应并解包 ApiResponse
 * - 根据 HTTP 状态码抛出带有用户友好提示的错误
 */
async function request<T>(
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

  // 非 2xx 响应统一处理
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const serverMsg = body?.message;
    throw new ApiError(res.status, getErrorMessage(res.status, serverMsg), body);
  }

  // 解包 ApiResponse<T>
  const json: ApiResponse<T> = await res.json();
  if (json.code !== 200) {
    throw new ApiError(json.code, json.message || '业务异常', json);
  }

  return json.data;
}

// ============ 辅助函数 ============

/** 将查询参数对象转为 URL 查询字符串（过滤 undefined/null） */
function toSearchParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => [k, String(v)]);
  return entries.length > 0 ? `?${new URLSearchParams(entries)}` : '';
}

// ============ API 调用方法 ============

/** 题目相关 API */
export const problemsApi = {
  /** 获取题目列表（分页，支持筛选） */
  list(params: ProblemListParams = {}): Promise<PageResponse<ProblemListItem>> {
    const query = toSearchParams(params as Record<string, unknown>);
    return request(`/api/v1/problems${query}`);
  },

  /** 获取题目详情 */
  get(id: string): Promise<Problem> {
    return request(`/api/v1/problems/${encodeURIComponent(id)}`);
  },

  /** 获取指定级别的解析内容 */
  getExplanation(id: string, level: number = 3): Promise<Explanation> {
    return request(`/api/v1/problems/${encodeURIComponent(id)}/explanation?level=${level}`);
  },

  /** 获取解析版本历史 */
  getExplanationHistory(id: string): Promise<ExplanationVersion[]> {
    return request(`/api/v1/problems/${encodeURIComponent(id)}/explanation/history`);
  },

  /** 获取关联题目推荐 */
  getRelated(id: string): Promise<RelatedProblem[]> {
    return request(`/api/v1/problems/${encodeURIComponent(id)}/related`);
  },

  /** 触发题目解析生成（返回 taskId） */
  generate(id: string, options: GenerateOptions = {}): Promise<string> {
    return request(`/api/v1/problems/${encodeURIComponent(id)}/generate`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  },
};

/** 算法模式相关 API */
export const patternsApi = {
  /** 获取模式列表 */
  list(): Promise<Pattern[]> {
    return request('/api/v1/patterns');
  },

  /** 获取模式详情（含关联题目） */
  get(id: string): Promise<Pattern> {
    return request(`/api/v1/patterns/${encodeURIComponent(id)}`);
  },
};

/** 内容相关 API */
export const contentApi = {
  /** 从 URL 导入题目内容 */
  importUrl(url: string): Promise<ImportResult> {
    return request('/api/v1/content/import-url', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  },
};

/** 任务状态 API */
export const tasksApi = {
  /** 查询任务进度 */
  getStatus(taskId: string): Promise<TaskStatus> {
    return request(`/api/v1/tasks/${encodeURIComponent(taskId)}/status`);
  },

  /** 创建 SSE 连接监听任务进度（返回 EventSource） */
  streamProgress(taskId: string): EventSource {
    const token = useAppStore.getState().token;
    const url = `${BASE_URL}/api/v1/tasks/${encodeURIComponent(taskId)}/stream`;
    // EventSource 不支持自定义 header，如需认证需通过 query param
    return new EventSource(token ? `${url}?token=${token}` : url);
  },
};

/** 公司标签 API */
export const companiesApi = {
  /** 获取所有公司标签及关联题目数 */
  list(): Promise<CompanyTag[]> {
    return request('/api/v1/companies');
  },
};

/** 用户相关 API */
export const userApi = {
  /** 获取当前用户偏好设置 */
  getPreferences(): Promise<UserPreferences> {
    return request('/api/v1/users/me/preferences');
  },

  /** 更新用户偏好设置 */
  updatePreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    return request('/api/v1/users/me/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
  },

  /** 获取通知偏好设置 */
  getNotificationPreferences(): Promise<import('./types').NotificationPreferences> {
    return request('/api/v1/users/me/notification-preferences');
  },

  /** 更新通知偏好设置 */
  updateNotificationPreferences(
    prefs: Partial<import('./types').NotificationPreferences>
  ): Promise<import('./types').NotificationPreferences> {
    return request('/api/v1/users/me/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
  },

  /** 导出用户学习数据（返回 JSON 下载 URL） */
  exportData(): Promise<import('./types').DataExportResponse> {
    return request('/api/v1/users/me/export');
  },

  /** 删除账户（30天内可恢复） */
  deleteAccount(): Promise<void> {
    return request('/api/v1/users/me', { method: 'DELETE' });
  },
};

/** 通知相关 API */
export const notificationsApi = {
  /** 获取通知列表 */
  list(): Promise<import('./types').NotificationListResponse> {
    return request('/api/v1/notifications');
  },

  /** 标记全部已读 */
  markAllRead(): Promise<void> {
    return request('/api/v1/notifications/read-all', { method: 'PUT' });
  },

  /** 标记单条已读 */
  markRead(id: string): Promise<void> {
    return request(`/api/v1/notifications/${encodeURIComponent(id)}/read`, { method: 'PUT' });
  },
};

// ============ 导出统一入口 ============

export const api = {
  problems: problemsApi,
  patterns: patternsApi,
  content: contentApi,
  tasks: tasksApi,
  companies: companiesApi,
  user: userApi,
  notifications: notificationsApi,
};

// ============ 交互式功能 API ============

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

async function interactiveRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { default: store } = await import('@/store');
  const token = store.getState().token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.message || `请求失败 (${res.status})`, body);
  }
  const json = await res.json();
  return json.data ?? json;
}

/** 费曼模式 API */
export const feynmanApi = {
  start: (userId: string, problemId: string) =>
    interactiveRequest('/api/v1/feynman/start', {
      method: 'POST',
      body: JSON.stringify({ userId, problemId }),
    }),
  end: (sessionId: string, problemTitle?: string) =>
    interactiveRequest(`/api/v1/feynman/${sessionId}/end`, {
      method: 'POST',
      body: JSON.stringify({ problemTitle }),
    }),
  analogies: (sessionId: string, approach: string, problemTitle: string) =>
    interactiveRequest(`/api/v1/feynman/${sessionId}/analogies`, {
      method: 'POST',
      body: JSON.stringify({ approach, problemTitle }),
    }),
  reset: (sessionId: string) =>
    interactiveRequest(`/api/v1/feynman/${sessionId}/reset`, { method: 'POST' }),
  history: (sessionId: string) =>
    interactiveRequest(`/api/v1/feynman/${sessionId}/history`),
};

/** 面试模拟 API */
export const interviewApi = {
  start: (userId: string, problemId: string, timeLimit = 45, difficulty = 'MEDIUM', companyStyle = 'GENERAL') =>
    interactiveRequest('/api/v1/interview/start', {
      method: 'POST',
      body: JSON.stringify({ userId, problemId, timeLimit, difficulty, companyStyle }),
    }),
  end: (sessionId: string, userId: string, problemId = '') =>
    interactiveRequest(`/api/v1/interview/${sessionId}/end`, {
      method: 'POST',
      body: JSON.stringify({ userId, problemId }),
    }),
  getReport: (sessionId: string) =>
    interactiveRequest(`/api/v1/interview/${sessionId}/report`),
  history: (userId: string, includeTrend = false) =>
    interactiveRequest(`/api/v1/interview/history?userId=${userId}&includeTrend=${includeTrend}`),
};

/** 苏格拉底追问 API */
export const socraticApi = {
  start: (userId: string, problemId: string) =>
    interactiveRequest('/api/v1/socratic/start', {
      method: 'POST',
      body: JSON.stringify({ userId, problemId }),
    }),
  nextHint: (sessionId: string) =>
    interactiveRequest(`/api/v1/socratic/${sessionId}/hint`),
  status: (sessionId: string) =>
    interactiveRequest(`/api/v1/socratic/${sessionId}/status`),
  summarize: (sessionId: string, problemTitle?: string) =>
    interactiveRequest(`/api/v1/socratic/${sessionId}/summarize?problemTitle=${encodeURIComponent(problemTitle || '算法题')}`, {
      method: 'POST',
    }),
};

/** Debug 训练 API */
export const debugApi = {
  challenge: (userId: string, problemId: string, difficulty = 'EASY', language = 'python') =>
    interactiveRequest('/api/v1/debug/challenge', {
      method: 'POST',
      body: JSON.stringify({ userId, problemId, difficulty, language }),
    }),
  records: (userId: string) =>
    interactiveRequest(`/api/v1/debug/records?userId=${userId}`),
  stats: (userId: string) =>
    interactiveRequest(`/api/v1/debug/stats?userId=${userId}`),
};

/** 反向费曼 API */
export const reverseFeynmanApi = {
  start: (userId: string, problemId: string, errorCount = 1, difficulty = 'MEDIUM') =>
    interactiveRequest('/api/v1/reverse-feynman/start', {
      method: 'POST',
      body: JSON.stringify({ userId, problemId, errorCount, difficulty }),
    }),
};

/** 复习（间隔重复）API */
export const reviewApi = {
  today: (userId: string) =>
    interactiveRequest(`/api/v1/review/today?userId=${userId}`),
  record: (cardId: string, quality: number) =>
    interactiveRequest('/api/v1/review/record', {
      method: 'POST',
      body: JSON.stringify({ cardId, quality }),
    }),
  createCard: (userId: string, problemId: string, cardType = 'EXPLAIN') =>
    interactiveRequest('/api/v1/review/cards', {
      method: 'POST',
      body: JSON.stringify({ userId, problemId, cardType }),
    }),
  stats: (userId: string) =>
    interactiveRequest(`/api/v1/review/stats?userId=${userId}`),
};

/** 学习分析 API */
export const analyticsApi = {
  stats: (userId: string) =>
    interactiveRequest(`/api/v1/analytics/stats?userId=${userId}`),
  weakPoints: (userId: string) =>
    interactiveRequest(`/api/v1/analytics/weak-points?userId=${userId}`),
  mastery: (userId: string) =>
    interactiveRequest(`/api/v1/analytics/mastery?userId=${userId}`),
  forgettingCurve: (userId: string) =>
    interactiveRequest(`/api/v1/analytics/forgetting-curve?userId=${userId}`),
  dailyPlan: (userId: string) =>
    interactiveRequest(`/api/v1/analytics/daily-plan?userId=${userId}`),
};

/** URL 内容导入 API */
export const importApi = {
  fromUrl: (url: string) =>
    interactiveRequest('/api/v1/import/url', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),
  get: (id: string) =>
    interactiveRequest(`/api/v1/import/${id}`),
};

/** 成就系统 API */
export const achievementsApi = {
  mine: (userId: string) =>
    interactiveRequest(`/api/v1/users/me/achievements?userId=${userId}`),
  definitions: () =>
    interactiveRequest('/api/v1/achievements/definitions'),
};
