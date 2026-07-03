import type { Request, Response } from "express";

export const AUTH_COOKIE = "butler_session";

export function ReadCookie(req: Request, name: string) {
  const raw = req.headers.cookie || "";
  const pairs = raw.split(";").map((item) => item.trim());
  const found = pairs.find((item) => item.startsWith(`${name}=`));
  if (!found) return "";
  return decodeURIComponent(found.slice(name.length + 1));
}

export function SetAuthCookie(res: Response, sessionId: string, expiresAt: Date) {
  res.cookie(AUTH_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export function ClearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

