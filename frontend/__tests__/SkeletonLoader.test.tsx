/**
 * SkeletonLoader 组件单元测试
 * 验证骨架屏渲染结构、ErrorFallback 交互
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  CardSkeleton,
  CardSkeletonList,
  DetailSkeleton,
  ErrorFallback,
} from '@/components/enriched/SkeletonLoader';

describe('CardSkeleton', () => {
  it('渲染卡片骨架屏容器', () => {
    const { container } = render(<CardSkeleton />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveAttribute('aria-hidden', 'true');
    expect(wrapper).toHaveAttribute('role', 'presentation');
    expect(wrapper.className).toContain('rounded-xl');
  });

  it('支持自定义 className', () => {
    const { container } = render(<CardSkeleton className="mt-4" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('mt-4');
  });
});

describe('CardSkeletonList', () => {
  it('默认渲染 3 张卡片骨架屏', () => {
    const { container } = render(<CardSkeletonList />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveAttribute('role', 'status');
    expect(wrapper.children).toHaveLength(3);
  });

  it('可自定义卡片数量', () => {
    const { container } = render(<CardSkeletonList count={2} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.children).toHaveLength(2);
  });

  it('有无障碍标签', () => {
    render(<CardSkeletonList />);
    expect(screen.getByLabelText('加载中')).toBeInTheDocument();
  });
});

describe('DetailSkeleton', () => {
  it('渲染详情骨架屏容器', () => {
    const { container } = render(<DetailSkeleton />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveAttribute('aria-hidden', 'true');
    expect(wrapper).toHaveAttribute('role', 'presentation');
  });

  it('支持自定义 className', () => {
    const { container } = render(<DetailSkeleton className="px-4" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('px-4');
  });
});

describe('ErrorFallback', () => {
  it('渲染默认错误信息', () => {
    render(<ErrorFallback />);
    expect(screen.getByText('加载失败，请重试')).toBeInTheDocument();
  });

  it('渲染自定义错误信息', () => {
    render(<ErrorFallback message="网络异常" />);
    expect(screen.getByText('网络异常')).toBeInTheDocument();
  });

  it('有重试回调时显示重试按钮', () => {
    const onRetry = jest.fn();
    render(<ErrorFallback onRetry={onRetry} />);
    expect(screen.getByText('重试')).toBeInTheDocument();
  });

  it('无重试回调时不显示重试按钮', () => {
    render(<ErrorFallback />);
    expect(screen.queryByText('重试')).not.toBeInTheDocument();
  });

  it('点击重试按钮触发 onRetry 回调', () => {
    const onRetry = jest.fn();
    render(<ErrorFallback onRetry={onRetry} />);
    fireEvent.click(screen.getByText('重试'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('容器有 role=alert 属性', () => {
    render(<ErrorFallback />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
