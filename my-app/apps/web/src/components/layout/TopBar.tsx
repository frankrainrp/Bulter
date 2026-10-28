"use client";

// ============================================================
// components/layout/TopBar.tsx — 56px 全宽顶 Bar
// Logo+字标 / 4 Tab / 搜索 / 通知 / 用户区
// ============================================================

import React, { useState } from "react";
import { ChevronDown, User as UserIcon, CreditCard, LayoutGrid, Settings, Plus, Trophy, Crown, LogOut } from "lucide-react";
import type { NavId, DdlItem, Note, ChatMessage, CustomPanel } from "@/lib/types";
import GlobalSearch from "./GlobalSearch";
import { useT } from "@/lib/i18n";
import { useCurrentPlan, getPlanDef } from "@/lib/billing";
import { useAuthProfile } from "@/components/AuthGate";

const DEFAULT_TAB_ORDER: NavId[] = ["chat", "tasks", "calendar", "notes"];

interface TopBarProps {
  activeNav: NavId;
  onNavChange: (id: NavId) => void;
  miniAppsOpen?: boolean;
  onToggleMiniApps?: () => void;
  // 全局搜索数据源
  ddls?: DdlItem[];
  notes?: Note[];
  messages?: ChatMessage[];
  /** B3: 搜索结果点击后透传给 page.tsx,用于跳转 + 高亮目标 */
  onSearchJump?: (target: NavId, refId?: string) => void;
  /** Epic 3 偏好设置入口 */
  onOpenPreferences?: () => void;
  /** #3 成就收藏室入口 */
  onOpenAchievements?: () => void;
  /** Phase D 用户自定义 Tab 顺序，未传则用默认 */
  tabsOrder?: NavId[];
  /** Phase D 隐藏的 Tab 集合 */
  hiddenTabs?: Set<NavId>;
  /** Phase D 拖拽重排后回调 */
  onTabsReorder?: (newOrder: NavId[]) => void;
  /** Phase E 自定义面板列表（按 createdAt 升序）*/
  customPanels?: Pick<CustomPanel, "id" | "label" | "emoji">[];
  /** Phase E 当前激活的自定义面板 id（非 null 时盖过 activeNav）*/
  activeCustomPanelId?: string | null;
  /** Phase E 点击自定义面板 Tab */
  onSelectCustomPanel?: (id: string) => void;
  /** Phase E 「+」按钮：创建新自定义面板 */
  onCreateCustomPanel?: () => void;
  /** 手机响应式：隐藏 pill-nav（底部 tab 代替）*/
  isMobile?: boolean;
  /** [072] 账单管理入口 */
  onOpenBilling?: () => void;
  /** [072] 升级 CTA（开定价页）*/
  onUpgrade?: () => void;
}

export default function TopBar({
  activeNav, onNavChange, miniAppsOpen, onToggleMiniApps,
  ddls = [], notes = [], messages = [], onSearchJump, onOpenPreferences, onOpenAchievements,
  tabsOrder, hiddenTabs, onTabsReorder,
  customPanels = [], activeCustomPanelId, onSelectCustomPanel, onCreateCustomPanel,
  isMobile = false, onOpenBilling, onUpgrade,
}: TopBarProps) {
  const { t } = useT();
  const authProfile = useAuthProfile();
  const plan = useCurrentPlan();
  const isPaid = plan !== "free";
  const [showUserMenu, setShowUserMenu] = useState(false);
  // Phase D Tab 拖拽：dragOverId 指示拖到哪个 tab 上（视觉反馈）
  const [dragOverId, setDragOverId] = useState<NavId | null>(null);

  const order = tabsOrder ?? DEFAULT_TAB_ORDER;
  const hidden = hiddenTabs ?? new Set<NavId>();
  const visibleTabs = order.filter((id) => !hidden.has(id));

  // 处理 drop：把 src 插入到 target 之前
  const handleDropTab = (sourceId: NavId, targetId: NavId) => {
    if (sourceId === targetId) return;
    const newOrder = order.filter((id) => id !== sourceId);
    const targetIdx = newOrder.indexOf(targetId);
    if (targetIdx < 0) return;
    newOrder.splice(targetIdx, 0, sourceId);
    onTabsReorder?.(newOrder);
  };

  return (
    <header
      style={{
        height: 56,
        minHeight: 56,
        flexShrink: 0,
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--glass-border)",
        background: "var(--glass-bg-strong)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        boxShadow: "var(--shadow-card-hover)",
        display: "flex",
        alignItems: "center",
        padding: isMobile ? "0 10px" : "0 16px",
        gap: isMobile ? 8 : 28,
        zIndex: 50,
        position: "relative",
      }}
    >
      {/* ── 左：Logo + 字标 ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          aria-label="Butler"
          role="img"
          className="app-logo"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            backgroundImage: "url('/assets/logo.png')",
            backgroundSize: "28px 28px",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
        <span
          className="font-display"
          style={{
            fontWeight: 600,
            fontSize: 18,
            letterSpacing: 2,
            color: "var(--color-text)",
          }}
        >
          Butler
        </span>
      </div>

      {/* ── 中：拟物胶囊导航条（样例 #B）；手机隐藏，底部 MobileTabBar 代替 ── */}
      {!isMobile && (
      <nav className="pill-nav">
        {visibleTabs.map((id) => {
          // Phase E：有 activeCustomPanelId 时所有内置 Tab 都不 active
          const isActive = !activeCustomPanelId && activeNav === id;
          const isDragOver = dragOverId === id;
          return (
            <button
              key={id}
              onClick={() => onNavChange(id)}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData("text/butler-tab", id); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("text/butler-tab")) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverId !== id) setDragOverId(id);
                }
              }}
              onDragLeave={() => { if (dragOverId === id) setDragOverId(null); }}
              onDrop={(e) => {
                e.preventDefault();
                const sourceId = e.dataTransfer.getData("text/butler-tab") as NavId;
                setDragOverId(null);
                if (sourceId && sourceId !== id) handleDropTab(sourceId, id);
              }}
              title={t("topbar.tabReorder")}
              className={isActive ? "pill-nav-item active" : "pill-nav-item"}
              style={isDragOver ? { boxShadow: "inset 0 0 0 2px var(--color-primary)" } : undefined}
            >
              {t(`nav.${id}`)}
            </button>
          );
        })}

        {/* Phase E 自定义面板 Tab（按 createdAt 顺序） */}
        {customPanels.map((p) => {
          const isActive = activeCustomPanelId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onSelectCustomPanel?.(p.id)}
              title={p.label}
              className={isActive ? "pill-nav-item active" : "pill-nav-item"}
              style={{ paddingLeft: 12, paddingRight: 12 }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>{p.emoji}</span>
              <span style={{
                maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{p.label}</span>
            </button>
          );
        })}

        {/* Phase E 「+」新建按钮 */}
        {onCreateCustomPanel && (
          <button
            onClick={onCreateCustomPanel}
            title={t("nav.newPanel")}
            aria-label={t("nav.newPanel")}
            className="pill-nav-item"
            style={{ padding: 0, width: 30, justifyContent: "center" }}
          >
            <Plus size={15} />
          </button>
        )}
      </nav>
      )}

      {/* ── 右：搜索 / 通知 / 用户 ── */}
      <div style={{ ...(isMobile ? { flex: 1, marginLeft: 10 } : { marginLeft: "auto" }), display: "flex", alignItems: "center", gap: isMobile ? 8 : 10 }}>
        {/* 全局搜索（接 ddls/notes/messages） */}
        <GlobalSearch
          isMobile={isMobile}
          ddls={ddls}
          notes={notes}
          messages={messages}
          onJump={(target, refId) => {
            if (onSearchJump) onSearchJump(target, refId);
            else onNavChange(target);
          }}
        />

        {/* [086] 升级 CTA / 档位徽标从顶栏移除 —— 改为只在用户菜单（个人资料）里出现。
            付费状态徽标见下方用户菜单 header；免费升级入口见菜单内「升级」项。 */}

        {/* [088] 用量指示已移到输入舱发送钮旁的圆环（UsageRing），顶栏不再放额度条 */}

        {/* 用户区 */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowUserMenu((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 6px 4px 4px",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--color-primary)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                overflow: "hidden",
              }}
            >
              {authProfile.imageUrl ? (
                <img src={authProfile.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <UserIcon size={14} />
              )}
            </div>
            {!isMobile && (
              <>
                <div style={{ textAlign: "left", lineHeight: 1.2 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text)" }}>{authProfile.name}</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{authProfile.email}</div>
                </div>
                <ChevronDown size={14} color="var(--color-text-muted)" />
              </>
            )}
          </button>

          {showUserMenu && (
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 40 }}
                onClick={() => setShowUserMenu(false)}
              />
              <div
                style={{
                  position: "absolute",
                  top: 44,
                  right: 0,
                  width: 200,
                  zIndex: 50,
                  borderRadius: 10,
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--color-border-soft)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>{authProfile.name}</p>
                    <span
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        padding: "1px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                        background: isPaid ? (plan === "max" ? "var(--butler-gold)" : "var(--color-primary)") : "var(--color-surface)",
                        color: isPaid ? (plan === "max" ? "#1c1c1e" : "#fff") : "var(--color-text-muted)",
                        border: isPaid ? "none" : "1px solid var(--color-border)",
                      }}
                    >
                      {isPaid && <Crown size={9} />}{t(getPlanDef(plan).nameKey)}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                    {authProfile.email}
                  </p>
                </div>
                {/* 升级 CTA（免费用户）*/}
                {!isPaid && (
                  <MenuBtn
                    icon={<Crown size={14} />}
                    label={t("topbar.upgradeCta")}
                    accent
                    onClick={() => { setShowUserMenu(false); onUpgrade?.(); }}
                  />
                )}
                {/* 学习工具（主题切换已去掉，固定深炭蓝；复古在偏好设置里选）*/}
                <MenuBtn
                  icon={<LayoutGrid size={14} />}
                  label={miniAppsOpen ? t("topbar.toolsClose") : t("topbar.toolsOpen")}
                  onClick={() => { setShowUserMenu(false); onToggleMiniApps?.(); }}
                />
                <MenuBtn
                  icon={<Settings size={14} />}
                  label={t("topbar.preferences")}
                  onClick={() => { setShowUserMenu(false); onOpenPreferences?.(); }}
                />
                <MenuBtn
                  icon={<Trophy size={14} />}
                  label={t("topbar.achievements")}
                  onClick={() => { setShowUserMenu(false); onOpenAchievements?.(); }}
                />
                <MenuBtn
                  icon={<CreditCard size={14} />}
                  label={t("topbar.billing")}
                  onClick={() => { setShowUserMenu(false); onOpenBilling?.(); }}
                />
                {authProfile.signOut && (
                  <MenuBtn
                    icon={<LogOut size={14} />}
                    label={t("topbar.logout")}
                    danger
                    onClick={() => { setShowUserMenu(false); authProfile.signOut?.(); }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuBtn({
  icon,
  label,
  danger,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  /** 升级 CTA：主色高亮 */
  accent?: boolean;
  onClick?: () => void;
}) {
  const [hov, setHov] = useState(false);
  const color = danger
    ? hov ? "#b91c1c" : "var(--color-danger)"
    : accent
    ? "var(--color-primary)"
    : hov ? "var(--color-text)" : "var(--color-text-muted)";
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        fontSize: 13,
        fontWeight: accent ? 600 : 400,
        fontFamily: "inherit",
        color,
        background: accent
          ? (hov ? "var(--color-primary-soft)" : "color-mix(in srgb, var(--color-primary) 7%, transparent)")
          : hov ? "var(--color-surface)" : "transparent",
        transition: "all 0.15s",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
