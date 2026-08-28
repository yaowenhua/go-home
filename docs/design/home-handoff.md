# Handoff · 给界面匠的落地说明

> 本文件把 MASTER.md 的设计系统和 home-prototype.html 的视觉效果，映射回 go-home Vue3 + CSS Modules 的实际改动。
> 我只出设计资产，**不改业务代码**；以下是按优先级排列的落地建议。

---

## 0. 一句话

把现有「暗蓝底 + 鲜红」的冷调，换成「**暖米纸底 + 日落琥珀 + 衬线倒计时**」，重点打磨 Hero 和日记卡片的温度与留白。

---

## 1. 第一步：改 `src/styles/variables.css`

在 `:root` 里**替换以下 Token**（深色主题主色板）。保留变量名不变，前端零改动即可生效：

```css
:root {
  /* 主色：日落琥珀（替代 #ff4757 鲜红） */
  --color-primary: #C97B3D;
  --color-primary-light: #E0A46E;
  --color-primary-dark: #A05F2B;

  /* 背景：暖米纸（替代暗蓝 #0f0f23） */
  --color-bg: #F7F1E7;
  --color-bg-card: #FFFCF5;
  --color-bg-card-hover: #FBF3E6;
  --color-bg-elevated: #FFF7EA;

  /* 文字：暖墨 */
  --color-text: #3A3630;
  --color-text-secondary: #8A8177;
  --color-text-muted: #B7AFA3;

  /* 边框 */
  --color-border: #EBE0CE;
  --color-border-light: #F3EBDD;

  /* 星标 */
  --color-star: #E4B04A;
  --color-star-empty: #E5DCCB;

  /* 语义色（柔化） */
  --color-success: #7A9E7E;
  --color-warning: #D9A05E;
  --color-danger: #C06B5A;
  --color-info: #7C9BA6;

  /* 分类色（低饱和、统一暖调） */
  --color-work: #7C9BA6;
  --color-study: #9B8FB8;
  --color-life: #7A9E7E;
  --color-health: #C06B5A;
  --color-entertainment: #D9A05E;
  --color-other: #A8A096;

  /* 阴影：暖棕替代纯黑重影 */
  --shadow-sm: 0 1px 2px rgba(122, 96, 62, 0.06);
  --shadow-md: 0 2px 8px rgba(122, 96, 62, 0.08);
  --shadow-lg: 0 6px 20px rgba(122, 96, 62, 0.12);
  --shadow-glow: 0 4px 18px rgba(201, 123, 61, 0.18);
}
```

> ⚠️ 注意：目前 `variables.css` 里有一段 `@media (prefers-color-scheme: light)` 的浅色覆盖。换完后这段会与新的米白底冲突，建议**删掉或重写**为「暖色为主、深色为可选暗主题」。本次只交付浅色（暖）主方案。

---

## 2. 第二步：Hero 倒计时（`Home.vue` + `Home.module.css`）

### 2a. 字体改衬线

在 `variables.css` 增加一个衬线变量，或直接在 `Home.module.css` 里写：

```css
--font-serif: 'Noto Serif SC', 'Songti SC', 'SimSun', serif;
```

`index.html` 的 `<head>` 加 Google Fonts（可选，不加载则 fallback 到系统衬线）：

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@500;600;700&display=swap" rel="stylesheet" />
```

### 2b. `Home.module.css` 的 `.remainingNumber` 调整

```css
.remainingNumber {
  font-family: var(--font-serif);        /* 衬线 */
  font-weight: 600;                       /* 原 800 → 600，衬线不必过重 */
  line-height: 1.05;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;    /* 数字等宽，避免跳动 */
}

.remainingLabel {
  letter-spacing: 6px;   /* 原 2px → 6px，拉开「余生还剩」的呼吸感 */
}
```

### 2c. Hero 加「落日光晕」

在 `.hero` 上叠一层径向光晕（照搬原型 `.hero::before`）：

```css
.hero {
  position: relative;
  /* 保留原有 padding/animation */
}
.hero::before {
  content: '';
  position: absolute;
  top: 20%;
  left: 50%;
  width: 320px;
  height: 320px;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(232,196,142,0.55) 0%, rgba(232,196,142,0) 70%);
  filter: blur(8px);
  z-index: 0;
  pointer-events: none;
}
/* 确保内部文字 z-index 高于光晕 */
.remainingLabel, .remainingNumber, .remainingUnit { position: relative; z-index: 1; }
```

---

## 3. 第三步：日记卡片（`EntryCard.module.css`）

- 背景已是 `var(--color-bg-card)`（改完变量自动变米白），无需动模板。
- 卡片间距从 `margin-bottom` 改为 `gap`（在 `.entryList` 里），并加 hover 上浮：

```css
/* Home.module.css .entryList */
.entryList {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

/* EntryCard.module.css .card */
.card {
  box-shadow: var(--shadow-md);
  transition: box-shadow 0.25s ease, transform 0.25s ease;
}
.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

- 分类标签：当前是 `color:#fff` 的实心块。建议改成「**同色系柔底 + 半透明**」更克制（可选，非必需）：

```css
.category {
  /* 或者改用同色系浅底 + 深色文字，例如 background: color-mix(in srgb, var(--cat) 15%, #fff) */
  /* 简易方案：保留实心，但降一点不透明度 + 圆角拉满 */
  border-radius: var(--radius-full);
}
```

- 卡片内文 `line-height` 建议 1.6 → 1.7（手帐感更舒展）。

---

## 4. 第四步：进度条（`ProgressBar.vue` + `.module.css`）

当前 `barColor` 是「绿→黄→红」四段色。建议**统一为主琥珀的暖过渡**，去掉危险红色带来的焦虑感：

```js
// ProgressBar.vue 里可简化，或直接改 CSS：
.fill {
  background: linear-gradient(90deg, #E0A46E, #C97B3D);
}
.dot {
  background: #fff;
  border: 3px solid var(--color-primary);   /* 原 text 色 → 主色 */
}
```

> 如果保留 `barColor` 逻辑，把四个色值换成 MASTER.md 里的柔和语义色（`#7A9E7E → #D9A05E → #C06B5A`）即可。

---

## 5. 第五步：FAB（`Home.module.css` `.fab`）

渐变从鲜红改为日落金棕（变量改完后自动生效，因为用了 `var(--color-primary)`），只需补一个更柔和的投影：

```css
.fab {
  box-shadow: var(--shadow-glow), 0 8px 24px rgba(201, 123, 61, 0.28);
}
```

---

## 6. 附：原型 vs 落地对照表

| 原型元素 | 对应 Vue 文件 / 类 | 落地关键点 |
|----------|-------------------|-----------|
| Hero 数字 | `Home.vue` / `.remainingNumber` | 衬线 + 字重 600 + 等宽数字 + 光晕 |
| 进度条 | `ProgressBar.vue` | 主色渐变 + 白色圆点描主色 |
| 日记卡片 | `EntryCard.module.css` | 米白底 + 暖阴影 + hover 上浮 |
| 分类标签 | `EntryCard.vue` / `.category` | 柔化色板自动生效 |
| FAB | `Home.vue` / `.fab` | 日落金棕渐变 + 柔和投影 |

---

## 7. 验收口径

- 打开页面：整体应是「暖米色、安静、留白充足」的观感，不再是暗蓝冷调。
- Hero 大数字是衬线的、有温度的，背后有若隐若现的暖色光晕。
- 日记卡片轻盈（不是硬邦邦的深色块），读起来像翻手帐。
- 移动端 `max-width: 600px` 下视觉不拥挤，FAB 不遮挡内容。

---

*设计权威见 MASTER.md；视觉基准见 home-prototype.html（浏览器直接打开看）。*
