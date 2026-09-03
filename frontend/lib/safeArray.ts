/**
 * 安全解析 JSON 数组字段
 * 后端 JPA 返回的 JSON 列可能是字符串（如 '["a","b"]'）或已解析数组
 * 该函数统一处理两种情况，避免 .map() 报 "not a function" 错误
 */
export function safeArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
