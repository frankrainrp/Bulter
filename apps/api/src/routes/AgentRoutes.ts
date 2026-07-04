import { Router } from "express";
import { RunAgentAction } from "../services/AgentService.js";
import { ReadOwnerId } from "../middleware/AuthMiddleware.js";
import { MakeOk } from "../utils/ApiResponse.js";
import { RunSafe } from "../utils/RunSafe.js";

export const AgentRoutes = Router();

AgentRoutes.post(
  "/run",
  RunSafe(async (req, res) => {
    const result = await RunAgentAction(ReadOwnerId(req), req.body);
    res.json(MakeOk(result));
  }),
);
