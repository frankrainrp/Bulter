import { Router } from "express";
import { ReadSafeError } from "../services/AiService.js";
import { GeneratePanel } from "../services/GeneratePanelService.js";
import { RunSafe } from "../utils/RunSafe.js";

export const GeneratePanelRoutes = Router();

GeneratePanelRoutes.post(
  "/",
  RunSafe(async (req, res) => {
    try {
      const result = await GeneratePanel(req.body || {});
      res.status(result.status).json(result);
    } catch (error) {
      res.status(200).json({ ok: false, error: ReadSafeError(error, "Panel generation failed.") });
    }
  }),
);

