# ⚙️ Setup

> 启动 / 测试 / 环境变量 / 模型切换 / 测试资源。

---

## 启动

```pwsh
# 启动 dev server
cd my-app/apps/web
pnpm dev               # http://localhost:3000

# TS 检查
pnpm exec tsc --noEmit

# 安装新依赖
pnpm add <pkg>
```

---

## 环境变量

`apps/web/.env.local`（不提交 git，模板见 `.env.local.example`）：

```env
# DeepSeek（必填）
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1    # 可省
DEEPSEEK_MODEL=deepseek-v4-flash                 # 已不再读，仅备查；模型由前端 selectedModel 决定

# Database login（临时 SQLite 账号库）
BUTLER_SQLITE_PATH=                         # 可选；默认 apps/web/data/butler.sqlite

# Mistral OCR（可选，用于扫描件 PDF + 图片课件识别）
MISTRAL_API_KEY=                                  # 申请：https://console.mistral.ai
MISTRAL_BASE_URL=https://api.mistral.ai/v1
OCR_PROVIDER=mistral                              # mistral / deepseek-vl(占位) / tesseract(占位)
```

### Database / SQLite 登录

- 当前登录门使用 email/password，并把用户与 session 写入 SQLite。
- 默认数据库路径是 `apps/web/data/butler.sqlite`；可用 `BUTLER_SQLITE_PATH` 改到其它位置。
- Docker Compose 默认使用 `/app/data/butler.sqlite`，并通过 named volume `butler-sqlite` 持久化。
- 这是临时开发用账号库；正式上线前仍应迁移到受管数据库、补完整账号策略和共享限流。

---

## 模型切换（PROGRESS [026]/[028]/[030]）

### 注册表（`lib/ai-models.ts`）

**只保留 V4 系列**（旧 `deepseek-chat` / `deepseek-reasoner` 2026-07-24 弃用）：

| id | apiModel | tier | 工具 | 思考 | 说明 |
|---|---|---|---|---|---|
| `deepseek-v4-flash`（默认） | `deepseek-v4-flash` | 🟢 low | ✅ | — | 最便宜，日常首选 |
| `deepseek-v4-thinking` | `deepseek-v4-pro` | 🟡 mid | ✅ | `reasoning_effort: "high"` + `thinking: { type: "enabled" }` | 复杂分析/数学/逻辑 |

### 思考模式怎么传

`/api/chat/route.ts` 根据 `modelMeta.thinking` 透传非标准字段（OpenAI SDK 不识别 `thinking`，DeepSeek 后端识别）：

```ts
const thinkingExtras = modelMeta.thinking ? {
  reasoning_effort: modelMeta.thinking.reasoningEffort,  // "high" | "max"
  thinking: { type: "enabled" },
} : {};
const stream = await openai.chat.completions.create({
  model: modelMeta.apiModel,
  ...thinkingExtras,
  ...
} as Parameters<...>[0]);
```

### 用户切换

InputPod 底部 model badge → 紧凑下拉（3px 墨绿左条 + ●tier + label + ✓ active）。
localStorage 持久化（key: `butler.selectedModel`）。

### 服务端校验

`/api/chat` 收到 `body.model` 用 `isValidModelId()` 白名单校验，非法值降级 V4 Flash。

---

## OCR 多模态（PROGRESS [028]）

### 路由策略

| 文件 | 走 | 成本 |
|---|---|---|
| 文字 PDF | unpdf 本地 | ¥0 |
| 扫描 PDF（unpdf 输出 < 50 字）| Mistral OCR | $0.001/页 |
| jpg/png/webp/heic 等 | Mistral OCR | $0.001/张 |

### Provider 注册表（`lib/ocr/providers.ts`）

| Provider | 状态 | 价格 | 需要的 env |
|---|---|---|---|
| **Mistral OCR**（默认） | ✅ 已接入 | $0.001/页 | `MISTRAL_API_KEY` |
| DeepSeek-VL | ⏳ 占位 | 复用 DeepSeek key | `DEEPSEEK_API_KEY` |
| Tesseract.js | ⏳ 占位 | 0（10MB 模型一次下载） | — |

切换：环境变量 `OCR_PROVIDER`。后两个待实现，架构留位。

---

## 测试资源

### 真实课件 PDF

`D:\User\asus\Desktop\Bulter\C245_Data_Analytics_Welcome.pdf`（用户本机）
- 23 页 / 1.4MB / 新加坡某专科课程 syllabus
- 含 CA1/CA2/Presentation/SDLC/FA 完整 assessment 表
- 实测：MiniLM 粗筛后 3138 字 → V4 Flash 提取 5 条 DDL → 总成本 ~¥0.003

### 浏览器自动化

`cp` 测试 PDF 到 `apps/web/public/test.pdf` 即可：

```js
const r = await fetch('/test.pdf');
const blob = await r.blob();
const file = new File([blob], 'test.pdf', { type: 'application/pdf' });
// 触发 InputPod.onAttach([file])
```

---

## Dexie 数据库

- 数据库名：`butler-db`
- 当前 schema：**v5**
- 表：`ddls` / `messages` / `sessions` / `blobs` / `notes`
- 升级路径：
  - v3 → v4：`completed=true → status="done"`
  - v4 → v5：新增 `notes` 表（PROGRESS [029]）

### 清库（彻底重置）

浏览器 DevTools → Application → IndexedDB → `butler-db` → Delete。
或代码：

```js
indexedDB.deleteDatabase("butler-db"); location.reload();
```

---

## 备份点（git tags）

历史 backup tags：
- `backup-019-stage-a` — UI Stage A 完成
- `backup-021-comic-chat` — 漫画式对话完成
- `backup-024-mini-apps` — Mini Apps Drawer
- `backup-025-ui-redesign-done` — UI 重构 Stage E 收尾

恢复：`git reset --hard <tag>`

---

## Windows PowerShell 注意

- 不支持 `&&` → 用 `;` 或 `if ($?) { B }`
- 不要在 dev server tab 同时跑 tsc（cwd 冲突）
- Bash 工具的 cwd 在 Windows 下会丢 → 显式 `cd` 或用 PowerShell + `Set-Location`

---

*最后更新：2026-05-24*
