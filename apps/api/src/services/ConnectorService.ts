import { lookup as DnsLookup } from "node:dns/promises";

export type ProxyRequest = {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  query?: Record<string, string | number>;
  body?: unknown;
};

export type ProxyOutcome = {
  status: number;
  body: {
    ok: boolean;
    status?: number;
    data?: unknown;
    error?: string;
  };
};

const MaxBytes = 3 * 1024 * 1024;
const TimeoutMs = 12000;

const EnvAllowList = new Set([
  "TWITCH_TOKEN",
  "TELEGRAM_BOT_TOKEN",
  "GITHUB_TOKEN",
  "LONGBRIDGE_TOKEN",
  "OPENWEATHER_KEY",
  "FINNHUB_KEY",
  "ALPHAVANTAGE_KEY",
]);

export function IsBlockedHost(hostname: string) {
  const host = hostname.toLowerCase();

  if (host === "localhost" || host === "0.0.0.0" || host === "::1" || host.endsWith(".localhost")) return true;
  if (host === "169.254.169.254" || host === "metadata.google.internal") return true;

  const ipv6Host = host.replace(/^\[|\]$/g, "");
  if (ipv6Host === "::1" || ipv6Host.startsWith("fc") || ipv6Host.startsWith("fd") || ipv6Host.startsWith("fe80")) {
    return true;
  }

  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;

  const first = Number(match[1]);
  const second = Number(match[2]);

  if (first === 127) return true;
  if (first === 10) return true;
  if (first === 169 && second === 254) return true;
  if (first === 192 && second === 168) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 100 && second >= 64 && second <= 127) return true;
  if (first === 0) return true;

  return false;
}

export async function ProxyFetch(payload: ProxyRequest): Promise<ProxyOutcome> {
  if (!payload?.url || typeof payload.url !== "string") {
    return { status: 400, body: { ok: false, error: "Missing url." } };
  }

  const target = ReadTargetUrl(payload.url);
  if (!target.ok) return target.fail;

  const blockedIp = await GetBlockedDnsIp(target.url.hostname);
  if (blockedIp) {
    return {
      status: 403,
      body: { ok: false, error: `Blocked private or local address: ${target.url.hostname} -> ${blockedIp}` },
    };
  }

  AddQuery(target.url, payload.query);

  const headers = ReadHeaders(payload.headers);
  const method = (payload.method || "GET").toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD" && payload.body !== undefined;

  if (hasBody && !headers["content-type"] && !headers["Content-Type"]) {
    headers["content-type"] = "application/json";
  }

  return FetchUpstream(target.url, method, headers, hasBody ? payload.body : undefined);
}

function ReadTargetUrl(rawUrl: string): { ok: true; url: URL } | { ok: false; fail: ProxyOutcome } {
  let url: URL;

  try {
    url = new URL(ResolveEnv(rawUrl));
  } catch {
    return { ok: false, fail: { status: 400, body: { ok: false, error: "Invalid url." } } };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, fail: { status: 400, body: { ok: false, error: "Only http and https are allowed." } } };
  }

  if (IsBlockedHost(url.hostname)) {
    return { ok: false, fail: { status: 403, body: { ok: false, error: `Blocked private or local address: ${url.hostname}` } } };
  }

  return { ok: true, url };
}

async function GetBlockedDnsIp(hostname: string) {
  if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) return "";

  try {
    const records = await DnsLookup(hostname, { all: true, verbatim: true });
    const blocked = records.find((record) => IsBlockedHost(record.address));
    return blocked?.address || "";
  } catch {
    return "";
  }
}

function AddQuery(url: URL, query?: Record<string, string | number>) {
  if (!query) return;

  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, ResolveEnv(String(value)));
  }
}

function ReadHeaders(input?: Record<string, string>) {
  const headers: Record<string, string> = {};

  if (!input) return headers;

  for (const [key, value] of Object.entries(input)) {
    headers[key] = ResolveEnv(String(value));
  }

  return headers;
}

function ResolveEnv(value: string) {
  return value.replace(/env:([A-Za-z_][A-Za-z0-9_]*)/g, (_match, key: string) => {
    if (!EnvAllowList.has(key)) return "";
    return process.env[key] || "";
  });
}

async function FetchUpstream(url: URL, method: string, headers: Record<string, string>, body: unknown): Promise<ProxyOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TimeoutMs);

  try {
    const upstream = await fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
      signal: controller.signal,
      redirect: "manual",
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location") || "";
      return { status: 200, body: { ok: false, error: `Blocked redirect: ${upstream.status} -> ${location.slice(0, 120)}` } };
    }

    const data = await ReadUpstreamBody(upstream);

    if (!upstream.ok) {
      return { status: 200, body: { ok: false, error: `Upstream returned ${upstream.status}`, status: upstream.status, data } };
    }

    return { status: 200, body: { ok: true, status: upstream.status, data } };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? `Request timed out after ${TimeoutMs / 1000}s.` : ReadError(error);
    return { status: 200, body: { ok: false, error: message } };
  } finally {
    clearTimeout(timer);
  }
}

async function ReadUpstreamBody(response: Response) {
  const buffer = await response.arrayBuffer();

  if (buffer.byteLength > MaxBytes) {
    throw new Error(`Response too large: ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB.`);
  }

  const text = new TextDecoder().decode(buffer);
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json") || /^\s*[[{]/.test(text)) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  return text;
}

function ReadError(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown connector error.";
}

