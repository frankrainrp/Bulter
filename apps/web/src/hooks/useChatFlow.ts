"use client";

import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { getStoredPersonality } from "@/components/PreferencesPanel";
import { useToast } from "@/components/Toast";
import type { AiModelId } from "@/lib/ai-models";
import { streamChat, type ApiMessage, type StreamOptions } from "@/lib/chat-client";
import {
  canAfford,
  creditCostOf,
  isPremiumModel,
  spendCredits,
} from "@/lib/credits";
import { playSound } from "@/lib/sound";
import type { ChatMessage, ChatSession, DdlItem, UploadedFile } from "@/lib/types";
import { canSpend } from "@/lib/usage";

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
const HISTORY_LIMIT = 10;

// Chat send orchestration lives here so page.tsx only wires state and UI.
// This hook owns quota/credit gates, attachment pipeline handoff, streaming
// assistant messages, tool-call callbacks, cancellation, and regeneration.
interface UseChatFlowArgs {
  activeSessionIdRef: MutableRefObject<string | null>;
  ddlsRef: MutableRefObject<DdlItem[]>;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setSessions: Dispatch<SetStateAction<ChatSession[]>>;
  attachedFiles: UploadedFile[];
  setAttachedFiles: Dispatch<SetStateAction<UploadedFile[]>>;
  runRealPipeline: (file: UploadedFile) => Promise<void>;
  executeToolCall: StreamOptions["executeToolCall"];
  selectedModel: AiModelId;
  openQuotaWall: () => void;
  openCreditsWall: (need: number) => void;
  resetCurrentBatch: () => void;
}

function buildContextSummary(items: DdlItem[]): string {
  if (items.length === 0) return "The user currently has no tasks or events.";

  const sorted = [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const cap = sorted.slice(0, 20);
  const lines = cap.map((d) => {
    const flags: string[] = [];
    if (d.completed) flags.push("done");
    if (d.isGroupWork) flags.push("group");
    if (d.weight != null) flags.push(`${d.weight}%`);
    const tag = flags.length ? ` [${flags.join(" ")}]` : "";
    return `- (id=${d.id}) ${d.taskName} - ${d.dueDate} ${d.dueTime}${tag}`;
  });
  const tail = items.length > 20 ? `\n(showing the latest 20 of ${items.length})` : "";
  return `Current task/event list:\n${lines.join("\n")}${tail}`;
}

export function useChatFlow({
  activeSessionIdRef,
  ddlsRef,
  messages,
  setMessages,
  setSessions,
  attachedFiles,
  setAttachedFiles,
  runRealPipeline,
  executeToolCall,
  selectedModel,
  openQuotaWall,
  openCreditsWall,
  resetCurrentBatch,
}: UseChatFlowArgs) {
  const toast = useToast();
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Keep chat titles lightweight: the first non-empty user prompt or file name
  // becomes the session title, while later sends only refresh updatedAt.
  const touchActiveSession = useCallback((titleHint?: string) => {
    const sid = activeSessionIdRef.current;
    if (!sid) return;

    setSessions((prev) => prev.map((session) => {
      if (session.id !== sid) return session;
      const next: ChatSession = { ...session, updatedAt: Date.now() };
      if (titleHint && session.title === "") {
        const title = titleHint.trim().slice(0, 24);
        if (title) next.title = title;
      }
      return next;
    }));
  }, [activeSessionIdRef, setSessions]);

  const handleSend = useCallback(async () => {
    const content = inputValue.trim();
    if (!content && attachedFiles.length === 0) return;
    if (isLoading) return;

    const sid = activeSessionIdRef.current;
    if (!sid) return;

    if (!canSpend()) {
      openQuotaWall();
      return;
    }

    const premiumCost = isPremiumModel(selectedModel) ? creditCostOf("chatPremium", selectedModel) : 0;
    if (premiumCost > 0 && !canAfford(premiumCost)) {
      openCreditsWall(premiumCost);
      return;
    }

    // Snapshot attachments before clearing input state; the async pipeline must
    // keep the exact File objects the user submitted in this send action.
    const filesSnapshot = attachedFiles;
    const userUiMsg: ChatMessage = {
      id: uid(),
      sessionId: sid,
      role: "user",
      content,
      files: filesSnapshot.length > 0 ? filesSnapshot : undefined,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userUiMsg]);
    touchActiveSession(content || filesSnapshot[0]?.name);
    playSound("send");
    setInputValue("");
    setAttachedFiles([]);

    // File uploads are processed by the document pipeline and produce review
    // batches. They intentionally do not also call the chat streaming endpoint.
    if (filesSnapshot.length > 0) {
      filesSnapshot.forEach((file) => {
        void runRealPipeline(file);
      });
      return;
    }

    if (premiumCost > 0) spendCredits(premiumCost, "chatPremium");
    setIsLoading(true);
    resetCurrentBatch();

    // Send only compact user/assistant turns to the model. Tool/pipeline/confirm
    // UI messages are local workflow artifacts, not model conversation history.
    const allHistory: ApiMessage[] = [...messages, userUiMsg]
      .filter((message) => (
        message.sessionId === sid
        && (message.role === "user" || message.role === "assistant")
        && message.content
      ))
      .map((message) => ({ role: message.role as "user" | "assistant", content: message.content }));

    let trimmed = allHistory.slice(-HISTORY_LIMIT);
    while (trimmed.length > 0 && trimmed[0].role !== "user") {
      trimmed = trimmed.slice(1);
    }
    const historyApi = trimmed;
    if (allHistory.length > historyApi.length) {
      console.log(`[chat] history truncated: ${allHistory.length} -> ${historyApi.length}`);
    }

    let currentAssistantId: string | null = null;
    // Streaming content and reasoning deltas may arrive before a full assistant
    // message is finalized, so create one UI message lazily and append deltas.
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
        return;
      }

      const id = currentAssistantId;
      setMessages((prev) => prev.map((message) => {
        if (message.id !== id) return message;
        const next = { ...message };
        if (patch.content) next.content = message.content + patch.content;
        if (patch.reasoning) next.reasoning = (message.reasoning ?? "") + patch.reasoning;
        return next;
      }));
    };

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
          onContentDelta: (delta) => {
            ensureAssistant({ content: delta });
          },
          onReasoningDelta: (delta) => {
            ensureAssistant({ reasoning: delta });
          },
          onAssistantMessage: () => {
            currentAssistantId = null;
          },
          onToolCallStart: (call) => {
            console.log("[tool] start", call.function.name, call.function.arguments);
            const labels: Record<string, string> = {
              create_item: "Drafting a new task",
              update_item: "Drafting a task update",
              delete_item: "Preparing a delete draft",
              toggle_complete: "Toggling completion",
              list_items: "Reading the task list",
              create_note: "Drafting a note",
              list_notes: "Reading the note list",
              update_note: "Updating a note",
              delete_note: "Deleting a note",
              create_custom_panel: "Drafting a custom panel",
              create_recurring_task: "Creating a recurring task",
            };
            const label = labels[call.function.name] ?? `Calling ${call.function.name}`;
            toast.info(`⚙ Butler ${label}...`, { id: "ai-tool-call", duration: 1500 });
          },
          onToolCallEnd: (call, result) => {
            console.log("[tool] end", call.function.name, result);
          },
          onError: (err) => {
            setMessages((prev) => [
              ...prev,
              {
                id: uid(),
                sessionId: sid,
                role: "assistant",
                content: `❌ Error: ${err.message}`,
                isError: true,
                timestamp: new Date(),
              },
            ]);
          },
        },
      });
      playSound("ai-reply");
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError" && err.name !== "DOMException") {
        console.warn("[chat] streamChat error:", err);
      }
    } finally {
      setIsLoading(false);
      resetCurrentBatch();
      abortRef.current = null;
    }
  }, [
    activeSessionIdRef,
    attachedFiles,
    ddlsRef,
    executeToolCall,
    inputValue,
    isLoading,
    messages,
    openCreditsWall,
    openQuotaWall,
    resetCurrentBatch,
    runRealPipeline,
    selectedModel,
    setAttachedFiles,
    setMessages,
    toast,
    touchActiveSession,
  ]);

  const handleStopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleRegenerate = useCallback((assistantMessageId: string) => {
    if (isLoading) return;

    const sid = activeSessionIdRef.current;
    if (!sid) return;

    const idx = messages.findIndex((message) => message.id === assistantMessageId);
    if (idx < 0) return;

    let userIdx = -1;
    for (let i = idx - 1; i >= 0; i -= 1) {
      if (messages[i].sessionId === sid && messages[i].role === "user") {
        userIdx = i;
        break;
      }
    }
    if (userIdx < 0) return;

    const userContent = messages[userIdx].content;
    setMessages((prev) => prev.slice(0, userIdx));
    setInputValue(userContent);

    setTimeout(() => {
      const btn = document.querySelector("#send-btn") as HTMLButtonElement | null;
      btn?.click();
    }, 50);
  }, [activeSessionIdRef, isLoading, messages, setMessages]);

  return {
    inputValue,
    setInputValue,
    isLoading,
    handleSend,
    handleStopGeneration,
    handleRegenerate,
  };
}
