# 返乡日记 · Home 视觉设计系统（MASTER）

> 设计目标：把「余生还剩多少天」这几个字，做成一种温柔的停顿。
> 一次呼吸，一秒安静，然后才看见数字。不是数据看板，是一本写给自己的手帐。

---

## 一、设计基调（一句话）

**温暖、安静、有仪式感** —— 像日落时分摊开的一本旧牛皮纸手帐。
克制、留白、低饱和。数字可以大，但情绪要沉；界面要「轻」，别让人有压力。

反模式（要避免）：
- ❌ 大面积高饱和纯色 / 荧光渐变
- ❌ 卡片密集堆叠、信息过载
- ❌ 圆角过小、阴影过重的「严肃表单感」
- ❌ 动效喧哗（弹跳、粒子、闪烁）

---

## 二、配色（Palette）

### 核心方向：暖米色 + 日落琥珀 + 深墨绿

放弃原「暗蓝底 + 鲜红」的科技冷调，改为**暖调低饱和**，贴合「返乡 / 余日 / 手帐」的静谧气质。

| 角色 | Token | Hex | 用途 |
|------|-------|-----|------|
| 主色（暖琥珀） | `--color-primary` | `#C97B3D` | 强调、按钮、进度、高亮 |
| 主色浅 | `--color-primary-light` | `#E0A46E` | 渐变尾、hover |
| 主色深 | `--color-primary-dark` | `#A05F2B` | 按压态 |
| 背景（米纸） | `--color-bg` | `#F7F1E7` | 页面底色 |
| 背景提亮 | `--color-bg-card` | `#FFFCF5` | 卡片背景 |
| 背景悬浮 | `--color-bg-card-hover` | `#FBF3E6` | 卡片 hover |
| 墨色主文字 | `--color-text` | `#3A3630` | 标题、正文 |
| 次级文字 | `--color-text-secondary` | `#8A8177` | 说明、标签 |
| 弱文字 | `--color-text-muted` | `#B7AFA3` | 时间戳、占位 |
| 边框 | `--color-border` | `#EBE0CE` | 分隔、卡片边 |
| 边框浅 | `--color-border-light` | `#F3EBDD` | 细线 |
| 星标 | `--color-star` | `#E4B04A` | 满意度星星 |
| 星标空 | `--color-star-empty` | `#E5DCCB` | 未点亮星 |
| 成功 | `--color-success` | `#7A9E7E` | |
| 警告 | `--color-warning` | `#D9A05E` | |
| 危险 | `--color-danger` | `#C06B5A` | 删除（柔化红） |
| 信息 | `--color-info` | `#7C9BA6` | |

### 分类色（柔和、低饱和、统一在暖调里）

| 分类 | Hex | 分类 | Hex |
|------|-----|------|-----|
| 工作 work | `#7C9BA6` | 健康 health | `#C06B5A` |
| 学习 study | `#9B8FB8` | 娱乐 entertainment | `#D9A05E` |
| 生活 life | `#7A9E7E` | 其他 other | `#A8A096` |

### 渐变（Hero 数字专用）

```
linear-gradient(135deg, #C97B3D 0%, #D89A5C 45%, #E0A46E 100%)
```

> 日落金棕渐变，替代原 `#ff4757 → #ffa502` 的鲜红橙。温暖但不刺眼。

---

## 三、字体（Typography）

### 推荐组合：衬线标题 + 无衬线正文

**数字 / Hero 标题** —— 用带「手帐感」的衬线或圆润字体：

| 优先级 | 字体 | 说明 |
|--------|------|------|
| 1 | `'Noto Serif SC'` | 中文衬线，气质沉静，hero 大字首选 |
| 2 | `'Songti SC'` / `'SimSun'` | macOS / Win 系统衬线 fallback |

> Google Fonts: `Noto Serif SC`（加载权重 500/600 即可，避免过大体积）

**正文 / 交互** —— 舒适的无衬线：

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
  'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei',
  'Helvetica Neue', Arial, sans-serif;
```

### 字号阶梯（相对原站放大 hero 的留白与层级）

| Token | 值 | 用途 |
|-------|-----|------|
| `--font-size-xs` | 12px | 时间戳、标签计数 |
| `--font-size-sm` | 14px | 说明、辅助 |
| `--font-size-md` | 16px | 正文 |
| `--font-size-lg` | 20px | 卡片标题、分区标题 |
| `--font-size-xl` | 26px | 问候语 |
| `--font-size-hero` | `clamp(4rem, 22vw, 9rem)` | 倒计时大数字 |

> Hero 数字行高 `1.05`，字距 `-0.02em`，`font-weight: 600`（衬线不必到 800，过重会发闷）。

---

## 四、间距（Spacing）与节奏

沿用并可微调原 token，核心是「**纵向留白 > 横向拥挤**」：

| Token | 值 | 用途 |
|-------|-----|------|
| `--space-xs` | 4px | 微距 |
| `--space-sm` | 8px | 图标间距 |
| `--space-md` | 14px | 卡片内边距 |
| `--space-lg` | 24px | 区块间距 |
| `--space-xl` | 36px | Hero 上下留白 |
| `--space-2xl` | 56px | 空态留白 |

规则：
- Hero 区块上下至少 `--space-xl` 留白，制造「停顿感」。
- 卡片之间 `--space-md`，卡片内文 `line-height: 1.7`（手帐感，比 1.6 更舒展）。
- 分区标题到内容之间 `--space-md`，标题与计数用「baseline」对齐。

---

## 五、圆角（Radius）

柔化所有边角，去掉「商用表单」的方正感：

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-sm` | 10px | 小元素、标签 |
| `--radius-md` | 16px | 卡片、输入框 |
| `--radius-lg` | 22px | 大卡片、Hero 面板 |
| `--radius-xl` | 28px | 弹层顶部 |
| `--radius-full` | 999px | 按钮、FAB、胶囊标签 |

---

## 六、阴影（Shadow）

关键：**浅、暖、弥散**。不用深黑重影，用暖棕的柔和投影模拟「纸叠在纸上的厚度」。

```css
--shadow-sm: 0 1px 2px rgba(122, 96, 62, 0.06);
--shadow-md: 0 2px 8px rgba(122, 96, 62, 0.08);
--shadow-lg: 0 6px 20px rgba(122, 96, 62, 0.12);
--shadow-glow: 0 4px 18px rgba(201, 123, 61, 0.18);
```

> 阴影用暖棕 `rgba(122,96,62,…)`，而不是纯黑 `rgba(0,0,0,…)`，视觉上「纸感」。

---

## 七、质感细节（Design Texture）

1. **纸纹 / 噪点**：页面背景可叠加极淡的 SVG 噪点（`opacity: 0.03`），营造纸张触感。
2. **渐变光晕**：Hero 数字背后叠一层径向光晕（琥珀色 `#E8C48E`，blur 大），制造「落日余晖」氛围。
3. **分隔线**：用 1px `--color-border` 虚线或细实线，替代粗边框。
4. **胶囊标签**：分类用 `radius-full` 的柔和底 + 同色系文字（而非白字硬块），更克制。

---

## 八、动效（克制版）

| 场景 | 建议 |
|------|------|
| 进入 | Hero 数字 `fade + 轻微上浮`（0.6s，`translateY(14px)`） |
| 卡片 | `slideUp 0.35s`，stagger 每张延迟 `0.05s` |
| 进度条 | `width` 过渡 1.2s，缓出 |
| FAB | hover 轻微上浮 + 发光，不弹跳 |
| 生日 banner | 柔和浮现 + 一点暖光，不要闪烁 |

> 全局减少 `scale` 类弹跳动效；仪式感来自「慢」，不来自「多」。

---

## 九、落地优先级（给界面匠）

1. 先替换 `variables.css` 的色板（核心 Token 已列出 hex）。
2. Hero 数字字体改衬线，调字重字距。
3. 卡片背景改 `--color-bg-card` 米白 + 暖阴影。
4. 进度条颜色从「绿→红」改为主琥珀的柔和过渡，圆点改主色。
5. FAB 主色渐变改日落金棕。

---

*本文件为设计系统权威来源；原型 `home-prototype.html` 是其静态可视化，`handoff.md` 是落地映射。*
