"use client";

// ============================================================
// components/OnboardingTour.tsx — 5 步首次使用引导
//
// 设计:
//   - 首次访问检测 localStorage "butler.onboarded"
//   - 5 步定位到关键 UI 元素(用 selector)
//   - 高亮目标元素 + 暗色遮罩裁切 + 浮动 tooltip
//   - 可跳过 / 上一步 / 下一步
// ============================================================

import React, { useEffect, useState } from "react";
import { X, ArrowRight, ArrowLeft, SkipForward } from "lucide-react";
import { useT } from "@/lib/i18n";

interface Step {
  /** 目标元素 selector;为空则居中显示 */
  selector?: string;
  /** i18n key（标题 / 正文）*/
  titleKey: string;
  bodyKey: string;
  /** tooltip 相对 anchor 的位置 */
  placement?: "bottom" | "top" | "right" | "left" | "center";
}

const STEPS: Step[] = [
  { placement: "center", titleKey: "tour.s0.title", bodyKey: "tour.s0.body" },
  { selector: "header nav", placement: "bottom", titleKey: "tour.s1.title", bodyKey: "tour.s1.body" },
  { selector: "#chat-input", placement: "top", titleKey: "tour.s2.title", bodyKey: "tour.s2.body" },
  { selector: "[id=\"model-selector-btn\"]", placement: "top", titleKey: "tour.s3.title", bodyKey: "tour.s3.body" },
  { selector: "input[placeholder*=\"Search\"]", placement: "bottom", titleKey: "tour.s4.title", bodyKey: "tour.s4.body" },
];

const KEY = "butler.onboarded";

interface Props {
  /** 显式控制:null = 按 localStorage 自动判断,true = 强制显示,false = 强制不显示 */
  forceOpen?: boolean | null;
  /** 完成 / 跳过时 callback */
  onClose?: () => void;
}

export default function OnboardingTour({ forceOpen = null, onClose }: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  // 自动触发
  useEffect(() => {
    if (forceOpen === true) {
      setOpen(true);
      setStepIdx(0);
      return;
    }
    if (forceOpen === false) {
      setOpen(false);
      return;
    }
    // 检查 localStorage
    try {
      const onboarded = localStorage.getItem(KEY);
      if (!onboarded) {
        // 延 1.5s 让页面 hydrate 完成
        const t = setTimeout(() => setOpen(true), 1500);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, [forceOpen]);

  // 定位 anchor
  useEffect(() => {
    if (!open) { setAnchorRect(null); return; }
    const sel = STEPS[stepIdx]?.selector;
    if (!sel) { setAnchorRect(null); return; }
    const update = () => {
      const el = document.querySelector(sel);
      if (el) setAnchorRect(el.getBoundingClientRect());
      else setAnchorRect(null);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [open, stepIdx]);

  const close = (markDone: boolean) => {
    setOpen(false);
    if (markDone) {
      try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
    }
    onClose?.();
  };

  if (!open) return null;
  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;
  const isFirst = stepIdx === 0;
  const isCenter = step.placement === "center" || !anchorRect;

  // tooltip 位置
  const tooltipStyle: React.CSSProperties = (() => {
    if (isCenter) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }
    const padding = 12;
    if (step.placement === "bottom") {
      return {
        top: anchorRect!.bottom + padding,
        left: Math.min(anchorRect!.left + anchorRect!.width / 2, window.innerWidth - 160),
        transform: "translateX(-50%)",
      };
    }
    if (step.placement === "top") {
      return {
        top: anchorRect!.top - padding,
        left: Math.min(anchorRect!.left + anchorRect!.width / 2, window.innerWidth - 160),
        transform: "translate(-50%, -100%)",
      };
    }
    if (step.placement === "right") {
      return {
        top: anchorRect!.top + anchorRect!.height / 2,
        left: anchorRect!.right + padding,
        transform: "translateY(-50%)",
      };
    }
    return {
      top: anchorRect!.top + anchorRect!.height / 2,
      left: anchorRect!.left - padding,
      transform: "translate(-100%, -50%)",
    };
  })();

  return (
    <>
      {/* 全屏暗色遮罩 + 镂空高亮 anchor */}
      <div
        onClick={() => close(true)}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--color-overlay)",
          zIndex: 100,
          animation: "tour-fade 0.2s ease-out",
          ...(anchorRect && {
            // 镂空效果用 box-shadow 模拟
            clipPath: "none",
          }),
        }}
      />

      {/* anchor 高亮框 */}
      {anchorRect && (
        <div
          style={{
            position: "fixed",
            top: anchorRect.top - 6,
            left: anchorRect.left - 6,
            width: anchorRect.width + 12,
            height: anchorRect.height + 12,
            border: "3px solid var(--color-primary)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 0 0 9999px var(--color-overlay)",
            pointerEvents: "none",
            zIndex: 101,
            animation: "tour-pulse 1.6s ease-in-out infinite",
          }}
        />
      )}

      {/* Tooltip */}
      <div
        style={{
          position: "fixed",
          ...tooltipStyle,
          width: 320,
          background: "var(--color-surface)",
          border: "2px solid var(--color-border)",
          borderRadius: "var(--radius-card)",
          padding: 16,
          boxShadow: "var(--shadow-modal)",
          zIndex: 102,
          fontFamily: "inherit",
          color: "var(--color-text)",
        }}
      >
        {/* 进度 + 关闭 */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-text-muted)",
              letterSpacing: 0.5,
            }}
          >
            {stepIdx + 1} / {STEPS.length}
          </span>
          <div
            style={{
              flex: 1,
              margin: "0 10px",
              height: 3,
              background: "var(--color-border)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${((stepIdx + 1) / STEPS.length) * 100}%`,
                height: "100%",
                background: "var(--color-primary)",
                transition: "width 0.25s",
              }}
            />
          </div>
          <button
            onClick={() => close(true)}
            aria-label={t("tour.skip")}
            title={t("tour.skipTitle")}
            style={{
              width: 22, height: 22, border: "none", background: "transparent",
              cursor: "pointer", color: "var(--color-text-muted)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              borderRadius: 4,
            }}
          >
            <X size={14} />
          </button>
        </div>

        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", margin: "0 0 6px" }}>
          {t(step.titleKey)}
        </h3>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "0 0 14px", lineHeight: 1.55, whiteSpace: "pre-line" }}>
          {t(step.bodyKey)}
        </p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => close(true)}
            style={{
              padding: "5px 10px",
              border: "none",
              background: "transparent",
              color: "var(--color-text-faint)",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <SkipForward size={11} /> {t("tour.skip")}
          </button>
          <div style={{ display: "flex", gap: 6 }}>
            {!isFirst && (
              <button
                onClick={() => setStepIdx((i) => i - 1)}
                style={{
                  padding: "6px 10px",
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  background: "var(--color-bg)",
                  color: "var(--color-text-muted)",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <ArrowLeft size={11} /> {t("tour.prev")}
              </button>
            )}
            <button
              onClick={() => (isLast ? close(true) : setStepIdx((i) => i + 1))}
              style={{
                padding: "6px 14px",
                border: "none",
                borderRadius: 6,
                background: "var(--color-primary)",
                color: "white",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              {isLast ? t("tour.start") : t("tour.next")} {!isLast && <ArrowRight size={11} />}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tour-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes tour-pulse {
          0%, 100% { box-shadow: 0 0 0 9999px var(--color-overlay), 0 0 0 0 color-mix(in srgb, var(--color-primary) 40%, transparent); }
          50%      { box-shadow: 0 0 0 9999px var(--color-overlay), 0 0 0 8px color-mix(in srgb, var(--color-primary) 25%, transparent); }
        }
      `}</style>
    </>
  );
}
