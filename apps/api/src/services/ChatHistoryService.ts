import { z } from "zod";
import { ChatMessageModel } from "../models/ChatMessageModel.js";
import { ChatSessionModel } from "../models/ChatSessionModel.js";

// 聊天消息里附带的文件元数据。
// 后端只保存文件 id/name/size/mime 这种轻量索引，不在聊天历史里重复保存二进制内容。
const StoredFileSchema = z.object({
  id: z.string(),
  name: z.string().optional().default(""),
  size: z.number().optional().default(0),
  mime: z.string().optional().default("application/octet-stream"),
});

// 前端本地会话的服务端持久化形状。
// clientId 对应前端生成的 session id，createdAt/updatedAt 用毫秒时间戳排序。
const ChatSessionSchema = z.object({
  id: z.string(),
  title: z.string().optional().default(""),
  createdAt: z.number(),
  updatedAt: z.number(),
});

// 前端聊天消息的导入形状。
// 当前持久化只支持 user/assistant 两类可展示消息；
// tool/system 这类运行时消息只参与模型上下文，不作为聊天历史展示记录入库。
const ChatMessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string().optional().default(""),
  files: z.array(StoredFileSchema).optional().default([]),
  reasoning: z.string().optional().default(""),
  isError: z.boolean().optional().default(false),
  timestamp: z.union([z.number(), z.string(), z.date()]),
});

// ReplaceChatHistory 的整包请求体。
// optional().default([]) 让旧客户端或空导入也能被规范化成空数组。
const ChatHistorySchema = z.object({
  sessions: z.array(ChatSessionSchema).optional().default([]),
  messages: z.array(ChatMessageSchema).optional().default([]),
});

// 读取所有聊天历史。
// sessions 按更新时间倒序，方便前端左侧会话列表优先展示最近对话；
// messages 按时间正序，方便前端直接按数组顺序渲染一条会话的聊天流。
export async function GetChatHistory() {
  const [sessions, messages] = await Promise.all([
    ChatSessionModel.find().sort({ updatedAtMs: -1 }),
    ChatMessageModel.find().sort({ timestampMs: 1 }),
  ]);

  return {
    sessions: sessions.map(ReadSessionDto),
    messages: messages.map(ReadMessageDto),
  };
}

// 用客户端传入的历史快照覆盖数据库中的聊天历史。
// 这是“以客户端当前状态为准”的同步策略，适合本项目的单用户/课程演示场景。
// 如果未来改成多用户协作，需要把这里拆成按 session/message 的增量 upsert。
export async function ReplaceChatHistory(input: unknown) {
  // zod parse 同时完成类型校验和默认值补齐；非法输入会抛出，由 RunSafe 转成错误响应。
  const data = ChatHistorySchema.parse(input);

  // 整包替换前先清空旧集合，避免前端删除的会话在服务端残留。
  await Promise.all([
    ChatSessionModel.deleteMany({}),
    ChatMessageModel.deleteMany({}),
  ]);

  // DTO -> Mongo document。
  // 使用 clientId 保存前端 id，避免把 Mongo _id 泄漏到前端状态模型里。
  const sessions = data.sessions.map((item) => ({
    clientId: item.id,
    title: item.title,
    createdAtMs: item.createdAt,
    updatedAtMs: item.updatedAt,
  }));

  // 只保留 user/assistant 展示消息。
  // files 做字段级复制，避免把未知对象直接塞进 Mongo。
  const messages = data.messages
    .filter((item) => item.role === "user" || item.role === "assistant")
    .map((item) => ({
      clientId: item.id,
      sessionId: item.sessionId,
      role: item.role,
      content: item.content,
      files: item.files.map((file) => ({
        id: file.id,
        name: file.name,
        size: file.size,
        mime: file.mime,
      })),
      reasoning: item.reasoning,
      isError: item.isError,
      timestampMs: ReadTimestampMs(item.timestamp),
    }));

  // insertMany 空数组在部分驱动版本会有边界行为，因此显式判断长度。
  if (sessions.length > 0) {
    await ChatSessionModel.insertMany(sessions);
  }
  if (messages.length > 0) {
    await ChatMessageModel.insertMany(messages);
  }

  return GetChatHistory();
}

// Mongo document -> 前端 session DTO。
// 这里统一把可能缺失的旧数据字段转成稳定默认值，避免前端渲染时处理 null/undefined 分支。
function ReadSessionDto(session: { toObject: () => Record<string, unknown> }) {
  const raw = session.toObject();
  return {
    id: String(raw.clientId),
    title: String(raw.title || ""),
    createdAt: Number(raw.createdAtMs || Date.now()),
    updatedAt: Number(raw.updatedAtMs || Date.now()),
  };
}

// Mongo document -> 前端 message DTO。
// timestamp 输出 ISO 字符串，方便前端和导出的 JSON 都用同一种可读格式。
function ReadMessageDto(message: { toObject: () => Record<string, unknown> }) {
  const raw = message.toObject();
  return {
    id: String(raw.clientId),
    sessionId: String(raw.sessionId),
    role: raw.role,
    content: String(raw.content || ""),
    files: Array.isArray(raw.files) ? raw.files : [],
    reasoning: raw.reasoning ? String(raw.reasoning) : undefined,
    isError: Boolean(raw.isError),
    timestamp: new Date(Number(raw.timestampMs || Date.now())).toISOString(),
  };
}

// 兼容前端可能传入的三种时间形态：number、ISO string、Date。
// 解析失败时用 Date.now() 兜底，保证数据库里 timestampMs 始终是可排序数字。
function ReadTimestampMs(value: number | string | Date) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}
