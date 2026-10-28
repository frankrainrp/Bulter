"use client";

// ============================================================
// app/page.tsx — 主页面：4 面板路由 + 真实 AI 对话 + AI 驱动 CRUD
// ============================================================

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import AuthGate from "@/components/AuthGate";
import TopBar from "@/components/layout/TopBar";
import LeftRail from "@/components/layout/LeftRail";
import MiniAppsDrawer from "@/components/MiniAppsDrawer";
import ChatRail from "@/components/layout/ChatRail";
import TasksRail from "@/components/layout/TasksRail";
import CalendarRail from "@/components/layout/CalendarRail";
import NotesRail from "@/components/layout/NotesRail";
import ChatCanvas from "@/components/ChatCanvas";
import TasksPanel from "@/components/TasksPanel";
import CalendarPanel from "@/components/CalendarPanel";
import NotesPanel from "@/components/NotesPanel";
import CustomPanelView from "@/components/CustomPanelView";
import TaskDetailDrawer, { type EditingTarget, type FormPayload } from "@/components/TaskDetailDrawer";
import AttachmentPreview from "@/components/AttachmentPreview";
import NotesPreview from "@/components/NotesPreview";
import KeyboardShortcutsHelp from "@/components/KeyboardShortcutsHelp";
import PreferencesPanel, { applyStoredPreferences, getStoredPersonality } from "@/components/PreferencesPanel";
import OnboardingTour from "@/components/OnboardingTour";
import Portal from "@/components/ui/Portal";
import WallpaperLayer from "@/components/WallpaperLayer";
import AchievementsRoom from "@/components/AchievementsRoom";
import MobileTabBar from "@/components/layout/MobileTabBar";
import PricingModal from "@/components/PricingModal";
import CheckoutModal from "@/components/CheckoutModal";
import QuotaWallModal from "@/components/QuotaWallModal";
import BillingPanel from "@/components/BillingPanel";
import { useIsMobile } from "@/lib/use-is-mobile";
import { applyStoredLang, useT } from "@/lib/i18n";
import {
  subscribeTo,
  cancelSubscription,
  getPlanDef,
  useSubscription,
  addInvoice,
  type PlanId,
  type BillingCycle,
  type CardInfo,
} from "@/lib/billing";
import {
  isPremiumModel,
  creditCostOf,
  canAfford,
  spendCredits,
  purchasePack,
  getPack,
  CREDITS_WALL_EVENT,
} from "@/lib/credits";
import type { CheckoutProduct } from "@/components/CheckoutModal";
import { setLocalDataset } from "@/lib/panel-local";
import type { ChatMessage, ChatSession, ProcessingPipeline, DdlItem, NavId, UploadedFile, DdlAttachment, Note, CustomPanel } from "@/lib/types";
import { INITIAL_STEPS } from "@/lib/mock-pipeline";
import { streamChat, type ApiMessage } from "@/lib/chat-client";
import { createToolExecutor } from "@/lib/tool-executor";
import { type PendingBatch, type PendingChange, makeBatch, makeChangeId, applyBatch, extractNoteDrafts, extractCustomPanelDrafts } from "@/lib/pending";
import type { ButlerPose } from "@/components/ButlerCharacter";
import { type AiModelId, DEFAULT_MODEL_ID, MODEL_STORAGE_KEY, isValidModelId } from "@/lib/ai-models";
import { canSpend, getNextResetAt } from "@/lib/usage";
import type { TaskViewId } from "@/components/layout/TasksRail";
import { useToast } from "@/components/Toast";
import {
  LAYOUT_PREFS_EVENT,
  getButlerPosition,
  getHiddenTabs,
  getTabsOrder,
  setTabsOrder,
  type ButlerPosition,
} from "@/lib/layout-prefs";
import {
  CUSTOM_PANEL_EVENT,
  createCustomPanel,
  deleteCustomPanel,
  getAllCustomPanels,
  putCustomPanel,
  updateCustomPanel,
} from "@/lib/custom-panels";
import { playSound } from "@/lib/sound";
import RecurringTasksManager from "@/components/RecurringTasksManager";
import {
  getAllRecurring,
  putRecurring,
  bulkPutRecurring,
  materializeDue,
} from "@/lib/recurring";
import type { RecurringTask } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

export default function HomePage() {
  return (
    <AuthGate>
      <ButlerApp />
    </AuthGate>
  );
}

function ButlerApp() {
  const toast = useToast();
  const { t } = useT();
  const [activeNav, setActiveNav] = useState<NavId>("chat");
  // 手机响应式：窄屏布局 + 左栏抽屉开关
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  // 抽屉内点操作按钮/项后自动关（用原生 click 监听，绕过 React 合成事件冒泡到容器的边界问题）
  useEffect(() => {
    const el = mobileDrawerRef.current;
    if (!el || !isMobile) return;
    const handler = (e: Event) => {
      if ((e.target as HTMLElement).closest('button, [role="button"]')) {
        // 微延迟让 rail 操作（切会话/建任务等）先执行，再收起抽屉
        setTimeout(() => setMobileNavOpen(false), 120);
      }
    };
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, [isMobile]);
  // Phase D 布局偏好（mount 后从 localStorage 读 + 监听 LAYOUT_PREFS_EVENT）
  const [tabsOrder, setTabsOrderState] = useState<NavId[]>(["chat", "tasks", "calendar", "notes"]);
  const [hiddenTabs, setHiddenTabsState] = useState<Set<NavId>>(new Set());
  const [butlerPosition, setButlerPositionState] = useState<ButlerPosition>("center");
  // Phase E 自定义面板（mount 后从 IndexedDB 加载 + 监听 CUSTOM_PANEL_EVENT）
  const [customPanels, setCustomPanels] = useState<CustomPanel[]>([]);
  const [activeCustomPanelId, setActiveCustomPanelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);  // 全 session 共池，渲染时按 activeSessionId 过滤
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [pipelines, setPipelines] = useState<Record<string, ProcessingPipeline>>({});
  const [ddls, setDdls] = useState<DdlItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // 待核实批次：AI tool_call / PDF 提取 都先入此处，用户接受后才落 ddls
  const [pendingBatches, setPendingBatches] = useState<Record<string, PendingBatch>>({});
  // 一次 AI send 期间累积同一 batchId，多个 tool_call 共用一张核实卡
  const currentBatchIdRef = useRef<string | null>(null);
  // PDF pipeline 完成时短暂高亮 pointout 姿势（5s 后回 standing/serving）
  const [pointoutHold, setPointoutHold] = useState(false);
  // AI 生成阶段（用于派生 butlerPose 的 thinking / thinking-hard / idea / rare-thinking）
  // phase=null 表示当前没有 AI 在跑；phase 推进顺序：thinking → thinking-hard（思考模式）→ idea → thinking
  // rareRoll：每次 send 开始抽一次（仅 7-9am × 6.1%），sticky 整个生成期
  const [aiActivity, setAiActivity] = useState<{
    phase: "thinking" | "thinking-hard" | "idea" | null;
    rareRoll: boolean;
  }>({ phase: null, rareRoll: false });
  // idea 是"reasoning→content 过渡"的一闪而过状态，1s 后自动切回 thinking
  const ideaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 停止生成：handleSend 时 new AbortController() 存入，handleStopGeneration abort
  const abortRef = useRef<AbortController | null>(null);

  // 早上 7-9 点 × 6.1% 概率，命中时整个生成期的 thinking/thinking-hard 显示 rare-thinking
  const rollRare = useCallback(() => {
    const hour = new Date().getHours();
    return hour >= 7 && hour < 9 && Math.random() < 0.061;
  }, []);
  // 学习工具抽屉
  const [miniAppsOpen, setMiniAppsOpen] = useState(false);
  // Tasks 当前 view
  const [taskView, setTaskView] = useState<TaskViewId>("active");
  // Notes 浏览器版（Dexie v5）
  const [notes, setNotes] = useState<Note[]>([]);
  // AI 模型选择（localStorage 持久化）
  const [selectedModel, setSelectedModel] = useState<AiModelId>(DEFAULT_MODEL_ID);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODEL_STORAGE_KEY);
      if (saved && isValidModelId(saved)) setSelectedModel(saved);
    } catch { /* ignore */ }
  }, []);
  const handleSelectModel = useCallback((id: AiModelId) => {
    setSelectedModel(id);
    try { localStorage.setItem(MODEL_STORAGE_KEY, id); } catch { /* ignore */ }
  }, []);

  // ddlsRef 保证 AI tool 执行时拿到最新 state（避免闭包陷阱）
  const ddlsRef = useRef(ddls);
  useEffect(() => { ddlsRef.current = ddls; }, [ddls]);
  const activeSessionIdRef = useRef<string | null>(null);
  useEffect(() => { activeSessionIdRef.current = activeSessionId; }, [activeSessionId]);

  // ---------- 持久化：启动 load + 改动同步到 IndexedDB（Dexie） ----------
  const [hydrated, setHydrated] = useState(false);

  // 启动一次性 load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getDb } = await import("@/lib/db");
        const db = getDb();
        const [ddlRows, sessRows, msgRows, noteRows] = await Promise.all([
          db.ddls.toArray(),
          db.sessions.toArray(),
          db.messages.toArray(),
          db.notes.toArray(),
        ]);
        if (cancelled) return;
        if (ddlRows.length > 0) setDdls(ddlRows);
        if (noteRows.length > 0) setNotes(noteRows);

        // sessions 排序（最近活跃在前）
        const sortedSessions = [...sessRows].sort((a, b) => b.updatedAt - a.updatedAt);
        if (sortedSessions.length === 0) {
          // 首次启动 → 自动建一个空 session
          const now = Date.now();
          const fresh: ChatSession = {
            id: "sess-" + Math.random().toString(36).slice(2, 9) + now.toString(36),
            title: "",
            createdAt: now,
            updatedAt: now,
          };
          setSessions([fresh]);
          setActiveSessionId(fresh.id);
        } else {
          setSessions(sortedSessions);
          setActiveSessionId(sortedSessions[0].id);
        }

        if (msgRows.length > 0) {
          // 旧 messages 的 timestamp 是 Date 实例，Dexie 序列化为 ISO 字符串/Date — 这里统一回 Date
          const normalized = msgRows.map((m) => ({
            ...m,
            timestamp: m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp as unknown as string),
          }));
          setMessages(normalized);
        }
      } catch (e) {
        console.warn("[db] hydrate failed:", e);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 改动同步：每次 ddls 变化，整体替换 IndexedDB 表
  useEffect(() => {
    if (!hydrated) return; // 防止首次渲染（空数组）覆盖已有数据
    (async () => {
      try {
        const { getDb } = await import("@/lib/db");
        const db = getDb();
        await db.transaction("rw", db.ddls, async () => {
          await db.ddls.clear();
          if (ddls.length > 0) await db.ddls.bulkPut(ddls);
        });
      } catch (e) {
        console.warn("[db] sync failed:", e);
      }
    })();
  }, [ddls, hydrated]);

  // 持久化：sessions 变化 → 整体替换
  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      try {
        const { getDb } = await import("@/lib/db");
        const db = getDb();
        await db.transaction("rw", db.sessions, async () => {
          await db.sessions.clear();
          if (sessions.length > 0) await db.sessions.bulkPut(sessions);
        });
      } catch (e) {
        console.warn("[db] sessions sync failed:", e);
      }
    })();
  }, [sessions, hydrated]);

  // 持久化：notes 变化 → bulkPut
  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      try {
        const { getDb } = await import("@/lib/db");
        const db = getDb();
        await db.transaction("rw", db.notes, async () => {
          await db.notes.clear();
          if (notes.length > 0) await db.notes.bulkPut(notes);
        });
      } catch (e) {
        console.warn("[db] notes sync failed:", e);
      }
    })();
  }, [notes, hydrated]);

  // Notes CRUD
  const handleCreateNote = useCallback((): Note => {
    const now = Date.now();
    const fresh: Note = {
      id: "note-" + uid(),
      title: "",
      content: "",
      createdAt: now,
      updatedAt: now,
    };
    setNotes((prev) => [fresh, ...prev]);
    return fresh;
  }, []);

  const handleUpdateNote = useCallback((id: string, patch: Partial<Note>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  const handleDeleteNote = useCallback((id: string) => {
    const snapshot = notes.find((n) => n.id === id);
    if (!snapshot) return;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    toast.success(t("pg.delNote", { title: snapshot.title || t("td.note.untitled") }), {
      action: {
        label: t("pg.undo"),
        onClick: () => setNotes((prev) => [snapshot, ...prev]),
      },
    });
  }, [notes, toast]);

  // 已触发过 AI 开屏问候的 session（防重复）
  const greetedSessionsRef = useRef<Set<string>>(new Set());
  // 已请求过自动标题的 session（防重复触发）
  const titleRequestedRef = useRef<Set<string>>(new Set());
  // Epic 5.4 已推送过 deadline 通知的 task id（防重复）
  const deadlineNotifiedRef = useRef<Set<string>>(new Set());

  // 持久化：messages 变化 → 整体替换（pipeline 类消息不持久化，避免重启后挂着旧 pipelineId）
  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      try {
        const { getDb } = await import("@/lib/db");
        const db = getDb();
        const persistable = messages.filter((m) => m.role !== "pipeline" && m.role !== "confirm");
        await db.transaction("rw", db.messages, async () => {
          await db.messages.clear();
          if (persistable.length > 0) await db.messages.bulkPut(persistable);
        });
      } catch (e) {
        console.warn("[db] messages sync failed:", e);
      }
    })();
  }, [messages, hydrated]);

  // 当前 session 的消息（派生）
  const visibleMessages = useMemo(
    () => (activeSessionId ? messages.filter((m) => m.sessionId === activeSessionId) : []),
    [messages, activeSessionId],
  );

  // 触碰当前 session 的 updatedAt（用户新发消息时调用，让它冒到列表顶部）
  const touchActiveSession = useCallback((titleHint?: string) => {
    const sid = activeSessionIdRef.current;
    if (!sid) return;
    setSessions((prev) => prev.map((s) => {
      if (s.id !== sid) return s;
      const next: ChatSession = { ...s, updatedAt: Date.now() };
      // 默认标题 → 用首条消息前 24 字
      if (titleHint && s.title === "") {
        const t = titleHint.trim().slice(0, 24);
        if (t) next.title = t;
      }
      return next;
    }));
  }, []);

  // ---------- 文件附件 ----------
  const handleAttach = useCallback((fileList: FileList) => {
    const list: UploadedFile[] = Array.from(fileList).map((f) => ({
      id: uid(), name: f.name, size: f.size, mime: f.type || "application/octet-stream",
      file: f, // 保留真实 File 对象供 pipeline 读取
    }));
    setAttachedFiles((prev) => [...prev, ...list]);
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // ---------- 真实处理流（PDF → 客户端解析 → V4 Flash 提取 → 落 state） ----------
  const runRealPipeline = useCallback(async (uploaded: UploadedFile) => {
    const pipelineId = uid();
    const messageId = uid();
    const sid = activeSessionIdRef.current;
    if (!sid) return;
    const initial: ProcessingPipeline = {
      id: pipelineId, file: uploaded,
      steps: INITIAL_STEPS.map((s) => ({ ...s })),
      status: "running", startedAt: Date.now(),
    };
    setPipelines((prev) => ({ ...prev, [pipelineId]: initial }));
    setMessages((prev) => [
      ...prev,
      { id: messageId, sessionId: sid, role: "pipeline", content: "", pipelineId, timestamp: new Date() },
    ]);

    const setStep = (idx: number, status: "running" | "success" | "failed", detail?: string) => {
      setPipelines((prev) => {
        const cur = prev[pipelineId]; if (!cur) return prev;
        return {
          ...prev,
          [pipelineId]: {
            ...cur,
            steps: cur.steps.map((s, i) => i === idx ? { ...s, status, ...(detail ? { detail } : {}) } : s),
          },
        };
      });
    };
    const finishPipeline = (status: "completed" | "failed", extractedCount?: number) => {
      setPipelines((prev) => {
        const cur = prev[pipelineId]; if (!cur) return prev;
        return {
          ...prev,
          [pipelineId]: { ...cur, status, finishedAt: Date.now(), ...(extractedCount !== undefined ? { extractedCount } : {}) },
        };
      });
    };

    try {
      // ---- Step 1: 解析 / OCR + 双重粗筛（关键词 → 语义） ----
      setStep(0, "running");
      if (!uploaded.file) throw new Error(t("pg.fileLost"));

      // 大文件 warning（10 MB+）
      if (uploaded.file.size > 10 * 1024 * 1024) {
        setStep(0, "running", t("pg.bigFile", { mb: (uploaded.file.size / 1024 / 1024).toFixed(1) }));
      }

      const { parseDocument, filterDdlRelevant } = await import("@/lib/document-parser");
      const parsed = await parseDocument(uploaded.file);
      if (parsed.ok !== true) {
        // 无 OCR key 的友好提示
        const hint = parsed.needsConfig
          ? t("pg.ocrHint")
          : "";
        setStep(0, "failed", parsed.error + hint);
        finishPipeline("failed");
        return;
      }

      const sourceLabel = parsed.source === "unpdf"
        ? t("pg.localParse")
        : parsed.source.startsWith("ocr-")
        ? `OCR (${parsed.source.replace("ocr-", "")})`
        : parsed.source;

      // 1a. 关键词快速预筛（同步，免费）
      const keywordFiltered = filterDdlRelevant(parsed.text);

      // 1b. 语义粗筛（MiniLM embedding，首次加载 ~22MB；失败降级到纯关键词）
      let finalMd = keywordFiltered;
      let semDetail = t("pg.kwOnly");
      try {
        setStep(0, "running", t("pg.parseProgress", { label: sourceLabel, pages: parsed.pages, chars: parsed.text.length, kw: keywordFiltered.length }));
        const { filterBySemantic } = await import("@/lib/semantic-filter");
        // 实测数据：相关段相似度 0.55+，弱相关 0.15-0.30，垃圾 <0.15
        // 阈值 0.35 + topK 20 既能砍掉模板段又保住所有真 DDL
        // 直接用 parsed.text（关键词筛后只剩 1 大段，semantic 自己切分更细）
        const sem = await filterBySemantic(parsed.text, { topK: 30, minSim: 0.35 });
        if (sem.kept > 0) {
          finalMd = sem.text;
          semDetail = `→ 语义 ${sem.kept}/${sem.total} 段 ${sem.text.length} 字 (top sim ${sem.topSim.toFixed(2)})`;
        }
      } catch (e) {
        // 模型下载失败 / 浏览器不支持 → 降级
        console.warn("semantic filter unavailable, fallback to keyword only:", e);
      }
      setStep(0, "success", t("pg.parseDone", { label: sourceLabel, pages: parsed.pages, chars: parsed.text.length, kw: keywordFiltered.length, sem: semDetail }));

      // ---- Step 2: V4 Flash 提取 DDL ----
      setStep(1, "running");
      const today = new Date(); const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const res = await fetch("/api/extract-ddls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markdown: finalMd, filename: uploaded.name, currentDate: isoToday }),
      });
      const json = await res.json();
      if (!json.ok) { setStep(1, "failed", json.error || t("pg.extractFail")); finishPipeline("failed"); return; }
      const items: Array<Omit<DdlItem, "id" | "source" | "completed">> = json.items || [];
      setStep(1, "success", t("pg.extractN", { n: items.length }));

      // ---- Step 3: 写入日历（暂跳过，Phase 4 接 Google Cal）----
      setStep(2, "running");
      await new Promise((r) => setTimeout(r, 300));
      setStep(2, "success", t("pg.calSkip"));

      // ---- Step 4: 落入待核实队列（v2：不直接 setDdls，需用户核实）----
      setStep(3, "running");
      const newDdls: DdlItem[] = items.map((it) => ({
        ...it,
        id: uid(),
        source: `${uploaded.name}（待核实）`,
        completed: false,
        weight: it.weight ?? null,
        dueTime: it.dueTime || "23:59",
        description: it.description || "",
        isGroupWork: it.isGroupWork ?? false,
      }));

      const batch = makeBatch(
        sid,
        "pdf-extract",
        t("pg.pdfBatchIntro", { name: uploaded.name, n: newDdls.length }),
      );
      batch.changes = newDdls.map<PendingChange>((d) => ({
        id: makeChangeId(),
        kind: "create",
        summary: `${d.taskName} · ${d.dueDate || t("tasks.date.tbd")}${d.dueTime ? " " + d.dueTime : ""}${d.weight != null ? ` · ${d.weight}%` : ""}`,
        draft: d,
      }));
      setPendingBatches((prev) => ({ ...prev, [batch.id]: batch }));
      // 同时往聊天流 push 一条 confirm 消息，方便用户在 Chat 里看到
      setMessages((prev) => [
        ...prev,
        {
          id: "msg-" + uid(),
          sessionId: sid,
          role: "confirm",
          content: "",
          confirmBatchId: batch.id,
          timestamp: new Date(),
        },
      ]);
      // 触发管家 pointout 姿势 5 秒
      setPointoutHold(true);
      setTimeout(() => setPointoutHold(false), 5000);

      setStep(3, "success", `识别到 ${newDdls.length} 条，已加入待核实队列`);

      finishPipeline("completed", newDdls.length);
    } catch (err) {
      const msg = (err as Error).message;
      // 哪一步在 running 就标 failed
      setPipelines((prev) => {
        const cur = prev[pipelineId]; if (!cur) return prev;
        const newSteps = cur.steps.map((s) => s.status === "running" ? { ...s, status: "failed" as const, detail: msg } : s);
        return { ...prev, [pipelineId]: { ...cur, steps: newSteps, status: "failed", finishedAt: Date.now() } };
      });
    }
  }, []);

  // ---------- 待核实批次：add / accept / reject / dropChange ----------
  const addPendingChange = useCallback((change: PendingChange) => {
    const sid = activeSessionIdRef.current;
    if (!sid) return;
    // 如果当前 send 还没建过 batch，建一个 + push confirm 消息到聊天流
    let batchId = currentBatchIdRef.current;
    if (!batchId) {
      const batch = makeBatch(sid, "ai-chat", "我准备为你做以下改动，请核实：");
      batchId = batch.id;
      currentBatchIdRef.current = batchId;
      setPendingBatches((prev) => ({ ...prev, [batch.id]: { ...batch, changes: [change] } }));
      setMessages((prev) => [
        ...prev,
        {
          id: "msg-" + uid(),
          sessionId: sid,
          role: "confirm",
          content: "",
          confirmBatchId: batch.id,
          timestamp: new Date(),
        },
      ]);
    } else {
      // 追加到现有 batch
      const bid = batchId;
      setPendingBatches((prev) => {
        const cur = prev[bid];
        if (!cur) return prev;
        return { ...prev, [bid]: { ...cur, changes: [...cur.changes, change] } };
      });
    }
  }, []);

  const handleAcceptBatch = useCallback((batchId: string) => {
    setPendingBatches((prev) => {
      const batch = prev[batchId];
      if (!batch || batch.status !== "pending") return prev;
      // 1. 应用 ddls 相关 changes
      const { next, stats } = applyBatch(ddlsRef.current, batch);
      setDdls(next);
      // 2. 应用 create-note changes（B2 跨面板联动）
      const noteDrafts = extractNoteDrafts(batch);
      if (noteDrafts.length > 0) {
        setNotes((prevNotes) => [...noteDrafts, ...prevNotes]);
      }
      // 3. [054] D.3 应用 create-custom-panel changes（异步 put IndexedDB；CUSTOM_PANEL_EVENT 触发 page 重载）
      const panelDrafts = extractCustomPanelDrafts(batch);
      if (panelDrafts.length > 0) {
        (async () => {
          for (const p of panelDrafts) {
            try { await putCustomPanel(p); } catch (e) { console.warn("[pending] put custom panel failed", e); }
          }
        })();
      }
      console.log(
        "[pending] accepted batch", batchId, stats,
        noteDrafts.length > 0 ? `+${noteDrafts.length} notes` : "",
        panelDrafts.length > 0 ? `+${panelDrafts.length} custom panels` : "",
      );
      return { ...prev, [batchId]: { ...batch, status: "accepted" } };
    });
  }, []);

  const handleRejectBatch = useCallback((batchId: string) => {
    setPendingBatches((prev) => {
      const batch = prev[batchId];
      if (!batch || batch.status !== "pending") return prev;
      return { ...prev, [batchId]: { ...batch, status: "rejected" } };
    });
  }, []);

  const handleDropChange = useCallback((batchId: string, changeId: string) => {
    setPendingBatches((prev) => {
      const batch = prev[batchId];
      if (!batch || batch.status !== "pending") return prev;
      return {
        ...prev,
        [batchId]: { ...batch, changes: batch.changes.filter((c) => c.id !== changeId) },
      };
    });
  }, []);

  // ---------- Butler 姿势：派生 ----------
  // 优先级（高 → 低）：
  //   1. pointoutHold（PDF 完成 5s 内高亮）
  //   2. PDF 待核实
  //   3. AI 在生成（按 aiActivity.phase + rareRoll）
  //   4. AI 待核实（ai-chat pending）
  //   5. 默认 standing
  const butlerPose: ButlerPose = useMemo(() => {
    if (pointoutHold) return "pointout";

    const hasPdfPending = Object.values(pendingBatches).some(
      (b) => b.origin === "pdf-extract" && b.status === "pending",
    );
    if (hasPdfPending) return "pointout";

    if (isLoading && aiActivity.phase) {
      // idea 优先级最高（一闪即过的灵感时刻）
      if (aiActivity.phase === "idea") return "idea";
      // thinking-hard / thinking 在 rare 命中时替换为 rare-thinking
      if (aiActivity.rareRoll) return "rare-thinking";
      if (aiActivity.phase === "thinking-hard") return "thinking-hard";
      return "thinking";
    }

    const hasAiPending = Object.values(pendingBatches).some(
      (b) => b.origin === "ai-chat" && b.status === "pending",
    );
    if (isLoading || hasAiPending) return "serving";

    return "standing";
  }, [pointoutHold, pendingBatches, isLoading, aiActivity]);

  // ---------- [079] 周期任务 ----------
  const [recurringOpen, setRecurringOpen] = useState(false);
  // 扫描所有模板：当期未生成的 → 生成实例 append 到 ddls + 回写 lastGeneratedPeriod
  const runMaterialize = useCallback(async () => {
    try {
      const routines = await getAllRecurring();
      if (routines.length === 0) return;
      const { newTasks, updatedRoutines, changed } = materializeDue(routines);
      if (newTasks.length > 0) {
        setDdls((prev) => [...prev, ...newTasks]);
        toast.info(`🔁 已自动生成 ${newTasks.length} 个周期任务`);
      }
      if (changed) await bulkPutRecurring(updatedRoutines);
    } catch (e) {
      console.warn("[recurring] materialize failed", e);
    }
  }, [toast]);
  // AI 工具 / 管理器创建模板 → 落库 + 立即生成当期
  const addRecurring = useCallback((routine: RecurringTask) => {
    (async () => {
      try {
        await putRecurring(routine);
        await runMaterialize();
      } catch (e) { console.warn("[recurring] add failed", e); }
    })();
  }, [runMaterialize]);

  // ---------- Tool 执行器（稳定 ref） ----------
  const executeToolCall = useMemo(
    () => createToolExecutor({
      getDdls: () => ddlsRef.current,
      setDdls,
      addPending: addPendingChange,
      addRecurring,
    }),
    [addPendingChange, addRecurring],
  );

  // ---------- 构建 contextSummary 给 AI ----------
  const buildContextSummary = useCallback((items: DdlItem[]): string => {
    if (items.length === 0) return "用户当前没有任何任务/事件。";
    const sorted = [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const cap = sorted.slice(0, 20);
    const lines = cap.map((d) => {
      const flags: string[] = [];
      if (d.completed) flags.push("✓已完成");
      if (d.isGroupWork) flags.push("小组");
      if (d.weight != null) flags.push(`${d.weight}%`);
      const tag = flags.length ? ` [${flags.join(" ")}]` : "";
      return `- (id=${d.id}) ${d.taskName} — ${d.dueDate} ${d.dueTime}${tag}`;
    });
    const tail = items.length > 20 ? `\n（仅显示最近 20 条，总共 ${items.length} 条）` : "";
    return `当前任务/事件列表：\n${lines.join("\n")}${tail}`;
  }, []);

  // 历史消息截断上限：避免长会话 input token 线性爆炸（system prompt 已含 contextSummary）
  // 10 条 ≈ 5 轮对话足够保留近期上下文；早期内容可通过 UI 历史回看
  const HISTORY_LIMIT = 10;

  // ---------- 发送 ----------
  const handleSend = useCallback(async () => {
    const content = inputValue.trim();
    if (!content && attachedFiles.length === 0) return;
    if (isLoading) return;
    const sid = activeSessionIdRef.current;
    if (!sid) return;

    // [087] 免费墙：当前 5h 窗口额度用尽 → 弹 softwall，不发送（也不入栈用户消息）
    if (!canSpend()) {
      setQuotaWallOpen(true);
      return;
    }

    // P5′ 积分预检：高级模型按次扣积分（Flash/思考走免费窗口，不耗积分）
    const premiumCost = isPremiumModel(selectedModel) ? creditCostOf("chatPremium", selectedModel) : 0;
    if (premiumCost > 0 && !canAfford(premiumCost)) {
      setCreditsWall(premiumCost);
      return;
    }

    const filesSnapshot = attachedFiles;

    // 1. 用户消息入栈
    const userUiMsg: ChatMessage = {
      id: uid(), sessionId: sid, role: "user", content,
      files: filesSnapshot.length > 0 ? filesSnapshot : undefined,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userUiMsg]);
    touchActiveSession(content || filesSnapshot[0]?.name);
    playSound("send"); // [056]

    setInputValue("");
    setAttachedFiles([]);

    // 2. 有文件 → 触发 mock pipeline（暂不接 AI，Phase D 再合并）
    if (filesSnapshot.length > 0) {
      filesSnapshot.forEach((f) => runRealPipeline(f));
      return;
    }

    // 3. 纯文本 → 真实 AI 对话（高级模型先扣积分，预检已通过）
    if (premiumCost > 0) spendCredits(premiumCost, "chatPremium");
    setIsLoading(true);
    currentBatchIdRef.current = null; // 新一轮 send：清掉旧 batchId，让首个 tool_call 时建新 batch

    // 初始化 AI 活动状态：默认 thinking（Flash 模式 content 流），rareRoll 一次抽定
    const rare = rollRare();
    setAiActivity({ phase: "thinking", rareRoll: rare });
    let contentStarted = false; // 当前轮 send 是否已进入 content 流（用于触发 idea 一闪）
    if (ideaTimerRef.current) {
      clearTimeout(ideaTimerRef.current);
      ideaTimerRef.current = null;
    }

    // 把当前 session 的 UI 历史消息转成 API 格式
    const allHistory: ApiMessage[] = [...messages, userUiMsg]
      .filter((m) => m.sessionId === sid && (m.role === "user" || m.role === "assistant") && m.content)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    // 截断到最近 HISTORY_LIMIT 条；如截断后首条是 assistant 则继续往后 trim
    // 保证首条 role=user（DeepSeek/OpenAI API 严格要求）
    let trimmed = allHistory.slice(-HISTORY_LIMIT);
    while (trimmed.length > 0 && trimmed[0].role !== "user") {
      trimmed = trimmed.slice(1);
    }
    const historyApi = trimmed;
    if (allHistory.length > historyApi.length) {
      console.log(`[chat] history truncated: ${allHistory.length} → ${historyApi.length}`);
    }

    // 流式回调：动态创建 UI assistant 消息 + 增量更新（content / reasoning 共用同一条消息）
    let currentAssistantId: string | null = null;
    const ensureAssistant = (patch: { content?: string; reasoning?: string }) => {
      if (!currentAssistantId) {
        const id = uid();
        currentAssistantId = id;
        setMessages((prev) => [
          ...prev,
          {
            id,
            sessionId: sid,
            role: "assistant",
            content: patch.content ?? "",
            reasoning: patch.reasoning,
            timestamp: new Date(),
          },
        ]);
      } else {
        const id = currentAssistantId;
        setMessages((prev) => prev.map((m) => {
          if (m.id !== id) return m;
          const next = { ...m };
          if (patch.content) next.content = m.content + patch.content;
          if (patch.reasoning) next.reasoning = (m.reasoning ?? "") + patch.reasoning;
          return next;
        }));
      }
    };

    // 创建可中止控制器（用户点 stop 按钮 → abortRef.current.abort()）
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat({
        messages: historyApi,
        contextSummary: buildContextSummary(ddlsRef.current),
        userName: "Feng",
        includeTools: true,
        model: selectedModel,
        personality: getStoredPersonality(),
        signal: controller.signal,
        executeToolCall,
        callbacks: {
          onContentDelta: (d) => {
            // 首次进入 content 流 → idea 一闪 1s → 回 thinking
            if (!contentStarted) {
              contentStarted = true;
              setAiActivity((a) => ({ ...a, phase: "idea" }));
              ideaTimerRef.current = setTimeout(() => {
                setAiActivity((a) => (a.phase === "idea" ? { ...a, phase: "thinking" } : a));
                ideaTimerRef.current = null;
              }, 1000);
            }
            ensureAssistant({ content: d });
          },
          onReasoningDelta: (d) => {
            // reasoning_content 出现 → 升级到 thinking-hard（仅 content 未开始时）
            if (!contentStarted) {
              setAiActivity((a) =>
                a.phase === "thinking-hard" ? a : { ...a, phase: "thinking-hard" },
              );
            }
            ensureAssistant({ reasoning: d });
          },
          onAssistantMessage: () => {
            // 一轮 assistant 消息收尾。下一轮（若有 tool call 后）会重新建立新的 UI 消息
            currentAssistantId = null;
          },
          onToolCallStart: (call) => {
            // eslint-disable-next-line no-console
            console.log("[tool] start", call.function.name, call.function.arguments);
            // 1.3 实时提示用户:Butler 正在调什么工具
            const labels: Record<string, string> = {
              create_item: "正在新建任务草稿",
              update_item: "正在修改任务草稿",
              delete_item: "正在准备删除",
              toggle_complete: "正在勾选完成",
              list_items: "正在查询任务列表",
              create_note: "正在生成笔记草稿",
              create_custom_panel: "正在生成自定义面板草稿",
              create_recurring_task: "正在创建周期任务",
            };
            const label = labels[call.function.name] ?? `正在调用 ${call.function.name}`;
            toast.info(`⚙ Butler ${label}…`, { id: "ai-tool-call", duration: 1500 });
          },
          onToolCallEnd: (call, result) => {
            // eslint-disable-next-line no-console
            console.log("[tool] end", call.function.name, result);
          },
          onError: (err) => {
            setMessages((prev) => [
              ...prev,
              { id: uid(), sessionId: sid, role: "assistant", content: `❌ 出错了：${err.message}`, isError: true, timestamp: new Date() },
            ]);
          },
        },
      });
      playSound("ai-reply"); // [056] 流式完成的成功路径
    } catch (err) {
      // AbortError 静默（用户主动 stop）；其他错误已通过 onError 上报，这里仅吞掉防止 unhandled rejection
      if (err instanceof Error && err.name !== "AbortError" && err.name !== "DOMException") {
        console.warn("[chat] streamChat error:", err);
      }
    } finally {
      setIsLoading(false);
      currentBatchIdRef.current = null;
      abortRef.current = null;
      if (ideaTimerRef.current) {
        clearTimeout(ideaTimerRef.current);
        ideaTimerRef.current = null;
      }
      setAiActivity({ phase: null, rareRoll: false });
    }
  }, [inputValue, attachedFiles, isLoading, messages, runRealPipeline, executeToolCall, buildContextSummary, touchActiveSession, selectedModel, rollRare, toast]);

  // 停止生成：触发当前 AbortController.abort()；finally 会自动清理状态
  const handleStopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // G: AI 自动生成会话标题 — 首轮对话完成后调一次 V4 Flash 总结 4-8 字
  const generateSessionTitle = useCallback(async (sid: string, userText: string, assistantText: string) => {
    let title = "";
    try {
      await streamChat({
        messages: [{
          role: "user",
          content: `请根据下面这段对话生成一个 4-8 个汉字的中文标题,直接输出标题文本本身,不要任何解释、标点、引号、emoji 或前后缀。\n\n用户:${userText.slice(0, 200)}\nAI:${assistantText.slice(0, 200)}`,
        }],
        userName: "Feng",
        includeTools: false,
        model: "deepseek-v4-flash",
        executeToolCall: async () => ({ ok: false, message: "not allowed" }),
        callbacks: {
          onContentDelta: (d) => { title += d; },
          onError: () => { /* 静默,不阻塞 */ },
        },
      });
    } catch { /* ignore */ }
    // 清理:去标点 / 引号 / 换行,限制 20 字
    const cleaned = title.replace(/["""《》「」<>【】[\]:：。.!！?？\n\r\s]/g, "").trim().slice(0, 20);
    if (cleaned) {
      setSessions((prev) => prev.map((s) => (s.id === sid && s.title === "" ? { ...s, title: cleaned } : s)));
    }
  }, []);

  // 监听:当 session 有 1 user + 1 真实 assistant 且 title 仍是默认值 → 自动生成
  useEffect(() => {
    if (isLoading || !hydrated) return;
    const sid = activeSessionIdRef.current;
    if (!sid) return;
    if (titleRequestedRef.current.has(sid)) return;
    const session = sessions.find((s) => s.id === sid);
    if (!session || session.title !== "") return;
    const sessMsgs = messages.filter((m) => m.sessionId === sid && (m.role === "user" || m.role === "assistant"));
    const lastUser = [...sessMsgs].reverse().find((m) => m.role === "user");
    const lastAssistant = [...sessMsgs].reverse().find((m) => m.role === "assistant" && !m.isError && m.content.length > 5);
    if (!lastUser || !lastAssistant) return;
    titleRequestedRef.current.add(sid);
    generateSessionTitle(sid, lastUser.content, lastAssistant.content);
  }, [isLoading, hydrated, sessions, messages, generateSessionTitle]);

  // 重新生成 / 错误重试：删除指定 assistant 消息及其之后的所有消息,
  // 找到它前面最近的 user 消息内容,塞回 inputValue 并触发 send。
  // 用 setTimeout(0) 让 setState 先 flush 再调 handleSend（拿到截断后的 messages）
  const handleRegenerate = useCallback((assistantMessageId: string) => {
    if (isLoading) return;
    const sid = activeSessionIdRef.current;
    if (!sid) return;
    const idx = messages.findIndex((m) => m.id === assistantMessageId);
    if (idx < 0) return;
    // 找前面最近的 user 消息
    let userIdx = -1;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].sessionId === sid && messages[i].role === "user") { userIdx = i; break; }
    }
    if (userIdx < 0) return;
    const userContent = messages[userIdx].content;
    // 截断：保留到 userIdx-1（去掉那条 user + 后面所有，因为待会儿 send 会重新加这条 user）
    setMessages((prev) => prev.slice(0, userIdx));
    setInputValue(userContent);
    // 下一 tick 触发 send（让 React flush state）
    setTimeout(() => {
      // 使用 ref 拿到最新 handleSend 不方便，直接通过 button click
      const btn = document.querySelector("#send-btn") as HTMLButtonElement | null;
      btn?.click();
    }, 50);
  }, [isLoading, messages]);

  // [078] 开屏问候已收进 ChatCanvas 空态「今日开场」（greetingHeadline + TodayHero），
  // 不再注入 assistant 消息，避免与开场重复。下面的 effect 仅标记 session 已处理。

  // 监听条件触发问候：hydrated 完成 + 当前在 chat tab + 当前 session 完全空（无 user/assistant 历史）+ 未触发过
  useEffect(() => {
    if (!hydrated) return;
    if (isLoading) return;
    if (activeNav !== "chat") return;
    const sid = activeSessionId;
    if (!sid) return;
    if (greetedSessionsRef.current.has(sid)) return;

    const sessionRealMsgs = messages.filter(
      (m) => m.sessionId === sid && (m.role === "user" || m.role === "assistant"),
    );
    if (sessionRealMsgs.length > 0) {
      // 已有真实对话历史，跳过 + 标记
      greetedSessionsRef.current.add(sid);
      return;
    }

    // [078] 不再自动推送问候消息——空态「今日开场」已承担问候+概览，避免重复
    greetedSessionsRef.current.add(sid);
  }, [hydrated, isLoading, activeNav, activeSessionId, messages]);

  // ---------- Epic 5.4 临近 deadline 浏览器通知（本地代码,零 token）----------
  // hydrate 完成后,每 60s 扫描一次未完成且 24h 内截止的任务
  // 用浏览器 Notification API（需用户授权）+ Toast 双通道提醒
  useEffect(() => {
    if (!hydrated) return;
    const check = () => {
      const now = Date.now();
      const horizon = now + 24 * 3600 * 1000;
      for (const d of ddlsRef.current) {
        if (d.completed || (d.status ?? "todo") === "done") continue;
        if (!d.dueDate) continue;
        if (deadlineNotifiedRef.current.has(d.id)) continue;
        const dueTs = new Date(`${d.dueDate}T${d.dueTime || "23:59"}:00`).getTime();
        if (dueTs >= now && dueTs <= horizon) {
          const hoursLeft = Math.round((dueTs - now) / 3600000);
          deadlineNotifiedRef.current.add(d.id);
          // Toast 一定弹
          toast.warning(`⏰ 「${d.taskName}」还有约 ${hoursLeft} 小时截止`, {
            duration: 10000,
            action: { label: "查看", onClick: () => handleJumpToTask(d.id) },
          });
          // 浏览器 Notification(可选,需授权)
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification("Butler · 临近截止", {
                body: `${d.taskName} · ${d.dueDate} ${d.dueTime || "23:59"}（约 ${hoursLeft}h）`,
                icon: "/assets/logo.png",
                tag: `deadline-${d.id}`,
              });
            } catch { /* silent */ }
          }
        }
      }
    };
    // hydrate 后 3s 跑首次（避免和开屏问候撞）
    const t0 = setTimeout(check, 3000);
    const interval = setInterval(check, 60 * 1000);
    return () => { clearTimeout(t0); clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // 首次进入时静默请求 Notification 权限（拒绝就走 Toast 兜底）
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      // 延 5s 避免开屏就弹权限请求
      const t = setTimeout(() => {
        Notification.requestPermission().catch(() => { /* silent */ });
      }, 5000);
      return () => clearTimeout(t);
    }
  }, []);

  // ---------- 多会话操作 ----------
  const handleNewChat = useCallback(() => {
    // 当前 session 已是空白默认对话 → 只切回 chat 面板，不开新 session
    const sid = activeSessionIdRef.current;
    const cur = sid ? sessions.find((s) => s.id === sid) : null;
    const curEmpty = cur && cur.title === "" &&
      !messages.some((m) => m.sessionId === sid);
    if (curEmpty) {
      setActiveNav("chat");
      return;
    }
    // 否则新建
    const now = Date.now();
    const fresh: ChatSession = {
      id: "sess-" + Math.random().toString(36).slice(2, 9) + now.toString(36),
      title: "",
      createdAt: now,
      updatedAt: now,
    };
    setSessions((prev) => [fresh, ...prev]);
    setActiveSessionId(fresh.id);
    setActiveNav("chat");
  }, [sessions, messages]);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    setActiveNav("chat");
  }, []);

  const handleRenameSession = useCallback((id: string, title: string) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
    // snapshot 整个 session（含其下所有 messages）用于撤销
    const sessionSnapshot = sessions.find((s) => s.id === id);
    if (!sessionSnapshot) return;
    const messagesSnapshot = messages.filter((m) => m.sessionId === id);
    const prevActive = activeSessionIdRef.current;

    // 1. 清掉它所有 messages
    setMessages((prev) => prev.filter((m) => m.sessionId !== id));
    // 2. 从 sessions 移除；若它是 active，挑剩下最新的；若空，自动建一个
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      if (activeSessionIdRef.current === id) {
        if (remaining.length > 0) {
          const next = [...remaining].sort((a, b) => b.updatedAt - a.updatedAt)[0];
          setActiveSessionId(next.id);
        } else {
          const now = Date.now();
          const fresh: ChatSession = {
            id: "sess-" + Math.random().toString(36).slice(2, 9) + now.toString(36),
            title: "",
            createdAt: now,
            updatedAt: now,
          };
          setActiveSessionId(fresh.id);
          return [fresh];
        }
      }
      return remaining;
    });

    toast.success(`已删除会话「${sessionSnapshot.title}」`, {
      action: {
        label: t("pg.undo"),
        onClick: () => {
          setSessions((prev) => [sessionSnapshot, ...prev.filter((s) => s.id !== sessionSnapshot.id)]);
          setMessages((prev) => [...prev, ...messagesSnapshot]);
          setActiveSessionId(prevActive);
        },
      },
    });
  }, [sessions, messages, toast]);

  // session 列表的显示顺序（最近活跃在前）
  // #9 默认开新会话：只有「确实有明确交互内容」（出现过用户消息）的会话才进历史列表，
  // 仅含开屏问候的空白草稿对话不污染 RECENT CHATS（当前活动草稿仍可正常输入，发消息后即出现）。
  const orderedSessions = useMemo(() => {
    const interacted = new Set(
      messages.filter((m) => m.role === "user").map((m) => m.sessionId),
    );
    return [...sessions]
      .filter((s) => interacted.has(s.id))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [sessions, messages]);

  // 任务计数（用于 TasksRail 的 views）
  const taskCounts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const effStatus = (d: DdlItem) => d.status ?? (d.completed ? "done" : "todo");
    return {
      all: ddls.length,
      active: ddls.filter((d) => effStatus(d) !== "done").length,
      in_progress: ddls.filter((d) => effStatus(d) === "in_progress").length,
      upcoming: ddls.filter(
        (d) => effStatus(d) !== "done" && d.dueDate && new Date(d.dueDate) >= today,
      ).length,
      completed: ddls.filter((d) => effStatus(d) === "done").length,
    };
  }, [ddls]);

  const handleQuickAction = useCallback((prompt: string) => {
    setInputValue(prompt);
  }, []);

  const handleToggleComplete = useCallback((id: string) => {
    setDdls((prev) => prev.map((d) => {
      if (d.id !== id) return d;
      const next = { ...d, completed: !d.completed };
      // [056] 音效（opt-in 守卫在 playSound 内置）
      playSound(next.completed ? "task-complete" : "task-uncomplete");
      return next;
    }));
  }, []);

  // ---------- 手动 CRUD（TaskEditModal） ----------
  const [editing, setEditing] = useState<EditingTarget | null>(null);
  // 附件预览 modal
  const [previewing, setPreviewing] = useState<DdlAttachment | null>(null);
  // 任务备注 markdown 预览 modal
  const [previewNotes, setPreviewNotes] = useState<DdlItem | null>(null);
  // B1/B3 跨面板跳转：从 Tasks 跳 Notes 时指定要选中的 note
  const [notesSelectId, setNotesSelectId] = useState<string | null>(null);
  // Epic 2.3 快捷键帮助面板
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Epic 3 偏好设置 modal
  const [prefsOpen, setPrefsOpen] = useState(false);
  // #3 成就收藏室 modal
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  // [072] 付费体系：账单面板 / 定价页 / 结账（演示模式）
  const subscription = useSubscription();
  const [billingOpen, setBillingOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutProduct | null>(null);
  // [087] 免费额度耗尽 softwall
  const [quotaWallOpen, setQuotaWallOpen] = useState(false);
  // P5′ 积分不足 softwall（值 = 本次所需积分；功能点直接 set 或广播 CREDITS_WALL_EVENT）
  const [creditsWall, setCreditsWall] = useState<number | null>(null);
  useEffect(() => {
    const onWall = (e: Event) => setCreditsWall((e as CustomEvent<{ need: number }>).detail?.need ?? 0);
    window.addEventListener(CREDITS_WALL_EVENT, onWall);
    return () => window.removeEventListener(CREDITS_WALL_EVENT, onWall);
  }, []);
  // 升级 CTA：先开定价页比价
  const openPricing = useCallback(() => { setBillingOpen(false); setPricingOpen(true); }, []);
  // 定价页选档 → 开结账
  const handleCheckout = useCallback((plan: PlanId, cycle: BillingCycle) => {
    setPricingOpen(false);
    setCheckout({ kind: "plan", plan, cycle });
  }, []);
  // P5′ 积分加油包 → 开结账（pack 模式）
  const handleBuyPack = useCallback((packId: string) => {
    setPricingOpen(false);
    setCheckout({ kind: "pack", packId });
  }, []);
  // 结账成功 → 落订阅/积分 + 账单 + toast（直接读 checkout，勿在 setState updater 里做副作用）
  const handleCheckoutConfirmed = useCallback((card: CardInfo) => {
    if (!checkout) return;
    if (checkout.kind === "pack") {
      const grant = purchasePack(checkout.packId);
      const pack = getPack(checkout.packId);
      if (grant && pack) {
        addInvoice({
          id: grant.id, date: grant.grantedAt, planId: subscription.plan, cycle: "monthly",
          amount: pack.price, status: "paid", kind: "pack", credits: pack.credits,
        });
        playSound("achievement");
        toast.success(`✨ ${t("checkout.packSuccessDesc", { credits: pack.credits })}`);
      }
      return;
    }
    subscribeTo(checkout.plan, checkout.cycle, card);
    playSound("achievement");
    toast.success(`🎉 ${t("checkout.successDesc", { plan: t(getPlanDef(checkout.plan).nameKey) })}`);
  }, [checkout, subscription.plan, toast, t]);
  // 定价页「继续免费」/ 账单「取消订阅」→ 降级
  const handleDowngradeFree = useCallback(() => {
    cancelSubscription();
    setPricingOpen(false);
    toast.info(t("billing.cancelled"));
  }, [toast, t]);
  // C1 CalendarRail 迷你月历跳转目标
  const [calendarJumpDay, setCalendarJumpDay] = useState<string | null>(null);

  // Epic 3 mount 时立即 apply localStorage 偏好(主题/字号/Phase B accent) + [072] 语言
  useEffect(() => { applyStoredPreferences(); applyStoredLang(); }, []);

  // Phase D 布局偏好：mount + 监听 LAYOUT_PREFS_EVENT 同步
  useEffect(() => {
    const sync = () => {
      setTabsOrderState(getTabsOrder());
      setHiddenTabsState(getHiddenTabs());
      setButlerPositionState(getButlerPosition());
    };
    sync();
    window.addEventListener(LAYOUT_PREFS_EVENT, sync);
    return () => window.removeEventListener(LAYOUT_PREFS_EVENT, sync);
  }, []);

  // Phase E 自定义面板：mount + 监听 CUSTOM_PANEL_EVENT 重新加载
  useEffect(() => {
    const sync = async () => {
      try {
        const list = await getAllCustomPanels();
        setCustomPanels(list);
        // 若当前激活的面板被删了 → 退回 chat
        if (activeCustomPanelId && !list.find((p) => p.id === activeCustomPanelId)) {
          setActiveCustomPanelId(null);
        }
      } catch { /* silent */ }
    };
    sync();
    window.addEventListener(CUSTOM_PANEL_EVENT, sync);
    return () => window.removeEventListener(CUSTOM_PANEL_EVENT, sync);
  }, [activeCustomPanelId]);

  // Phase E 创建新面板：建一条 + 立即激活
  const handleCreateCustomPanel = useCallback(async () => {
    try {
      const p = await createCustomPanel(t("pg.newPanel"));
      setActiveCustomPanelId(p.id);
      playSound("panel-create"); // [056]
    } catch (e) {
      toast.error(`创建失败：${(e as Error).message}`);
    }
  }, [toast]);

  // Phase E 更新（防抖在 CustomPanelView 内）
  const handleUpdateCustomPanel = useCallback(async (id: string, patch: Partial<Pick<CustomPanel, "label" | "emoji" | "content" | "kind" | "url" | "modules" | "spec">>) => {
    try { await updateCustomPanel(id, patch); } catch { /* silent */ }
  }, []);

  // Phase E 删除：清除 active + 退回 chat
  const handleDeleteCustomPanel = useCallback(async (id: string) => {
    try {
      await deleteCustomPanel(id);
      if (activeCustomPanelId === id) {
        setActiveCustomPanelId(null);
        setActiveNav("chat");
      }
      toast.success("已删除面板");
    } catch (e) {
      toast.error(`删除失败：${(e as Error).message}`);
    }
  }, [activeCustomPanelId, toast]);

  // G2.1 streak 状态(显示给 TodayHero)
  const [streakDays, setStreakDays] = useState(0);
  // [065] 每日仪式 · 今日简报：每天首次打开显示一次
  const [showDailyBrief, setShowDailyBrief] = useState(false);
  const BRIEF_KEY = "butler.brief.lastSeen";
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const markBriefSeen = useCallback(() => {
    try { localStorage.setItem(BRIEF_KEY, todayKey()); } catch { /* silent */ }
  }, []);
  const dismissDailyBrief = useCallback(() => {
    markBriefSeen();
    setShowDailyBrief(false);
  }, [markBriefSeen]);
  const handleStartFocus = useCallback(() => {
    markBriefSeen();
    setShowDailyBrief(false);
    setActiveNav("chat");
    setMiniAppsOpen(true); // 打开学习工具抽屉（含专注计时）
  }, [markBriefSeen]);

  // G5.2 学习习惯识别:基于 messages 时间戳 + ddls.dueTime 派生「最佳时段」
  const bestHourLabel = useMemo(() => {
    if (!hydrated) return null;
    const buckets: Record<string, number> = { earlyMorning: 0, morning: 0, noon: 0, afternoon: 0, evening: 0, night: 0, dawn: 0 };
    const classify = (h: number) =>
      h < 6 ? "dawn" : h < 9 ? "earlyMorning" : h < 12 ? "morning" : h < 14 ? "noon" : h < 17 ? "afternoon" : h < 19 ? "evening" : h < 23 ? "night" : "dawn";
    for (const m of messages) {
      if (m.role !== "user") continue;
      const ts = m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp as unknown as string);
      const h = ts.getHours();
      buckets[classify(h)]++;
    }
    const total = Object.values(buckets).reduce((a, b) => a + b, 0);
    if (total < 5) return null; // 样本不足
    const top = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
    if (!top || top[1] < 2) return null;
    return t(`pg.bucket.${top[0]}`);
  }, [hydrated, messages, t]);
  // G2.1 hydrate 后 touchStreak;若是新一天 toast 一下
  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      const { touchStreak } = await import("@/lib/streak");
      const { newDay, broken, state } = touchStreak();
      setStreakDays(state.currentDays);
      if (newDay && state.currentDays > 1 && !broken) {
        toast.success(t("pg.streakToast", { n: state.currentDays }), { duration: 5000 });
      } else if (newDay && broken) {
        toast.info(t("pg.welcomeBack"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // [079] 周期任务：hydrate 后跑一次 materialize（生成当期实例）+ 每 10 分钟兜底
  //（跨午夜/跨周长开着的会话也能续期）。增删/启用由各 mutation 显式调 runMaterialize，
  //  不走事件监听，避免与 putRecurring 的并发二次生成竞态。
  useEffect(() => {
    if (!hydrated) return;
    runMaterialize();
    const interval = setInterval(runMaterialize, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [hydrated, runMaterialize]);

  // [065] 每日仪式：hydrate 后，若今天还没看过简报则显示一次
  useEffect(() => {
    if (!hydrated) return;
    try {
      const lastSeen = localStorage.getItem(BRIEF_KEY);
      if (lastSeen !== todayKey()) setShowDailyBrief(true);
    } catch { /* silent */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // G2.2 成就解锁检测:ddls/notes/streak 变化时跑
  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      const { detectNewUnlocks, getUnlockedSet, saveUnlockedSet, ACHIEVEMENTS } = await import("@/lib/streak");
      const unlocked = getUnlockedSet();
      const ctx = {
        ddlsTotal: ddls.length,
        ddlsDone: ddls.filter((d) => d.completed || (d.status ?? "todo") === "done").length,
        notesTotal: notes.length,
        streakDays,
        longestStreak: streakDays,
      };
      const newly = detectNewUnlocks(ctx, unlocked);
      if (newly.length === 0) return;
      for (const a of newly) unlocked.add(a.id);
      saveUnlockedSet(unlocked);
      // 弹解锁 Toast(每个 0.5s 错开)
      newly.forEach((a, i) => {
        setTimeout(() => {
          toast.success(`${a.emoji} 解锁成就「${a.label}」— ${a.desc}`, { duration: 6000 });
        }, i * 500);
      });
      void ACHIEVEMENTS; // 仅为静默 lint
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, ddls, notes, streakDays]);

  // A1.2 本地数据源注册：把真实 ddls/notes/sessions/streak 扁平成「面板友好行」
  // 灌入 panel-local 注册表，供 kind:"local" 数据源消费（"我本月 DDL 完成率"等面板）
  useEffect(() => {
    setLocalDataset("ddls", ddls.map((d) => ({
      title: d.taskName,
      completed: d.completed || d.status === "done",
      status: d.status ?? (d.completed ? "done" : "todo"),
      priority: d.priority ?? "",
      dueDate: d.dueDate,
      weight: d.weight ?? 0,
      isGroupWork: d.isGroupWork,
      tags: (d.tags ?? []).join(","),
    })));
  }, [ddls]);
  useEffect(() => {
    setLocalDataset("notes", notes.map((n) => ({
      title: n.title,
      wordCount: n.content.length,
      pinned: Boolean(n.pinned),
      tags: (n.tags ?? []).join(","),
      updatedAt: n.updatedAt,
      createdAt: n.createdAt,
    })));
  }, [notes]);
  useEffect(() => {
    setLocalDataset("sessions", sessions.map((s) => ({
      title: s.title,
      messageCount: messages.filter((m) => m.sessionId === s.id).length,
      updatedAt: s.updatedAt,
    })));
  }, [sessions, messages]);
  useEffect(() => {
    setLocalDataset("streak", [{ current: streakDays, longest: streakDays }]);
  }, [streakDays]);

  // B3 全局搜索跳转后高亮目标（每次设置 2s 后自动清空,触发 CSS 闪烁动画）
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Epic 2 全局快捷键:⌘N 新建当前 Tab 项 / ? 快捷键帮助 / Esc 关一切
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target?.tagName?.toLowerCase();
      const isInput = tag === "input" || tag === "textarea" || target?.isContentEditable;

      // ⌘N / Ctrl+N: 新建当前 Tab 项
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        if (activeNav === "chat") handleNewChat();
        else if (activeNav === "tasks") setEditing({ mode: "create" });
        else if (activeNav === "calendar") setEditing({ mode: "create" });
        else if (activeNav === "notes") {
          const fresh = handleCreateNote();
          setNotesSelectId(fresh.id);
        }
        return;
      }
      // Esc: 兜底关闭层级最高的浮层
      if (e.key === "Escape") {
        if (shortcutsOpen) { setShortcutsOpen(false); return; }
        if (previewNotes) { setPreviewNotes(null); return; }
        if (previewing) { setPreviewing(null); return; }
        if (editing) { setEditing(null); return; }
        if (miniAppsOpen) { setMiniAppsOpen(false); return; }
        return;
      }
      // ?: 帮助面板（非输入框）
      if (!isInput && e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeNav, shortcutsOpen, previewNotes, previewing, editing, miniAppsOpen, handleNewChat, handleCreateNote]);

  // B3 搜索结果点击：根据 target 类型切 Tab + 设置高亮 / 选中
  const handleSearchJump = useCallback((target: NavId, refId?: string) => {
    setActiveNav(target);
    if (!refId) return;
    if (target === "tasks") {
      // 清旧 timer + 设置新 highlight + 2s 后清空
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      setHighlightTaskId(refId);
      highlightTimerRef.current = setTimeout(() => setHighlightTaskId(null), 2000);
    } else if (target === "notes") {
      setNotesSelectId(refId);
    } else if (target === "chat") {
      setActiveSessionId(refId);
    }
  }, []);

  // ---------- B1 跨面板：任务↔笔记关联 handlers ----------
  // 创建空笔记 + 立即关联到任务 + 切到 Notes Tab 并选中新笔记
  const handleCreateLinkedNote = useCallback((taskId: string) => {
    const task = ddlsRef.current.find((d) => d.id === taskId);
    if (!task) return;
    const now = Date.now();
    const fresh: Note = {
      id: "note-" + uid(),
      title: task.taskName, // 默认用任务名作为笔记标题
      content: `# ${task.taskName}\n\n`,
      createdAt: now,
      updatedAt: now,
    };
    setNotes((prev) => [fresh, ...prev]);
    setDdls((prev) => prev.map((d) => (d.id === taskId ? { ...d, noteId: fresh.id } : d)));
    setEditing(null); // 关闭抽屉
    setNotesSelectId(fresh.id);
    setActiveNav("notes");
  }, []);

  // 跳到 Notes 并打开指定 note
  const handleJumpToNote = useCallback((noteId: string) => {
    setEditing(null);
    setNotesSelectId(noteId);
    setActiveNav("notes");
  }, []);

  // 解除关联（不删笔记）
  const handleUnlinkNote = useCallback((taskId: string) => {
    setDdls((prev) => prev.map((d) => (d.id === taskId ? { ...d, noteId: undefined } : d)));
  }, []);

  // 从 Notes 跳到 Tasks 并打开 TaskDetailDrawer
  const handleJumpToTask = useCallback((taskId: string) => {
    const target = ddlsRef.current.find((d) => d.id === taskId);
    if (!target) return;
    setActiveNav("tasks");
    setEditing({ mode: "edit", item: target });
  }, []);

  // C4 拖动改时间:快速 patch dueDate + dueTime（不走 TaskDetailDrawer）
  const handleMoveEvent = useCallback((id: string, newDate: string, newTime: string) => {
    setDdls((prev) => prev.map((d) => (d.id === id ? { ...d, dueDate: newDate, dueTime: newTime } : d)));
    toast.info(`已移动到 ${newDate} ${newTime}`);
  }, [toast]);

  // G1.1 一键填入 Demo 数据(激活新用户;支持 Undo)
  const handleLoadDemo = useCallback(async () => {
    const { buildDemoData } = await import("@/lib/demo-data");
    const { ddls: demoDdls, notes: demoNotes } = buildDemoData();
    const prevDdls = ddlsRef.current;
    const prevNotes = notes;
    setDdls((p) => [...p, ...demoDdls]);
    setNotes((p) => [...demoNotes, ...p]);
    toast.success(`已加入 ${demoDdls.length} 个示例任务 + ${demoNotes.length} 篇笔记`, {
      duration: 8000,
      action: {
        label: t("pg.undo"),
        onClick: () => {
          setDdls(prevDdls);
          setNotes(prevNotes);
        },
      },
    });
  }, [notes, toast]);

  // B4 笔记 `- [ ] todo` 自动同步到 Tasks（单向）
  // 1. 为每个新 todo 创建一个 task,默认 dueDate="待定",source="笔记自动同步"
  // 2. task.noteId 自动关联回这个笔记
  // 3. 更新 note.syncedTodos 防重复
  const handleAutoExtractTodos = useCallback((noteId: string, newTodos: string[]) => {
    if (newTodos.length === 0) return;
    const newTasks: DdlItem[] = newTodos.map((text) => ({
      id: uid(),
      taskName: text,
      weight: null,
      dueDate: "",
      dueTime: "23:59",
      description: "",
      isGroupWork: false,
      source: "笔记自动同步",
      completed: false,
      status: "todo",
      noteId,
    }));
    setDdls((prev) => [...prev, ...newTasks]);
    // 把这些 todo 文本加入笔记的 syncedTodos
    setNotes((prev) => prev.map((n) => {
      if (n.id !== noteId) return n;
      return { ...n, syncedTodos: [...(n.syncedTodos ?? []), ...newTodos] };
    }));
    console.log(`[B4] auto-synced ${newTodos.length} todo(s) from note ${noteId}`);
  }, []);

  // #16 推荐每日任务：一键直接创建（不开编辑器），落今天 DDL
  const handleQuickAddTask = useCallback((title: string) => {
    const d = new Date();
    const todayIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setDdls((prev) => [...prev, {
      id: uid(),
      taskName: title,
      weight: null,
      dueDate: todayIso,
      dueTime: "23:59",
      description: "",
      isGroupWork: false,
      source: "推荐任务",
      completed: false,
      status: "todo",
    }]);
    toast.success(`已添加：${title}`);
    playSound("panel-create");
  }, [toast]);

  const handleSubmitEdit = useCallback((data: FormPayload) => {
    // 计算被移除的 blob 附件，编辑后清理孤立 blob
    if (editing?.mode === "edit") {
      const oldBlobIds = (editing.item.attachments ?? []).filter((a) => a.kind === "blob").map((a) => a.ref);
      const newBlobIds = new Set(data.attachments.filter((a) => a.kind === "blob").map((a) => a.ref));
      const orphans = oldBlobIds.filter((id) => !newBlobIds.has(id));
      if (orphans.length > 0) {
        import("@/lib/blobs").then(({ deleteBlobs }) => deleteBlobs(orphans));
      }
    }
    // status 同步 completed：status="done" → completed=true，否则 false
    const completed = data.status === "done";
    setDdls((prev) => {
      if (editing?.mode === "edit") {
        return prev.map((d) => d.id === editing.item.id ? { ...d, ...data, completed } : d);
      }
      return [...prev, { ...data, id: uid(), completed, source: "手动添加" }];
    });
    setEditing(null);
  }, [editing]);

  const handleDeleteDdl = useCallback((id: string) => {
    // 任务删除时连带清理它的 blob 附件
    const target = ddlsRef.current.find((d) => d.id === id);
    if (!target) return;
    // 注意:暂不立刻清 blob — 等 5s 撤销窗口过后再清。简化版:撤销不恢复 blob（已存的 ref 仍有效）
    setDdls((prev) => prev.filter((d) => d.id !== id));
    setEditing(null);
    toast.success(`已删除任务「${target.taskName}」`, {
      action: {
        label: t("pg.undo"),
        onClick: () => setDdls((prev) => [...prev, target]),
      },
    });
  }, [toast]);

  // ---------- 导出/导入 ----------
  const handleExportIcs = useCallback(async () => {
    const { downloadIcs } = await import("@/lib/ics-export");
    const r = downloadIcs(ddlsRef.current);
    if (r.count === 0) {
      toast.warning("当前没有可导出的事件（待定任务会被跳过）");
    } else {
      toast.success(`已导出 ${r.count} 条事件为 .ics`);
    }
  }, [toast]);

  const handleExportJson = useCallback(async () => {
    const { exportToJson } = await import("@/lib/json-export");
    exportToJson(ddlsRef.current);
    toast.success(`已导出 ${ddlsRef.current.length} 条任务为 .json`);
  }, [toast]);

  // G1.4 导入 .ics 课表文件 → 批量创建任务
  const handleImportIcs = useCallback(async () => {
    const { pickIcsFile, parseIcs, icsEventsToDdls } = await import("@/lib/ics-import");
    const file = await pickIcsFile();
    if (!file) return;
    try {
      const text = await file.text();
      const events = parseIcs(text);
      if (events.length === 0) {
        toast.warning("没有从 .ics 文件中解析到事件");
        return;
      }
      const newDdls = icsEventsToDdls(events, file.name);
      const prevSnap = ddlsRef.current;
      setDdls((p) => [...p, ...newDdls]);
      toast.success(`已导入 ${newDdls.length} 个事件来自「${file.name}」`, {
        duration: 8000,
        action: { label: "撤销", onClick: () => setDdls(prevSnap) },
      });
    } catch (e) {
      toast.error("解析 .ics 失败:" + (e instanceof Error ? e.message : String(e)));
    }
  }, [toast]);

  const handleImportJson = useCallback(async () => {
    const { pickJsonFile, importFromFile } = await import("@/lib/json-export");
    const file = await pickJsonFile();
    if (!file) return;
    const r = await importFromFile(file, ddlsRef.current);
    if (r.ok !== true) { toast.error("导入失败:" + r.error); return; }
    setDdls(r.merged);
    toast.success(`导入完成:新增 ${r.added} 条,更新 ${r.updated} 条`);
  }, [toast]);

  // ---------- 渲染 ----------
  // 左栏二级导航内容（桌面常驻胶囊 / 手机抽屉复用同一份）
  const railContent = (
    <LeftRail>
      {!activeCustomPanelId && activeNav === "chat" && (
        <ChatRail
          sessions={orderedSessions}
          activeId={activeSessionId}
          onCreate={handleNewChat}
          onSelect={handleSelectSession}
          onRename={handleRenameSession}
          onDelete={handleDeleteSession}
        />
      )}
      {!activeCustomPanelId && activeNav === "tasks" && (
        <TasksRail
          onCreateTask={() => setEditing({ mode: "create" })}
          counts={taskCounts}
          view={taskView}
          onSelectView={setTaskView}
        />
      )}
      {!activeCustomPanelId && activeNav === "calendar" && (
        <CalendarRail
          onCreateEvent={() => setEditing({ mode: "create" })}
          ddls={ddls}
          onJumpToDay={(iso) => {
            setCalendarJumpDay(iso + "#" + Date.now());
          }}
        />
      )}
      {!activeCustomPanelId && activeNav === "notes" && (
        <NotesRail notes={notes} onCreate={handleCreateNote} />
      )}
    </LeftRail>
  );

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        maxWidth: isMobile ? undefined : 1600,
        margin: isMobile ? undefined : "0 auto",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "transparent",
        padding: isMobile ? "8px 8px 72px" : 12,
        gap: isMobile ? 8 : 12,
      }}
    >
      {/* [066] 壁纸层（固定全屏，在玻璃胶囊之后；无壁纸则露出 body 网格底）*/}
      <WallpaperLayer />

      {/* 顶 Bar（悬浮胶囊条）*/}
      <TopBar
        isMobile={isMobile}
        activeNav={activeNav}
        onNavChange={(id) => { setActiveNav(id); setActiveCustomPanelId(null); }}
        miniAppsOpen={miniAppsOpen}
        onToggleMiniApps={() => setMiniAppsOpen((v) => !v)}
        ddls={ddls}
        notes={notes}
        messages={messages}
        onSearchJump={handleSearchJump}
        onOpenPreferences={() => setPrefsOpen(true)}
        onOpenAchievements={() => setAchievementsOpen(true)}
        onOpenBilling={() => setBillingOpen(true)}
        onUpgrade={openPricing}
        tabsOrder={tabsOrder}
        hiddenTabs={hiddenTabs}
        onTabsReorder={(newOrder) => setTabsOrder(newOrder)}
        customPanels={customPanels}
        activeCustomPanelId={activeCustomPanelId}
        onSelectCustomPanel={(id) => setActiveCustomPanelId(id)}
        onCreateCustomPanel={handleCreateCustomPanel}
      />

      {/* 学习工具抽屉（fixed 浮在右侧，不阻塞主区操作） */}
      <MiniAppsDrawer
        open={miniAppsOpen}
        onClose={() => setMiniAppsOpen(false)}
        ddls={ddls}
        onAppendTaskNote={(taskId, line) => {
          setDdls((prev) => prev.map((d) => {
            if (d.id !== taskId) return d;
            const oldNotes = d.notes ?? "";
            const newNotes = oldNotes ? `${oldNotes}\n${line}` : line;
            return { ...d, notes: newNotes };
          }));
          toast.info(`已追加到任务备注`);
        }}
      />

      {/* 主体：左栏 + 内容区（两个独立悬浮胶囊仓，互留间隙）*/}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", gap: isMobile ? 0 : 12 }}>
        {/* 左栏：桌面常驻胶囊；手机 fixed 抽屉（点底部菜单滑入，点遮罩关）*/}
        {isMobile ? (
          <>
            {mobileNavOpen && (
              <div
                onClick={() => setMobileNavOpen(false)}
                style={{ position: "fixed", inset: 0, background: "var(--color-overlay)", zIndex: 46 }}
              />
            )}
            <div
              ref={mobileDrawerRef}
              style={{
                position: "fixed",
                top: 8,
                left: 8,
                bottom: 8,
                width: 240,
                zIndex: 47,
                transform: mobileNavOpen ? "translateX(0)" : "translateX(-110%)",
                transition: "transform 0.3s cubic-bezier(.4,0,.2,1)",
              }}
            >
              {railContent}
            </div>
          </>
        ) : (
          railContent
        )}

        <main
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            borderRadius: "var(--radius-card)",
            border: "1px solid var(--glass-border)",
            background: "var(--glass-bg)",
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)",
            boxShadow: "var(--shadow-card-hover)",
          }}
        >
          {!activeCustomPanelId && activeNav === "chat" && (
            <ChatCanvas
              messages={visibleMessages}
              pipelines={pipelines}
              pendingBatches={pendingBatches}
              butlerPose={butlerPose}
              onAcceptBatch={handleAcceptBatch}
              onRejectBatch={handleRejectBatch}
              onDropChange={handleDropChange}
              onQuickAction={handleQuickAction}
              isLoading={isLoading}
              onJumpToTasks={() => setActiveNav("tasks")}
              onJumpToCalendar={() => setActiveNav("calendar")}
              inputValue={inputValue}
              onInputChange={setInputValue}
              onSend={handleSend}
              onStop={handleStopGeneration}
              onRegenerate={handleRegenerate}
              attachedFiles={attachedFiles}
              onAttach={handleAttach}
              onRemoveAttachment={handleRemoveAttachment}
              selectedModel={selectedModel}
              onSelectModel={handleSelectModel}
              ddls={ddls}
              onJumpToTask={handleJumpToTask}
              onLoadDemo={handleLoadDemo}
              hasAnyData={ddls.length > 0 || notes.length > 0}
              streakDays={streakDays}
              bestHourLabel={bestHourLabel}
              butlerPosition={butlerPosition}
              onStartFocus={handleStartFocus}
            />
          )}
          {!activeCustomPanelId && activeNav === "tasks" && (
            <TasksPanel
              ddls={ddls}
              view={taskView}
              onToggleComplete={handleToggleComplete}
              onRequestCreate={() => setEditing({ mode: "create" })}
              onQuickAdd={handleQuickAddTask}
              onRequestEdit={(d) => setEditing({ mode: "edit", item: d })}
              onRequestDelete={handleDeleteDdl}
              onRequestPreview={(a) => setPreviewing(a)}
              onRequestNotesPreview={(d) => setPreviewNotes(d)}
              onExportIcs={handleExportIcs}
              onExportJson={handleExportJson}
              onImportJson={handleImportJson}
              onImportIcs={handleImportIcs}
              onOpenRecurring={() => setRecurringOpen(true)}
              highlightTaskId={highlightTaskId}
            />
          )}
          {!activeCustomPanelId && activeNav === "calendar" && (
            <CalendarPanel
              ddls={ddls}
              onRequestCreate={(presetDate, presetTime) => setEditing({ mode: "create", presetDate, presetTime })}
              onRequestEdit={(d) => setEditing({ mode: "edit", item: d })}
              jumpToDay={calendarJumpDay ? calendarJumpDay.split("#")[0] : null}
              onMoveEvent={handleMoveEvent}
            />
          )}
          {!activeCustomPanelId && activeNav === "notes" && (
            <NotesPanel
              notes={notes}
              onCreate={handleCreateNote}
              onUpdate={handleUpdateNote}
              onDelete={handleDeleteNote}
              ddls={ddls}
              selectActiveId={notesSelectId}
              onJumpToTask={handleJumpToTask}
              onAutoExtractTodos={handleAutoExtractTodos}
            />
          )}

          {/* Phase E 自定义面板：activeCustomPanelId 设置时盖过所有内置面板 */}
          {activeCustomPanelId && (() => {
            const panel = customPanels.find((p) => p.id === activeCustomPanelId);
            if (!panel) return null;
            return (
              <CustomPanelView
                key={panel.id}
                panel={panel}
                onUpdate={handleUpdateCustomPanel}
                onDelete={handleDeleteCustomPanel}
                dataCtx={{
                  ddls,
                  notes,
                  streakCurrent: streakDays,
                  streakLongest: streakDays,
                }}
              />
            );
          })()}

        </main>
      </div>

      {/* 手机底部主导航 tab bar（替代 TopBar pill-nav）*/}
      {isMobile && (
        <MobileTabBar
          activeNav={activeNav}
          inCustomPanel={!!activeCustomPanelId}
          onNavChange={(id) => { setActiveNav(id); setActiveCustomPanelId(null); }}
          onOpenNav={() => setMobileNavOpen(true)}
        />
      )}

      {/* ── 浮层全部 Portal 到 body：逃离胶囊面板的 overflow/backdrop-filter，避免被截断 ── */}
      <Portal>
        {editing && (
          <TaskDetailDrawer
            target={editing}
            onCancel={() => setEditing(null)}
            onSubmit={handleSubmitEdit}
            onDelete={handleDeleteDdl}
            linkedNote={
              editing.mode === "edit" && editing.item.noteId
                ? notes.find((n) => n.id === editing.item.noteId) ?? null
                : null
            }
            onCreateLinkedNote={handleCreateLinkedNote}
            onJumpToNote={handleJumpToNote}
            onUnlinkNote={handleUnlinkNote}
          />
        )}

        {previewing && (
          <AttachmentPreview attachment={previewing} onClose={() => setPreviewing(null)} />
        )}

        {previewNotes && (
          <NotesPreview
            title={previewNotes.taskName}
            notes={previewNotes.notes ?? ""}
            onClose={() => setPreviewNotes(null)}
          />
        )}

        {/* Epic 2.3 快捷键帮助面板（? 触发） */}
        <KeyboardShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        {/* Epic 3 偏好设置 modal */}
        <PreferencesPanel open={prefsOpen} onClose={() => setPrefsOpen(false)} />
        {/* #3 成就收藏室 */}
        <AchievementsRoom
          open={achievementsOpen}
          onClose={() => setAchievementsOpen(false)}
          ctx={{
            ddlsTotal: ddls.length,
            ddlsDone: ddls.filter((d) => d.completed).length,
            notesTotal: notes.length,
            streakDays,
            longestStreak: streakDays,
          }}
        />
        {/* [072] 付费体系：账单管理 / 定价页 / 模拟结账（演示模式） */}
        <BillingPanel
          open={billingOpen}
          onClose={() => setBillingOpen(false)}
          onViewPlans={openPricing}
          onBuyPack={openPricing}
          onCancelled={() => toast.info(t("billing.cancelled"))}
        />
        <PricingModal
          open={pricingOpen}
          onClose={() => setPricingOpen(false)}
          subscription={subscription}
          onCheckout={handleCheckout}
          onBuyPack={handleBuyPack}
          onDowngradeFree={handleDowngradeFree}
        />
        <CheckoutModal
          open={checkout !== null}
          product={checkout}
          onClose={() => setCheckout(null)}
          onConfirmed={handleCheckoutConfirmed}
        />
        {/* softwall：[087] 免费窗口耗尽（切 Flash / 加油包 / 会员）+ P5′ 积分不足（加油包 / 会员）*/}
        <QuotaWallModal
          open={quotaWallOpen || creditsWall !== null}
          mode={creditsWall !== null ? "credits" : "window"}
          creditsNeed={creditsWall ?? 0}
          resetAt={getNextResetAt()}
          canFallbackFlash={selectedModel !== "deepseek-v4-flash"}
          onSwitchFlash={() => { handleSelectModel("deepseek-v4-flash"); setQuotaWallOpen(false); setCreditsWall(null); }}
          onTopUp={() => { setQuotaWallOpen(false); setCreditsWall(null); openPricing(); }}
          onUpgrade={() => { setQuotaWallOpen(false); setCreditsWall(null); openPricing(); }}
          onClose={() => { setQuotaWallOpen(false); setCreditsWall(null); }}
        />

        {/* [079] 周期任务管理 */}
        <RecurringTasksManager
          open={recurringOpen}
          onClose={() => setRecurringOpen(false)}
          onChanged={runMaterialize}
        />

        {/* G1.3 首次使用 Tour(自动检测 localStorage) */}
        <OnboardingTour />
      </Portal>
    </div>
  );
}
