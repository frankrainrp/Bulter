// ============================================================
// packages/database/src/client.ts
// 动态连接池路由 — 根据租户 ID（高校 ID）路由至对应独立物理数据库
// 禁止跨库查询，每个租户数据库完全隔离
// ============================================================
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// 连接池缓存：避免为同一租户重复创建连接
const connectionCache = new Map<string, ReturnType<typeof drizzle>>();

/**
 * 根据租户 ID 获取对应的 Drizzle 数据库实例
 * @param tenantId - 高校/机构 ID（对应独立物理数据库）
 * @returns Drizzle DB 实例，已绑定 Schema
 */
export function getDbForTenant(tenantId: string) {
  if (connectionCache.has(tenantId)) {
    return connectionCache.get(tenantId)!;
  }

  // 从环境变量动态构建租户数据库连接 URL
  // 格式：DATABASE_URL_<TENANT_ID_大写>
  const envKey = `DATABASE_URL_${tenantId.toUpperCase().replace(/-/g, "_")}`;
  const connectionString = process.env[envKey];

  if (!connectionString) {
    throw new Error(
      `[Database] 租户 "${tenantId}" 的数据库连接未配置，请检查环境变量 ${envKey}`
    );
  }

  const client = postgres(connectionString, { max: 10 });
  const db = drizzle(client, { schema });

  connectionCache.set(tenantId, db);
  return db;
}
