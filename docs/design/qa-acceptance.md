# QA 验收报告 · 绘灵 Home 视觉设计落地

> 质量哨 🧪 · 2026-08-28 · 独立验收（设计基准对照 + 代码审查 + 运行时真实 Chromium 核验）
> 验收依据：`docs/design/MASTER.md`（设计系统权威）+ `docs/design/home-handoff.md`（落地映射 §7 验收口径）

## 总评：✅ 通 过（有条件）

Home 视觉改造**核心目标全部达成**：暖米纸底、日落琥珀、衬线倒计时、落日光晕、手帐感卡片、FAB 不遮挡——实际运行观感与设计基准一致，无样式错乱、无 console 报错。整体为「暖、安静、有仪式感」的正确方向。

**有条件通过的非阻塞项**：① Home 内生日 banner 仍残留旧鲜红渐变；② hero 数字尺寸较设计规范偏小；③ 若干 Home 外的遗留冷色（Login/Onboarding/admin）未纳入本卡范围，非回归。详见缺陷清单。

---

## 一、对照 handoff §7 验收口径逐项核验

| §7 验收点 | 判定 | 证据 |
|-----------|------|------|
| 整体暖米、安静、留白充足，非暗蓝冷调 | ✅ | 运行时 `body bg = rgb(247,241,231)` = `#F7F1E7` 暖米；页面 `rgb(255,252,245)` = `#FFFCF5` 米白；Hero 上下 `--space-xl` 留白 |
| Hero 大数字衬线、有温度、背后暖光晕 | ✅ | 运行计算样式：`fontFamily="Noto Serif SC…serif"`、`fontWeight=600`、`lineHeight=78.75(1.05×)`、`letterSpacing=-1.5px(-0.02em)`、`tabular-nums`、渐变 `rgb(201,123,61)→rgb(216,154,92)→rgb(224,164,110)`；`hero::before` radial `rgba(232,196,142,0.55)` + blur(8px) 光晕在数字背后 |
| 日记卡片轻盈、手帐感 | ✅ | 卡片 `--color-bg-card` 米白 + 暖棕 `--shadow-md` + hover `translateY(-2px)` 上浮 + 内文 `line-height:1.7`；分类标签 `radius-full` 胶囊 |
| 移动端不拥挤、FAB 不遮挡 | ✅ | 390×844 视口：FAB `bottom:calc(header+space-lg+safe-area)` 固定，页面 `padding-bottom:calc(header+space-xl+safe-area)` 预留空间，内容可滚动越过 FAB 不遮挡 |
| 进度条去红黄绿、统一琥珀 | ✅ | 运行 `fill = linear-gradient(90deg,#E0A46E,#C97B3D)`；圆点白底 + 主琥珀描边；`ProgressBar.vue` 已删除 4 段 barColor 逻辑 |

## 二、运行时验证（真实 Chromium headless + CDP，端口 8112）

- 成功自动登录（写 `go_home_access_token`）→ `/home` 正常渲染，**0 console 报错 / 0 异常**
- 逐个核对 Home/Login/Settings/History/Onboarding：各页正常加载、暖色底、**无 console 错误**
- `vite` 各模块 HTTP 200；`index.html` theme-color 已改 `#F7F1E7`，Noto Serif SC 字体已加载
- History 共享 EntryCard：`entryList gap:16px`，3 卡片间距一致（top 496→647→825，+151px 含 gap）——**间距无回归**

## 三、改动文件逐一核验（git diff，7 文件全对齐 handoff）

| 文件 | 与设计/落地是否一致 |
|------|---------------------|
| `variables.css` | ✅ token 全替换为 MASTER hex；删了 `prefers-color-scheme: light` 覆盖段；新增 `--font-serif`；阴影改暖棕 |
| `Home.module.css` | ✅ 衬线 hero + 落日光晕 ::before + entryList gap + FAB 琥珀渐变/暖投影 |
| `EntryCard.module.css` | ✅ 暖阴影 + hover 上浮 + line-height 1.7 + 胶囊圆角 |
| `ProgressBar.vue/.css` | ✅ 去 4 段色，统一琥珀渐变 + 白点描主色 |
| `History.module.css` | ✅ 补 gap（与 EntryCard 去 margin 一致，间距不塌） |
| `index.html` | ✅ theme-color 暖米 + Noto Serif SC |

---

## 四、缺陷清单（按严重级别）

| # | 级别 | 位置 | 问题 | 说明 |
|---|------|------|------|------|
| 1 | 🟠 中（有条件通过项） | `Home.module.css:16` `.birthdayBanner` | **残留旧鲜红渐变 `#f39c12→#e74c3c`** | 生日 banner 用的是冷调鲜红/橙，与暖琥珀主题冲突，是本卡 Home 文件内唯一没被替换的冷色点。属**本文件内既有（非本次 diff 引入）但未被一并清理**。建议改 `--color-primary` 琥珀渐变 |
| 2 | 🟡 低 | `variables.css:62` `--font-size-hero` | **hero 数字尺寸较设计规范偏小** | 实现 `clamp(3rem,15vw,7rem)` vs MASTER `clamp(4rem,22vw,9rem)`。390px 视口下约 58px，设计意图约 86px。衬线+光晕已达标，仅「大数字」冲击力略弱，不阻塞 |
| 3 | 🟢 提示 | `Onboarding.module.css:7` | **遗留深蓝渐变 `#0f0f23→#1a1a2e→#16213e`** | Home 外页面（Onboarding 引导页），本卡**未涉及**、非回归。建议后续暖色整体铺开时一并替换 |
| 4 | 🟢 提示 | `Login.module.css`、`admin/*.module.css`（AdminLayout/Users/Stats/UserDetail） | **遗留冷调色板**（`#1a1a2e`、`#667eea`、`#764ba2`、`#e74c3c`等） | 登录页/后台页主色调仍是冷色（运行时 admin 根 bg 为冷灰 `rgb(240,242,245)`）。本卡范围「Home 视觉改造」，**未涉及这些页面，非回归**。若产品要全站统一暖调，需另开任务 |
| 5 | 🟢 提示 | `public/design/auto-login.html` + `preview.png` `prototype.html` | **未跟踪的验收辅助/测试残留文件** | 前端自留的截图/自动登录辅助文件，不应进正式交付。建议提交前移出或删除 |

**回归结论**：Home 视觉改造**未破坏其它任何页面**。Login/Onboarding/Settings/History/admin 均正常加载、无 console 报错（运行时逐一验证）。History 与 Home 共享 EntryCard，间距因两边同步改 gap 而保持一致，无塌陷。

---

## 五、结论

- 设计核心承诺（暖米安静、衬线大数字+光晕、手帐感卡片、移动端 FAB 不遮挡、进度条去焦虑红）**全部落地且运行时达标**。
- **判定：✅ 有条件通过**。条件（可选，非阻塞发布）：
  - 强烈建议修 #1（Home 生日 banner 残留鲜红）以彻底达成「Home 无冷色」；
  - #2 hero 尺寸如要完全贴合设计可调；#3/#4 属 Home 卡范围外，如需全站统一暖调另立任务；
  - #5 交付前清理测试残留文件。

*验收方法：设计基准逐项对照 + git diff 审阅 7 个改动文件 + headless Chromium 运行时核对计算样式/console/移动端布局。截图存于验收会话 /tmp（home_cdp.png、home_mobile.png）。*
