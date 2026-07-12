import type { NextFunction, Request, Response } from "express";
import { ApiDailyUsageModel } from "../models/ApiDailyUsageModel.js";
import { MakeFail } from "../utils/ApiResponse.js";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  name: string;
  identity?: "ip" | "user";
  resetAt?: (now: number) => number;
  message?: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

type DailyRateLimitOptions = {
  max: number;
  name: string;
};

export function CreateRateLimit({
  windowMs,
  max,
  name,
  identity = "ip",
  resetAt,
  message = "Too many requests. Please try again later.",
}: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  return function RateLimit(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();
    const key = `${name}:${ReadIdentity(req, identity)}`;
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: resetAt?.(now) ?? now + windowMs }
      : current;

    bucket.count += 1;
    buckets.set(key, bucket);

    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    res.setHeader("X-RateLimit-Policy", name);

    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      res.status(429).json(MakeFail(message));
      return;
    }

    next();
  };
}

/** Persistent per-user calendar-day limit. MongoDB keeps the count across API restarts. */
export function CreateDailyRateLimit({ max, name }: DailyRateLimitOptions) {
  return async function DailyRateLimit(req: Request, res: Response, next: NextFunction) {
    try {
      const now = Date.now();
      const ownerId = ReadAuthenticatedUserId(req);
      const resetAt = NextLocalMidnight(now);
      const usage = await ApiDailyUsageModel.findOneAndUpdate(
        { ownerId, day: LocalDayKey(now), scope: name },
        {
          $inc: { count: 1 },
          $setOnInsert: { expiresAt: new Date(resetAt + 7 * 24 * 60 * 60 * 1000) },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean();
      const count = usage?.count ?? 1;

      res.setHeader("RateLimit-Limit", String(max));
      res.setHeader("RateLimit-Remaining", String(Math.max(0, max - count)));
      res.setHeader("RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
      res.setHeader("X-RateLimit-Policy", name);

      if (count > max) {
        res.setHeader("Retry-After", String(Math.max(1, Math.ceil((resetAt - now) / 1000))));
        res.status(429).json(MakeFail("Daily API request limit reached. Your quota resets at midnight."));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

function ReadIdentity(req: Request, identity: "ip" | "user") {
  if (identity === "user") {
    const userId = ReadAuthenticatedUserId(req);
    if (userId) return `user:${userId}`;
  }
  return `ip:${ReadClientKey(req)}`;
}

function ReadAuthenticatedUserId(req: Request) {
  return (req as Request & { auth?: { userId?: string } }).auth?.userId || "unknown";
}

function LocalDayKey(now: number) {
  const date = new Date(now);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function NextLocalMidnight(now: number) {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
}

function ReadClientKey(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (firstForwarded?.split(",")[0] || req.ip || req.socket.remoteAddress || "unknown").trim();
}
