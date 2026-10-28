# 🎨 Butler UI 重构计划（已存档）

> ✅ **本计划 5 个 Stage 已全部完成**（PROGRESS [017]-[025]）。
> 留作历史参考，理解为什么当前 UI 是这套设计语言。
>
> 📦 从原 `my-app/UI-REDESIGN-PLAN.md` 迁移到此（PROGRESS [027]）。
>
> 2026-07-01 状态清账：旧 checklist 已按真实落地情况更新。后续开发主线为 `codex/butler-mainline`；本文件不再作为开放待办入口。

---

> **参考设计稿**：`Doc/chat.png` · `Doc/task.png` · `Doc/calender.png` · `Doc/notes.png`
> **目标**：从「玻璃态 + 紫色 + 网格底纹」切到「Linear/Notion 风格的极简墨绿色工具型 SaaS」
> **范围决策**（已与用户对齐）：
> - ✅ Layout + 设计语言全换、内容分期推进
> - ✅ Notes 仍占位，但升级为新设计语言下的「Coming soon」页

---

## 0. TL;DR

| 项 | 决策 |
|---|---|
| 总工作量估计 | ~5-6 天分 5 个 Stage 推进 |
| 主色 | 墨绿 `#1B3D2F`（按钮/Logo/Active） |
| 导航结构 | 顶 Tab Bar（Chat / Tasks / Calendar / Notes）+ 左侧 200px 二级栏（动态：根据当前 Tab 切内容） |
| 当前 [016] SessionListPanel | **作废** —— Recent Chats 直接嵌入左侧二级栏，删除滑入面板 |
| 玻璃态组件 (`GlassButton`, `DecoLayered`) | **作废** —— 全面切换到平面化实色组件 |
| 用户区 | 从左下 68px 头像 → 右上角条目（头像 + 姓名 + 邮箱） |
| Tauri 阻塞项 | Notes 真实化等 Phase 3；本次只做空状态 |

---

## 1. 设计 Token（新调色板与排版）

### 1.1 颜色

```css
/* Primary（墨绿，按钮 / Active / Logo） */
--color-primary:        #1B3D2F;
--color-primary-hover:  #234B3A;
--color-primary-soft:   #E8F0EC;   /* Active 高亮的浅绿背景 */

/* Accent（提示绿 / 成功） */
--color-success:        #2D7A4D;

/* Text */
--color-text:           #0F172A;   /* 主文字 */
--color-text-muted:     #64748B;   /* 次要文字 */
--color-text-faint:     #94A3B8;   /* 占位 / placeholder */

/* Borders / Surfaces */
--color-bg:             #FFFFFF;   /* 主背景，纯白 */
--color-surface:        #F8FAFC;   /* 左栏 / 右栏面板底色 */
--color-border:         #E5E7EB;   /* 主分割线 */
--color-border-soft:    #F1F5F9;   /* 表格行分割 */

/* 状态色（任务优先级 / 标签） */
--color-warning:        #F59E0B;   /* 中优先级 */
--color-danger:         #DC2626;   /* 高优先级 / 逾期 */
--color-info:           #3B82F6;   /* 低优先级 / 信息 */
```

> 旧紫色 `#6366f1` / 玻璃态 `rgba(255,255,255,0.18)` / 网格底纹 `.bg-grid` 全部退场。

### 1.2 字体

- 当前 Inter 已经匹配设计稿，**继续用**
- Size scale：12 / 13 / 14（base）/ 15 / 18 / 22 / 28（page title）
- 字重：400（正文）/ 500（次要标题）/ 600（强调）/ 700（页面标题）

### 1.3 圆角与间距

- 圆角：4（小标签）/ 8（按钮、输入框）/ 10（卡片）/ 12（modal）
- 间距：4 / 8 / 12 / 16 / 24（基于 4px grid）
- 阴影：弱阴影 `0 1px 2px rgba(0,0,0,0.04)`；浮层 `0 8px 24px rgba(0,0,0,0.08)`

---

## 2. 信息架构对照

### 2.1 全局布局

```
┌─────────────────────────────────────────────────────────────────┐
│  [BUTLER]     Chat   Tasks   Calendar   Notes      🔍 + 头像区   │  56px Top Bar
├──────────┬──────────────────────────────────────────┬───────────┤
│  二级栏   │            主内容区（白底）              │  右侧详情  │
│ (200px)  │                                          │  抽屉/Widgets │
│ 内容随   │                                          │  (~280px)  │
│ Tab 切换 │                                          │  可隐藏     │
└──────────┴──────────────────────────────────────────┴───────────┘
```

### 2.2 各 Tab 的左侧二级栏内容

| Tab | 左侧二级栏内容 |
|---|---|
| Chat | `+ New Chat` 按钮 + **Recent Chats**（取代 [016] SessionListPanel） + 「Workspace / Templates」次级链接 |
| Tasks | Views（Active / Upcoming / All / Recently completed） + Tags 分类列表 + 底部小图表 widget（如周完成数） |
| Calendar | 迷你月历 + `+ New Event` + Calendars 分类 + My Schedule（Today / Upcoming / Completed） |
| Notes | 占位空状态文字 + 「Phase 3 解锁」标签（保持当前心智，但样式重做） |

### 2.3 右侧详情面板（按需）

| Tab | 右侧面板 |
|---|---|
| Chat | 无（保持主区居中，可省略） |
| Tasks | 选中任务时弹出详情抽屉：Description / Notes / Attachments / 简化版「最近活动」 |
| Calendar | 常驻 widgets：Upcoming Events / Tasks / Focus Timer |
| Notes | （Phase 3 才有） |

### 2.4 整体布局明细（已拍板）

#### 通用骨架

```
┌──────────────────────────────────────────────────────────────────┐
│                       TopBar  (高 56px, 全宽)                     │
├──────────┬───────────────────────────────────────────────────────┤
│          │                                                        │
│ LeftRail │              主内容区（背景纯白）                       │
│  200px   │              (上下文操作按钮放主区右上角)               │
│  常驻    │                                                        │
│  随Tab   │                                                        │
│  切内容  │                                                        │
│          │                                                        │
└──────────┴───────────────────────────────────────────────────────┘
```

#### TopBar 56px 内容

```
[🎩 24px] BUTLER    Chat   Tasks   Calendar   Notes      🔍 ── 🔔  [Jane ▾]
                    ↑ active 项 2px 墨绿底线
```

- 左：Butler logo 24×24（复用现有 SVG 缩小）+ 字标 `BUTLER`（大写、字距 1.5px）
- 中：4 个 Tab 横排（间距 24px，14px / 500，active 加 2px 墨绿底线）
- 右：全局搜索 240px（⌘K 提示）+ 通知铃铛 + 用户区（头像 32px + 姓名 + 下拉）
- **`+ New Xxx` 等上下文操作按钮 NOT 在 TopBar**，放主区右上角（避免 Tab 切换时按钮跳）

#### LeftRail 200px 通用槽位

```
┌──────────────┐
│ [大按钮 36h] │  各 Tab 的主操作（+ New Chat / + New Task / + New Event / + New Note）
│              │  墨绿实心
│ ▸ 主视图列表 │  扁平列表（带次级图标），≤14 项
│   ...        │
│              │
│ ▸ 分类/Tags │  折叠区，标题 11px 大写灰色
│              │
│ ────────     │
│ [小widget]   │  可选（统计 / 存储进度）
└──────────────┘
```

#### 各 Tab 列数差异

| Tab | 列数 | 结构 |
|---|---|---|
| Chat | 2 列 | LeftRail + 主区（消息流） |
| Tasks | 2 列基础 / 3 列含详情 | LeftRail + 任务表格 [+ 详情抽屉 320px] |
| Calendar | 3 列 | LeftRail + 时间轴主区 + RightWidgets 280px |
| Notes | 4 列（Phase 3 完整）；本期占位 | LeftRail + 笔记树 200px + 编辑器 + 详情抽屉 280px |

#### 列宽速查

| 元素 | 尺寸 |
|---|---|
| TopBar 高度 | 56px |
| LeftRail 宽度 | 200px（折叠态 64px） |
| 详情抽屉宽度 | 320px |
| RightWidgets 宽度 | 280px |
| 主区两侧 padding | 24px |
| 卡片圆角 | 10px |
| 任务表格行高 | 44px |
| 标题与内容间距 | 16px |

#### 响应式断点

| 视口 | 行为 |
|---|---|
| ≥1440px | 全展示（含详情抽屉 / RightWidgets） |
| 1200-1440px | 详情抽屉 / RightWidgets 默认折起，按钮触发 |
| <1200px | LeftRail 折成 **64px 图标条**（hover 展开），抽屉一律折起 |
| <900px | 不在本期范围（学生用户应在笔记本以上屏） |

#### 待定项的最终拍板

1. **`+ 主操作按钮`位置** = 主区右上角（不放 TopBar，避免 Tab 切换跳）
2. **LeftRail 折叠态** = 64px 图标条（保留入口，不消失）
3. **Recent Chats 数量** = LeftRail 最近 **12 条 + "View all"**（更老的进单独页）

---

## 3. 与现有功能的兼容性

| 现有功能 | 处理方式 |
|---|---|
| 4 面板路由 (`activeNav`) | **保留** —— 改成顶 Tab Bar 触发即可 |
| Dexie v3 schema (sessions/messages/ddls/blobs) | **完全保留** —— 数据层 0 改动 |
| AI 对话 + 5 个 tool calling | **完全保留** —— 仅 ChatCanvas 内部样式重做 |
| Pipeline 4 步可视化 | **保留** —— 但改用新设计语言（实色线段、不再用玻璃 `DecoLayered`） |
| TasksPanel CRUD + Modal | **保留逻辑、重做样式** —— Modal 改宽为右侧抽屉风格 |
| CalendarPanel 月视图 | **扩展** —— 增加日/周视图切换 + 时间轴模式 |
| ICS 导出 / JSON 导出导入 | **保留** —— 按钮位置可移到 Tasks 主区右上角 |
| 附件预览（URL / filepath / blob） | **保留** —— Modal 样式重做即可 |
| **SessionListPanel（[016] 刚做）** | ⚠️ **删除** —— Recent Chats 改放 Chat Tab 的左栏 |
| **GlassButton / DecoLayered** | ⚠️ **删除** —— 新设计无玻璃态 |
| **网格底纹 `.bg-grid`** | ⚠️ **删除** —— 设计稿是纯白底 |
| Butler Logo SVG（卡通管家） | **保留** —— 缩小放顶 Tab Bar 左侧，配大写"BUTLER"字标 |

---

## 4. 字段扩展（Tasks）

设计稿引入了 Assignee / Activity / Comments 等团队协作字段。**Butler 是学生 B2C**（[[user_role]]），不照搬。但有 2 个字段值得补：

| 字段 | 当前 | 新增 | 理由 |
|---|---|---|---|
| `status` | `completed: boolean` | `status: "todo" \| "in_progress" \| "done"` | 设计稿 4 段（To-Do / In Progress / Review / Done）简化为 3 段 |
| `tags` | 无 | `tags: string[]` | 替代设计稿里的 Assignee 列位置；学生用「中文/ Project / 考试」等自定义标签更有用 |
| `priority` | 无（仅 weight%） | `priority: "low" \| "med" \| "high"` 可选 | 设计稿 Priority 字段；与 weight% 互补（weight=成绩占比，priority=主观重要度） |

实施时：Dexie v3→v4 升级，旧数据 `completed=true → status="done"`、其余 → `"todo"`。

> ⚠️ Assignee / Activity / Subtasks / Comments **不在本次范围**——非 B2C 场景。

---

## 5. 分阶段实施状态（2026-07-01 更新）

### Stage A — 全局 layout 框架 + 设计 token（已完成）

**Deliverable**：4 个页面都能进，整体外观切换完成，内容尚未深度重做。

- [x] `globals.css` 新增 token 变量；旧玻璃/网格/紫色 legacy 已清理，后续又演进为 paper / simple / retro 三主题。
- [x] 删除旧 `components/ui/GlassButton.tsx` / `components/ui/DecoLayered.tsx` 引用；当前保留的是新 `components/ui/Glass.tsx` / `Portal.tsx`。
- [x] 新建 `components/layout/TopBar.tsx`（Logo 字标 + Tab + 搜索 + 用户菜单）。
- [x] 新建 `components/layout/LeftRail.tsx`（各 Tab 注入二级导航）。
- [x] 改造 `app/page.tsx` 顶层结构：`<TopBar /> + <LeftRail> + <main> + <RightDrawer?>`，移动端另有 `MobileTabBar`。
- [x] 删除旧 `Sidebar.tsx` 68px 设计。
- [x] 删除旧 `SessionListPanel.tsx`，Recent Chats 改为 `ChatRail`。

### Stage B — Chat 页（已完成，部分实现调整）

**Deliverable**：聊天页符合 chat.png 视觉。

- [x] LeftRail 内嵌：`+ New Chat` + Recent Chats 列表（`ChatRail`）。
- [x] ChatCanvas 欢迎屏已重做为本地问候 + TodayHero + 提示词卡；不是原计划 4 张 QuickCard，而是后续交互版本。
- [x] 消息流完成漫画/工具型布局，AI/用户消息区分明确。
- [x] Pipeline 消息从旧装饰板改为独立状态组件。
- [x] InputPod 完成新视觉与模型/额度/附件能力整合。

### Stage C — Tasks 页（已完成）

**Deliverable**：Tasks 页符合 task.png 视觉与基础交互。

- [x] Dexie v3→v4：加 `status` + `tags?` + `priority?` 字段；自动迁移旧数据。
- [x] LeftRail 内嵌 Views（Active / In Progress / Upcoming / All / Completed）；标签统计在 Tasks 顶部聚合。
- [x] 主区列表显示任务名 / 标签 chips / 优先级 / 截止日期 / 完成状态，并支持视图过滤。
- [x] 顶部工具条保留 List 主模式，含 New Task / 周期任务 / ICS / 导入导出。
- [x] `TaskDetailDrawer` 替换原 Modal，含说明 / 备注 / 附件 / 关联笔记等字段。
- [x] ICS 订阅 / 导入导出已保留在 Tasks 工具条中，位置与原计划略有调整。

### Stage D — Calendar 页（已完成，Week 已在后续版本补齐）

**Deliverable**：Calendar 页符合 calender.png 视觉 + 至少日/月切换。

- [x] LeftRail 内嵌迷你月历与 `+ New Event`。
- [x] 主区已支持 Month / Day，后续 [042]/[043] 补了 Week 与拖拽创建/改时间。
  - Month：复用现有 CalendarPanel 月视图、视觉重做
  - Day：按小时纵向排布事件
  - Week：已在后续 Calendar C1-C4 中落地
- [x] 右侧 widgets 区已落地并后续调整：
  - Upcoming Events（取 ddls 中未来事件）
  - Tasks（取未完成 ddls）
  - Focus Timer 最终调整为全局 Mini Apps Drawer，不再放 Calendar 右侧

### Stage E — Notes 占位重做 + 收尾（已完成，Notes 后续已真实化）

**Deliverable**：notes.png 风格的「Coming soon」页 + 全局打磨。

- [x] NotesPanel 重做：背景 / 字体 / 排版用新 token；后续已从占位页演进为浏览器版真实 Notes。
- [x] LeftRail 显示 Notes 列表/入口，Phase 3 Vault 仍为后续桌面壳事项。
- [x] 顶部全局搜索已接任务 / 笔记 / 对话。
- [x] 用户区下拉菜单已有偏好设置 / 成就 / 账单 / 升级入口；2026-07-01 起登录用户信息从 AuthGate 读取，后续已切到 SQLite database login。
- [x] 4 个页面字号 / 间距 / 圆角一致性已多轮打磨并通过后续走查。
- [x] `PROGRESS.md` 已记录 [017]-[026]，后续继续记录到 [096]。

---

## 6. 风险与未决项

| 项 | 风险 | 缓解 |
|---|---|---|
| Calendar 时间轴（Day view） | 时间冲突 / 拖拽编辑实现复杂 | 本期只做**只读时间轴**，编辑仍走 Modal/右抽屉 |
| 设计稿的"Activity"评论流 | B2C 单人场景不需要 | **不做**，详情抽屉只保留 Description / Notes / Attachments |
| Focus Timer | 真实计时器需要后台 + 通知 | 本期纯 UI；Phase 3 接 Tauri 通知后再做真实计时 |
| 字段迁移（status/tags/priority） | 旧数据兼容 | Dexie upgrade hook 自动转：`completed → status="done"`、其余 → `"todo"`；新字段 optional |
| 中文字距与英文对齐 | 设计稿是英文为主，中文密度更高 | 在 Inter 之外用 system-ui fallback；表格列宽给足 |
| 移除 SessionListPanel | [016] 刚做的功能本期作废 | 数据层（sessions/messages）100% 保留；只是 UI 入口换地方 |
| 玻璃组件删除 | 担心不可逆 | 先重命名为 `.legacy.tsx` 留 1-2 个 Stage 验证稳定后再真删 |

---

## 7. 不在本次范围

- ❌ Notes 真实编辑器 + 本地 Vault 读写（Phase 3 / Tauri）
- ❌ Assignee / Activity / Comments / Subtasks（团队协作字段，非 B2C 场景）
- ❌ 全局搜索的语义搜索能力（先做关键字 placeholder）
- ❌ Focus Timer 真实计时逻辑（先做 UI）
- ❌ Calendar 拖拽创建 / 拖拽改时间（成本高，按需后置）
- ❌ Dark mode（设计稿没给，等用户要再做）

---

## 8. 实施前确认清单

每个 Stage 开工前**必须**确认：

1. 上一个 Stage 已通过 `pnpm exec tsc --noEmit` + 浏览器 4 个页面手测
2. 当前 Stage 的 sub-toolbar 元素位置已与设计稿核对（不要靠记忆）
3. 颜色用 token，禁止硬编码 `#1B3D2F` 散落到组件
4. 文案先用占位英文，等 Stage E 收尾时统一中文化

---

*最后更新：2026-05-22 — 计划版 v1，待用户确认后进入 Stage A*
