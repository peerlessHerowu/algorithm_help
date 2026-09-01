# UI 设计规范 — 方案B：Aurora 极光风

> 风格对标：GitHub Copilot / Stripe / Framer
> 设计理念：**渐变即生命力，毛玻璃即层次，光效即灵魂**

---

## 一、设计哲学

### 核心气质

```
科技感 · 未来感 · 流动 · 梦幻 · 深邃 · 高端
```

像在深空中看到极光 — 暗色背景上流动的渐变色彩，给人"这个产品来自未来"的感觉。

### 三条原则

| 原则 | 描述 |
|------|------|
| **光影层次** | 通过磨砂玻璃和光效制造深度，而非扁平色块 |
| **渐变克制** | 渐变只用在强调元素上，背景保持深色纯净 |
| **动态呼吸** | 关键元素有缓慢呼吸动画，像活着一样 |

---

## 二、色彩系统

### 2.1 背景层级

| Token | 值 | 说明 |
|-------|-----|------|
| `--bg-root` | `hsl(230 20% 6%)` | 深蓝黑底色（比纯黑更有质感） |
| `--bg-primary` | `hsl(230 18% 9%)` | 卡片背景 |
| `--bg-glass` | `hsl(230 15% 12% / 0.6)` | 毛玻璃面板 |
| `--bg-elevated` | `hsl(230 15% 14% / 0.8)` | 弹窗 |

### 2.2 极光渐变色

| 名称 | 渐变值 | 用途 |
|------|--------|------|
| Aurora Primary | `linear-gradient(135deg, #667eea, #764ba2)` | 主按钮、核心强调 |
| Aurora Glow | `linear-gradient(135deg, #667eea33, #764ba233)` | 卡片hover光晕 |
| Aurora Mesh | 多色mesh gradient | 页面顶部装饰背景 |
| Aurora Border | `conic-gradient(from 180deg, #667eea, #764ba2, #f093fb, #667eea)` | 旋转边框效果 |

### 2.3 文字与边框

| Token | 值 |
|-------|-----|
| `--text-primary` | `hsl(0 0% 95%)` |
| `--text-secondary` | `hsl(230 10% 60%)` |
| `--border-glass` | `hsl(0 0% 100% / 0.08)` |
| `--border-glow` | `hsl(240 60% 60% / 0.3)` |


### 2.4 难度色

| 难度 | 颜色 | 特殊处理 |
|------|------|----------|
| Easy | `#34d399` 翠绿 | 带微弱发光效果 |
| Medium | `#fbbf24` 金黄 | 带微弱发光效果 |
| Hard | `#f87171` 珊瑚红 | 带微弱发光效果 |

---

## 三、字体系统

```css
--font-sans: 'Plus Jakarta Sans', 'Inter', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

> Plus Jakarta Sans 比 Inter 更圆润，更有亲和力和现代感，适合"科技+教育"产品。

### 字号阶梯

| Token | 大小 | 行高 | 字重 |
|-------|------|------|------|
| `--text-xs` | 12px | 16px | 400 |
| `--text-sm` | 14px | 20px | 400 |
| `--text-base` | 16px | 26px | 400 |
| `--text-lg` | 20px | 28px | 500 |
| `--text-xl` | 24px | 32px | 600 |
| `--text-2xl` | 32px | 40px | 700 |
| `--text-3xl` | 40px | 48px | 700 |
| `--text-hero` | 56px | 64px | 800 |

---

## 四、毛玻璃效果（Glassmorphism）

### 核心配方

```css
.glass-panel {
  background: hsl(230 15% 12% / 0.6);
  backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid hsl(0 0% 100% / 0.08);
  border-radius: 16px;
}
```

### 层级使用

| 层级 | blur值 | 透明度 | 用途 |
|------|--------|--------|------|
| Glass-1 | 8px | 0.4 | Navbar |
| Glass-2 | 16px | 0.6 | 卡片面板 |
| Glass-3 | 24px | 0.7 | 弹窗 |
| Glass-4 | 32px | 0.8 | 全屏遮罩上的面板 |

---

## 五、动效系统

### 5.1 极光呼吸动画

```css
@keyframes aurora-breathe {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
}
/* 用在页面顶部的装饰性渐变背景上，8s循环 */
```

### 5.2 旋转边框（Rotating Border）

选中的核心卡片/当前题目，使用旋转 conic-gradient 边框：

```css
.rotating-border {
  background: conic-gradient(from var(--angle), #667eea, #764ba2, #f093fb, #667eea);
  animation: rotate-border 4s linear infinite;
}
@keyframes rotate-border { to { --angle: 360deg; } }
```

### 5.3 Hover Glow 效果

卡片 hover 时底部出现彩色光晕：

```css
.card:hover::after {
  content: '';
  position: absolute;
  bottom: -20px;
  left: 20%;
  width: 60%;
  height: 40px;
  background: linear-gradient(135deg, #667eea44, #764ba244);
  filter: blur(20px);
  opacity: 1;
  transition: opacity 300ms;
}
```

### 5.4 Spotlight 跟随

鼠标在卡片上移动时，卡片表面有一个光斑跟随鼠标位置：

```css
.card {
  background: radial-gradient(
    circle at var(--mouse-x) var(--mouse-y),
    hsl(0 0% 100% / 0.06) 0%,
    transparent 50%
  );
}
/* JS: 监听mousemove更新CSS变量 */
```


---

## 六、组件风格

### 6.1 按钮

```
Primary:   极光渐变背景 + 白色文字 + 12px圆角 + hover时微弱外发光
Secondary: 毛玻璃背景 + text-primary + glass边框
Ghost:     无背景 + text-secondary + hover时毛玻璃
```

### 6.2 LevelTabs

**设计亮点**：发光的胶囊选择器

```
容器: 毛玻璃条(glass-1)，圆角full
未选中: 透明 + text-secondary
选中: 极光渐变背景 + 白色文字 + 底部发光投影
切换动画: 选中态滑动(spring) + 发光跟随
```

### 6.3 卡片

```
背景: glass-2
边框: border-glass
圆角: 16px
Hover: spotlight跟随 + 底部aurora glow + border变亮
选中态: rotating-border包裹
```

### 6.4 CodeBlock

```
背景: bg-root(最深色) + border-glass
顶栏: glass-1背景 + 语言Tab + 亮色指示点
代码: JetBrains Mono, 14px
行高亮: 当前行有极光色淡底色
复制成功: 短暂的绿色发光脉冲
```

### 6.5 知识图谱节点

```
节点: 圆形 + 毛玻璃 + 极光边框（难度决定颜色）
边: 半透明渐变线 + 方向箭头
Hover: 节点放大 + 发光 + 连线变亮
选中: 脉冲动画(pulse) + 信息弹窗(glass-3)
```

---

## 七、页面装饰

### 7.1 顶部极光背景

页面顶部有一个大面积的渐变色块，极低透明度，配合 `aurora-breathe` 动画：

```css
.page-aurora {
  position: fixed;
  top: -200px;
  left: 50%;
  width: 800px;
  height: 600px;
  background: radial-gradient(ellipse, #667eea22 0%, transparent 70%);
  animation: aurora-breathe 8s ease-in-out infinite;
  pointer-events: none;
}
```

### 7.2 网格装饰

页面背景有非常淡的网格线（类似 Stripe 官网）：

```css
.grid-bg {
  background-image: linear-gradient(hsl(0 0% 100% / 0.03) 1px, transparent 1px),
                    linear-gradient(90deg, hsl(0 0% 100% / 0.03) 1px, transparent 1px);
  background-size: 64px 64px;
}
```

---

## 八、布局

与方案A相同的三栏布局，但：
- Navbar 使用 glass-1 效果（半透明模糊）
- Sidebar 背景为 glass-2
- 卡片间距略大（24px），给发光效果留空间

---

## 九、风格总结

**一句话定义**：深空极光 × 毛玻璃层次 × 流动渐变 × 科技未来感

适合喜欢 GitHub Copilot / Stripe / Framer 视觉风格的用户。视觉冲击力强，但需要注意性能（backdrop-filter 在低端设备上可能卡顿，需要降级方案）。
