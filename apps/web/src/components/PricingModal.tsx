"use client";

// ============================================================
// components/PricingModal.tsx — 仿 Claude 定价页
//
// 三档 Free / Pro / Max 横排卡片 + 月/年切换 + Pro「最受欢迎」高亮。
// 升级 → onCheckout(plan, cycle)；降级到 free 直接 onDowngradeFree。
// 全文案走 i18n（useT）。手机堆叠竖排。
// ============================================================

import React, { useState } from "react";
import { X, Check, Sparkles } from "lucide-react";
import { useIsMobile } from "@/lib/use-is-mobile";
import { useT } from "@/lib/i18n";
import {
  PLANS,
  CURRENCY,
  type PlanId,
  type BillingCycle,
  type Subscription,
  planRank,
  pricePerMonth,
  chargeTotal,
} from "@/lib/billing";
import { PACKS } from "@/lib/credits";

interface Props {
  open: boolean;
  onClose: () => void;
  subscription: Subscription;
  /** 升级 / 切换到付费档 → 打开结账 */
  onCheckout: (plan: PlanId, cycle: BillingCycle) => void;
  /** 买积分加油包 → 打开结账（pack 模式） */
  onBuyPack: (packId: string) => void;
  /** 降级到 free（取消订阅） */
  onDowngradeFree: () => void;
}

export default function PricingModal({ open, onClose, subscription, onCheckout, onBuyPack, onDowngradeFree }: Props) {
  const isMobile = useIsMobile();
  const { t } = useT();
  const [cycle, setCycle] = useState<BillingCycle>("annual");

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--color-overlay)",
          zIndex: 90,
          animation: "fade-in 0.18s ease-out",
        }}
      />
      <div
        role="dialog"
        aria-label={t("pricing.title")}
        style={{
          position: "fixed",
          ...(isMobile
            ? { left: 0, right: 0, top: 0, bottom: 0, borderRadius: 0 }
            : {
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 960,
                maxWidth: "94vw",
                maxHeight: "92vh",
                borderRadius: 20,
                animation: "modal-pop 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
              }),
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-modal)",
          zIndex: 91,
          color: "var(--color-text)",
        }}
      >
        {/* Header */}
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            padding: isMobile ? "18px 16px 10px" : "26px 28px 12px",
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1 }}>
            <h2
              className="font-display"
              style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, margin: 0, letterSpacing: "-0.4px" }}
            >
              {t("pricing.title")}
            </h2>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "6px 0 0", maxWidth: 520 }}>
              {t("pricing.subtitle")}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            style={{
              width: 32, height: 32, borderRadius: 8, border: "none",
              background: "var(--color-surface)", cursor: "pointer",
              color: "var(--color-text-muted)", flexShrink: 0,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={16} />
          </button>
        </header>

        {/* 月/年切换 */}
        <div style={{ display: "flex", justifyContent: "center", padding: isMobile ? "4px 0 14px" : "8px 0 18px", flexShrink: 0 }}>
          <CycleToggle cycle={cycle} onChange={setCycle} t={t} />
        </div>

        {/* 卡片区 */}
        <div
          style={{
            display: isMobile ? "flex" : "grid",
            flexDirection: isMobile ? "column" : undefined,
            gridTemplateColumns: isMobile ? undefined : "repeat(3, 1fr)",
            gap: 14,
            padding: isMobile ? "0 14px 18px" : "0 28px 18px",
            overflowY: "auto",
            flex: 1,
            minHeight: 0,
            alignItems: "stretch",
          }}
        >
          {PLANS.map((p) => (
            <PlanCard
              key={p.id}
              planId={p.id}
              nameKey={p.nameKey}
              taglineKey={p.taglineKey}
              featureKeys={p.featureKeys}
              highlight={p.highlight}
              cycle={cycle}
              currentPlan={subscription.plan}
              onCheckout={onCheckout}
              onDowngradeFree={onDowngradeFree}
              t={t}
            />
          ))}
        </div>

        {/* 积分加油包条（一次性购买，超额/轻度用户承接） */}
        <div
          style={{
            display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
            padding: isMobile ? "0 14px 14px" : "0 28px 16px", flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{t("pricing.packsTitle")}</span>
          {PACKS.map((p) => (
            <button
              key={p.id}
              onClick={() => onBuyPack(p.id)}
              style={{
                padding: "6px 13px", borderRadius: 999,
                border: "1px solid var(--color-border)", background: "var(--color-surface)",
                color: "var(--color-text)", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit", transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--color-primary)";
                e.currentTarget.style.color = "var(--color-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border)";
                e.currentTarget.style.color = "var(--color-text)";
              }}
            >
              {t("pricing.packBtn", { credits: p.credits, price: `${CURRENCY}${p.price}` })}
            </button>
          ))}
        </div>

        {/* Demo 底注 */}
        <footer
          style={{
            padding: "10px 18px",
            borderTop: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            fontSize: 11,
            color: "var(--color-text-faint)",
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          {t("billing.demoNote")}
        </footer>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-pop {
          from { transform: translate(-50%, -50%) scale(0.96); opacity: 0; }
          to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}

function CycleToggle({
  cycle, onChange, t,
}: { cycle: BillingCycle; onChange: (c: BillingCycle) => void; t: (k: string) => string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        padding: 3,
        borderRadius: 999,
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      {(["monthly", "annual"] as BillingCycle[]).map((c) => {
        const active = cycle === c;
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 16px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              background: active ? "var(--color-primary)" : "transparent",
              color: active ? "#fff" : "var(--color-text-muted)",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {t(c === "monthly" ? "pricing.monthly" : "pricing.annual")}
            {c === "annual" && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 999,
                  background: active ? "rgba(255,255,255,0.22)" : "var(--color-success-soft)",
                  color: active ? "#fff" : "var(--color-success-strong)",
                }}
              >
                {t("pricing.annualSave")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PlanCard({
  planId, nameKey, taglineKey, featureKeys, highlight, cycle, currentPlan, onCheckout, onDowngradeFree, t,
}: {
  planId: PlanId;
  nameKey: string;
  taglineKey: string;
  featureKeys: string[];
  highlight?: boolean;
  cycle: BillingCycle;
  currentPlan: PlanId;
  onCheckout: (plan: PlanId, cycle: BillingCycle) => void;
  onDowngradeFree: () => void;
  t: (k: string, params?: Record<string, string | number>) => string;
}) {
  const isCurrent = currentPlan === planId;
  const isFree = planId === "free";
  const perMonth = pricePerMonth(planId, cycle);
  const total = chargeTotal(planId, cycle);
  const rankDelta = planRank(planId) - planRank(currentPlan);

  // CTA 文案 + 行为
  let ctaLabel: string;
  let ctaAction: (() => void) | null;
  let ctaPrimary = false;
  if (isCurrent) {
    ctaLabel = t("pricing.current");
    ctaAction = null;
  } else if (isFree) {
    ctaLabel = t("pricing.stayFree");
    ctaAction = onDowngradeFree; // 从付费降级
  } else if (rankDelta > 0) {
    ctaLabel = t("pricing.getPlan", { plan: t(nameKey) });
    ctaAction = () => onCheckout(planId, cycle);
    ctaPrimary = true;
  } else {
    ctaLabel = t("pricing.downgradeTo", { plan: t(nameKey) });
    ctaAction = () => onCheckout(planId, cycle);
  }

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        padding: "20px 18px 18px",
        borderRadius: 16,
        border: highlight ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
        background: highlight ? "var(--color-primary-soft)" : "var(--color-surface)",
        boxShadow: highlight ? "0 12px 30px color-mix(in srgb, var(--color-primary) 18%, transparent)" : "var(--shadow-card)",
      }}
    >
      {/* most popular 缎带 */}
      {highlight && (
        <div
          style={{
            position: "absolute",
            top: -11,
            left: "50%",
            transform: "translateX(-50%)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 12px",
            borderRadius: 999,
            background: "var(--color-primary)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 12px color-mix(in srgb, var(--color-primary) 40%, transparent)",
          }}
        >
          <Sparkles size={11} /> {t("pricing.mostPopular")}
        </div>
      )}

      {/* 名 + 标语 */}
      <h3 className="font-display" style={{ fontSize: 20, fontWeight: 700, margin: "2px 0 2px" }}>
        {t(nameKey)}
      </h3>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "0 0 14px", minHeight: 32 }}>
        {t(taglineKey)}
      </p>

      {/* 价格 */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
        {isFree ? (
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-1px" }}>{t("pricing.free")}</span>
        ) : (
          <>
            <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-1px" }}>
              {CURRENCY}{perMonth}
            </span>
            <span style={{ fontSize: 13, color: "var(--color-text-muted)", fontWeight: 500 }}>
              {t("pricing.perMonth")}
            </span>
          </>
        )}
      </div>
      <p style={{ fontSize: 11, color: "var(--color-text-faint)", margin: "0 0 16px", minHeight: 16 }}>
        {isFree
          ? ""
          : cycle === "annual"
          ? t("pricing.billedAnnually", { amount: `${CURRENCY}${total}` })
          : t("pricing.billedMonthly")}
      </p>

      {/* CTA */}
      <button
        onClick={ctaAction ?? undefined}
        disabled={!ctaAction}
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 10,
          border: ctaPrimary ? "none" : "1px solid var(--color-border)",
          background: !ctaAction
            ? "var(--color-bg)"
            : ctaPrimary
            ? "var(--color-primary)"
            : "var(--color-surface)",
          color: !ctaAction
            ? "var(--color-text-faint)"
            : ctaPrimary
            ? "#fff"
            : "var(--color-text)",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: ctaAction ? "pointer" : "default",
          marginBottom: 18,
          transition: "filter 0.15s",
        }}
        onMouseEnter={(e) => { if (ctaAction) (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.05)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "none"; }}
      >
        {ctaLabel}
      </button>

      {/* 功能列表 */}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 9 }}>
        {featureKeys.map((fk) => (
          <li key={fk} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, lineHeight: 1.4 }}>
            <span
              style={{
                flexShrink: 0,
                marginTop: 1,
                width: 16, height: 16, borderRadius: 999,
                background: highlight ? "var(--color-primary)" : "var(--color-success)",
                color: "#fff",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Check size={11} strokeWidth={3} />
            </span>
            <span style={{ color: "var(--color-text)" }}>{t(fk)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
