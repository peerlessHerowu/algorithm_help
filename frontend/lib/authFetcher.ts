/**
 * 带自动 token 刷新的 fetch 封装
 *
 * 功能：
 * - 自动附加 Authorization Bearer token
 * - 收到 401 时尝试刷新 token
 * - 刷新成功后重试原请求
 * - 刷新失败则 logout 并跳转登录页
 */

import { useAppStore } from '@/store';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

/** 是否正在刷新 token（防止并发刷新） */
let isRefreshing = false;
/** 等待刷新完成的请求队列 */
let refreshQueue: Array<(token: string | null) => void> = [];

/** 通知排队的请求刷新结果 */
function processQueue(newToken: string | null) {
  refreshQueue.forEach((resolve) => resolve(newToken));
  refreshQueue = [];
}

/** 尝试刷新 token */
async function refreshToken(): Promise<string | null> {
  try {
    const currentToken = useAppStore.getState().token;
    const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      },
    });

    if (!res.ok) return null;

    const json = await res.json();
    if (json.code === 200 && json.data?.token) {
      return json.data.token as string;
    }
    return null;
  } catch {
    return null;
  }
}

/** 处理 401 错误：刷新 token 或 logout */
async function handle401(): Promise<string | null> {
  if (isRefreshing) {
    // 已有刷新请求在进行，排队等待
    return new Promise<string | null>((resolve) => {
      refreshQueue.push(resolve);
    });
  }

  isRefreshing = true;
  const newToken = await refreshToken();
  isRefreshing = false;

  if (newToken) {
    // 刷新成功，更新 store
    const store = useAppStore.getState();
    if (store.user) {
      store.login(store.user, newToken);
    }
    processQueue(newToken);
    return newToken;
  }

  // 刷新失败，logout 并跳转
  processQueue(null);
  useAppStore.getState().logout();
  if (typeof window !== 'undefined') {
    window.location.href = '/auth/login';
  }
  return null;
}

/**
 * 带自动 token 刷新的 fetch 函数
 * 用法与原生 fetch 相同，自动处理认证
 *
 * @param path - 相对路径（如 /api/v1/problems）或完整 URL
 * @param options - fetch RequestInit 选项
 */
export async function authFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = useAppStore.getState().token;
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(url, { ...options, headers });

  // 收到 401，尝试刷新 token 后重试
  if (res.status === 401) {
    const newToken = await handle401();
    if (newToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { ...options, headers });
    }
  }

  return res;
}
