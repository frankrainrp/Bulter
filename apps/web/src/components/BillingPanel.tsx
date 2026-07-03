"use client";

// ============================================================
// components/BillingPanel.tsx — 账户 · 账单管理（演示模式）
//
// 当前计划卡 + 支付方式 + 账单历史表 + 查看全部计划 / 取消订阅。
// 订阅状态走 useSubscription()；账单 getInvoices()（开面板时读 + BILLING_EVENT 刷新）。
// 取消订阅 → cancelSubscription() + onCancelled() 回调（父组件 toast）。
// ============================================================

import React, { useEffect, useState } from "react";
import { X, CreditCard, Crown, Sparkles, Receipt } from "lucide-react";
import { useIsMobile } from "@/lib/use-is-mobile";
import { useT } from "@/lib/i18n";
import {
  CURRENCY,
  type Invoice,
  type PlanId,
  getInvoices,
  getPlanDef,
  useSubscription,
  cancelSubscription,
  BILLING_EVENT,
} from "@/lib/billing";
import { useCredits } from "@/lib/credits";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 查看全部计划 → 打开 PricingModal */
  onViewPlans: () => void;
  /** 买积分加油包 → 打开 PricingModal（含加油包条）或直接结账 */
  onBuyPack: () => void;
  /** 取消订阅完成 → 父组件 toast */
  onCancelled: () => void;
}

const PLAN_ACCENT: Record<PlanId, { bg: string; fg: string; icon: React.ReactNode }> = {
  free: { bg: "var(--color-surface)", fg: "var(--color-text-muted)", icon: <Sparkles size={16} /> },
  pro: { bg: "var(--color-primary)", fg: "#fff", icon: <Crown size={16} /> },
  max: { bg: "var(--butler-gold)", fg: "#1c1c1e", icon: <Crown size={16} /> },
};

export default function BillingPanel({ open, onClose, onViewPlans, onBuyPack, onCancelled }: Props) {
  const isMobile = useIsMobile();
  const { t, lang } = useT();
  const sub = useSubscription();
  const credits = useCredits();
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    if (!open) return;
    setInvoices(getInvoices());
    const refresh = () => setInvoices(getInvoices());
    window.addEventListener(BILLING_EVENT, refresh);
    return () => window.removeEventListener(BILLING_EVENT, refresh);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const def = getPlanDef(sub.plan);
  const accent = PLAN_ACCENT[sub.plan];
  const isFree = sub.plan === "free";

  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleDateString(lang === "en" ? "en-US" : "zh-CN", { year: "numeric", month: "short", day: "numeric" });

  const handleCancel = () => {
    if (!window.confirm(t("billing.cancelConfirm"))) return;
    cancelSubscription();
    onCancelled();
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "var(--color-overlay)", zIndex: 80, animation: "fade-in 0.18s ease-out" }}
      />
      <div
        role="dialog"
        aria-label={t("billing.title")}
        style={{
          position: "fixed",
          ...(isMobile
            ? { left: 0, right: 0, bottom: 0, maxHeight: "92vh", borderRadius: "20px 20px 0 0", animation: "sheet-up 0.28s cubic-bezier(0.16,1,0.3,1)" }
            : {
                top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                width: 480, maxWidth: "94vw", maxHeight: "90vh", borderRadius: 16,
                animation: "modal-pop 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
              }),
          display: "flex", flexDirection: "column", overflow: "hidden",
          background: "var(--color-bg)", border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-modal)", zIndex: 81, color: "var(--color-text)",
        }}
      >
        <header style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
          <h2 style={{ flex: 1, fontSize: 15, fontWeight: 700, margin: 0 }}>{t("billing.title")}</h2>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={16} />
          </button>
        </header>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", flex: 1, minHeight: 0 }}>
          {/* 当前计划卡 */}
          <section
            style={{
              borderRadius: 14, padding: "16px 16px",
              background: isFree ? "var(--color-surface)" : `color-mix(in srgb, ${accent.bg} 12%, var(--color-surface))`,
              border: `1px solid ${isFree ? "var(--color-border)" : `color-mix(in srgb, ${accent.bg} 40%, transparent)`}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: accent.bg, color: accent.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {accent.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0, fontWeight: 500 }}>{t("billing.currentPlan")}</p>
                <p className="font-display" style={{ fontSize: 20, fontWeight: 700, margin: "1px 0 0" }}>Butler {t(def.nameKey)}</p>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "12px 0 0" }}>
              {isFree
                ? t("billing.freeForever")
                : `${CURRENCY}${sub.cycle === "annual" ? def.annualPerMonth : def.monthly}${t("pricing.perMonth")} · ${sub.renewsAt ? t("billing.renews", { date: fmtDate(sub.renewsAt) }) : ""}`}
            </p>

            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button
                onClick={onViewPlans}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "9px 16px", borderRadius: 10, border: "none",
                  background: "var(--color-primary)", color: "#fff",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <Sparkles size={14} /> {isFree ? t("common.upgrade") : t("billing.viewPlans")}
              </button>
              {!isFree && (
                <button
                  onClick={handleCancel}
                  style={{
                    padding: "9px 16px", borderRadius: 10,
                    border: "1px solid var(--color-border)", background: "var(--color-surface)",
                    color: "var(--color-text-muted)", fontSize: 13, fontWeight: 500,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {t("billing.cancelPlan")}
                </button>
              )}
            </div>
          </section>

          {/* 积分余额 */}
          <Section title={t("billing.credits")}>
            <div
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", borderRadius: 10,
                border: "1px solid var(--color-border)", background: "var(--color-surface)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0, fontWeight: 500 }}>
                  {t("billing.creditsBalance")}
                </p>
                <p className="font-display" style={{ fontSize: 24, fontWeight: 800, margin: "2px 0 4px" }}>
                  {credits.balance}{" "}
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)" }}>
                    {t("billing.creditsUnit")}
                  </span>
                </p>
                <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0 }}>
                  {t("billing.creditsMonthly", { remain: credits.monthlyRemaining, total: credits.monthlyTotal })}
                  {" · "}
                  {t("billing.creditsExtra", { n: credits.extraRemaining })}
                </p>
              </div>
              <button
                onClick={onBuyPack}
                style={{
                  flexShrink: 0, padding: "9px 14px", borderRadius: 10,
                  border: "1px solid var(--color-primary)", background: "transparent",
                  color: "var(--color-primary)", fontSize: 12.5, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {t("billing.buyPack")}
              </button>
            </div>
          </Section>

          {/* 支付方式 */}
          <Section title={t("billing.paymentMethod")}>
            <div
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 14px", borderRadius: 10,
                border: "1px solid var(--color-border)", background: "var(--color-surface)",
              }}
            >
              <CreditCard size={18} color="var(--color-text-muted)" />
              <span style={{ fontSize: 13, color: sub.card ? "var(--color-text)" : "var(--color-text-faint)" }}>
                {sub.card
                  ? t("billing.cardOnFile", { last4: sub.card.last4, brand: sub.card.brand })
                  : t("billing.noPaymentMethod")}
              </span>
            </div>
          </Section>

          {/* 账单历史 */}
          <Section title={t("billing.invoices")}>
            {invoices.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 14px", borderRadius: 10, border: "1px dashed var(--color-border)", color: "var(--color-text-faint)", fontSize: 12, justifyContent: "center" }}>
                <Receipt size={14} /> {t("billing.noInvoices")}
              </div>
            ) : (
              <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden" }}>
                {invoices.map((inv, idx) => (
                  <div
                    key={inv.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px",
                      borderBottom: idx === invoices.length - 1 ? "none" : "1px solid var(--color-border-soft)",
                      background: "var(--color-surface)",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>
                        {inv.kind === "pack"
                          ? t("billing.invoice.pack", { credits: inv.credits ?? 0 })
                          : `Butler ${t(getPlanDef(inv.planId).nameKey)}`}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "2px 0 0" }}>{fmtDate(inv.date)}</p>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{CURRENCY}{inv.amount}</span>
                    <span
                      style={{
                        fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                        background: "var(--color-success-soft)", color: "var(--color-success-strong)",
                      }}
                    >
                      {t("billing.status.paid")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <footer style={{ padding: "10px 18px", borderTop: "1px solid var(--color-border)", background: "var(--color-surface)", fontSize: 11, color: "var(--color-text-faint)", textAlign: "center", flexShrink: 0 }}>
          {t("billing.demoNote")}
        </footer>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-pop {
          from { transform: translate(-50%, -50%) scale(0.96); opacity: 0; }
          to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes sheet-up { from { transform: translateY(100%); opacity: 0.5; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", letterSpacing: 0.5, textTransform: "uppercase", margin: "0 0 8px" }}>
        {title}
      </h3>
      {children}
    </section>
  );
}
