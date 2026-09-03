import { renderHook, act } from '@testing-library/react';
import { useLangPreference } from '@/hooks/useLangPreference';

const STORAGE_KEY = 'algorithm-help:lang-preference';

describe('useLangPreference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('默认语言为中文', () => {
    const { result } = renderHook(() => useLangPreference());
    expect(result.current.lang).toBe('cn');
    expect(result.current.isChinese).toBe(true);
  });

  it('从 localStorage 读取已保存的偏好', () => {
    localStorage.setItem(STORAGE_KEY, 'en');
    const { result } = renderHook(() => useLangPreference());
    expect(result.current.lang).toBe('en');
    expect(result.current.isChinese).toBe(false);
  });

  it('toggleLang 切换语言并写入 localStorage', () => {
    const { result } = renderHook(() => useLangPreference());
    expect(result.current.lang).toBe('cn');

    act(() => {
      result.current.toggleLang();
    });

    expect(result.current.lang).toBe('en');
    expect(result.current.isChinese).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('en');

    act(() => {
      result.current.toggleLang();
    });

    expect(result.current.lang).toBe('cn');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('cn');
  });

  it('setLang 设置指定语言并持久化', () => {
    const { result } = renderHook(() => useLangPreference());

    act(() => {
      result.current.setLang('en');
    });

    expect(result.current.lang).toBe('en');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('en');
  });

  it('localStorage 中无效值时降级为默认 cn', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid');
    const { result } = renderHook(() => useLangPreference());
    expect(result.current.lang).toBe('cn');
  });
});
