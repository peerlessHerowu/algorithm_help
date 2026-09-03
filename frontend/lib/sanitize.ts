/**
 * HTML 安全过滤工具
 * 使用 DOMPurify 清理不可信 HTML 内容，防止 XSS 攻击
 *
 * 使用场景：
 * - 渲染用户输入内容（评论、反馈文字、费曼模式历史记录）
 * - 渲染 AI 生成的 HTML 内容
 * - 处理外部导入的内容
 */

import DOMPurify from 'dompurify';

/**
 * 默认允许的 HTML 标签白名单
 * 仅保留安全的格式化标签，禁止 script/iframe/object/embed 等危险标签
 */
const ALLOWED_TAGS = [
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'em', 'b', 'i', 'u', 's', 'del',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'span', 'div', 'sup', 'sub',
];

/** 默认允许的 HTML 属性白名单 */
const ALLOWED_ATTRS = [
  'href', 'src', 'alt', 'title', 'class',
  'target', 'rel', 'width', 'height',
];

/**
 * 清理 HTML 字符串，移除危险内容
 * @param dirty - 不可信的 HTML 字符串
 * @returns 安全的 HTML 字符串
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
    ALLOW_DATA_ATTR: false,
    // 链接强制添加 noopener noreferrer
    ADD_ATTR: ['target'],
  });
}

/**
 * 严格清理：移除所有 HTML 标签，仅保留纯文本
 * 适用于搜索输入、表单提交等场景
 */
export function sanitizeText(dirty: string): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] });
}
