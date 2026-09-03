/**
 * SWR 全局 fetcher 配置
 *
 * 功能：
 * - 自动附加 Authorization header
 * - 解包 ApiResponse<T> 格式，直接返回 data 字段
 * - 401 错误自动跳转登录页
 * - 网络断开友好提示
 * - 统一错误处理
 */

import { useAppStore } from '@/store'

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

/** 后端统一响应格式 */
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
  timestamp: number
}

/** 自定义 Fetch 错误 */
export class FetchError extends Error {
  status: number
  info?: unknown

  constructor(message: string, status: number, info?: unknown) {
    super(message)
    this.name = 'FetchError'
    this.status = status
    this.info = info
  }
}

/**
 * SWR 全局 fetcher
 * 传入相对路径（如 /api/v1/problems），自动拼接 BASE_URL 并处理认证
 */
export async function fetcher<T>(path: string): Promise<T> {
  const token = useAppStore.getState().token
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, { headers })
  } catch (err) {
    // 网络断开或请求失败
    throw new FetchError(
      '网络连接失败，请检查网络后重试',
      0,
      err
    )
  }

  // 401 未授权 → 清除认证状态并跳转登录
  if (res.status === 401) {
    useAppStore.getState().logout()
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw new FetchError('登录已过期，请重新登录', 401)
  }

  // 其他 HTTP 错误
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new FetchError(
      body?.message || `请求失败 (${res.status})`,
      res.status,
      body
    )
  }

  // 解包 ApiResponse，直接返回 data 字段
  const json: ApiResponse<T> = await res.json()

  if (json.code !== 200) {
    throw new FetchError(json.message || '业务错误', json.code, json)
  }

  return json.data
}
