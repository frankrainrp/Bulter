import type { NextFunction, Request, Response } from "express";
import { GetUserBySession } from "../services/AuthService.js";
import { AUTH_COOKIE, ReadCookie } from "../utils/CookieTools.js";
import { MakeFail } from "../utils/ApiResponse.js";

export type AuthContext = {
  userId: string;
  email: string;
  name: string;
};

export type AuthenticatedRequest = Request & {
  auth: AuthContext;
};

export async function RequireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = ReadCookie(req, AUTH_COOKIE);
    const user = await GetUserBySession(sessionId);

    if (!user) {
      res.status(401).json(MakeFail("Authentication required."));
      return;
    }

    (req as AuthenticatedRequest).auth = {
      userId: user.id,
      email: user.email,
      name: user.name,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function ReadOwnerId(req: Request) {
  const ownerId = (req as Partial<AuthenticatedRequest>).auth?.userId;
  if (!ownerId) {
    throw new Error("Authenticated user context is missing.");
  }
  return ownerId;
}
