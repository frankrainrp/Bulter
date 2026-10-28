import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, SESSION_TTL_MS, authenticateUser, createSession, deleteExpiredSessions, isValidEmail } from "@/lib/server-auth";
import { rateLimited, safeError } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const limited = rateLimited(req, 8, 60_000);
  if (limited) return limited;

  try {
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!isValidEmail(email) || password.length < 6) {
      return NextResponse.json({ ok: false, error: "Enter a valid email and password." }, { status: 400 });
    }

    deleteExpiredSessions();
    const user = authenticateUser(email, password);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Email or password is incorrect." }, { status: 401 });
    }

    const session = createSession(user.id);
    const res = NextResponse.json({ ok: true, user });
    res.cookies.set(AUTH_COOKIE, session.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
      expires: new Date(session.expiresAt),
    });
    return res;
  } catch (err) {
    return NextResponse.json({ ok: false, error: safeError(err, "Login failed.") }, { status: 500 });
  }
}
