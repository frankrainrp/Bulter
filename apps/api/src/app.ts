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
import { RecurringRoutes } from "./routes/RecurringRoutes.js";
import { ResearchRoutes } from "./routes/ResearchRoutes.js";
import { StorageRoutes } from "./routes/StorageRoutes.js";
import { TaskRoutes } from "./routes/TaskRoutes.js";
import { ErrorMiddleware } from "./middleware/ErrorMiddleware.js";
import { RequireAuth } from "./middleware/AuthMiddleware.js";
import { CreateDailyRateLimit, CreateRateLimit } from "./middleware/RateLimitMiddleware.js";

export function CreateApp() {
  const env = GetEnv();
  const app = express();
  const authRateLimit = CreateRateLimit({ name: "auth", windowMs: 15 * 60 * 1000, max: 40 });
  const dailyAiRateLimit = CreateDailyRateLimit({ name: "ai-daily", max: 1000 });
  const chatRateLimit = CreateRateLimit({
    name: "chat-completion",
    windowMs: 60 * 1000,
    max: 100,
    identity: "user",
    message: "Chat is receiving requests too quickly. Please wait briefly before retrying.",
  });
  const generationRateLimit = CreateRateLimit({ name: "generation", windowMs: 60 * 1000, max: 60, identity: "user" });
  const connectorRateLimit = CreateRateLimit({ name: "connector", windowMs: 60 * 1000, max: 120, identity: "user" });

  app.use(cors({ origin: env.CorsOrigin, credentials: true }));
  app.use(express.json({ limit: "5mb" }));

  app.use("/api/health", HealthRoutes);
  app.use("/api/auth/login", authRateLimit);
  app.use("/api/auth/signup", authRateLimit);
  app.use("/api/auth", AuthRoutes);
  // History reads/writes are ordinary persistence traffic and must never consume
  // the AI completion quota. Only POST /api/chat reaches the model limiters.
  app.use("/api/chat", RequireAuth);
  app.post("/api/chat", chatRateLimit, dailyAiRateLimit);
  app.use("/api/chat", ChatRoutes);
  app.use("/api/connector", RequireAuth, connectorRateLimit, dailyAiRateLimit, ConnectorRoutes);
  app.use("/api/custom-panels", RequireAuth, CustomPanelRoutes);
  app.use("/api/extract-ddls", RequireAuth, generationRateLimit, dailyAiRateLimit, ExtractDdlRoutes);
  app.use("/api/generate-panel", RequireAuth, generationRateLimit, dailyAiRateLimit, GeneratePanelRoutes);
  app.use("/api/generate-source", RequireAuth, generationRateLimit, dailyAiRateLimit, GenerateSourceRoutes);
  app.use("/api/research", RequireAuth, generationRateLimit, dailyAiRateLimit, ResearchRoutes);
  app.use("/api/tasks", RequireAuth, TaskRoutes);
  app.use("/api/notes", RequireAuth, NoteRoutes);
  app.use("/api/recurring", RequireAuth, RecurringRoutes);
  app.use("/api/storage", RequireAuth, StorageRoutes);
  app.use("/api/agent", RequireAuth, generationRateLimit, dailyAiRateLimit, AgentRoutes);

  app.use(ErrorMiddleware);

  return app;
}
