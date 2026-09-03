'use client';

/**
 * 认证状态初始化器
 *
 * 在应用根布局挂载时：
 * 1. 若 localStorage 中有 token 但 user 为 null，调 /api/v1/auth/me 恢复用户信息
 * 2. 若 token 已过期（me 接口返回 401），自动清除登录态
 *
 * 这样保证：
 * - 刷新页面后登录态不丢失（即使 user 未被持久化）
 * - token 过期时自动登出，不会出现幽灵登录态
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

export default function AuthInitializer() {
  const { token, user, isAuthenticated, login, logout } = useAppStore();
  const initialized = useRef(false);

  useEffect(() => {
    // 只初始化一次，避免重复请求
    if (initialized.current) return;
    initialized.current = true;

    // 有 token 但没有用户信息 → 尝试从服务端恢复
    if (token && !user) {
      fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (res.status === 401) {
            // token 已失效，清除登录态
            logout();
            return null;
          }
          if (!res.ok) return null;
          return res.json();
        })
        .then((data) => {
          if (!data) return;
          // me 接口可能直接返回 UserInfoResponse，也可能包在 { data: ... } 里
          const userInfo = data?.data ?? data;
          if (userInfo?.id) {
            login(
              {
                id: userInfo.id,
                email: userInfo.email,
                nickname: userInfo.nickname,
                role: userInfo.role,
              },
              token
            );
          }
        })
        .catch(() => {
          // 网络错误时不登出，保持现有状态
        });
    }
  }, [token, user, login, logout]);

  // 这个组件不渲染任何 UI
  return null;
}
