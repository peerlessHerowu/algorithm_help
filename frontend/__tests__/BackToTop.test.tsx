/**
 * BackToTop 组件测试
 * - 滚动 > 600px 时显示
 * - 滚动 <= 600px 时隐藏
 * - 点击后触发 scrollTo
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import BackToTop from '@/components/enriched/BackToTop';

describe('BackToTop', () => {
  beforeEach(() => {
    // 模拟 window.scrollY
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
    window.scrollTo = jest.fn();
    // requestAnimationFrame 同步执行
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('默认不显示（scrollY=0）', () => {
    render(<BackToTop />);
    expect(screen.queryByRole('button', { name: '回到顶部' })).not.toBeInTheDocument();
  });

  it('滚动超过 600px 后显示', () => {
    render(<BackToTop />);
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 650 });
      fireEvent.scroll(window);
    });
    expect(screen.getByRole('button', { name: '回到顶部' })).toBeInTheDocument();
  });

  it('自定义 threshold 生效', () => {
    render(<BackToTop threshold={300} />);
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 350 });
      fireEvent.scroll(window);
    });
    expect(screen.getByRole('button', { name: '回到顶部' })).toBeInTheDocument();
  });

  it('点击后调用 scrollTo 平滑滚动到顶部', () => {
    render(<BackToTop />);
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 800 });
      fireEvent.scroll(window);
    });
    fireEvent.click(screen.getByRole('button', { name: '回到顶部' }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
