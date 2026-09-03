/**
 * DifficultyBadge 组件单元测试
 * 验证不同难度渲染正确的颜色和文案
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DifficultyBadge from '@/components/common/DifficultyBadge';

describe('DifficultyBadge', () => {
  it('渲染 EASY 难度为绿色标签和"简单"文案', () => {
    render(<DifficultyBadge difficulty="EASY" />);
    const badge = screen.getByText('简单');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-success-100');
    expect(badge.className).toContain('text-success-700');
  });

  it('渲染 MEDIUM 难度为橙色标签和"中等"文案', () => {
    render(<DifficultyBadge difficulty="MEDIUM" />);
    const badge = screen.getByText('中等');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-warning-100');
    expect(badge.className).toContain('text-warning-700');
  });

  it('渲染 HARD 难度为红色标签和"困难"文案', () => {
    render(<DifficultyBadge difficulty="HARD" />);
    const badge = screen.getByText('困难');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-danger-100');
    expect(badge.className).toContain('text-danger-700');
  });

  it('默认尺寸为 md', () => {
    render(<DifficultyBadge difficulty="EASY" />);
    const badge = screen.getByText('简单');
    expect(badge.className).toContain('px-2.5');
    expect(badge.className).toContain('text-sm');
  });

  it('sm 尺寸渲染更小的样式', () => {
    render(<DifficultyBadge difficulty="EASY" size="sm" />);
    const badge = screen.getByText('简单');
    expect(badge.className).toContain('px-2');
    expect(badge.className).toContain('text-xs');
  });

  it('支持自定义 className 扩展', () => {
    render(<DifficultyBadge difficulty="EASY" className="mt-4" />);
    const badge = screen.getByText('简单');
    expect(badge.className).toContain('mt-4');
  });
});
