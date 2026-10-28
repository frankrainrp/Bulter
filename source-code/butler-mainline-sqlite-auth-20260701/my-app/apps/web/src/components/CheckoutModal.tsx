"use client";

// ============================================================
// components/CheckoutModal.tsx — 模拟结账（演示模式，零真实支付）
//
// 订单摘要 + 卡片表单（卡号空格格式化 + 品牌识别 / 有效期 MM/YY / CVC / 姓名 / 邮箱）
//   → 点支付 → 处理中 spinner（~1.6s）→ 成功页。
//   成功时回调 onConfirmed(card)，父组件落 subscribeTo + 账单 + toast。
// 顶部醒目「演示模式不扣款」横幅；提供「一键填入演示卡号」。
// ============================================================

import React, { useState } from "react";
import { X, Lock, CreditCard, CheckCircle2, Loader2 } from "lucide-react";
import { useIsMobile } from "@/lib/use-is-mobile";
import { useT } from "@/lib/i18n";
import {
  CURRENCY,
  type PlanId,
  type BillingCycle,
  type CardInfo,
  getPlanDef,
  chargeTotal,
  detectCardBrand,
} from "@/lib/billing";
import { getPack } from "@/lib/credits";

/** 结账商品：订阅档（plan+cycle）或积分加油包（一次性） */
export type CheckoutProduct =
  | { kind: "plan"; plan: PlanId; cycle: BillingCycle }
  | { kind: "pack"; packId: string };

interface Props {
  open: boolean;
  product: CheckoutProduct | null;
  onClose: () => void;
  /** 模拟支付成功 → 父组件 subscribeTo / purchasePack + toast */
  onConfirmed: (card: CardInfo) => void;
}

type Phase = "form" | "processing" | "success";

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export default function CheckoutModal({ open, product, onClose, onConfirmed }: Props) {
  const isMobile = useIsMobile();
  const { t } = useT();
  const [phase, setPhase] = useState<Phase>("form");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  if (!open || !product) return null;

  const isPack = product.kind === "pack";
  const pack = isPack ? getPack(product.packId) : undefined;
  const def = product.kind === "plan" ? getPlanDef(product.plan) : null;
  const total = product.kind === "plan" ? chargeTotal(product.plan, product.cycle) : pack?.price ?? 0;
  const brand = detectCardBrand(cardNumber);
  const digits = cardNumber.replace(/\D/g, "");
  const canPay = digits.length >= 12 && expiry.length === 5 && cvc.length >= 3 && name.trim().length > 0;

  const handleFillDemo = () => {
    setCardNumber("4242 4242 4242 4242");
    setExpiry("12/29");
    setCvc("123");
    setName("Feng Kaiduo");
    setEmail("feng@example.com");
  };

  const handlePay = () => {
    if (!canPay) return;
    setPhase("processing");
    window.setTimeout(() => {
      const card: CardInfo = { last4: digits.slice(-4), brand };
      onConfirmed(card);
      setPhase("success");
    }, 1600);
  };

  const reset = () => {
    setPhase("form");
    onClose();
  };

  const cycleLabel =
    product.kind === "plan"
      ? t(product.cycle === "annual" ? "pricing.annual" : "pricing.monthly")
      : t("checkout.oneTime");

  return (
    <>
      <div
        onClick={phase === "processing" ? undefined : reset}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--color-overlay)",
          zIndex: 95,
          animation: "fade-in 0.18s ease-out",
        }}
      />
      <div
        role="dialog"
        aria-label={t("checkout.title")}
        style={{
          position: "fixed",
          ...(isMobile
            ? { left: 0, right: 0, bottom: 0, maxHeight: "94vh", borderRadius: "20px 20px 0 0", animation: "sheet-up 0.28s cubic-bezier(0.16,1,0.3,1)" }
            : {
                top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                width: 440, maxWidth: "94vw", maxHeight: "92vh", borderRadius: 18,
                animation: "modal-pop 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
              }),
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-modal)",
          zIndex: 96,
          color: "var(--color-text)",
        }}
      >
        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
          <h2 style={{ flex: 1, fontSize: 15, fontWeight: 700, margin: 0 }}>{t("checkout.title")}</h2>
          {phase !== "processing" && (
            <button
              onClick={reset}
              aria-label={t("common.close")}
              style={{
                width: 28, height: 28, borderRadius: 6, border: "none",
                background: "transparent", cursor: "pointer", color: "var(--color-text-muted)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X size={16} />
            </button>
          )}
        </header>

        {phase === "success" ? (
          <div style={{ padding: "40px 24px 32px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ animation: "pay-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
              <CheckCircle2 size={64} color="var(--color-success)" strokeWidth={1.6} />
            </div>
            <h3 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>
              {t(isPack ? "checkout.packSuccess" : "checkout.success")}
            </h3>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0, maxWidth: 300 }}>
              {isPack
                ? t("checkout.packSuccessDesc", { credits: pack?.credits ?? 0 })
                : t("checkout.successDesc", { plan: def ? t(def.nameKey) : "" })}
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: 8, padding: "10px 28px", borderRadius: 10, border: "none",
                background: "var(--color-primary)", color: "#fff", fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {t("checkout.done")}
            </button>
          </div>
        ) : (
          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", flex: 1, minHeight: 0 }}>
            {/* 演示横幅 */}
            <div
              style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "10px 12px", borderRadius: 10,
                background: "var(--color-warning-soft)",
                border: "1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)",
                fontSize: 12, color: "var(--color-text)", lineHeight: 1.45,
              }}
            >
              <Lock size={14} style={{ flexShrink: 0, marginTop: 1, color: "var(--color-warning)" }} />
              <span>{t("checkout.demoBanner")}</span>
            </div>

            {/* 订单摘要 */}
            <section
              style={{
                border: "1px solid var(--color-border)", borderRadius: 12,
                background: "var(--color-surface)", padding: "12px 14px",
              }}
            >
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" }}>
                {t("checkout.orderSummary")}
              </p>
              <Row
                label={t(isPack ? "checkout.item" : "checkout.plan")}
                value={isPack ? t("checkout.packItem", { credits: pack?.credits ?? 0 }) : `Butler ${def ? t(def.nameKey) : ""}`}
              />
              <Row label={t("checkout.billing")} value={cycleLabel} />
              <div style={{ height: 1, background: "var(--color-border-soft)", margin: "8px 0" }} />
              <Row label={t("checkout.total")} value={`${CURRENCY}${total}`} bold />
            </section>

            {/* 卡片表单 */}
            <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Field label={t("checkout.cardNumber")}>
                <div style={{ position: "relative" }}>
                  <input
                    inputMode="numeric"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    placeholder={t("checkout.cardPlaceholder")}
                    style={inputStyle}
                  />
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", pointerEvents: "none" }}>
                    <CreditCard size={14} />
                    {digits.length >= 2 ? brand : ""}
                  </span>
                </div>
              </Field>
              <div style={{ display: "flex", gap: 10 }}>
                <Field label={t("checkout.expiry")}>
                  <input
                    inputMode="numeric"
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    placeholder="MM/YY"
                    style={inputStyle}
                  />
                </Field>
                <Field label={t("checkout.cvc")}>
                  <input
                    inputMode="numeric"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="123"
                    style={inputStyle}
                  />
                </Field>
              </div>
              <Field label={t("checkout.cardName")}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("checkout.namePlaceholder")}
                  style={inputStyle}
                />
              </Field>
              <Field label={t("checkout.email")}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={inputStyle}
                />
              </Field>

              <button
                onClick={handleFillDemo}
                style={{
                  alignSelf: "flex-start",
                  padding: "5px 10px", borderRadius: 6,
                  border: "1px dashed var(--color-border)", background: "transparent",
                  color: "var(--color-primary)", fontSize: 12, fontWeight: 500,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {t("checkout.fillDemo")}
              </button>
            </section>
          </div>
        )}

        {/* Footer 支付按钮 */}
        {phase !== "success" && (
          <footer style={{ padding: "14px 18px", borderTop: "1px solid var(--color-border)", flexShrink: 0 }}>
            <button
              onClick={handlePay}
              disabled={!canPay || phase === "processing"}
              style={{
                width: "100%",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px 16px", borderRadius: 12, border: "none",
                background: canPay ? "var(--color-primary)" : "var(--color-border)",
                color: canPay ? "#fff" : "var(--color-text-faint)",
                fontSize: 15, fontWeight: 700, fontFamily: "inherit",
                cursor: canPay && phase !== "processing" ? "pointer" : "default",
              }}
            >
              {phase === "processing" ? (
                <>
                  <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />
                  {t("checkout.processing")}
                </>
              ) : (
                <>
                  <Lock size={14} />
                  {t("checkout.payNow", { amount: `${CURRENCY}${total}` })}
                </>
              )}
            </button>
          </footer>
        )}
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-pop {
          from { transform: translate(-50%, -50%) scale(0.96); opacity: 0; }
          to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes sheet-up { from { transform: translateY(100%); opacity: 0.5; } to { transform: translateY(0); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pay-pop { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
      `}</style>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)" }}>{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
      <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{label}</span>
      <span style={{ fontSize: bold ? 16 : 13, fontWeight: bold ? 800 : 500, color: "var(--color-text)" }}>{value}</span>
    </div>
  );
}
