# 🕳️ Pitfalls — 前任踩过的坑

> 报错先来这里查。每加一个 = 节省下次接手的 AI 至少 30 分钟。

---

## A. 第三方库

| 陷阱 | 解决方案 | 影响文件 |
|---|---|---|
| `@huggingface/transformers` npm 包 webpack 打包失败 | 用 CDN + `new Function("u","return import(u)")` 隐藏 dynamic import 让 webpack 看不到 | `lib/semantic-filter.ts` |
| unpdf 浏览器 `mergePages: true` 在 +esm CDN 版本返回空（仅 npm 版本 OK） | 用 npm import，**不要**改 CDN | `lib/document-parser.ts` |
| 关键词过滤后 PDF 文本只剩 1 大段（无换行），semantic 算分被稀释 | semantic-filter 自己激进 split：`[.!?。！？；;]\s+\|\n+\|\s{2,}\|•\s+`，少于 5 段时启用 180 字滑窗 | `lib/semantic-filter.ts` |
| Dexie 启动 load 时 hydration 与首次 setState 竞态会清空 IDB | 用 `hydrated` 状态门控，首次 IDB load 完才允许 sync | `app/page.tsx` |
| Next.js dev HMR 缓存 dynamic import 模块 → 修改不生效 | 必要时 `Get-Process node \| Stop-Process` + 重启 dev server | — |

---

## B. React 行为

| 陷阱 | 解决方案 |
|---|---|
| React 18 StrictMode 让 console.log 双触发，看起来"tool 调了 6 次"，实际只 1 次 | dev only，生产无影响。`setDdls` 内部按 id 去重 |
| HMR 中间态 props 可能短暂 undefined（如 InputPod.value） | 加 fallback `value?.trim() ?? ""` |
| `position: fixed` 内嵌组件想去掉 fixed 时父容器 layout 抖 | 改前先确认父容器有 `flex 1 / display:flex` |
| `onMouseEnter` 写入 `e.currentTarget.style.X` 与 React 重渲染 inline style 竞争 → active 项视觉残留（PROGRESS [030] 模型切换 bug） | **完全用 `useState(hov)` 派生 background**，不要写 `e.currentTarget.style` |

---

## C. Windows / PowerShell

| 陷阱 | 解决方案 |
|---|---|
| `&&` 在 PowerShell 5.1 不支持 | 用 `;` 或 `if ($?) { B }` |
| Bash 工具在 Windows 下 cwd 会丢失 | PowerShell 工具用 `Set-Location` 显式设置 |
| `[void][Class]::Method()` 返回 int 时 binder 错误 | 改返回 string，或 `[int]` 强转 |
| `[System.IO.File]::ReadAllText` 持有文件句柄，同路径 Save 报 GDI+ ExternalException | 先输出到临时文件再 `Move-Item -Force` 覆盖 |
| `Add-Type System.Drawing` 在 PS 7 已弃用 | 用 PS 5.1（.NET Framework），项目脚本依赖此特性 |

---

## D. 浏览器自动化（Claude Preview / Chrome MCP）

| 陷阱 | 解决方案 |
|---|---|
| `preview_click` 不一定触发 React onClick（React 合成事件特殊） | 改用 `document.querySelector(sel).click()` via `preview_eval` |
| `preview_fill` 设置 controlled input 不触发 React onChange | 用原生 setter + `dispatchEvent('input')` |

---

## E. UI / 样式

| 陷阱 | 解决方案 |
|---|---|
| SVG 内嵌 JPEG 无 alpha 通道 | 不能直接做透明背景。两种路径：(a) `mix-blend-mode: multiply` 视觉透明；(b) PowerShell + .NET LockBits 抠白底重生成 PNG（PROGRESS [019]） |
| PNG 边缘有透明像素影响 layout | 用 PowerShell trim 算法去除（PROGRESS [027]）让人物视觉变大 |
| color-mix() 浏览器支持 | Chrome/Edge/Firefox 113+ 已稳定，Safari 16.4+。Tauri 用 WebView2 也 OK |
| `objectFit: contain + objectPosition: bottom` 让人物"踩"在容器底 | 用 `fillContainer` prop 控制（见 ButlerCharacter） |

---

## F. AI / DeepSeek API

| 陷阱 | 解决方案 |
|---|---|
| 旧 `deepseek-chat` / `deepseek-reasoner` 2026-07-24 弃用 | 已统一迁到 V4 系列（`deepseek-v4-flash` + `deepseek-v4-pro` + thinking）；`AiModelMeta.apiModel` 字段存真实 API 名 |
| OpenAI SDK 不识别 `thinking` 字段和 `reasoning_effort: "max"` | 用 `Record<string, unknown>` 收容 + cast 整个 createParams 为 SDK 类型；DeepSeek 后端识别 |
| AI 流式 tool_calls 分片需要按 index 拼装 | 见 `chat-client.ts streamOneRound` 中 `toolCallsAcc Map` |
| AI 在 dueDate 不明时会瞎猜 | system prompt 强约束「宁可漏标也不要瞎猜」 + tool-executor 允许空串 |
| 模型切换时 cache hit 失效（system prompt 因 model 变化重新计费） | 实际 system prompt 不依赖 model，cache 应该命中。如果发现不命中先检查 prompt 是否随 model 变 |

---

## G. Dexie / IndexedDB

| 陷阱 | 解决方案 |
|---|---|
| schema 升级时丢数据 | 永远用 `.version(N).stores({...}).upgrade(async tx => ...)`，**不要**直接改 v(N-1) |
| 多 tab 打开同一 db 时升级阻塞 | 用户关其他 tab 即可 |
| `db.ddls.toArray()` 返回的 Date 字段是字符串（IDB 序列化） | 需要手动 normalize：`m.timestamp = new Date(m.timestamp)` |

---

## H. TypeScript

| 陷阱 | 解决方案 |
|---|---|
| `Promise<X \| Y>` await 后 `if (!result.ok)` narrowing 失败（PROGRESS [028] OcrResponse 踩过） | 用 **显式比较** `if (result.ok !== true)` 或 `if (result.ok === false)`，强制 discriminated union narrow |
| OpenAI SDK 的 `reasoning_effort` 类型不接受 `"max"`（只 high/low/medium） | 用 `Record<string, unknown>` 收容字段 + cast 整个 createParams 为 SDK 类型 |
| stream 返回 `Stream<...> \| ChatCompletion` 联合类型，`for await` 报错 | `for await (const chunk of stream as AsyncIterable<unknown>)` |
| interface vs type alias 在 discriminated union 上行为差异 | 一律用 `export type Foo = A \| B`，narrowing 更可靠 |

---

*最后更新：2026-05-24 — 加 H. TypeScript 段 + 模型 thinking 字段相关坑*
