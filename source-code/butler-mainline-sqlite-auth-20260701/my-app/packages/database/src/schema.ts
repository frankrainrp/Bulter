// ============================================================
// packages/database/src/schema.ts
// Drizzle ORM Schema — 定义多租户数据库的核心表结构
// 每所高校拥有完全隔离的独立物理数据库，此 Schema 适用于所有库
// ============================================================
import { pgTable, text, timestamp, uuid, real } from "drizzle-orm/pg-core";

/**
 * DDL 任务表
 * 存储从文档提取的截止日期与任务信息
 */
export const ddlTasks = pgTable("ddl_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(), // Clerk User ID
  title: text("title").notNull(),
  course: text("course").notNull(),
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  description: text("description"),
  calendarEventId: text("calendar_event_id"), // 写入日历后存储事件 ID（只写不读）
  confidence: real("confidence").notNull().default(1.0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * 文档上传日志表
 * 记录上传事件（原始文件 S3 TTL 物理删除后，此日志仍保留）
 */
export const uploadLogs = pgTable("upload_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  originalFilename: text("original_filename").notNull(),
  s3Key: text("s3_key").notNull(), // 上传时的 S3 Key（文件已删除）
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
