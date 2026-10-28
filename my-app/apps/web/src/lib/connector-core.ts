// ============================================================
// lib/connector-core.ts — 通用 HTTP 代理核心（服务端共享，无 "use client"）
//
// 抽自 app/api/connector/route.ts，让 connector 路由与 generate-panel 的
// 「两阶段探测」(A1.4) 共用同一套取数 + SSRF 守卫 + env 注入逻辑。
// 单一收口点：所有出站代理都走 proxyFetch → 安全加固只改这里（见 SECURITY.md）。
// ============================================================

import { lookup as dnsLookup } from "node:dns/promises";

export interface ProxyRequest {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  query?: Record<string, string | number>;
  body?: unknown;
}

/** 路由直接 return Response.json(body, { status }) */
export interface ProxyOutcome {
  status: number;
  body: { ok: boolean; status?: number; data?: unknown; error?: string };
}

const MAX_BYTES = 3 * 1024 * 1024; // 3MB 响应上限
const TIMEOUT_MS = 12000;

// --- env 注入白名单（SECURITY: 只允许这些 key 名被 env: 解析，杜绝任意环境变量外带）---
const ENV_ALLOWLIST = new Set<string>([
  "TWITCH_TOKEN",
  "TELEGRAM_BOT_TOKEN",
  "GITHUB_TOKEN",
  "LONGBRIDGE_TOKEN",
  "OPENWEATHER_KEY",
  "FINNHUB_KEY",
  "ALPHAVANTAGE_KEY",
  // 新增第三方数据源密钥时在此登记；绝不放 DEEPSEEK/ANTHROPIC/OPENAI/GEMINI 等平台核心 key
]);

/** 私网 / 本机 / 元数据 IP 段（SSRF 守卫）*/
export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0" || h === "::1" || h.endsWith(".localhost")) return true;
  if (h === "169.254.169.254" || h === "metadata.google.internal") return true; // 云元数据
  // IPv6 私网/本机（简易：去掉中括号后判前缀）
  const h6 = h.replace(/^\[|\]$/g, "");
  if (h6 === "::1" || h6.startsWith("fc") || h6.startsWith("fd") || h6.startsWith("fe80")) return true;
  // IPv4 私网
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127) return true;               // loopback
    if (a === 10) return true;                // 10.0.0.0/8
    if (a === 169 && b === 254) return true;  // link-local
    if (a === 192 && b === 168) return true;  // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 0) return true;                  // 0.0.0.0/8
  }
  return false;
}

/**
 * SEC-02：DNS 预解析校验。fetch 只看 hostname 字符串，攻击者可让一个普通域名解析到
 * 127.0.0.1 / 169.254.169.254 等内网地址绕过 host 守卫。这里在请求前解析域名的所有 IP，
 * 任一落在私网/本机/元数据段即拒绝。挡住绝大多数 DNS-SSRF（静态恶意解析）。
 * 残留：主动 rebinding（解析与连接之间翻 DNS）的窄窗口 —— 部署时配出站防火墙/代理兜底。
 */
async function dnsResolvesToBlocked(hostname: string): Promise<string | null> {
  // 已是 IP 字面量则无需解析（URL 校验时 isBlockedHost 已覆盖）
  if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) return null;
  try {
    const records = await dnsLookup(hostname, { all: true, verbatim: true });
    for (const r of records) {
      if (isBlockedHost(r.address)) return r.address;
    }
  } catch {
    // 解析失败交给后续 fetch 报错，这里不拦（避免误杀）
    return null;
  }
  return null;
}

/** 把 "env:KEY_NAME" 片段替换成 process.env.KEY_NAME —— 仅白名单内的 key，否则替成空串。*/
function resolveEnv(v: string): string {
  if (typeof v !== "string") return v;
  return v.replace(/env:([A-Za-z_][A-Za-z0-9_]*)/g, (_m, k: string) =>
    ENV_ALLOWLIST.has(k) ? process.env[k] ?? "" : "",
  );
}

/** 核心代理取数（带 SSRF 守卫 + env 注入 + 体积/超时上限）。返回 { status, body }。*/
export async function proxyFetch(payload: ProxyRequest): Promise<ProxyOutcome> {
  if (!payload?.url || typeof payload.url !== "string") {
    return { status: 400, body: { ok: false, error: "缺少 url" } };
  }

  let target: URL;
  try {
    target = new URL(resolveEnv(payload.url));
  } catch {
    return { status: 400, body: { ok: false, error: "url 格式非法" } };
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return { status: 400, body: { ok: false, error: "仅支持 http/https" } };
  }
  if (isBlockedHost(target.hostname)) {
    return { status: 403, body: { ok: false, error: `出于安全，禁止访问内网 / 本机地址：${target.hostname}` } };
  }
  // SEC-02：DNS 预解析校验（挡「域名解析到内网 IP」）
  const blockedIp = await dnsResolvesToBlocked(target.hostname);
  if (blockedIp) {
    return { status: 403, body: { ok: false, error: `出于安全，禁止访问内网 / 本机地址：${target.hostname}（解析到 ${blockedIp}）` } };
  }
  if (payload.query) {
    for (const [k, v] of Object.entries(payload.query)) {
      target.searchParams.set(k, resolveEnv(String(v)));
    }
  }

  const headers: Record<string, string> = {};
  if (payload.headers) {
    for (const [k, v] of Object.entries(payload.headers)) headers[k] = resolveEnv(String(v));
  }

  const method = (payload.method ?? "GET").toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD" && payload.body !== undefined;
  if (hasBody && !headers["content-type"] && !headers["Content-Type"]) {
    headers["content-type"] = "application/json";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // SECURITY: redirect:"manual" —— 不自动跟跳转，防止跳到内网绕过上面的 host/DNS 守卫
    const upstream = await fetch(target.toString(), {
      method,
      headers,
      body: hasBody ? (typeof payload.body === "string" ? payload.body : JSON.stringify(payload.body)) : undefined,
      signal: controller.signal,
      redirect: "manual",
    });

    // 跳转：若上游 3xx，校验 Location 的 host 后由调用方决定（这里直接挡，最安全）
    if (upstream.status >= 300 && upstream.status < 400) {
      const loc = upstream.headers.get("location") ?? "";
      return { status: 200, body: { ok: false, error: `上游要求跳转（${upstream.status} → ${loc.slice(0, 120)}），出于安全已拦截` } };
    }

    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return { status: 413, body: { ok: false, error: `响应过大（${(buf.byteLength / 1024 / 1024).toFixed(1)}MB > 3MB）` } };
    }
    const text = new TextDecoder().decode(buf);
    const contentType = upstream.headers.get("content-type") ?? "";

    let data: unknown = text;
    if (contentType.includes("application/json") || /^\s*[[{]/.test(text)) {
      try { data = JSON.parse(text); } catch { /* 保留原始文本 */ }
    }

    if (!upstream.ok) {
      // 上游错误作为数据回传（前端面板展示），不当代理本身失败
      return { status: 200, body: { ok: false, error: `上游返回 ${upstream.status}`, status: upstream.status, data } };
    }
    return { status: 200, body: { ok: true, status: upstream.status, data } };
  } catch (e) {
    const err = e as Error;
    const msg = err.name === "AbortError" ? `请求超时（>${TIMEOUT_MS / 1000}s）` : err.message;
    return { status: 200, body: { ok: false, error: msg } };
  } finally {
    clearTimeout(timer);
  }
}
