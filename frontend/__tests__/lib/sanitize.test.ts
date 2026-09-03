/**
 * sanitize.ts 单元测试
 * 验证 DOMPurify HTML 清洗功能正确性
 */

import { sanitizeHtml, sanitizeText } from '@/lib/sanitize';

describe('sanitizeHtml', () => {
  it('返回空字符串当输入为空', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('保留安全的 HTML 标签', () => {
    const input = '<p>正常段落</p><strong>加粗</strong>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>');
  });

  it('移除 script 标签', () => {
    const input = '<p>安全</p><script>alert("xss")</script>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('安全');
  });

  it('移除 on* 事件处理器', () => {
    const input = '<img src="pic.png" onerror="alert(1)" />';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('alert');
  });

  it('移除 javascript: URL', () => {
    const input = '<a href="javascript:alert(1)">点击</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('javascript:');
  });

  it('保留合法链接', () => {
    const input = '<a href="https://leetcode.com">LeetCode</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('https://leetcode.com');
    expect(result).toContain('LeetCode');
  });

  it('移除 iframe 标签', () => {
    const input = '<iframe src="evil.com"></iframe>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<iframe');
    expect(result).not.toContain('evil.com');
  });
});

describe('sanitizeText', () => {
  it('移除所有 HTML 标签仅保留文本', () => {
    const input = '<p>纯文本<script>bad</script>内容</p>';
    const result = sanitizeText(input);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toContain('纯文本');
    expect(result).toContain('内容');
    expect(result).not.toContain('bad');
  });

  it('返回空字符串当输入为空', () => {
    expect(sanitizeText('')).toBe('');
  });
});
