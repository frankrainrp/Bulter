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
import { RequireAuth } from "./middleware/AuthMiddleware.js";
import { CreateRateLimit } from "./middleware/RateLimitMiddleware.js";

export function CreateApp() {
  const env = GetEnv();
  const app = express();
  const authRateLimit = CreateRateLimit({ name: "auth", windowMs: 15 * 60 * 1000, max: 40 });
  const aiRateLimit = CreateRateLimit({ name: "ai", windowMs: 60 * 1000, max: 20 });
  const uploadRateLimit = CreateRateLimit({ name: "upload", windowMs: 60 * 1000, max: 12 });

  app.use(cors({ origin: env.CorsOrigin, credentials: true }));
  app.use(express.json({ limit: "5mb" }));

  app.use("/api/health", HealthRoutes);
  app.use("/api/auth/login", authRateLimit);
  app.use("/api/auth/signup", authRateLimit);
  app.use("/api/auth", AuthRoutes);
  app.use("/api/chat", RequireAuth, aiRateLimit, ChatRoutes);
  app.use("/api/connector", RequireAuth, aiRateLimit, ConnectorRoutes);
  app.use("/api/custom-panels", RequireAuth, CustomPanelRoutes);
  app.use("/api/extract-ddls", RequireAuth, aiRateLimit, ExtractDdlRoutes);
  app.use("/api/generate-panel", RequireAuth, aiRateLimit, GeneratePanelRoutes);
  app.use("/api/generate-source", RequireAuth, aiRateLimit, GenerateSourceRoutes);
  app.use("/api/research", RequireAuth, aiRateLimit, ResearchRoutes);
  app.use("/api/tasks", RequireAuth, TaskRoutes);
  app.use("/api/notes", RequireAuth, NoteRoutes);
  app.use("/api/ocr", RequireAuth, uploadRateLimit, OcrRoutes);
  app.use("/api/recurring", RequireAuth, RecurringRoutes);
  app.use("/api/storage", RequireAuth, StorageRoutes);
  app.use("/api/agent", RequireAuth, aiRateLimit, AgentRoutes);

  app.use(ErrorMiddleware);

  return app;
}
