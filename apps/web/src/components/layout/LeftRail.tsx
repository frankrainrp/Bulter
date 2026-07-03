"use client";

// ============================================================
// components/layout/LeftRail.tsx — 200px 左侧二级栏容器
// 内容由各 Tab 通过 children 注入（ChatRail/TasksRail/...）
// ============================================================

import React from "react";
import { GlassButton } from "@/components/ui/Glass";

interface LeftRailProps {
  children: React.ReactNode;
}

export default function LeftRail({ children }: LeftRailProps) {
  return (
    <aside
      className="retro-railhost"
      style={{
        position: "relative", // 让复古天际线装饰（::after）能贴左栏底部定位
        width: 220,
        minWidth: 220,
        height: "100%",
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        border: "1px solid var(--glass-border)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card-hover)",
        display: "flex",
        flexDirection: "column",
        padding: "16px 12px",
        gap: 16,
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {children}
    </aside>
  );
}

// ============================================================
// 共享子组件：左栏内通用 UI 元素
// ============================================================

/** 主操作按钮（+ New Xxx）—— 墨绿实心 */
export function RailPrimaryBtn({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <GlassButton
      variant="primary"
      onClick={onClick}
      disabled={disabled}
      style={{ width: "100%", height: 36, fontSize: 13 }}
    >
      {icon}
      {label}
    </GlassButton>
  );
}

/** 分组标题 11px 大写灰色 */
export function RailGroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.8,
        color: "var(--color-text-faint)",
        textTransform: "uppercase",
        padding: "0 4px",
        marginTop: 4,
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

/** 列表项（含图标 / 标签 / active / 右侧 badge） */
export function RailItem({
  icon,
  label,
  active,
  badge,
  onClick,
  onMenuClick,
}: {
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: React.ReactNode;
  onClick?: () => void;
  onMenuClick?: (e: React.MouseEvent) => void;
}) {
  const [hov, setHov] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      role="button"
      tabIndex={0}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        borderRadius: 6,
        background: active ? "var(--color-primary-soft)" : hov ? "rgba(0,0,0,0.04)" : "transparent",
        cursor: "pointer",
        fontSize: 13,
        color: active ? "var(--color-primary)" : "var(--color-text)",
        fontWeight: active ? 500 : 400,
        transition: "background 0.12s",
        position: "relative",
      }}
    >
      {icon && (
        <span
          style={{
            display: "inline-flex",
            color: active ? "var(--color-primary)" : "var(--color-text-muted)",
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
      )}
      <span
        style={{
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {badge}
      {onMenuClick && hov && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMenuClick(e);
          }}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
            color: "var(--color-text-muted)",
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ⋯
        </button>
      )}
    </div>
  );
}
