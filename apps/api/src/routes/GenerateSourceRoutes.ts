import { Router } from "express";
import { ReadSafeError } from "../services/AiService.js";
import { GenerateSource } from "../services/GenerateSourceService.js";
import { RunSafe } from "../utils/RunSafe.js";

export const GenerateSourceRoutes = Router();

GenerateSourceRoutes.post(
  "/",
  RunSafe(async (req, res) => {
    try {
      const result = await GenerateSource(String(req.body?.prompt || ""));
      res.status(result.status).json(result);
    } catch (error) {
      res.status(200).json({ ok: false, error: ReadSafeError(error, "Data source generation failed.") });
    }
  }),
);

