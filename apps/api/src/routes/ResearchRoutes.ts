import { Router } from "express";
import { MakeResearchPlan, MakeSquadFinding } from "../services/ResearchService.js";
import { ReadSafeError } from "../services/AiService.js";
import { RunSafe } from "../utils/RunSafe.js";

export const ResearchRoutes = Router();

ResearchRoutes.post(
  "/plan",
  RunSafe(async (req, res) => {
    try {
      const result = await MakeResearchPlan(String(req.body?.goal || ""));
      res.status(result.status).json(result);
    } catch (error) {
      res.status(200).json({ ok: false, error: ReadSafeError(error, "Research planning failed.") });
    }
  }),
);

ResearchRoutes.post(
  "/squad",
  RunSafe(async (req, res) => {
    try {
      const result = await MakeSquadFinding(req.body || {});
      res.status(result.status).json(result);
    } catch (error) {
      res.status(200).json({ ok: false, error: ReadSafeError(error, "Squad research failed.") });
    }
  }),
);

