# 🎭 管家人物动画方案（Live2D / Rive / CSS）

> **状态**：计划阶段（PROGRESS [027]）
> **当前选择**：**P1 Rive**（已与用户对齐）
> **阻塞**：等用户准备分层 SVG 资产

---

## 0. 用户决策记录

| 选项 | 用户选择 |
|---|---|
| P0 CSS 微动画（呼吸/眨眼） | ❌ 未选 |
| **P1 Rive（需要分层资产）** | ✅ **选** |
| P2 Live2D Cubism（Phase 3 Tauri 后） | ❌ 未选 |
| 先不做 | ❌ |

---

## 1. 方案对比

| 方案 | 学习曲线 | runtime 体积 | 商用授权 | Web 支持 | 当前 PNG 兼容 |
|---|---|---|---|---|---|
| **Live2D Cubism** | 陡（需 Cubism Editor） | 300KB+ | 收费（小公司有免费档） | ✅ cubism-web SDK | ❌ 必须重做 .moc3 |
| **Rive**（推荐 ✅） | 中（在线 editor，所见即所得） | ~100KB | 免费 / 开源 | ✅ `@rive-app/react-canvas` | ❌ 需重做 .riv，但可基于现有 PNG 设计 |
| Lottie | 低（AE 导出） | ~200KB | 开源 | ✅ lottie-web | ❌ 需 AE 工具 |
| **CSS 微动画**（P0 备选） | 极低 | 0 | 免费 | ✅ 浏览器原生 | ✅ 当前 PNG 直接可用 |
| Spine | 陡 | 500KB+ | 收费 | ⚠ 偏游戏 | ❌ 需重做 |

---

## 2. Rive 路径详细

### 2.1 用户需要准备的资产

请提供 **1 套人物分层文件**，建议格式：**SVG**（推荐）或 **PSD**。

#### 必需图层（最少分层）

| 图层 | 用途 |
|---|---|
| `body` | 身体 + 黑西装（不可拆分主体） |
| `head` | 头颅 + 礼帽（整体可旋转 / 点头） |
| `eye_left` / `eye_right` | 眼睛上半（可眨眼） |
| `mouth` | 嘴部（可张合 / 微笑切换） |
| `arm_left` / `arm_right` | 双臂（可挥手 / 端盘子 / 指出方向） |
| `hat`（可选独立） | 礼帽（脱帽致敬动作） |
| `accessory_tray`（serving 专用） | 端着的托盘 / 茶杯 |

#### 建议同时提供 3 个姿势的关键帧参考

| 姿势 | 关键帧描述 |
|---|---|
| `standing` | 双手垂放体侧，正面 |
| `serving` | 右手端托盘，左手压在身前（鞠躬式） |
| `pointout` | 右手前伸食指点出方向（如指日历 / 屏幕） |

> 当前 PNG（`apps/web/public/assets/butler-*.png`）可作为风格参考。

#### 替代方案：让 AI 生图

如果你没有插画能力，可用 Midjourney / DALL-E 3 / SDXL 生成：

```
Prompt 模板：
"A flat illustration of a butler character, [pose=standing/serving/pointing],
black tuxedo with bow tie, top hat, white gloves, friendly cartoon style,
transparent background, layered components (head, body, arms separated),
SVG-ready, minimalist line art, single character on plain background"
```

然后用 PS / Figma 拆图层导出 SVG（每个图层为独立 group）。

### 2.2 Rive Editor 制作步骤

**工具**：[rive.app](https://rive.app)（在线 + 免费层）

1. 在 Rive editor **New File** → Import SVG
2. **Rig**（绑定骨骼）：
   - `head` 加一个 bone，绑定头部转动
   - `eye_*` 各加一个 bone，绑定眨眼缩放（scaleY 0.1）
   - `mouth` 加一个 morph target（张/合两个形状插值）
   - `arm_*` 加 IK 链，绑定挥手 / 指出动作
3. **State Machine**：
   - 4 个状态：`idle_standing` / `idle_serving` / `idle_pointing` / `talking`
   - Inputs（外部触发）：
     - `to_standing` (trigger)
     - `to_serving` (trigger)
     - `to_pointing` (trigger)
     - `is_talking` (boolean) — 嘴部微动
   - Transitions：trigger 触发 → 1.0s smooth blend
4. **Idle Animations**（每个状态自带）：
   - 呼吸：`body.scale.y` 1.0 ↔ 1.02 周期 4s
   - 眨眼：`eye_*.scale.y` 1.0 ↔ 0.1 周期 0.1s（随机 4-8s 间隔）
   - 头部微动：`head.rotation` ±2° 周期 6s
5. **Talking Animation**（boolean `is_talking=true` 时触发）：
   - 嘴部 morph 0 ↔ 1 周期 0.2-0.4s 随机
   - 头部 ±1° 抖动
6. **Export**：File → Export → `.riv` 文件（约 50-100KB）
7. 上传到 `apps/web/public/assets/butler.riv`

### 2.3 代码接入（已准备好骨架）

**安装**：

```bash
cd apps/web
pnpm add @rive-app/react-canvas
```

**新建** `apps/web/src/components/ButlerRive.tsx`（替代 ButlerCharacter）：

```tsx
"use client";

import { useRive, useStateMachineInput, Layout, Fit, Alignment } from "@rive-app/react-canvas";
import { useEffect } from "react";
import type { ButlerPose } from "./ButlerCharacter";

interface ButlerRiveProps {
  pose: ButlerPose;
  isTalking?: boolean;
}

const STATE_MACHINE = "ButlerStateMachine";

export default function ButlerRive({ pose, isTalking }: ButlerRiveProps) {
  const { rive, RiveComponent } = useRive({
    src: "/assets/butler.riv",
    stateMachines: STATE_MACHINE,
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.BottomCenter }),
  });

  // pose 切换 → 触发对应 trigger
  const toStanding = useStateMachineInput(rive, STATE_MACHINE, "to_standing");
  const toServing = useStateMachineInput(rive, STATE_MACHINE, "to_serving");
  const toPointing = useStateMachineInput(rive, STATE_MACHINE, "to_pointing");
  const isTalkingInput = useStateMachineInput(rive, STATE_MACHINE, "is_talking");

  useEffect(() => {
    if (!rive) return;
    if (pose === "standing") toStanding?.fire();
    else if (pose === "serving") toServing?.fire();
    else if (pose === "pointout") toPointing?.fire();
  }, [pose, rive, toStanding, toServing, toPointing]);

  useEffect(() => {
    if (isTalkingInput) isTalkingInput.value = !!isTalking;
  }, [isTalking, isTalkingInput]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <RiveComponent />
    </div>
  );
}
```

**接入 ChatCanvas**：

```diff
- import ButlerCharacter, { type ButlerPose } from "./ButlerCharacter";
+ import ButlerRive from "./ButlerRive";
+ import { type ButlerPose } from "./ButlerCharacter"; // 保留类型 export
...
- <ButlerCharacter pose={butlerPose} fillContainer />
+ <ButlerRive pose={butlerPose} isTalking={isLoading} />
```

**fallback 策略**：
- `.riv` 加载失败 / 用户网络慢 → `useRive` 的 `loadError` 触发 → 渲染原 PNG ButlerCharacter
- 推荐：把 ButlerCharacter 作为 fallback 包在外面，Suspense 风格

---

## 3. P0 备用方案（Rive 资产未到位前）

如果用户暂时无法准备资产，先上 CSS 微动画。不需要任何新文件，只改 ButlerCharacter：

```tsx
// ButlerCharacter.tsx 在 img 上加 animation
style={{
  ...原 style,
  animation: "butler-breathe 4s ease-in-out infinite",
}}

// globals.css 加
@keyframes butler-breathe {
  0%, 100% { transform: scale(1) translateY(0); }
  50% { transform: scale(1.015) translateY(-1px); }
}

@keyframes butler-blink {
  0%, 93%, 100% { transform: scaleY(1); }
  95% { transform: scaleY(0.05); }
}
```

效果：人物有微微呼吸感，不死板。约 30 分钟工作量。

---

## 4. 实施 Roadmap

### 阶段 1：等待用户提供分层资产

**Block on**：用户准备 SVG / PSD 或让 AI 生图后导出分层

### 阶段 2：Rive Editor 制作（用户/我）

如果用户能上 Rive editor → 我提供操作指南；
如果用户希望我代做 → 资产传我，我用 Rive 在线编辑器做（但 Editor 是图形界面，AI 难以远程操控，更现实是用户自己做或外包）。

### 阶段 3：接入代码（我）

1. `pnpm add @rive-app/react-canvas`
2. 新建 `components/ButlerRive.tsx`（代码骨架见上）
3. ChatCanvas 替换 ButlerCharacter → ButlerRive
4. 保留 ButlerCharacter 作为 fallback
5. tsc + 浏览器手测
6. PROGRESS 记录

**预估**：资产到位后接入 1.5-2 小时。

### 阶段 4（可选）：扩展 Mini Apps 中"换装"等

- 后续可在 MiniAppsDrawer 加"管家形象设置"App
- 切换不同套装 / 表情包 / 圣诞帽 等

---

## 5. 性能考虑

| 项 | 数值 |
|---|---|
| Rive runtime 体积 | `@rive-app/react-canvas` ~100KB（含 wasm） |
| `.riv` 文件 | 50-150KB（视复杂度） |
| 60fps 渲染 | 现代浏览器（含 Edge WebView2 → Tauri）原生支持 |
| CPU 占用 | < 5%（单角色 idle） |
| 首屏加载 | 异步加载 `.riv`，loading 时显示 ButlerCharacter PNG fallback |

---

## 6. 风险与决策点

| 风险 | 缓解 |
|---|---|
| Rive 免费层有功能限制（如导出格式） | 实测 free tier 足够；如果触顶可升级 Pro $14/月 |
| 用户拿不出分层资产 | 建议先用 P0 CSS 微动画过渡 |
| Rive Editor 学习曲线（用户为非美术） | 提供完整操作录屏（B 站搜"Rive 教程"），或外包给美术 |
| `.riv` 跨域加载 | 放 public/ 同源，无 CORS 问题 |
| Tauri 桌面壳 webview 兼容 | Rive 用 canvas + wasm，Tauri WebView2 完全支持 |

---

## 7. 不在本期范围

- ❌ 3D 模型（VRoid / VRM）
- ❌ 多角色切换
- ❌ 用户自定义表情 / 服装
- ❌ 同步嘴型 lip-sync（需要 TTS 时机数据，太复杂）

---

*最后更新：2026-05-24 — P1 选定，待资产*
