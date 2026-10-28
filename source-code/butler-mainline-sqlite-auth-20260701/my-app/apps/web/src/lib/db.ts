// ============================================================
// lib/db.ts — Dexie (IndexedDB) 本地持久化
//
// Phase 2 单用户场景：所有 DDL / 消息存浏览器本地，0 部署、0 月费。
// Phase 3 切 Tauri 桌面壳时改用 SQLite；Phase 4 上云时迁 Neon。
// Schema 与 packages/database/src/schema.ts 字段保持一致。
// ============================================================

import Dexie, { type Table } from "dexie";
import type { DdlItem, ChatMessage, StoredBlob, ChatSession, Note, ButlerAsset, CustomPanel, Wallpaper, RecurringTask } from "./types";

export class ButlerDB extends Dexie {
  ddls!: Table<DdlItem, string>;          // 主键 id
  messages!: Table<ChatMessage, string>;  // 主键 id（消息历史）
  blobs!: Table<StoredBlob, string>;      // 主键 id（附件文件二进制）
  sessions!: Table<ChatSession, string>;  // 主键 id（多会话）
  notes!: Table<Note, string>;            // 主键 id（笔记，v5 起）
  butlerAssets!: Table<ButlerAsset, string>; // 主键 poseName（v6 起，Phase C 人物自定义）
  customPanels!: Table<CustomPanel, string>; // 主键 id（v7 起，Phase E 自定义面板）
  wallpapers!: Table<Wallpaper, string>;  // 主键 id（v8 起，[066] 壁纸系统）
  recurringTasks!: Table<RecurringTask, string>; // 主键 id（v9 起，[079] 周期任务）

  constructor() {
    super("butler-db");
    this.version(1).stores({
      // & = primary key, 后续是索引
      ddls: "&id, dueDate, completed, source",
      messages: "&id, timestamp, role",
    });
    // v2: 新增 blobs 表（不影响 v1 数据，自动迁移）
    this.version(2).stores({
      ddls: "&id, dueDate, completed, source",
      messages: "&id, timestamp, role",
      blobs: "&id, createdAt",
    });
    // v3: 新增 sessions 表 + messages 加 sessionId 索引
    // upgrade: 把 v2 的孤立 messages 全部归到一个「历史对话」session
    this.version(3).stores({
      ddls: "&id, dueDate, completed, source",
      messages: "&id, sessionId, timestamp, role",
      blobs: "&id, createdAt",
      sessions: "&id, updatedAt",
    }).upgrade(async (tx) => {
      const defaultId = "sess-legacy-" + Date.now().toString(36);
      const now = Date.now();
      await tx.table("sessions").add({
        id: defaultId,
        title: "历史对话",
        createdAt: now,
        updatedAt: now,
      });
      await tx.table("messages").toCollection().modify((m: ChatMessage) => {
        if (!m.sessionId) m.sessionId = defaultId;
      });
    });
    // v4: ddls 加 status 索引；旧数据 completed=true → status="done"，否则 "todo"
    this.version(4).stores({
      ddls: "&id, dueDate, completed, status, source",
      messages: "&id, sessionId, timestamp, role",
      blobs: "&id, createdAt",
      sessions: "&id, updatedAt",
    }).upgrade(async (tx) => {
      await tx.table("ddls").toCollection().modify((d: DdlItem) => {
        if (!d.status) {
          d.status = d.completed ? "done" : "todo";
        }
      });
    });
    // v5: 新增 notes 表（浏览器内简易 Markdown 笔记）
    this.version(5).stores({
      ddls: "&id, dueDate, completed, status, source",
      messages: "&id, sessionId, timestamp, role",
      blobs: "&id, createdAt",
      sessions: "&id, updatedAt",
      notes: "&id, updatedAt, pinned",
    });
    // v6: 新增 butlerAssets 表（[050] Phase C 用户自定义管家形象）
    // 主键 poseName："default" 表示替换全部 7 姿势；后续可支持每姿势单独上传
    this.version(6).stores({
      ddls: "&id, dueDate, completed, status, source",
      messages: "&id, sessionId, timestamp, role",
      blobs: "&id, createdAt",
      sessions: "&id, updatedAt",
      notes: "&id, updatedAt, pinned",
      butlerAssets: "&poseName, updatedAt",
    });
    // v7: 新增 customPanels 表（[052] Phase E 用户自定义 Tab 面板）
    this.version(7).stores({
      ddls: "&id, dueDate, completed, status, source",
      messages: "&id, sessionId, timestamp, role",
      blobs: "&id, createdAt",
      sessions: "&id, updatedAt",
      notes: "&id, updatedAt, pinned",
      butlerAssets: "&poseName, updatedAt",
      customPanels: "&id, updatedAt",
    });
    // v8: 新增 wallpapers 表（[066] 壁纸系统，主键 id 固定 "current"）
    this.version(8).stores({
      ddls: "&id, dueDate, completed, status, source",
      messages: "&id, sessionId, timestamp, role",
      blobs: "&id, createdAt",
      sessions: "&id, updatedAt",
      notes: "&id, updatedAt, pinned",
      butlerAssets: "&poseName, updatedAt",
      customPanels: "&id, updatedAt",
      wallpapers: "&id, updatedAt",
    });
    // v9: 新增 recurringTasks 表（[079] 周期任务模板）
    this.version(9).stores({
      ddls: "&id, dueDate, completed, status, source",
      messages: "&id, sessionId, timestamp, role",
      blobs: "&id, createdAt",
      sessions: "&id, updatedAt",
      notes: "&id, updatedAt, pinned",
      butlerAssets: "&poseName, updatedAt",
      customPanels: "&id, updatedAt",
      wallpapers: "&id, updatedAt",
      recurringTasks: "&id, createdAt, active",
    });
  }
}

// 单例（Next.js 客户端组件多处 import 同一份）
let _db: ButlerDB | null = null;
export function getDb(): ButlerDB {
  if (typeof window === "undefined") {
    throw new Error("getDb() 仅可在客户端调用");
  }
  if (!_db) _db = new ButlerDB();
  return _db;
}
