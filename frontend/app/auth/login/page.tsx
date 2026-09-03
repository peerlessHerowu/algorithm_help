'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/store';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

/** 邮箱格式校验正则 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 登录页面
 * 邮箱 + 密码登录表单，成功后跳转首页
 */
export default function LoginPage() {
  const router = useRouter();
  const login = useAppStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /** 表单校验 */
  function validate(): string | null {
    if (!EMAIL_REGEX.test(email)) return '请输入有效的邮箱地址';
    if (!password) return '请输入密码';
    return null;
  }

  /** 提交登录 */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(BASE_URL + '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        // 后端可能返回 { message: "..." } 或 ApiResponse 格式
        setError(json.message || json.error || '登录失败，请重试');
        return;
      }

      // 后端登录接口直接返回 { accessToken, refreshToken, expiresIn }
      // 不包装在 ApiResponse.data 中
      const data = json.data ?? json; // 兼容两种格式
      const accessToken = data.accessToken;
      if (!accessToken) {
        setError('登录响应异常');
        return;
      }

      // 从 token 中解析用户信息，或调 /me 接口获取
      let user = data.user;
      if (!user) {
        // 调用 /auth/me 获取用户信息
        const meRes = await fetch(BASE_URL + '/api/v1/auth/me', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (meRes.ok) {
          user = await meRes.json();
        } else {
          // 降级：从 token 中解析基础信息
          user = { email, nickname: email.split('@')[0], role: 'USER' };
        }
      }

      login(user, accessToken);
      router.push('/');
    } catch {
      setError('网络错误，请检查连接后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-900 dark:text-white">
          登录
        </h1>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 邮箱 */}
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入邮箱"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* 密码 */}
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        {/* 注册链接 */}
        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          还没有账号？
          <Link href="/auth/register" className="ml-1 text-primary-600 hover:underline dark:text-primary-400">
            注册
          </Link>
        </p>
      </div>
    </div>
  );
}
