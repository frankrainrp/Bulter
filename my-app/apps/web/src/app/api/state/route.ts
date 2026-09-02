import { z } from "zod";
import { readState, writeState } from "@/lib/server-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEYS = ["ddls", "sessions", "messages", "notes"] as const;
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const payloadSchema = z.object({
  key: z.enum(KEYS),
  value: z.array(z.unknown()).max(50_000),
});

export async function GET() {
  return Response.json(Object.fromEntries(KEYS.map((key) => [key, readState(key)])), {
    headers: { "cache-control": "no-store" },
  });
}

export async function PUT(req: Request) {
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return Response.json({ error: "请求体过大" }, { status: 413 });
  }

  let raw: unknown;
  try {
    const text = await req.text();
    if (Buffer.byteLength(text, "utf8") > MAX_REQUEST_BYTES) {
      return Response.json({ error: "请求体过大" }, { status: 413 });
    }
    raw = JSON.parse(text);
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "状态数据格式不合法" }, { status: 400 });
  }

  writeState(parsed.data.key, parsed.data.value);
  return Response.json({ ok: true });
}
