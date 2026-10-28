"use client";

// ============================================================
// components/layout/MobileTabBar.tsx — 手机底部主导航 tab bar
// 窄屏(≤768)时替代 TopBar 的 pill-nav：4 主面板快速切换 + 菜单(开左栏抽屉)。
// fixed 底部玻璃胶囊；env(safe-area) 适配刘海屏底部。
// ============================================================

import React from "react";
import { MessageSquare, ListTodo, Calendar as CalendarIcon, FileText, PanelLeft } from "lucide-react";
import type { NavId } from "@/lib/types";
import { useT } from "@/lib/i18n";

const TABS: { id: NavId; icon: React.ReactNode }[] = [
  { id: "chat", icon: <MessageSquare size={20} /> },
  { id: "tasks", icon: <ListTodo size={20} /> },
  { id: "calendar", icon: <CalendarIcon size={20} /> },
  { id: "notes", icon: <FileText size={20} /> },
];

interface Props {
  activeNav: NavId;
  /** 当前是否在自定义面板（高亮则 4 tab 都不 active）*/
  inCustomPanel?: boolean;
  onNavChange: (id: NavId) => void;
  /** 打开左栏二级抽屉（New Chat / 会话列表 / 任务视图等）*/
  onOpenNav: () => void;
}

export default function MobileTabBar({ activeNav, inCustomPanel, onNavChange, onOpenNav }: Props) {
  const { t } = useT();
  return (
    <nav
      style={{
        position: "fixed",
        left: 8,
        right: 8,
        bottom: 8,
        height: 56,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        display: "flex",
        alignItems: "stretch",
        background: "var(--glass-bg-strong)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        border: "1px solid var(--glass-border)",
        borderRadius: "var(--radius-card)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
        zIndex: 45,
        overflow: "hidden",
      }}
    >
      {/* 菜单：开左栏二级抽屉 */}
      <button
        onClick={onOpenNav}
        aria-label={t("topbar.openNav")}
        style={{
          width: 52,
          border: "none",
          borderRight: "1px solid var(--color-border-soft)",
          background: "transparent",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-muted)",
        }}
      >
        <PanelLeft size={20} />
      </button>

      {TABS.map((tab) => {
        const active = !inCustomPanel && activeNav === tab.id;
        const label = t(`nav.${tab.id}`);
        return (
          <button
            key={tab.id}
            onClick={() => onNavChange(tab.id)}
            aria-label={label}
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              color: active ? "var(--color-primary)" : "var(--color-text-faint)",
              fontSize: 10,
              fontWeight: active ? 600 : 500,
              fontFamily: "inherit",
              transition: "color 0.15s",
            }}
          >
            {tab.icon}
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
