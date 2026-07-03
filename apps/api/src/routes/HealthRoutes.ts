import { Router } from "express";
import mongoose from "mongoose";
import { MakeOk } from "../utils/ApiResponse.js";

export const HealthRoutes = Router();

HealthRoutes.get("/", (req, res) => {
  res.json(
    MakeOk({
      service: "c270-fa-agent-api",
      mongoReadyState: mongoose.connection.readyState,
      time: new Date().toISOString(),
    }),
  );
});

