import type { NextFunction, Request, Response } from "express";
import { MakeFail } from "../utils/ApiResponse.js";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  name: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

export function CreateRateLimit({ windowMs, max, name }: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  return function RateLimit(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();
    const key = `${name}:${ReadClientKey(req)}`;
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;

    bucket.count += 1;
    buckets.set(key, bucket);

    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      res.status(429).json(MakeFail("Too many requests. Please try again later."));
      return;
    }

    next();
  };
}

function ReadClientKey(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (firstForwarded?.split(",")[0] || req.ip || req.socket.remoteAddress || "unknown").trim();
}
