import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, deleteExpiredSessions, getUserForSession } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  deleteExpiredSessions();
  const user = getUserForSession(req.cookies.get(AUTH_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ ok: false, user: null });
  }
  return NextResponse.json({ ok: true, user });
}
