import { Router } from "express";
import { GetChatHistory, ReplaceChatHistory } from "../services/ChatHistoryService.js";
import { StreamChat } from "../services/ChatService.js";
import { MakeOk } from "../utils/ApiResponse.js";
import { RunSafe } from "../utils/RunSafe.js";

// ChatRoutes 是 Express 后端的聊天模块入口。
// 前端所有 `/express-api/chat...` 请求最终都会落到这里，再被分发给具体 service。
// 这一层只负责 HTTP 方法、路径和响应格式，不直接写数据库，也不直接调用大模型。
export const ChatRoutes = Router();

// GET /express-api/chat/history
// 读取完整聊天历史快照：会话列表 + 消息列表。
// 用于前端启动、刷新、跨设备恢复时把 MongoDB 中的聊天记录重新灌回本地状态。
ChatRoutes.get(
  "/history",
  RunSafe(async (req, res) => {
    const history = await GetChatHistory();
    res.json(MakeOk(history));
  }),
);

// PUT /express-api/chat/history
// 用前端传来的历史快照覆盖服务端历史。
// ReplaceChatHistory 内部会做 zod 校验、清空旧记录、重建 sessions/messages。
// 注意：这里是“整包替换”语义，不是增量 append；调用方必须传完整当前历史。
ChatRoutes.put(
  "/history",
  RunSafe(async (req, res) => {
    const history = await ReplaceChatHistory(req.body || {});
    res.json(MakeOk(history));
  }),
);

// POST /express-api/chat
// 发起一次流式 AI 对话。
// StreamChat 会直接持有 Express Response 写 SSE，因此这里不能再 res.json。
// body 里包含 messages、contextSummary、model、personality、includeTools 等聊天参数。
ChatRoutes.post(
  "/",
  RunSafe(async (req, res) => {
    await StreamChat(req.body || {}, res);
  }),
);
