/**
 * 主题切换集成测试
 * 测试点：localStorage 持久化、dark class 切换、全组件适配
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ThemeToggle from '@/components/common/ThemeToggle';
import { useTheme } from '@/hooks/useTheme';

// ===== 测试辅助组件 =====

/** 用于验证暗色模式下组件样式适配的测试容器 */
function ThemeTestContainer() {
  const { theme, isDark, setTheme } = useTheme();

  return (
    <div>
      <ThemeToggle />
      <div data-testid="theme-status">{theme}</div>
      <div data-testid="is-dark">{String(isDark)}</div>
      <button data-testid="set-light" onClick={() => setTheme('light')}>Light</button>
      <button data-testid="set-dark" onClick={() => setTheme('dark')}>Dark</button>
    </div>
  );
}

// ===== 测试用例 =====

describe('主题切换集成测试', () => {
  beforeEach(() => {
    // 清理 localStorage 和 html class
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('点击主题切换按钮后 html 元素添加 dark class', () => {
    render(<ThemeTestContainer />);

    // 初始状态应为 system（未设置过）
    const toggleButton = screen.getByRole('button', { name: /切换到暗色模式/ });

    // 点击切换到暗色
    fireEvent.click(toggleButton);

    // html 元素应有 dark class
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('主题偏好持久化到 localStorage', () => {
    render(<ThemeTestContainer />);

    // 设置为 dark
    const darkBtn = screen.getByTestId('set-dark');
    fireEvent.click(darkBtn);

    // 验证 localStorage 存储
    expect(localStorage.getItem('algorithm-help-theme')).toBe('dark');

    // 设置为 light
    const lightBtn = screen.getByTestId('set-light');
    fireEvent.click(lightBtn);

    expect(localStorage.getItem('algorithm-help-theme')).toBe('light');
  });

  it('页面加载时从 localStorage 恢复主题', () => {
    // 预设 localStorage 为 dark
    localStorage.setItem('algorithm-help-theme', 'dark');

    render(<ThemeTestContainer />);

    // 验证 dark class 已应用
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByTestId('theme-status')).toHaveTextContent('dark');
    expect(screen.getByTestId('is-dark')).toHaveTextContent('true');
  });

  it('切换到 light 模式后移除 dark class', () => {
    // 先设置 dark
    localStorage.setItem('algorithm-help-theme', 'dark');
    document.documentElement.classList.add('dark');

    render(<ThemeTestContainer />);

    // 点击设置为 light
    const lightBtn = screen.getByTestId('set-light');
    fireEvent.click(lightBtn);

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('algorithm-help-theme')).toBe('light');
  });

  it('ThemeToggle 按钮 aria-label 随主题状态变化', () => {
    render(<ThemeTestContainer />);

    // 初始为 system 模式（matchMedia mock 返回 false → light），按钮显示"切换到暗色模式"
    expect(screen.getByRole('button', { name: /切换到暗色模式/ })).toBeInTheDocument();

    // 点击 ThemeToggle 按钮本身来切换到 dark
    const toggleBtn = screen.getByRole('button', { name: /切换到暗色模式/ });
    fireEvent.click(toggleBtn);

    // 按钮应变为"切换到亮色模式"
    expect(screen.getByRole('button', { name: /切换到亮色模式/ })).toBeInTheDocument();
  });

  it('多次切换主题状态一致性', () => {
    render(<ThemeTestContainer />);

    const darkBtn = screen.getByTestId('set-dark');
    const lightBtn = screen.getByTestId('set-light');

    // dark → light → dark
    fireEvent.click(darkBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    fireEvent.click(lightBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    fireEvent.click(darkBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('algorithm-help-theme')).toBe('dark');
  });
});
