import { Router } from "express";
import { ReadSafeError } from "../services/AiService.js";
import { ExtractDdls } from "../services/ExtractDdlService.js";
import { RunSafe } from "../utils/RunSafe.js";

export const ExtractDdlRoutes = Router();

ExtractDdlRoutes.post(
  "/",
  RunSafe(async (req, res) => {
    try {
      const result = await ExtractDdls(req.body || {});
      res.status(result.status).json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: ReadSafeError(error, "Deadline extraction failed.") });
    }
  }),
);

