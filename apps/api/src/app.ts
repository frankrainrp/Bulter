import cors from "cors";
import express from "express";
import { GetEnv } from "./config/Env.js";
import { AgentRoutes } from "./routes/AgentRoutes.js";
import { AuthRoutes } from "./routes/AuthRoutes.js";
import { ChatRoutes } from "./routes/ChatRoutes.js";
import { ConnectorRoutes } from "./routes/ConnectorRoutes.js";
import { CustomPanelRoutes } from "./routes/CustomPanelRoutes.js";
import { ExtractDdlRoutes } from "./routes/ExtractDdlRoutes.js";
import { GenerateSourceRoutes } from "./routes/GenerateSourceRoutes.js";
import { GeneratePanelRoutes } from "./routes/GeneratePanelRoutes.js";
import { HealthRoutes } from "./routes/HealthRoutes.js";
import { NoteRoutes } from "./routes/NoteRoutes.js";
import { OcrRoutes } from "./routes/OcrRoutes.js";
import { RecurringRoutes } from "./routes/RecurringRoutes.js";
import { ResearchRoutes } from "./routes/ResearchRoutes.js";
import { StorageRoutes } from "./routes/StorageRoutes.js";
import { TaskRoutes } from "./routes/TaskRoutes.js";
import { ErrorMiddleware } from "./middleware/ErrorMiddleware.js";

export function CreateApp() {
  const env = GetEnv();
  const app = express();

  app.use(cors({ origin: env.CorsOrigin, credentials: true }));
  app.use(express.json({ limit: "5mb" }));

  app.use("/api/health", HealthRoutes);
  app.use("/api/auth", AuthRoutes);
  app.use("/api/chat", ChatRoutes);
  app.use("/api/connector", ConnectorRoutes);
  app.use("/api/custom-panels", CustomPanelRoutes);
  app.use("/api/extract-ddls", ExtractDdlRoutes);
  app.use("/api/generate-panel", GeneratePanelRoutes);
  app.use("/api/generate-source", GenerateSourceRoutes);
  app.use("/api/research", ResearchRoutes);
  app.use("/api/tasks", TaskRoutes);
  app.use("/api/notes", NoteRoutes);
  app.use("/api/ocr", OcrRoutes);
  app.use("/api/recurring", RecurringRoutes);
  app.use("/api/storage", StorageRoutes);
  app.use("/api/agent", AgentRoutes);

  app.use(ErrorMiddleware);

  return app;
}
