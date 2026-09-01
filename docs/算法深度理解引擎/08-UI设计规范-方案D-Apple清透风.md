# UI 设计规范 — 方案D：Apple 清透风

> 风格对标：Apple Developer / Craft.do / Things 3 / Arc Browser
> 设计理念：**清透即呼吸，圆润即友好，光影即空间**

---

## 一、设计哲学

### 核心气质

```
清透 · 圆润 · 空间感 · 精致 · 友好 · 高完成度
```

像 macOS 原生应用 — 大圆角、精致光影、丰富但不过度的色彩、让人"一看就想用"。

### 三条原则

| 原则 | 描述 |
|------|------|
| **Depth & Layers** | 多层叠加，通过半透明和模糊制造空间深度 |
| **Friendly Precision** | 圆润的同时保持精确，每个像素都有意义 |
| **Vibrant but Calm** | 色彩丰富但不刺眼，鲜艳但柔和 |

---

## 二、色彩系统

### 2.1 亮色模式（默认）

这个方案**亮色优先**，暗色为适配。

| Token | 值 | 说明 |
|-------|-----|------|
| `--bg-root` | `hsl(220 20% 97%)` | 冷灰蓝底色（类似macOS壁纸前的感觉） |
| `--bg-primary` | `hsl(0 0% 100% / 0.8)` | 半透明白色卡片 |
| `--bg-secondary` | `hsl(220 15% 95%)` | 输入框/次级面板 |
| `--bg-sidebar` | `hsl(220 15% 94% / 0.7)` | 侧边栏半透明 |

### 2.2 强调色体系（多彩但协调）

不像方案A/B只用一个强调色，Apple风格允许**多色**但保持协调：

| 名称 | 色值 | 用途 |
|------|------|------|
| Blue | `hsl(211 100% 50%)` | 主按钮、选中态 |
| Purple | `hsl(270 70% 55%)` | 算法模式标签 |
| Orange | `hsl(30 95% 55%)` | 提醒、Medium难度 |
| Green | `hsl(145 60% 42%)` | 成功、已完成 |
| Red | `hsl(355 75% 55%)` | 错误、Hard难度 |
| Teal | `hsl(185 60% 42%)` | 信息、链接 |

> 每种颜色都有「振动」感但不刺眼 — 饱和度 60-80%，明度 42-55%。

### 2.3 暗色模式

| Token | 暗色值 |
|-------|--------|
| `--bg-root` | `hsl(220 15% 10%)` |
| `--bg-primary` | `hsl(220 12% 15% / 0.8)` |
| `--bg-sidebar` | `hsl(220 12% 12% / 0.7)` |
| `--text-primary` | `hsl(0 0% 95%)` |

### 2.4 文字

| Token | 亮色 | 暗色 |
|-------|------|------|
| `--text-primary` | `hsl(220 15% 15%)` | `hsl(0 0% 95%)` |
| `--text-secondary` | `hsl(220 10% 45%)` | `hsl(220 10% 60%)` |
| `--text-tertiary` | `hsl(220 8% 65%)` | `hsl(220 8% 40%)` |

---

## 三、字体系统

```css
--font-sans: 'SF Pro Display', -apple-system, 'Inter', sans-serif;
--font-text: 'SF Pro Text', -apple-system, 'Inter', sans-serif;
--font-mono: 'SF Mono', 'JetBrains Mono', monospace;
```

> SF Pro 是 Apple 系统字体，macOS/iOS上自动可用。非Apple设备降级Inter。

### 字号阶梯

| Token | 大小 | 行高 | 字重 |
|-------|------|------|------|
| `--text-caption` | 11px | 14px | 400 |
| `--text-footnote` | 13px | 18px | 400 |
| `--text-body` | 15px | 22px | 400 |
| `--text-headline` | 17px | 24px | 600 |
| `--text-title3` | 20px | 28px | 600 |
| `--text-title2` | 24px | 32px | 700 |
| `--text-title1` | 28px | 36px | 700 |
| `--text-largeTitle` | 34px | 42px | 700 |
| `--text-hero` | 48px | 56px | 800 |

> 注意：字号阶梯比其他方案更密，这是Apple的特点——很多微妙的大小区分。


---

## 四、圆角系统

Apple 风格的核心标志之一 — **大圆角 + 连续曲率**：

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-sm` | 8px | 小按钮、标签 |
| `--radius-md` | 12px | 输入框、工具栏 |
| `--radius-lg` | 16px | 卡片 |
| `--radius-xl` | 20px | 面板、弹窗 |
| `--radius-2xl` | 28px | 大卡片、Hero区域 |
| `--radius-full` | 9999px | 胶囊按钮 |

> 使用连续曲率（squircle）而非标准 border-radius:
> `border-radius: 16px` + `mask: squircle` (或 SVG clip-path)

---

## 五、阴影系统

Apple 风格**大量依赖阴影**制造层次感（与暗色极简方案相反）：

| Token | 值 | 用途 |
|-------|-----|------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.04)` | 输入框 |
| `--shadow-sm` | `0 2px 8px rgba(0,0,0,0.06)` | 小卡片 |
| `--shadow-md` | `0 4px 16px rgba(0,0,0,0.08)` | 面板 |
| `--shadow-lg` | `0 8px 32px rgba(0,0,0,0.1)` | 弹窗 |
| `--shadow-xl` | `0 16px 48px rgba(0,0,0,0.12)` | 全屏面板 |
| `--shadow-colored` | `0 4px 16px hsl(211 100% 50% / 0.2)` | 主按钮（彩色阴影） |

### 内阴影（凹陷效果）

```css
--shadow-inset: inset 0 1px 2px rgba(0,0,0,0.06);
/* 用在输入框、分段控制器的凹槽内 */
```

---

## 六、动效系统

### 6.1 Spring 弹性动画

Apple 风格大量使用弹性曲线：

```css
--spring-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
--spring-gentle: cubic-bezier(0.22, 1, 0.36, 1);
--spring-snappy: cubic-bezier(0.2, 0.8, 0.2, 1);
```

### 6.2 时长

| 场景 | 时长 | 缓动 |
|------|------|------|
| 按钮按下 | 80ms | ease-out |
| 按钮释放 | 200ms | spring-bounce |
| Tab 切换 | 250ms | spring-gentle |
| 面板打开 | 350ms | spring-snappy |
| 页面切换 | 400ms | spring-gentle |

### 6.3 核心交互

| 交互 | 动效 |
|------|------|
| 按钮按下 | scale(0.96) + 亮度降低 |
| 按钮释放 | scale(1) + spring弹回 |
| 卡片 Hover | scale(1.02) + shadow-md→shadow-lg |
| Tab 切换 | 背景色块滑动(spring) |
| 列表项 | 按下时scale(0.98) + 底色变深 |
| Toast | 从顶部弹入(spring-bounce) |

### 6.4 按压反馈（Active State）

Apple 的标志性交互 — 按下时有"物理回馈"感：

```css
.pressable:active {
  transform: scale(0.97);
  opacity: 0.85;
  transition: transform 80ms ease-out, opacity 80ms;
}
.pressable:not(:active) {
  transition: transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```


---

## 七、组件风格

### 7.1 按钮

```
Primary:   Blue背景 + 白色文字 + 12px圆角 + colored shadow + 按下缩放
Secondary: 半透明灰底 + 深色文字 + 边框 + 按下变深
Pill:      胶囊形状 + Blue文字 + Blue/10%底色 + 小号
Destructive: Red背景 + 白色文字
```

### 7.2 分段控制器（Segmented Control）

替代传统 Tab，用 iOS 风格分段控制器：

```
容器: 凹槽背景(shadow-inset) + 大圆角(full)
选项: 横排排列
选中: 白色胶囊 + shadow-sm + spring滑动
未选中: 透明 + text-secondary
```

> LevelTabs 用这个形式实现 — 5个级别像iOS分段控制器一样切换

### 7.3 卡片

```
背景: bg-primary(半透明白) + backdrop-blur(8px)
边框: 无（靠阴影制造层次）
圆角: 16px
阴影: shadow-sm
Hover: shadow-md + scale(1.01)
Active: scale(0.98) + shadow-xs
```

### 7.4 输入框

```
背景: bg-secondary
边框: 1px solid hsl(220 10% 85%)
圆角: 10px
内边距: 10px 14px
Focus: Blue border + Blue shadow(ring) + 微弱放大
内阴影: shadow-inset(凹陷感)
```

### 7.5 CodeBlock

```
背景: hsl(220 15% 96%) — 淡蓝灰
边框: 无
圆角: 12px
阴影: shadow-inset(凹进去的感觉)
顶栏: 同色 + 底部分隔线 + 语言选择器(分段控制器样式)
字体: SF Mono, 14px
```

### 7.6 DifficultyBadge

```
形状: 小胶囊(border-radius:full)
大小: padding 3px 8px, font 12px, 字重600
背景: 对应色彩/15% + 对应色文字
变体: 带小圆点(●)前缀的行内标记
```

### 7.7 知识图谱

```
背景: bg-root + 极淡的圆点网格
节点: 圆角方块(12px) + 白色底 + shadow-sm + 对应难度色左边线
边: 灰色虚线 + 方向箭头
Hover: 节点shadow-lg + scale(1.05)
选中: Blue ring + 信息面板从底部弹出(spring)
```

---

## 八、布局

### 侧边栏 + 内容区（类 Craft/Things）

```
┌──────────────────────────────────────────────────┐
│ Toolbar (h=48px, 交通灯区域 + 搜索 + 操作按钮)    │
├────────────┬─────────────────────────────────────┤
│            │                                     │
│  Sidebar   │         Main Content                │
│  (w=260)   │        (自适应宽度)                  │
│            │                                     │
│  半透明底    │   内容最大宽度 800px 居中             │
│  + blur    │                                     │
│            │                                     │
└────────────┴─────────────────────────────────────┘
```

- Toolbar: 像原生macOS工具栏，按钮间距紧凑
- Sidebar: 半透明 + backdrop-blur，像 Finder 侧边栏
- Content: 宽松居中，800px 最大宽度

### 响应式

| 断点 | 变化 |
|------|------|
| Mobile | Sidebar 隐藏为底部 Tab Bar（5个图标） |
| Tablet | Sidebar 折叠为窄版(60px) |
| Desktop | 完整侧边栏 |

---

## 九、特殊效果

### 9.1 Vibrancy（活力效果）

侧边栏和工具栏使用类似 macOS 的 vibrancy 效果：

```css
.vibrancy {
  background: hsl(220 15% 94% / 0.65);
  backdrop-filter: blur(20px) saturate(180%);
}
```

### 9.2 弹窗动画

弹窗从中心 scale(0.9) + opacity(0) 弹出，带 spring 缓动：

```css
.modal-enter {
  animation: modal-in 350ms cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes modal-in {
  from { transform: scale(0.92); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
```

### 9.3 列表动画

列表项依次进入（stagger），每项延迟 30ms：

```css
.list-item { animation: slide-in 300ms ease-out both; }
.list-item:nth-child(1) { animation-delay: 0ms; }
.list-item:nth-child(2) { animation-delay: 30ms; }
.list-item:nth-child(3) { animation-delay: 60ms; }
/* ... */
```

---

## 十、风格总结

**一句话定义**：macOS 原生质感 × 大圆角友好感 × Spring弹性 × 多彩但协调

适合喜欢 Apple 设计语言的用户。比方案A更"友好"，比方案B更"克制"，比方案C更"活泼"。它是四种方案中**最平衡的** — 既有视觉吸引力又不过度装饰。

**潜在问题**：SF Pro 字体仅 Apple 设备可用，非 Apple 用户体验可能有差异（需要做好 fallback）。
