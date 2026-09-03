/**
 * 全局状态管理 (Zustand)
 * 
 * 管理：
 * - 认证状态（用户信息、token、登录状态）
 * - 当前解释级别偏好（默认 L3）
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** 用户信息 */
export interface User {
  id: string
  email: string
  nickname: string
  role: 'USER' | 'ADMIN'
}

/** 认证状态切片 */
interface AuthSlice {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  /** 登录成功后设置用户和 token */
  login: (user: User, token: string) => void
  /** 退出登录，清除所有认证信息 */
  logout: () => void
  /** 更新用户信息（不影响 token） */
  updateUser: (user: Partial<User>) => void
}

/** 偏好设置切片 */
interface PreferenceSlice {
  /** 当前解释级别 1-5，默认 3 */
  currentLevel: number
  /** 切换解释级别 */
  setLevel: (level: number) => void
  /** 用户偏好代码语言，默认 python */
  preferredLanguage: string
  /** 设置偏好代码语言 */
  setPreferredLanguage: (lang: string) => void
}

export type AppStore = AuthSlice & PreferenceSlice

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // ── 认证状态 ──
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, token) =>
        set({ user, token, isAuthenticated: true }),

      logout: () =>
        set({ user: null, token: null, isAuthenticated: false }),

      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),

      // ── 偏好设置 ──
      currentLevel: 3,

      setLevel: (level) =>
        set({ currentLevel: Math.min(5, Math.max(1, level)) }),

      preferredLanguage: 'python',

      setPreferredLanguage: (lang) =>
        set({ preferredLanguage: lang }),
    }),
    {
      name: 'algorithm-help-store', // localStorage key
      partialize: (state) => ({
        // 持久化 token、用户信息、认证状态和偏好
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        currentLevel: state.currentLevel,
        preferredLanguage: state.preferredLanguage,
      }),
    }
  )
)
