"use client";

// ============================================================
// lib/billing.ts — 付费计划数据层（演示模式，纯前端）
//
// 仿 Claude 三档：Free / Pro / Max。
//   - 计划定义 PLANS（月价 / 年价 / 功能 i18n key）
//   - 订阅状态 getSubscription / setSubscription（localStorage + BILLING_EVENT）
//   - 模拟账单 getInvoices / addInvoice
//   - 模型门槛 isModelAllowed（Free 仅 Flash，Pro+ 全模型）
//   - useSubscription / useCurrentPlan hook（订阅事件，状态变化即重渲）
//
// ⚠️ 演示模式：不接真实支付。CheckoutModal 走模拟流程后调 setSubscription +
//    addInvoice。真实 Stripe 接入点见 PROGRESS [072] 留位。
// ============================================================

import { useCallback, useEffect, useState } from "react";
import type { AiModelId } from "./ai-models";

export type PlanId = "free" | "pro" | "max";
export type BillingCycle = "monthly" | "annual";

export interface PlanDef {
  id: PlanId;
  nameKey: string;
  taglineKey: string;
  /** 月付时的月单价（CNY） */
  monthly: number;
  /** 年付时折算的月单价（CNY，约 8 折） */
  annualPerMonth: number;
  /** 功能清单 i18n key（PricingModal 用 t() 解析） */
  featureKeys: string[];
  /** Pro 高亮「最受欢迎」 */
  highlight?: boolean;
}

export const CURRENCY = "¥";

export const PLANS: PlanDef[] = [
  {
    id: "free",
    nameKey: "plan.free.name",
    taglineKey: "plan.free.tagline",
    monthly: 0,
    annualPerMonth: 0,
    featureKeys: ["feat.free.1", "feat.free.2", "feat.free.3", "feat.free.4", "feat.free.5"],
  },
  {
    id: "pro",
    nameKey: "plan.pro.name",
    taglineKey: "plan.pro.tagline",
    monthly: 39,
    annualPerMonth: 31,
    featureKeys: ["feat.pro.1", "feat.pro.2", "feat.pro.3", "feat.pro.4", "feat.pro.5", "feat.pro.6"],
    highlight: true,
  },
  {
    id: "max",
    nameKey: "plan.max.name",
    taglineKey: "plan.max.tagline",
    monthly: 99,
    annualPerMonth: 79,
    featureKeys: ["feat.max.1", "feat.max.2", "feat.max.3", "feat.max.4", "feat.max.5", "feat.max.6"],
  },
];

export function getPlanDef(id: PlanId): PlanDef {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/** 档位排序值，用于判断升级 / 降级 */
export function planRank(id: PlanId): number {
  return id === "max" ? 2 : id === "pro" ? 1 : 0;
}

/** 月单价（按计费周期）*/
export function pricePerMonth(id: PlanId, cycle: BillingCycle): number {
  const def = getPlanDef(id);
  return cycle === "annual" ? def.annualPerMonth : def.monthly;
}

/** 一次结算的总额（月付=月价；年付=月价×12）*/
export function chargeTotal(id: PlanId, cycle: BillingCycle): number {
  const def = getPlanDef(id);
  return cycle === "annual" ? def.annualPerMonth * 12 : def.monthly;
}

export interface CardInfo {
  last4: string;
  brand: string;
}

export interface Subscription {
  plan: PlanId;
  cycle: BillingCycle;
  startedAt: number;
  /** 下次续费时间戳；free 为 null */
  renewsAt: number | null;
  card?: CardInfo;
}

export interface Invoice {
  id: string;
  date: number;
  planId: PlanId;
  cycle: BillingCycle;
  amount: number;
  status: "paid";
  /** 账单类型：订阅（默认）/ 积分加油包 */
  kind?: "plan" | "pack";
  /** kind=pack：包含的积分数 */
  credits?: number;
}

const SUB_KEY = "butler.subscription";
const INVOICE_KEY = "butler.invoices";
export const BILLING_EVENT = "butler:plan-change";

const FREE_SUB: Subscription = { plan: "free", cycle: "monthly", startedAt: 0, renewsAt: null };

export function getSubscription(): Subscription {
  if (typeof window === "undefined") return FREE_SUB;
  try {
    const raw = localStorage.getItem(SUB_KEY);
    if (!raw) return FREE_SUB;
    const parsed = JSON.parse(raw) as Subscription;
    if (parsed && (parsed.plan === "free" || parsed.plan === "pro" || parsed.plan === "max")) {
      return parsed;
    }
    return FREE_SUB;
  } catch {
    return FREE_SUB;
  }
}

/** 写订阅状态 + 广播（所有 useSubscription 重渲）*/
export function setSubscription(sub: Subscription) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SUB_KEY, JSON.stringify(sub));
  } catch {
    /* silent */
  }
  window.dispatchEvent(new CustomEvent(BILLING_EVENT));
}

export function getCurrentPlan(): PlanId {
  return getSubscription().plan;
}

/** 计算续费时间戳：月付 +30d / 年付 +365d */
export function computeRenewal(cycle: BillingCycle, from = Date.now()): number {
  const days = cycle === "annual" ? 365 : 30;
  return from + days * 24 * 3600 * 1000;
}

/** 升级/订阅：写订阅 + 落一条账单。返回新订阅。*/
export function subscribeTo(plan: PlanId, cycle: BillingCycle, card?: CardInfo): Subscription {
  const now = Date.now();
  const sub: Subscription = {
    plan,
    cycle,
    startedAt: now,
    renewsAt: plan === "free" ? null : computeRenewal(cycle, now),
    card,
  };
  setSubscription(sub);
  if (plan !== "free") {
    addInvoice({
      id: "inv-" + Math.random().toString(36).slice(2, 9) + now.toString(36),
      date: now,
      planId: plan,
      cycle,
      amount: chargeTotal(plan, cycle),
      status: "paid",
    });
  }
  return sub;
}

/** 取消订阅 → 降级 free（保留账单历史）*/
export function cancelSubscription() {
  setSubscription(FREE_SUB);
}

export function getInvoices(): Invoice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INVOICE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Invoice[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addInvoice(inv: Invoice) {
  if (typeof window === "undefined") return;
  try {
    const all = [inv, ...getInvoices()].slice(0, 50);
    localStorage.setItem(INVOICE_KEY, JSON.stringify(all));
  } catch {
    /* silent */
  }
}

// ---------- 模型门槛 ----------
const FREE_MODELS: AiModelId[] = ["deepseek-v4-flash"];

/** Free 仅 Flash；Pro/Max 解锁全部模型 */
export function isModelAllowed(modelId: AiModelId, plan: PlanId): boolean {
  if (plan !== "free") return true;
  return FREE_MODELS.includes(modelId);
}

// ---------- hooks ----------
export function useSubscription(): Subscription {
  const [sub, setSub] = useState<Subscription>(FREE_SUB);
  useEffect(() => {
    setSub(getSubscription());
    const onChange = () => setSub(getSubscription());
    window.addEventListener(BILLING_EVENT, onChange);
    return () => window.removeEventListener(BILLING_EVENT, onChange);
  }, []);
  return sub;
}

export function useCurrentPlan(): PlanId {
  return useSubscription().plan;
}

/** 信用卡号 → 品牌识别（演示用，仅看前缀）*/
export function detectCardBrand(num: string): string {
  const n = num.replace(/\s/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^6(?:011|5)/.test(n)) return "Discover";
  if (/^62/.test(n)) return "UnionPay";
  return "Card";
}
