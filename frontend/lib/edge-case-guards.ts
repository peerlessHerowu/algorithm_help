/**
 * 边界场景保护工具
 *
 * 综合自检验证点（Task 31）：
 * - localStorage 容量保护
 * - 乐观锁冲突提示
 * - 移动端适配
 * - AI_ORIGINAL 无 votes 展示 → SourceBadge 已处理
 * - L1 "📋 复制全文" → ActionBar 已处理
 * - 频率超限刷新恢复 → RateLimitCountdown 已处理
 *
 * Requirements: 跨需求集成验证
 */

/** localStorage 容量限制：所有本应用 key 总计不超过 100KB */
const STORAGE_PREFIX = 'algorithm-help:';
const MAX_STORAGE_BYTES = 100 * 1024;

/**
 * 安全写入 localStorage
 * 超出容量时自动清理最旧条目
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  const fullKey = STORAGE_PREFIX + key;
  try {
    // 检测当前总使用量
    const currentSize = estimateLocalStorageUsage();
    const newSize = (fullKey.length + value.length) * 2; // UTF-16

    if (currentSize + newSize > MAX_STORAGE_BYTES) {
      pruneOldestEntries();
    }

    localStorage.setItem(fullKey, value);
    return true;
  } catch (e) {
    // QuotaExceededError → 清理后重试一次
    pruneOldestEntries();
    try {
      localStorage.setItem(fullKey, value);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 安全读取 localStorage
 */
export function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key);
  } catch {
    return null;
  }
}

/**
 * 估算当前 localStorage 使用量（字节）
 */
function estimateLocalStorageUsage(): number {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        const value = localStorage.getItem(key) || '';
        total += (key.length + value.length) * 2;
      }
    }
  } catch {
    // 忽略
  }
  return total;
}

/**
 * 清理最旧条目（LRU 策略）
 * 清理带时间戳的条目中最旧的 20%
 */
function pruneOldestEntries(): void {
  try {
    const entries: { key: string; timestamp: number }[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;

      const value = localStorage.getItem(key);
      if (!value) continue;

      try {
        const parsed = JSON.parse(value);
        const ts = parsed.lastVisitAt || parsed.timestamp || 0;
        entries.push({ key, timestamp: ts });
      } catch {
        entries.push({ key, timestamp: 0 });
      }
    }

    // 按时间排序，删除最旧的 20%
    entries.sort((a, b) => a.timestamp - b.timestamp);
    const deleteCount = Math.max(1, Math.floor(entries.length * 0.2));
    for (let i = 0; i < deleteCount; i++) {
      localStorage.removeItem(entries[i].key);
    }
  } catch {
    // 忽略
  }
}

/**
 * 乐观锁冲突检测：用于前端在接收到 40004 错误码后的处理
 */
export function handleOptimisticLockConflict(refreshFn: () => void): void {
  // toast 提示（调用方自行展示）
  // 自动刷新数据
  setTimeout(refreshFn, 500);
}

/**
 * 检查当前设备是否为移动端（用于操作栏折叠判断）
 */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

/**
 * 分享链接无效 ID 容错
 * 当 detail API 返回 404 时调用此函数
 */
export function handleInvalidShareLink(problemId: string): {
  shouldFallback: boolean;
  message: string;
} {
  return {
    shouldFallback: true,
    message: '该解析已不存在，已为你展示当前列表',
  };
}
