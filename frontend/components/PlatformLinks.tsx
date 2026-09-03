'use client';

import { useEffect, useState, useCallback } from 'react';

// ===== 类型定义 =====

/** 平台链接 DTO */
interface PlatformLinkDTO {
  platform: string;
  platformId: string;
  platformUrl: string;
  platformTitle: string;
}

/** 组件 Props */
interface PlatformLinksProps {
  problemId: string;
  className?: string;
}

// ===== 平台配置 =====

/** 平台颜色和图标映射 */
const PLATFORM_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  LEETCODE: { color: 'text-green-700', bgColor: 'bg-green-50 border-green-200 hover:bg-green-100', label: 'LC' },
  NOWCODER: { color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200 hover:bg-orange-100', label: 'NC' },
  HACKERRANK: { color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100', label: 'HR' },
  CODEFORCES: { color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200 hover:bg-blue-100', label: 'CF' },
  LUOGU: { color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200 hover:bg-purple-100', label: 'LG' },
  ATCODER: { color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200 hover:bg-teal-100', label: 'AC' },
};

/** 获取平台配置，未知平台使用默认灰色 */
function getPlatformConfig(platform: string) {
  return PLATFORM_CONFIG[platform] ?? {
    color: 'text-gray-700',
    bgColor: 'bg-gray-50 border-gray-200 hover:bg-gray-100',
    label: platform.slice(0, 2).toUpperCase(),
  };
}

// ===== 主组件 =====

export default function PlatformLinks({ problemId, className = '' }: PlatformLinksProps) {
  const [links, setLinks] = useState<PlatformLinkDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** 获取平台链接数据 */
  const fetchLinks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/mapping/problem/${problemId}/links`);
      if (!res.ok) throw new Error(`接口错误: ${res.status}`);

      const data = await res.json();
      // 兼容 ApiResponse 包装格式
      setLinks(Array.isArray(data) ? data : data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [problemId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  /** 点击链接新窗口打开 */
  const handleClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ===== 加载状态 =====
  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="animate-pulse flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-7 w-20 bg-gray-100 rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  // ===== 错误状态 =====
  if (error) {
    return (
      <div className={`${className}`}>
        <p className="text-xs text-red-500">⚠️ {error}</p>
      </div>
    );
  }

  // ===== 空数据状态 =====
  if (links.length === 0) {
    return (
      <div className={`${className}`}>
        <p className="text-xs text-gray-400">暂无其他平台映射</p>
      </div>
    );
  }

  // ===== 正常渲染 =====
  return (
    <div className={`${className}`}>
      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
        <span>🌐</span>
        其他平台
      </h4>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => {
          const config = getPlatformConfig(link.platform);
          return (
            <button
              key={`${link.platform}-${link.platformId}`}
              onClick={() => handleClick(link.platformUrl)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${config.bgColor} ${config.color}`}
              title={`在 ${link.platform} 上查看: ${link.platformTitle}`}
            >
              {/* 平台缩写标识 */}
              <span className="font-bold">{config.label}</span>
              {/* 平台编号 */}
              <span className="opacity-80">#{link.platformId}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
