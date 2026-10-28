"use client";

// ============================================================
// components/MiniAppsDrawer.tsx — 右侧"小程序仓库"滑入抽屉
//
// 装一系列学习辅助小工具（Focus Timer / 后续: 番茄记录 / 单词卡 / 计算器...）
// 入口：TopBar 右上的 LayoutGrid 按钮
//
// 设计：
//   - 用户用 App 时 drawer 长开，主区不被遮罩（pointer-events 透）
//   - drawer 内顶部是 App 列表（图标网格），点击切换当前显示的 App
//   - 主区域随选中 App 渲染对应组件
// ============================================================

import React, { useState } from "react";
import { X, Target, Sparkles, BarChart3, Share2 } from "lucide-react";
import type { DdlItem } from "@/lib/types";
import FocusTimer from "./mini-apps/FocusTimer";
import StatsApp from "./mini-apps/StatsApp";
import ShareCard from "./mini-apps/ShareCard";
import { useIsMobile } from "@/lib/use-is-mobile";
import { useT } from "@/lib/i18n";

interface MiniAppCommonProps {
  ddls?: DdlItem[];
  onAppendTaskNote?: (taskId: string, line: string) => void;
}

interface MiniApp {
  id: string;
  nameKey: string;
  icon: React.ReactNode;
  Component: React.ComponentType<MiniAppCommonProps>;
  disabled?: boolean;
}

const APPS: MiniApp[] = [
  { id: "focus", nameKey: "mini.focus", icon: <Target size={16} />, Component: FocusTimer },
  { id: "stats", nameKey: "mini.stats", icon: <BarChart3 size={16} />, Component: StatsApp },
  { id: "share", nameKey: "mini.share", icon: <Share2 size={16} />, Component: ShareCard },
];

interface MiniAppsDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Epic 4.3 / 5.1 提供给 StatsApp / FocusTimer */
  ddls?: DdlItem[];
  /** Epic 5.1 FocusTimer 结束追加到任务 notes */
  onAppendTaskNote?: (taskId: string, line: string) => void;
}

export default function MiniAppsDrawer({ open, onClose, ddls = [], onAppendTaskNote }: MiniAppsDrawerProps) {
  const [activeId, setActiveId] = useState<string>("focus");
  const active = APPS.find((a) => a.id === activeId) ?? APPS[0];
  const ActiveComponent = active.Component;
  const isMobile = useIsMobile();
  const { t } = useT();

  return (
    <>
      {/* 手机：开启时全屏暗色遮罩，点击关（桌面不挡主区，用户可继续操作）*/}
      {isMobile && open && (
        <div
          onClick={onClose}
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--color-overlay)",
            zIndex: 59,
            animation: "drawer-fade 0.2s ease-out",
          }}
        />
      )}
      {/* 抽屉本体 */}
      <aside
        aria-label="Mini Apps Drawer"
        aria-hidden={!open}
        style={{
          position: "fixed",
          // 手机：贴着 TopBar(顶 8 + 56) 下方，且不压到底部 MobileTabBar(底 8 + 56)；近全宽
          // 桌面：右侧固定 320 长条
          ...(isMobile
            ? {
                top: 72,
                right: 8,
                left: 8,
                bottom: 72,
                width: "auto",
                borderRadius: "var(--radius-card)",
                border: "1px solid var(--color-border)",
                background: "var(--glass-bg-strong)",
                backdropFilter: "var(--glass-blur)",
                WebkitBackdropFilter: "var(--glass-blur)",
                boxShadow: open ? "0 16px 40px rgba(0,0,0,0.18)" : "none",
                transform: open ? "translateY(0)" : "translateY(110%)",
              }
            : {
                top: 56,
                right: 0,
                bottom: 0,
                width: 320,
                background: "var(--color-bg)",
                borderLeft: "1px solid var(--color-border)",
                boxShadow: open ? "-8px 0 24px rgba(0,0,0,0.06)" : "none",
                transform: open ? "translateX(0)" : "translateX(100%)",
              }),
          transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 60,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* 标题栏 */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 14px",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <Sparkles size={14} color="var(--color-primary)" />
          <h2
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-text)",
              margin: 0,
              letterSpacing: 0.3,
              flex: 1,
            }}
          >
            {t("mini.title")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--color-text-muted)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
          >
            <X size={16} />
          </button>
        </header>

        {/* App 切换器（图标 + 名称 横向条，>= 2 个 App 时显示） */}
        {APPS.length > 1 && (
          <div
            style={{
              display: "flex",
              gap: 4,
              padding: "8px 12px",
              borderBottom: "1px solid var(--color-border-soft)",
              overflowX: "auto",
            }}
          >
            {APPS.map((app) => {
              const isActive = app.id === activeId;
              return (
                <button
                  key={app.id}
                  onClick={() => !app.disabled && setActiveId(app.id)}
                  disabled={app.disabled}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid " + (isActive ? "var(--color-primary)" : "var(--color-border)"),
                    background: isActive ? "var(--color-primary-soft)" : "var(--color-bg)",
                    color: isActive ? "var(--color-primary)" : "var(--color-text-muted)",
                    cursor: app.disabled ? "not-allowed" : "pointer",
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: "inherit",
                    opacity: app.disabled ? 0.5 : 1,
                  }}
                >
                  {app.icon}
                  {t(app.nameKey)}
                </button>
              );
            })}
          </div>
        )}

        {/* App 主区 */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 16px",
          }}
        >
          <ActiveComponent ddls={ddls} onAppendTaskNote={onAppendTaskNote} />
        </div>
      </aside>
    </>
  );
}
