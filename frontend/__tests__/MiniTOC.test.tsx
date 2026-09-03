/**
 * MiniTOC 组件测试
 * - items < 2 时不渲染
 * - 屏幕 < 1280px 时不渲染
 * - items >= 2 且屏幕 >= 1280px 时渲染目录
 * - 点击标题滚动到对应卡片
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MiniTOC, { type MiniTOCItem } from '@/components/enriched/MiniTOC';

// 模拟 IntersectionObserver
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();

beforeAll(() => {
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: jest.fn(() => ({
      observe: mockObserve,
      disconnect: mockDisconnect,
      unobserve: jest.fn(),
    })),
  });
});

describe('MiniTOC', () => {
  const items: MiniTOCItem[] = [
    { id: 'card-1', title: '哈希表解法' },
    { id: 'card-2', title: '双指针解法' },
    { id: 'card-3', title: '排序解法' },
  ];

  let matchMediaMock: jest.Mock;

  beforeEach(() => {
    // 默认设置为 Desktop XL
    matchMediaMock = jest.fn().mockReturnValue({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
    Object.defineProperty(window, 'matchMedia', { value: matchMediaMock, writable: true });

    // 添加 DOM 元素
    document.body.innerHTML = items
      .map((item) => `<div data-card-id="${item.id}"></div>`)
      .join('');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  it('items < 2 时不渲染', () => {
    const { container } = render(<MiniTOC items={[items[0]]} />);
    expect(container.innerHTML).toBe('');
  });

  it('屏幕 < 1280px 时不渲染', () => {
    matchMediaMock.mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
    const { container } = render(<MiniTOC items={items} />);
    expect(container.innerHTML).toBe('');
  });

  it('满足条件时渲染目录', () => {
    render(<MiniTOC items={items} />);
    expect(screen.getByText('哈希表解法')).toBeInTheDocument();
    expect(screen.getByText('双指针解法')).toBeInTheDocument();
    expect(screen.getByText('排序解法')).toBeInTheDocument();
  });

  it('目录标题作为按钮可点击', () => {
    Element.prototype.scrollIntoView = jest.fn();
    render(<MiniTOC items={items} />);
    fireEvent.click(screen.getByText('双指针解法'));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('渲染 nav 导航元素用于语义化', () => {
    render(<MiniTOC items={items} />);
    expect(screen.getByRole('navigation', { name: '解析卡片目录' })).toBeInTheDocument();
  });
});
