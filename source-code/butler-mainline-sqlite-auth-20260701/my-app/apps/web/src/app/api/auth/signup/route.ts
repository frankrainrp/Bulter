import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, SESSION_TTL_MS, createSession, createUser, deleteExpiredSessions, isValidEmail } from "@/lib/server-auth";
import { rateLimited, safeError } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const limited = rateLimited(req, 5, 60_000);
  if (limited) return limited;

  try {
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name : "";

    if (!isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: "Password must be at least 8 characters." }, { status: 400 });
    }

    deleteExpiredSessions();
    const user = createUser(email, password, name);
    const session = createSession(user.id);
    const res = NextResponse.json({ ok: true, user }, { status: 201 });
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
    const message = err instanceof Error && /UNIQUE/i.test(err.message)
      ? "An account with this email already exists."
      : safeError(err, "Sign up failed.");
    return NextResponse.json({ ok: false, error: message }, { status: message.includes("already exists") ? 409 : 500 });
  }
}
