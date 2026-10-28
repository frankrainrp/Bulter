// ============================================================
// packages/workflows/src/inngest-client.ts
// Inngest 客户端单例 — 全局共享，避免重复初始化
// ============================================================
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "smart-learning-hub",
  name: "智能多模态学习管家",
});
