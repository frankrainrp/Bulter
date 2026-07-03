import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { MakeFail } from "../utils/ApiResponse.js";

export function ErrorMiddleware(error: unknown, req: Request, res: Response, next: NextFunction) {
  if (error instanceof ZodError) {
    res.status(400).json(MakeFail(error.errors[0]?.message || "Invalid request data."));
    return;
  }

  if (error instanceof Error) {
    res.status(500).json(MakeFail(error.message));
    return;
  }

  res.status(500).json(MakeFail("Unknown server error."));
}

