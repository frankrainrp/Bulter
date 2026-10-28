"use client";

// ============================================================
// components/QuotaWallModal.tsx — softwall（[087] 免费窗口耗尽 / P5′ 积分不足）
//
// mode="window"：5h 免费窗口用尽 → 切 Flash / 买加油包 / 开会员（带回满倒计时）。
// mode="credits"：高级操作积分不足 → 买加油包 / 开会员（显示所需 vs 余额）。
// 永远给"继续免费"出口，绝不让用户撞墙流失。详见 Doc/变现方案.md §2.3 / §3。
// ============================================================

import React, { useEffect, useState } from "react";
import { Crown, Zap, Wallet, X, Clock } from "lucide-react";
import { formatCountdown } from "@/lib/usage";
import { useCredits } from "@/lib/credits";
import { useT } from "@/lib/i18n";

interface QuotaWallModalProps {
  open: boolean;
  /** "window"=免费窗口耗尽（默认）；"credits"=积分不足 */
  mode?: "window" | "credits";
  /** credits 模式：本次操作所需积分 */
  creditsNeed?: number;
  /** 下次额度回满时间戳（window 模式） */
  resetAt: number;
  /** 是否可降级到 Flash 继续免费（当前模型非 Flash 时为 true）*/
  canFallbackFlash: boolean;
  /** 切回 Flash 继续免费 */
  onSwitchFlash: () => void;
  /** 买积分加油包 */
  onTopUp: () => void;
  /** 开会员 */
  onUpgrade: () => void;
  onClose: () => void;
}

export default function QuotaWallModal({
  open, mode = "window", creditsNeed = 0, resetAt, canFallbackFlash, onSwitchFlash, onTopUp, onUpgrade, onClose,
}: QuotaWallModalProps) {
  const { t } = useT();
  const credits = useCredits();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const iv = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(iv);
  }, [open]);

  if (!open) return null;
  const isCredits = mode === "credits";
  const reset = formatCountdown(resetAt, now);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.45)", padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 100%)", borderRadius: "var(--radius-card)",
          background: "var(--color-bg)", border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-card-hover)", overflow: "hidden",
          fontFamily: "inherit",
        }}
      >
        {/* header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--color-border-soft)", position: "relative" }}>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            style={{
              position: "absolute", top: 14, right: 14, width: 28, height: 28,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              borderRadius: 8, border: "none", background: "transparent", cursor: "pointer",
              color: "var(--color-text-muted)",
            }}
          >
            <X size={16} />
          </button>
          <div style={{ fontSize: 24, lineHeight: 1, marginBottom: 8 }}>{isCredits ? "✨" : "🔥"}</div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
            {t(isCredits ? "cw.title" : "qw.title")}
          </h2>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "6px 0 0", lineHeight: 1.5 }}>
            {isCredits ? (
              t("cw.desc", { need: creditsNeed, balance: credits.balance })
            ) : (
              <>
                {t("qw.desc")}{" "}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--color-text)", fontWeight: 600 }}>
                  <Clock size={12} /> {t("qw.resetIn", { reset })}
                </span>
              </>
            )}
          </p>
        </div>

        {/* options */}
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {!isCredits && canFallbackFlash && (
            <OptionRow
              icon={<Zap size={18} />}
              title={t("qw.flash.title")}
              desc={t("qw.flash.desc")}
              primary
              badge={t("qw.flash.badge")}
              onClick={onSwitchFlash}
            />
          )}
          <OptionRow
            icon={<Wallet size={18} />}
            title={t("qw.topup.title")}
            desc={t("qw.topup.desc")}
            primary={isCredits}
            badge={isCredits ? t("qw.flash.badge") : undefined}
            onClick={onTopUp}
          />
          <OptionRow
            icon={<Crown size={18} />}
            title={t("qw.member.title")}
            desc={t("qw.member.desc")}
            onClick={onUpgrade}
          />
        </div>
      </div>
    </div>
  );
}

function OptionRow({
  icon, title, desc, primary, badge, onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  primary?: boolean;
  badge?: string;
  onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%",
        padding: "12px 14px", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
        borderRadius: 12,
        border: primary ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
        background: primary
          ? (hov ? "var(--color-primary-soft)" : "color-mix(in srgb, var(--color-primary) 7%, transparent)")
          : (hov ? "var(--color-surface)" : "transparent"),
        transition: "all 0.15s",
      }}
    >
      <span style={{
        flexShrink: 0, width: 36, height: 36, borderRadius: 9,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: primary ? "var(--color-primary)" : "var(--color-surface)",
        color: primary ? "#fff" : "var(--color-text-muted)",
      }}>
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>{title}</span>
          {badge && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 999,
              background: "var(--color-primary)", color: "#fff",
            }}>{badge}</span>
          )}
        </span>
        <span style={{ display: "block", fontSize: 12, color: "var(--color-text-muted)", marginTop: 2, lineHeight: 1.4 }}>
          {desc}
        </span>
      </span>
    </button>
  );
}
