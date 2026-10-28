// ============================================================
// app/api/connector/route.ts — 通用 HTTP 连接器代理（P1 引擎地基）
//
// 客户端 POST { url, method?, headers?, query?, body? } → 服务端 fetch → { ok, status, data }。
// 取数 + SSRF 守卫 + env 注入逻辑已抽到 lib/connector-core.ts（与 generate-panel 两阶段探测共用）。
// 本路由只做 JSON 解析 + 委托 proxyFetch。安全细节见 Doc/SECURITY.md。
// ============================================================

import { proxyFetch, type ProxyRequest } from "@/lib/connector-core";
import { rateLimited } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = rateLimited(req); // SEC-05：连接器是出站代理，限流尤为重要
  if (limited) return limited;

  let payload: ProxyRequest;
  try {
    payload = (await req.json()) as ProxyRequest;
  } catch {
    return Response.json({ ok: false, error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const { status, body } = await proxyFetch(payload);
  return Response.json(body, { status });
}
