"use client";

// ============================================================
// lib/credits.ts — 积分账本（变现方案 v2.0 P5′）
//
// 积分 = Butler 高级功能的使用单位（对用户只显示积分，¥/token 只留内部核算）。
//   - 月配额：随订阅档每月发放（free 30 / pro 300 / max 1000），月底清零不滚存
//   - 注册礼包：首次使用一次性 +50（30 天有效）
//   - 加油包：一次性购买（¥10/100 · ¥30/350 · ¥50/650），365 天有效，可滚存
//   - 扣分顺序：先到期先扣（FIFO by expiry）
//
// ⚠️ 演示模式：账本存 localStorage（前端可篡改）。P6′ 接 Clerk+Neon 时迁
//    服务端权威记账（credits_ledger 表），本模块接口保持不变。
// ============================================================

import { useEffect, useState } from "react";
import type { AiModelId } from "./ai-models";
import { getCurrentPlan, BILLING_EVENT, type PlanId } from "./billing";

// ---------- 配额 / 计价 ----------

/** 每月积分配额（随订阅档，月底清零） */
export const MONTHLY_CREDITS: Record<PlanId, number> = {
  free: 30,
  pro: 300,
  max: 1000,
};

/** 注册礼包（一次性，30 天有效）——把「哇时刻」前置到注册后前两周 */
export const SIGNUP_BONUS = 50;
const SIGNUP_EXPIRY_MS = 30 * 24 * 3600 * 1000;

/** 加油包定义（一次性购买，365 天有效） */
export interface CreditPack {
  id: string;
  credits: number;
  /** 价格（CNY） */
  price: number;
}
export const PACKS: CreditPack[] = [
  { id: "pack-100", credits: 100, price: 10 },
  { id: "pack-350", credits: 350, price: 30 },
  { id: "pack-650", credits: 650, price: 50 },
];
const PACK_EXPIRY_MS = 365 * 24 * 3600 * 1000;

export function getPack(id: string): CreditPack | undefined {
  return PACKS.find((p) => p.id === id);
}

/** 计价操作类型 */
export type CreditOp = "chatPremium" | "generatePanel" | "research" | "ocr";

/**
 * 操作 → 积分价（变现方案 v2.0 §3.1）。
 * 按「操作」计价不按 token：用户发起前就能看到确定消耗。
 * 高端对话按模型档位分级；汇率失衡时调这张表（内部 usage.ts 成本计量做毛利核对）。
 */
export function creditCostOf(op: CreditOp, model?: AiModelId): number {
  switch (op) {
    case "chatPremium":
      if (model === "claude") return 2; // Sonnet 档；Opus 档接通后 5
      return 1; // gemini / gpt 档
    case "generatePanel":
      return 2;
    case "research":
      return 10;
    case "ocr":
      return 1; // 每 10 页
  }
}

/** 该模型是否走积分（Flash/思考 走免费窗口，不耗积分） */
export function isPremiumModel(model: AiModelId): boolean {
  return !model.startsWith("deepseek");
}

// ---------- 账本（grants + 消费历史） ----------

export type GrantKind = "signup" | "monthly" | "pack";

export interface CreditGrant {
  id: string;
  kind: GrantKind;
  amount: number;
  used: number;
  grantedAt: number;
  /** 过期时间戳；monthly = 当月最后一刻 */
  expiresAt: number;
  /** monthly 专用：所属月份 "2026-06"，防重复发放 */
  period?: string;
  /** pack 专用：包 id */
  packId?: string;
}

export interface CreditSpend {
  id: string;
  ts: number;
  credits: number;
  /** 计价操作（展示用） */
  op: CreditOp;
}

const GRANTS_KEY = "butler.credits.grants";
const HISTORY_KEY = "butler.credits.history";
export const CREDITS_EVENT = "butler:credits-change";
/** 任意组件 dispatch 此事件 → page 弹「积分不足」softwall（detail: { need: number }） */
export const CREDITS_WALL_EVENT = "butler:credits-wall";

function monthPeriod(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthEnd(now = Date.now()): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
}
function uid(prefix: string): string {
  return prefix + "-" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function readGrants(): CreditGrant[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GRANTS_KEY);
    const arr = raw ? (JSON.parse(raw) as CreditGrant[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeGrants(grants: CreditGrant[]) {
  try {
    localStorage.setItem(GRANTS_KEY, JSON.stringify(grants));
  } catch {
    /* silent */
  }
  window.dispatchEvent(new CustomEvent(CREDITS_EVENT));
}

/**
 * 懒发放：补注册礼包（仅一次）+ 当月配额（按当前档位；升档补差额），清过期。
 * 所有读余额入口都先走这里，无需定时任务。
 */
function ensureGrants(now = Date.now()): CreditGrant[] {
  if (typeof window === "undefined") return [];
  let grants = readGrants();
  let dirty = false;

  // 注册礼包（看历史是否发过，而非当前是否存在——过期也不补发）
  const signupDone = grants.some((g) => g.kind === "signup") || localStorage.getItem("butler.credits.signupDone") === "1";
  if (!signupDone) {
    grants.push({
      id: uid("signup"), kind: "signup", amount: SIGNUP_BONUS, used: 0,
      grantedAt: now, expiresAt: now + SIGNUP_EXPIRY_MS,
    });
    try { localStorage.setItem("butler.credits.signupDone", "1"); } catch { /* silent */ }
    dirty = true;
  }

  // 当月配额（升档时补差额：已发 100、Pro 应发 300 → 再发 200）
  const period = monthPeriod(now);
  const allowance = MONTHLY_CREDITS[getCurrentPlan()];
  const grantedThisMonth = grants
    .filter((g) => g.kind === "monthly" && g.period === period)
    .reduce((s, g) => s + g.amount, 0);
  if (grantedThisMonth < allowance) {
    grants.push({
      id: uid("monthly"), kind: "monthly", amount: allowance - grantedThisMonth, used: 0,
      grantedAt: now, expiresAt: monthEnd(now), period,
    });
    dirty = true;
  }

  // 清过期（保留 7 天供账单页回看，再物理删除）
  const keepUntil = now - 7 * 24 * 3600 * 1000;
  const pruned = grants.filter((g) => g.expiresAt > keepUntil);
  if (pruned.length !== grants.length) {
    grants = pruned;
    dirty = true;
  }

  if (dirty) writeGrants(grants);
  return grants;
}

/** 当前可用积分余额 */
export function getCreditsBalance(now = Date.now()): number {
  return ensureGrants(now)
    .filter((g) => g.expiresAt > now)
    .reduce((s, g) => s + Math.max(0, g.amount - g.used), 0);
}

export function canAfford(cost: number): boolean {
  return getCreditsBalance() >= cost;
}

/**
 * 扣分：先到期先扣（FIFO by expiry）。余额不足返回 false 且不扣。
 * 演示模式前端原子性足够；P6′ 服务端版本用事务。
 */
export function spendCredits(cost: number, op: CreditOp, now = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  if (cost <= 0) return true;
  const grants = ensureGrants(now);
  const usable = grants
    .filter((g) => g.expiresAt > now && g.amount - g.used > 0)
    .sort((a, b) => a.expiresAt - b.expiresAt);
  const balance = usable.reduce((s, g) => s + (g.amount - g.used), 0);
  if (balance < cost) return false;

  let remaining = cost;
  for (const g of usable) {
    if (remaining <= 0) break;
    const take = Math.min(g.amount - g.used, remaining);
    g.used += take;
    remaining -= take;
  }
  writeGrants(grants);
  addSpend({ id: uid("spend"), ts: now, credits: cost, op });
  return true;
}

/** 购买加油包（CheckoutModal 模拟支付成功后调）。返回新 grant。 */
export function purchasePack(packId: string, now = Date.now()): CreditGrant | null {
  const pack = getPack(packId);
  if (!pack || typeof window === "undefined") return null;
  const grants = ensureGrants(now);
  const grant: CreditGrant = {
    id: uid("pack"), kind: "pack", amount: pack.credits, used: 0,
    grantedAt: now, expiresAt: now + PACK_EXPIRY_MS, packId,
  };
  grants.push(grant);
  writeGrants(grants);
  return grant;
}

// ---------- 消费历史（账单页展示用） ----------

export function getSpendHistory(): CreditSpend[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? (JSON.parse(raw) as CreditSpend[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function addSpend(s: CreditSpend) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([s, ...getSpendHistory()].slice(0, 100)));
  } catch {
    /* silent */
  }
}

// ---------- 快照 / hook ----------

export interface CreditsSnapshot {
  balance: number;
  /** 本月配额剩余（monthly grants 未用部分） */
  monthlyRemaining: number;
  /** 本月配额总量 */
  monthlyTotal: number;
  /** 加油包 + 礼包剩余 */
  extraRemaining: number;
}

export function readCredits(now = Date.now()): CreditsSnapshot {
  const grants = ensureGrants(now).filter((g) => g.expiresAt > now);
  const monthly = grants.filter((g) => g.kind === "monthly");
  const extra = grants.filter((g) => g.kind !== "monthly");
  const remain = (gs: CreditGrant[]) => gs.reduce((s, g) => s + Math.max(0, g.amount - g.used), 0);
  return {
    monthlyRemaining: remain(monthly),
    monthlyTotal: monthly.reduce((s, g) => s + g.amount, 0),
    extraRemaining: remain(extra),
    balance: remain(grants),
  };
}

const EMPTY_CREDITS: CreditsSnapshot = { balance: 0, monthlyRemaining: 0, monthlyTotal: 0, extraRemaining: 0 };

/** 订阅积分变化（扣分/购包/档位变更即重渲）。SSR 安全：初始 0、挂载后读真实。 */
export function useCredits(): CreditsSnapshot {
  const [snap, setSnap] = useState<CreditsSnapshot>(EMPTY_CREDITS);
  useEffect(() => {
    const update = () => setSnap(readCredits());
    update();
    window.addEventListener(CREDITS_EVENT, update);
    window.addEventListener(BILLING_EVENT, update); // 升降档 → 月配额变
    return () => {
      window.removeEventListener(CREDITS_EVENT, update);
      window.removeEventListener(BILLING_EVENT, update);
    };
  }, []);
  return snap;
}

/** 积分不足时由功能点调用：广播给 page 弹 softwall */
export function requestCreditsWall(need: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CREDITS_WALL_EVENT, { detail: { need } }));
}
