import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, deleteSession } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  deleteSession(req.cookies.get(AUTH_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
