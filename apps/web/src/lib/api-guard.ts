// ============================================================
// lib/api-guard.ts — 服务端输入限额守卫（SECURITY SEC-12，服务端共享，无 "use client"）
//
// 原则：不信任任何客户端输入。AI 路由的 prompt/messages/上下文都可能被构造成
// 超长载荷放大成本（一次请求烧掉大量 token），或塞进注入文本。这里做硬上限：
//   - 截断超长字符串、限制消息条数与总量
//   - 返回是否「被拒」由调用方决定（一般截断即可，极端超限直接 400）
//
// 这是纵深防御的一层；真正的配额/限流要在 P6′ 鉴权后按用户做（见 SECURITY.md SEC-03/05）。
// ============================================================

export const INPUT_LIMITS = {
  /** 单条消息最大字符（约 6k token）*/
  maxMessageChars: 24_000,
  /** 历史消息最多条数（与客户端 HISTORY_LIMIT=10 呼应，留余量）*/
  maxMessages: 40,
  /** 所有消息内容总字符上限 */
  maxTotalChars: 160_000,
  /** 一句话 prompt 上限（生成面板/数据源等）*/
  maxPromptChars: 8_000,
  /** 上下文摘要上限 */
  maxContextChars: 16_000,
} as const;

/** 截断字符串到上限（保留头部）*/
export function clampText(s: unknown, max: number): string {
  const str = typeof s === "string" ? s : s == null ? "" : String(s);
  return str.length > max ? str.slice(0, max) : str;
}

export interface ChatMsgLike {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  [k: string]: unknown;
}

/** 对一组聊天消息做限额：取最近 N 条、逐条截断内容、并按总量再砍。返回安全副本。*/
export function clampMessages<T extends ChatMsgLike>(messages: T[]): T[] {
  if (!Array.isArray(messages)) return [];
  const recent = messages.slice(-INPUT_LIMITS.maxMessages);
  let total = 0;
  const out: T[] = [];
  // 从最新往旧累计，超总量即停（保证最近上下文优先保留）
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    const content = typeof m.content === "string" ? clampText(m.content, INPUT_LIMITS.maxMessageChars) : m.content;
    const len = typeof content === "string" ? content.length : 0;
    if (total + len > INPUT_LIMITS.maxTotalChars && out.length > 0) break;
    total += len;
    out.unshift({ ...m, content });
  }
  return out;
}

// ============================================================
// SEC-11 错误脱敏：对外只回通用文案，真实细节留服务端日志
// ============================================================

/** 把异常转成「可安全回前端」的通用消息；真实 error 打到服务端日志。*/
export function safeError(err: unknown, fallback = "Request handling failed. Please try again later."): string {
  try {
    console.error("[api-error]", err instanceof Error ? `${err.name}: ${err.message}` : err);
  } catch { /* silent */ }
  return fallback;
}

// ============================================================
// SEC-05 基础限流：进程内令牌桶（按客户端 IP）
//
// ⚠️ 进程内 = 每个 serverless 实例独立、冷启动清零，是「第一层」防刷而非权威配额。
//    生产要换 Upstash/Redis 共享存储 + 结合 P6′ 鉴权按用户限（见 SECURITY.md SEC-03/05）。
// ============================================================

interface Bucket { count: number; resetAt: number; }
const buckets = new Map<string, Bucket>();

/** 从请求头取客户端标识（部署在反代/边缘后用 x-forwarded-for）*/
export function clientKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export interface RateResult { ok: boolean; retryAfterSec: number; }

/**
 * 滑动固定窗口限流。返回 ok=false 时调用方应回 429。
 * 默认每 IP 每 10s 内 20 次（足够正常使用，挡脚本刷量）。
 */
export function rateLimit(key: string, limit = 20, windowMs = 10_000): RateResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // 顺手清理过期桶，避免无限增长（避开 Map 直接迭代以兼容 tsconfig target）
    if (buckets.size > 5000) {
      const stale: string[] = [];
      buckets.forEach((v, k) => { if (now >= v.resetAt) stale.push(k); });
      stale.forEach((k) => buckets.delete(k));
    }
    return { ok: true, retryAfterSec: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { ok: true, retryAfterSec: 0 };
}

/** 便捷：限流命中则返回 429 Response，否则 null。 */
export function rateLimited(req: Request, limit?: number, windowMs?: number): Response | null {
  const r = rateLimit(clientKey(req), limit, windowMs);
  if (r.ok) return null;
  return new Response(
    JSON.stringify({ ok: false, error: "Too many requests. Please try again later." }),
    { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(r.retryAfterSec) } },
  );
}
