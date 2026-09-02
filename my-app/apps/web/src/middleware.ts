import { NextResponse, type NextRequest } from "next/server";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

export function middleware(request: NextRequest) {
  const now = Date.now();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwarded || request.ip || "unknown";
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  current.count += 1;
  if (current.count > MAX_REQUESTS) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试" },
      { status: 429, headers: { "retry-after": String(Math.ceil((current.resetAt - now) / 1000)) } },
    );
  }

  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };

