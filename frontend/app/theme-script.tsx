/**
 * 主题初始化脚本组件
 * 在 head 中内联执行，避免页面加载时的闪烁（FOUC）
 * 读取 localStorage 中的主题偏好，立即设置 dark class
 */
export function ThemeScript() {
  const script = `
    (function() {
      try {
        var theme = localStorage.getItem('algorithm-help-theme') || 'system';
        var isDark = theme === 'dark' ||
          (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (e) {}
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
