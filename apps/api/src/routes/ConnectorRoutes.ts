import { Router } from "express";
import { ProxyFetch, type ProxyRequest } from "../services/ConnectorService.js";
import { MakeFail } from "../utils/ApiResponse.js";
import { RunSafe } from "../utils/RunSafe.js";

export const ConnectorRoutes = Router();

ConnectorRoutes.post(
  "/",
  RunSafe(async (req, res) => {
    const payload = req.body as ProxyRequest;
    if (!payload || typeof payload !== "object") {
      res.status(400).json(MakeFail("Request body must be JSON."));
      return;
    }

    const outcome = await ProxyFetch(payload);
    res.status(outcome.status).json(outcome.body);
  }),
);

