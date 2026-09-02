// ============================================================
// app/api/connector/route.ts — 通用 HTTP 连接器代理（P1 引擎地基）
//
// 客户端 POST { url, method?, headers?, query?, body? } → 服务端 fetch →
// 返回 { ok, status, data }。作用：
//   1. 绕过浏览器 CORS（服务端发请求无跨域限制）
//   2. 密钥不进前端：headers/query 里 "env:KEY_NAME" 在服务端替换成 process.env.KEY_NAME
//   3. SSRF 守卫：挡 localhost / 私网 / 云元数据 IP，防止被诱导打内网
//
// ⚠️ 演示级守卫（hostname 字符串匹配，不做 DNS 解析）。生产需加 DNS rebinding 防护 +
//    出站允许名单。够个人 demo 安全使用。
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ConnectorRequest {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  query?: Record<string, string | number>;
  body?: unknown;
}

const MAX_BYTES = 3 * 1024 * 1024; // 3MB 响应上限
const TIMEOUT_MS = 12000;

// 私网 / 本机 / 元数据 IP 段（SSRF 守卫）
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0" || h === "::1" || h.endsWith(".localhost")) return true;
  if (h === "169.254.169.254" || h === "metadata.google.internal") return true; // 云元数据
  // IPv4 私网
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127) return true;              // loopback
    if (a === 10) return true;               // 10.0.0.0/8
    if (a === 169 && b === 254) return true; // link-local
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  }
  return false;
}

/** 把字符串里所有 "env:KEY_NAME" 片段替换成 process.env.KEY_NAME（密钥不进前端）。
 *  支持内嵌，如 "Bearer env:TWITCH_TOKEN" / URL 路径里的 "botenv:TELEGRAM_BOT_TOKEN"。*/
function resolveEnv(v: string): string {
  if (typeof v !== "string") return v;
  const allowed = new Set(
    (process.env.CONNECTOR_ENV_ALLOWLIST || "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean),
  );
  return v.replace(/env:([A-Za-z_][A-Za-z0-9_]*)/g, (_m, k: string) => {
    if (!allowed.has(k)) throw new Error("环境变量不在连接器允许名单中");
    return process.env[k] ?? "";
  });
}

export async function POST(req: Request) {
  if (process.env.CONNECTOR_ENABLED !== "true") {
    return Response.json({ ok: false, error: "HTTP 连接器已由管理员禁用" }, { status: 403 });
  }
  let payload: ConnectorRequest;
  try {
    payload = (await req.json()) as ConnectorRequest;
  } catch {
    return Response.json({ ok: false, error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!payload?.url || typeof payload.url !== "string") {
    return Response.json({ ok: false, error: "缺少 url" }, { status: 400 });
  }

  // 解析 + 拼 query + SSRF 守卫（先注入 url 里的 env:KEY，如 Telegram 路径 token）
  let target: URL;
  try {
    target = new URL(resolveEnv(payload.url));
  } catch {
    return Response.json({ ok: false, error: "url 格式非法" }, { status: 400 });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return Response.json({ ok: false, error: "仅支持 http/https" }, { status: 400 });
  }
  if (isBlockedHost(target.hostname)) {
    return Response.json({ ok: false, error: `出于安全，禁止访问内网 / 本机地址：${target.hostname}` }, { status: 403 });
  }
  if (payload.query) {
    for (const [k, v] of Object.entries(payload.query)) {
      target.searchParams.set(k, resolveEnv(String(v)));
    }
  }

  // headers（解析 env: 密钥）
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
    const upstream = await fetch(target.toString(), {
      method,
      headers,
      body: hasBody ? (typeof payload.body === "string" ? payload.body : JSON.stringify(payload.body)) : undefined,
      signal: controller.signal,
      redirect: "error",
    });

    // 体积上限保护
    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return Response.json({ ok: false, error: `响应过大（${(buf.byteLength / 1024 / 1024).toFixed(1)}MB > 3MB）` }, { status: 413 });
    }
    const text = new TextDecoder().decode(buf);
    const contentType = upstream.headers.get("content-type") ?? "";

    let data: unknown = text;
    if (contentType.includes("application/json") || /^\s*[[{]/.test(text)) {
      try { data = JSON.parse(text); } catch { /* 保留原始文本 */ }
    }

    if (!upstream.ok) {
      return Response.json(
        { ok: false, error: `上游返回 ${upstream.status}`, status: upstream.status, data },
        { status: 200 }, // 把上游错误作为数据回传，前端面板展示，不当成代理本身失败
      );
    }
    return Response.json({ ok: true, status: upstream.status, data });
  } catch (e) {
    const err = e as Error;
    const msg = err.name === "AbortError" ? `请求超时（>${TIMEOUT_MS / 1000}s）` : err.message;
    return Response.json({ ok: false, error: msg }, { status: 200 });
  } finally {
    clearTimeout(timer);
  }
}
