/**
 * LoginGuideModal 组件单元测试
 * 验证：弹窗渲染、intent 消息、登录按钮、关闭行为、sessionStorage intent 恢复
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import LoginGuideModal, {
  saveIntent,
  consumeIntent,
  clearIntent,
} from '@/components/enriched/LoginGuideModal';
import type { LoginIntent } from '@/components/enriched/LoginGuideModal';

// 模拟 sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

describe('LoginGuideModal', () => {
  const defaultProps = {
    isOpen: true,
    intent: 'upvote' as LoginIntent,
    onLogin: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorageMock.clear();
  });

  it('isOpen=false 时不渲染', () => {
    render(<LoginGuideModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('isOpen=true 时渲染弹窗', () => {
    render(<LoginGuideModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('需要登录')).toBeInTheDocument();
  });

  it('展示默认 intent 消息：upvote', () => {
    render(<LoginGuideModal {...defaultProps} intent="upvote" />);
    expect(screen.getByText('登录后即可点赞')).toBeInTheDocument();
  });

  it('展示默认 intent 消息：downvote', () => {
    render(<LoginGuideModal {...defaultProps} intent="downvote" />);
    expect(screen.getByText('登录后即可点踩')).toBeInTheDocument();
  });

  it('展示默认 intent 消息：generate', () => {
    render(<LoginGuideModal {...defaultProps} intent="generate" />);
    expect(screen.getByText('登录后即可使用 AI 生成')).toBeInTheDocument();
  });

  it('展示默认 intent 消息：feedback', () => {
    render(<LoginGuideModal {...defaultProps} intent="feedback" />);
    expect(screen.getByText('登录后即可提交纠错反馈')).toBeInTheDocument();
  });

  it('自定义 message 覆盖默认消息', () => {
    render(<LoginGuideModal {...defaultProps} message="自定义提示" />);
    expect(screen.getByText('自定义提示')).toBeInTheDocument();
    expect(screen.queryByText('登录后即可点赞')).not.toBeInTheDocument();
  });

  it('点击登录按钮：保存 intent 到 sessionStorage 并调用 onLogin', () => {
    const onLogin = jest.fn();
    render(<LoginGuideModal {...defaultProps} intent="upvote" targetId="abc-123" onLogin={onLogin} />);
    fireEvent.click(screen.getByText('去登录'));
    expect(onLogin).toHaveBeenCalledTimes(1);
    // 验证 sessionStorage 写入
    const stored = JSON.parse(sessionStorageMock.getItem('algorithm-help:login-intent')!);
    expect(stored.intent).toBe('upvote');
    expect(stored.targetId).toBe('abc-123');
  });

  it('点击暂不登录按钮调用 onClose', () => {
    const onClose = jest.fn();
    render(<LoginGuideModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('暂不登录'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('按 Escape 键调用 onClose', () => {
    const onClose = jest.fn();
    render(<LoginGuideModal {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩层调用 onClose', () => {
    const onClose = jest.fn();
    render(<LoginGuideModal {...defaultProps} onClose={onClose} />);
    // role="dialog" 就是 overlay 本身
    const overlay = screen.getByRole('dialog');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('弹窗有正确的无障碍属性', () => {
    render(<LoginGuideModal {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'login-guide-title');
  });
});

describe('Intent 工具函数', () => {
  beforeEach(() => {
    sessionStorageMock.clear();
  });

  it('saveIntent 写入 sessionStorage', () => {
    saveIntent('generate', 'target-1');
    const raw = sessionStorageMock.getItem('algorithm-help:login-intent');
    expect(raw).not.toBeNull();
    const data = JSON.parse(raw!);
    expect(data.intent).toBe('generate');
    expect(data.targetId).toBe('target-1');
    expect(data.timestamp).toBeGreaterThan(0);
  });

  it('consumeIntent 读取并清除', () => {
    saveIntent('feedback');
    const result = consumeIntent();
    expect(result).not.toBeNull();
    expect(result!.intent).toBe('feedback');
    // 二次读取为空
    expect(consumeIntent()).toBeNull();
  });

  it('consumeIntent 超时返回 null', () => {
    // 手动写入一个过期的 intent
    const expired = {
      intent: 'upvote',
      timestamp: Date.now() - 6 * 60 * 1000, // 6 分钟前
    };
    sessionStorageMock.setItem('algorithm-help:login-intent', JSON.stringify(expired));
    expect(consumeIntent()).toBeNull();
    // 确认已清除
    expect(sessionStorageMock.getItem('algorithm-help:login-intent')).toBeNull();
  });

  it('clearIntent 清除存储', () => {
    saveIntent('downvote');
    clearIntent();
    expect(sessionStorageMock.getItem('algorithm-help:login-intent')).toBeNull();
  });
});
