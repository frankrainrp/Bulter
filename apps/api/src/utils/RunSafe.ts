import type { NextFunction, Request, Response } from "express";

type SafeHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function RunSafe(handler: SafeHandler) {
  return function SafeRoute(req: Request, res: Response, next: NextFunction) {
    handler(req, res, next).catch(next);
  };
}

