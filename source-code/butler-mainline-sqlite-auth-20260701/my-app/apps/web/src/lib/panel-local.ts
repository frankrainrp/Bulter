"use client";

// ============================================================
// lib/panel-local.ts — A1.2 本地数据源注册表
//
// kind:"local" 数据源（AI 生成的面板想用「我自己的任务/笔记/streak」）需要
// 访问用户真实数据，但 connector-client 是纯模块、面板组件深在树里。
// 用一个轻量注册表解耦：page.tsx 在数据变化时 setLocalDataset(...)，
// fetchSource 读 getLocalDataset(name)。零 props 穿透。
//
// 注入的是「面板友好」的扁平行（已展开常用字段），不是原始 Dexie 实体。
// ============================================================

import type { LocalDataset } from "./panel-schema";

const store: Partial<Record<LocalDataset, Record<string, unknown>[]>> = {};

/** page 在数据变化时灌入（如 ddls 改变 → setLocalDataset("ddls", rows)）*/
export function setLocalDataset(name: LocalDataset, rows: Record<string, unknown>[]) {
  store[name] = rows;
}

/** fetchSource 读取；未注册返回空数组（面板显示空态而非报错）*/
export function getLocalDataset(name: LocalDataset): Record<string, unknown>[] {
  return store[name] ?? [];
}

/** AI 生成提示词用：各本地数据集的字段说明（让 AI 知道能绑哪些字段）*/
export const LOCAL_DATASET_FIELDS: Record<LocalDataset, string> = {
  ddls: "title(标题) · completed(bool 是否完成) · status(todo/in_progress/done) · priority(low/med/high) · dueDate(YYYY-MM-DD) · weight(权重数字) · isGroupWork(bool) · tags(逗号串)，每个任务一行",
  notes: "title(标题) · wordCount(字数) · pinned(bool 置顶) · tags(逗号串) · updatedAt(时间戳) · createdAt(时间戳)，每篇笔记一行",
  streak: "current(当前连续天数) · longest(历史最长天数) —— 单行汇总",
  sessions: "title(会话标题) · messageCount(消息数) · updatedAt(时间戳)，每个会话一行",
};
