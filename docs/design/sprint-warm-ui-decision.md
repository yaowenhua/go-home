# 全站统一暖调 · 视觉改造决策（Sprint Warm-UI）

> 产品官「👑」── 拍板人
> 决策依据：`docs/design/MASTER.md`（设计系统权威）+ `docs/design/home-handoff.md` + `docs/design/qa-acceptance.md`（QA defect #3/#4）
> 交付位置：本文件 `docs/design/sprint-warm-ui-decision.md`
> 下游：界面匠（frontend）执行样式改造；后端数据芯**不参与**（无样式）。质量哨按本文 DoD 验收。

---

## 0. 现状核验（决策依据）

- **设计系统已就绪**：`styles/variables.css` 全局 token 已是暖调（`#C97B3D` 琥珀主 / `#F7F1E7` 米纸底 / 暖棕阴影），是**唯一权威色板来源**。Home/History/Settings/EntryCard/ProgressBar **已用 token，达标，不动**。
- **冷色残留 = 6 个页面 CSS 硬编码了冷 hex、没有用 token**：
  - `Onboarding.module.css`（深蓝渐变 `#0f0f23→#1a1a2e→#16213e`）— QA #3
  - `Login.module.css`（`#667eea→#764ba2` 紫蓝渐变、`#1a1a2e` 文字、`#f5f5f5`）— QA #4
  - `admin/AdminLayout.module.css`（冷灰根 bg `rgb(240,242,245)`、`#1a1a2e`）— QA #4
  - `admin/AdminUsers.module.css`（`#1a1a2e`、`#667eea`）— QA #4
  - `admin/AdminStats.module.css`（`#1a1a2e`、`#667eea`、`#764ba2`，信息密度高）— QA #4
  - `admin/AdminUserDetail.module.css`（`#667eea`、`#764ba2`、`#1a1a2e`）— QA #4
- **非目标文件已排除**：`Settings.module.css` 已用 `var(--color)` 无冷色残留；`variables.css:7` 的 `#0f0f23` 仅是**注释**（真实 `--color-bg` 已暖），无需改。
- **后端**：纯逻辑、无样式字段/主题配置返回给前端上色，**不参与本次改造**。

---

## 1. 范围（Scope）—— 拍板：6 个页面

本次暖调改造**恰好 6 个前端页面 CSS**，其余一律不动：

| # | 文件 | 处理 |
|---|------|------|
| 1 | `views/Onboarding.module.css` | 深蓝渐变 → 暖米底 + 琥珀主调 |
| 2 | `views/Login.module.css` | 紫蓝渐变/文字 → 暖调（米底 + 琥珀主按钮） |
| 3 | `views/admin/AdminLayout.module.css` | 冷灰根 bg → 暖米 `#F7F1E7` |
| 4 | `views/admin/AdminUsers.module.css` | 冷蓝紫 → 琥珀/暖米 |
| 5 | `views/admin/AdminStats.module.css` | 冷蓝紫 → 暖（**保留信息密度，见 §5**） |
| 6 | `views/admin/AdminUserDetail.module.css` | 冷蓝紫 → 暖 |

**范围外（明确不动）**：
- Home / History / Settings / EntryCard / ProgressBar / 其余已用 token 的组件。
- `variables.css` 全局 token（已暖）；`Home.module.css:16` 生日 banner 残留属**上一卡 Home 内部项**（QA #1），不在本卡，如需修另立票，不并入以免扩大面。
- 后端、数据库、业务逻辑、任何 .vue 逻辑代码。纯样式层。

**验收的"全站无冷色"以这 6 文件为基线**，不重新引入任何其它改动。

---

## 2. 口径（Calibration）—— 拍板两级，后台可适度冷静

### 2.1 统一主口径：**严格复用 `variables.css` token，禁硬编码**

- 6 个文件**一律改用 `var(--color-*)` / `var(--radius-*)` / `var(--space-*)` / `var(--shadow-*)` token**，不新造冷色、不hardcode新 hex。
- 这是本次改造的**第一原则**：不是"抄一遍暖色数值"，而是**接上 token 体系**，让后续维护只改 `variables.css` 一处。现有硬编码的 `#667eea`、`#1a1a2e`、`#f0f2f5`、深蓝渐变必须**全部清除**。

### 2.2 按页面性质分两级暖度（关键取舍）

**A 级 —— 用户面（Onboarding / Login）：全量暖米 + 琥珀，同 Home**
- 与 Home 完全同语言：米纸底 `--color-bg`、白卡片 `--color-bg-card`、琥珀主按钮 `--color-primary` 渐变、暖棕阴影。Login 的紫蓝渐变按钮 → 琥珀 `linear-gradient(135deg, var(--color-primary), var(--color-primary-light))`（与 Home FAB 同款）。

**B 级 —— 后台（4 个 admin 页）：暖米底 + **去冷去紫蓝**，但**保留数据密度与冷静感**
- 根 bg 冷灰 → 暖米 `--color-bg`（`#F7F1E7`）；卡片/表格底 `--color-bg-card`。
- `#667eea`/`#764ba2`/`#1a1a2e` 全部清除：主控色调 → `--color-primary` 琥珀；行内强调/链接/表头高亮用琥珀；表格文字用 `--color-text`/`--color-text-secondary`。
- **刻意保留**：B 级**不追求 Home 那种大留白/大圆角/大数字仪式感**。后台是工具，琥珀只作强调色点缀（`--color-primary` 用于操作按钮、当前状态、关键数据），默认态保持中性暖灰米，避免琥珀大色块淹没表格密度。

**一句话口径**：同色板（token）、不同节奏——前台暖到「手帐感」，后台暖到"不再是冷灰/紫蓝、但仍是冷静的管理工具"。

---

## 3. DoD（Done Definition，可判定）

- [ ] **DD-1 冷色清零**：对 `frontend/src` 全量扫描，**无** `#0f0f23 / #1a1a2e / #16213e / #667eea / #764ba2 / #f0f2f5 / rgb(240,242,245) / #e74c3c` 冷色 hex 残留（含 6 文件；`variables.css` 注释中的 `#0f0f23` 属说明文字，允许豁免）。
- [ ] **DD-2 token 复用**：6 文件不再出现**冷色 hardcode**；暖边界的颜色一律经 `var(--color-*)` 引用（验收：grep 6 文件无敌对冷 hex；抽查使用 `var(--color-primary / bg / text)`）。
- [ ] **DD-3 构建通过**：`frontend` `npm run build`（或 vite build）**0 error**；无未定义 CSS 变量导致的样式失效。
- [ ] **DD-4 无回归**：Home / History / Settings / 其余已用 token 页面**无任何改动**（git 确认这 6 文件之外无样式侧 diff）；6 文件只影响样式、不动 .vue 逻辑。
- [ ] **DD-5 运行时核验**（质量哨 headless Chromium，仿 QA 验收法）：Login / Onboarding / 4 个 admin 页逐页加载，根 bg 均暖调（运行计算样式 `= rgb(247,241,231)` 或 `#F7F1E7` 系）；**0 console 报错**。admin 表格数据可读（对比度/信息密度无崩溃）。
- [ ] **DD-6 后台可读性**：admin 页无「琥珀大色块把表格/文字淹没」的现象；文字与背景对比度可用（`--color-text` 墨色在 `--color-bg` 米底上清晰）。

---

## 4. 边界（非目标，明确不做）

- ❌ **不改任何业务逻辑 / 数据 / 后端 / .vue 交互逻辑**。纯 `*.module.css` 样式层。
- ❌ **不改动已达标的 Home / History / Settings / EntryCard / ProgressBar**（含 Home 生日 banner QA #1——那是上一卡遗留项，另行处理）。
- ❌ **不引入新色板 / 新品牌色 / 深色模式**。只迁移到现有暖 token。
- ❌ **不改 `variables.css` 的 token 定义**（已暖、是基准）。
- ❌ 不做动效/字体/间距的全面重设——本卡只管"冷→暖"，不重排布局。

---

## 5. 风险与取舍（拍板说明）

**风险 1：后台信息密度 vs 琥珀暖调的大色块倾向**
- 取舍：**后台 B 级刻意收敛琥珀，只做强调点缀**（按钮/当前态/关键数据），默认背景与文字保持低饱和暖灰米。理由：后台是高频操作的数据工具，Home 那种大琥珀 Hero + 大留白在表格页会刺眼、稀释信息层级。**同色板、不同节奏**是本次设计中立场地裁定。

**风险 2：一改 6 文件易误伤已达标页面**
- 取舍：DoD 限定「6 文件之外无样式 diff」（DD-4）+ 构建通过（DD-3），把回归面锁死。只动 CSS，不改 .vue。

**风险 3：`var()` 引用错/变量名拼错导致样式静默失效**
- 取舍：DD-3 构建 + DD-5 运行时计算样式核验兜底；抽查是否真的命中了 token（而非形似）。

**风险 4：Login 表单在纯米底上略显平淡（无深色渐变背景的层次感）**
- 取舍：接受。深蓝渐变本是冷调根源，去掉后登录页用「居中卡片 + 琥珀主按钮 + 暖色光晕/边框」补层次，不依赖冷渐变。这是方向性取舍：**一致的暖**优先于 Login 单页的戏剧感。

---

## 6. 给下游的分工

| 角色 | 交付 |
|------|------|
| **界面匠 (frontend)** | 按 §1 范围改 6 个 `*.module.css`，严格走 token；B 级后台按 §2.2 收敛琥珀。只动样式 |
| **后端 (数据芯)** | **不参与**（纯前端样式任务，后端无样式/主题字段） |
| **质量哨 (qa)** | 按 §3 DoD 逐条验收，重点 DD-1 冷色扫描、DD-3 build、DD-5 运行时逐页核验、DD-6 后台可读性 |

**优先级**：一次性交付 6 页（同卡），无内部先后；若排期紧，可按「用户面 2 页优先（Login/Onboarding，用户直接可见）→ 后台 4 页」分两批，但**同卡验收**。
