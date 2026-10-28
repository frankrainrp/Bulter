"use client";

// ============================================================
// components/ui/Glass.tsx — 液态玻璃通用件
// 基于样例「纯CSS液态玻璃」.box + 「导航栏对比 #B」拟物质感，
// 适配 espresso/奶油配色。样式定义在 globals.css 的 @layer components。
// ============================================================

import React from "react";

type GlassVariant = "default" | "primary" | "accent";

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 视觉变体：default 透明玻璃 / primary espresso 实色 / accent 黄铜实色 */
  variant?: GlassVariant;
  /** 圆形图标钮（1:1，自动 padding 0）*/
  circle?: boolean;
}

const VARIANT_CLASS: Record<GlassVariant, string> = {
  default: "",
  primary: "glass-btn-primary",
  accent: "glass-btn-accent",
};

/** 液态玻璃按钮 —— 折射高光 + 柔和悬浮 + active 回弹 */
export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  function GlassButton(
    { variant = "default", circle = false, className = "", children, style, ...rest },
    ref,
  ) {
    const cls = [
      "glass-btn",
      VARIANT_CLASS[variant],
      circle ? "glass-btn-circle" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <button ref={ref} className={cls} style={style} {...rest}>
        {children}
      </button>
    );
  },
);

export interface GlassCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** 渲染成其他标签（如 section / aside）*/
  as?: keyof React.JSX.IntrinsicElements;
}

/** 液态玻璃大模块面板容器 */
export function GlassCard({ as = "div", className = "", children, ...rest }: GlassCardProps) {
  const Tag = as as React.ElementType;
  const cls = ["liquid-glass", className].filter(Boolean).join(" ");
  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  );
}
