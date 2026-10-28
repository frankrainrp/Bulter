"use client";

// ============================================================
// components/ButlerCharacter.tsx — 管家人物形象
//
// 7 姿势（详细触发条件见 page.tsx butlerPose 派生）：
//   - standing       默认空闲
//   - serving        AI 待核实 (ai-chat pending)
//   - pointout       PDF 完成短暂高亮 / PDF 待核实
//   - thinking       Flash 模式 content 生成中
//   - thinking-hard  Thinking 模式 reasoning 流中
//   - idea           reasoning→content 过渡的 1s 灵感闪现
//   - rare-thinking  早上 7-9 点 6.1% 概率替代 thinking/thinking-hard 的彩蛋姿势
//
// 渲染策略：所有姿势按各自原始 PNG 尺寸 × scale 缩放，叠加在同一容器内，
// bottom-center 对齐让"脚底踩在同一基准线"，opacity 切换实现交叉淡入。
// 容器尺寸 = 三姿势中的最大值，确保 pose 切换时容器不抖动。
//
// 缺资产降级：img onError 时整个 pose 的 src + 尺寸都切到 standing 资产，
// 这样用户尚未提供新 PNG 时代码可跑、视觉自然降级。
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import { BUTLER_ASSET_EVENT, DEFAULT_POSE_KEY, getCustomAsset } from "@/lib/butler-asset";

export type ButlerPose =
  | "standing"
  | "serving"
  | "pointout"
  | "thinking"
  | "thinking-hard"
  | "idea"
  | "rare-thinking";

interface PoseMeta {
  src: string;
  /** PNG 原始宽度（已 trim 透明边） */
  w: number;
  /** PNG 原始高度 */
  h: number;
}

// 7 个姿势的 PNG 原始尺寸（trim 透明边后的真实 bbox）。
// 原稿 1254×1254 JPEG-in-SVG 由 scripts/trim_butler_poses.py
// 白底抠图（threshold 240）+ getbbox 裁剪生成。
// rare-thinking 矮宽（坐姿/喝咖啡）；其余高瘦贴近 standing 体态。
const POSES: Record<ButlerPose, PoseMeta> = {
  standing:        { src: "/assets/butler-standing.png",      w: 374, h: 1094 },
  serving:         { src: "/assets/butler-serving.png",       w: 683, h: 1003 },
  pointout:        { src: "/assets/butler-pointout.png",      w: 475, h: 1067 },
  thinking:        { src: "/assets/butler-thinking.png",      w: 324, h: 1056 },
  "thinking-hard": { src: "/assets/butler-thinking-hard.png", w: 293, h: 1099 },
  idea:            { src: "/assets/butler-idea.png",          w: 459, h: 1051 },
  "rare-thinking": { src: "/assets/butler-rare-thinking.png", w: 637, h: 855  },
};

const MAX_W = Math.max(...Object.values(POSES).map((p) => p.w));
const MAX_H = Math.max(...Object.values(POSES).map((p) => p.h));

interface ButlerCharacterProps {
  pose: ButlerPose;
  /** 统一缩放倍率（基于 PNG 原始尺寸）；默认 0.33（= 0.55 × 0.6 二次缩减） */
  scale?: number;
  /** 是否带阴影 / 渐入动画 */
  withFx?: boolean;
}

export default function ButlerCharacter({
  pose,
  scale = 0.33,
  withFx = true,
}: ButlerCharacterProps) {
  // 已确认 404 的 pose（缺资产时降级到 standing）
  const [errored, setErrored] = useState<Set<ButlerPose>>(new Set());
  const imgRefs = useRef<Partial<Record<ButlerPose, HTMLImageElement>>>({});

  // [050] Phase C 自定义形象：用户上传的 default 资产 → 替换所有 7 姿势
  // 维护一个 objectURL + 真实尺寸；监听 BUTLER_ASSET_EVENT 即时换肤
  const [customDefault, setCustomDefault] = useState<{ url: string; w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let currentUrl: string | null = null;
    const loadCustom = async () => {
      try {
        const asset = await getCustomAsset(DEFAULT_POSE_KEY);
        if (cancelled) return;
        // 先撤销之前的 URL
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        currentUrl = null;
        if (asset) {
          const url = URL.createObjectURL(asset.blob);
          currentUrl = url;
          setCustomDefault({ url, w: asset.width, h: asset.height });
        } else {
          setCustomDefault(null);
        }
      } catch { /* silent */ }
    };
    loadCustom();
    const onChange = () => loadCustom();
    window.addEventListener(BUTLER_ASSET_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(BUTLER_ASSET_EVENT, onChange);
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, []);

  // mount 后主动检查 — onError 在 SSR/browser cache 场景常漏触发
  // （img 已在 hydrate 前完成加载流程, complete=true 后不再 fire onerror）
  useEffect(() => {
    const check = () => {
      let changed = false;
      const next = new Set(errored);
      (Object.keys(POSES) as ButlerPose[]).forEach((p) => {
        if (p === "standing") return;
        const img = imgRefs.current[p];
        if (img?.complete && img.naturalWidth === 0 && !next.has(p)) {
          next.add(p);
          changed = true;
        }
      });
      if (changed) setErrored(next);
    };
    check();
    const t = setTimeout(check, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 容器尺寸：有自定义形象时按其单一尺寸；否则按内置 MAX
  const baseW = customDefault ? customDefault.w : MAX_W;
  const baseH = customDefault ? customDefault.h : MAX_H;
  const containerW = Math.round(baseW * scale);
  const containerH = Math.round(baseH * scale);

  return (
    <div
      style={{
        position: "relative",
        width: containerW,
        height: containerH,
        flexShrink: 0,
        pointerEvents: "none",
      }}
    >
      {(Object.keys(POSES) as ButlerPose[]).map((p) => {
        // 优先级：用户自定义 default 形象 > 内置 PNG > standing fallback
        const useCustom = customDefault !== null;
        const isFallback = !useCustom && errored.has(p) && p !== "standing";
        const meta = isFallback ? POSES.standing : POSES[p];
        const src = useCustom ? customDefault.url : meta.src;
        const baseMetaW = useCustom ? customDefault.w : meta.w;
        const baseMetaH = useCustom ? customDefault.h : meta.h;
        const isActive = p === pose;
        const w = Math.round(baseMetaW * scale);
        const h = Math.round(baseMetaH * scale);
        return (
          <img
            key={p}
            ref={(el) => { imgRefs.current[p] = el || undefined; }}
            src={src}
            alt={`Butler ${p}`}
            // 内置黑色立绘在黑夜模式自动反色成白；用户自定义形象不反色
            className={!useCustom ? "butler-figure" : undefined}
            draggable={false}
            onError={() => {
              if (!useCustom && p !== "standing" && !errored.has(p)) {
                setErrored((prev) => {
                  const next = new Set(prev);
                  next.add(p);
                  return next;
                });
              }
            }}
            style={{
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: w,
              height: h,
              opacity: isActive ? 1 : 0,
              transition: withFx ? "opacity 0.4s ease" : "none",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        );
      })}

      {/* 站立平台阴影，让人物视觉上"踏在"画面上 */}
      {withFx && (
        <div
          style={{
            position: "absolute",
            bottom: -6,
            left: "20%",
            right: "20%",
            height: 8,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at center, rgba(27,61,47,0.22), transparent 70%)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
