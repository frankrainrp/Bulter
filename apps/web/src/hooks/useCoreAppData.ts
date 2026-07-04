"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  GetChatHistoryByApi,
  GetNoteListByApi,
  GetTaskListByApi,
  ReplaceChatHistoryByApi,
  ReplaceNoteListByApi,
  ReplaceTaskListByApi,
} from "@/lib/backend-api";
import type { ChatMessage, ChatSession, DdlItem, Note } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

function makeFreshSession(): ChatSession {
  const now = Date.now();
  return {
    id: "sess-" + uid(),
    title: "",
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeMessages(
  rows: Array<Omit<ChatMessage, "timestamp"> & { timestamp: string | Date }>,
): ChatMessage[] {
  return rows.map((message) => ({
    ...message,
    timestamp: message.timestamp instanceof Date
      ? message.timestamp
      : new Date(message.timestamp as unknown as string),
  }));
}

function toPersistableMessages(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      id: message.id,
      sessionId: message.sessionId,
      role: message.role,
      content: message.content,
      files: message.files?.map((file) => ({
        id: file.id,
        name: file.name,
        size: file.size,
        mime: file.mime,
        blobId: file.blobId,
      })),
      reasoning: message.reasoning,
      isError: message.isError,
      timestamp: message.timestamp,
    }));
}

interface CoreAppData {
  hydrated: boolean;
  ddls: DdlItem[];
  setDdls: Dispatch<SetStateAction<DdlItem[]>>;
  notes: Note[];
  setNotes: Dispatch<SetStateAction<Note[]>>;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  sessions: ChatSession[];
  setSessions: Dispatch<SetStateAction<ChatSession[]>>;
  activeSessionId: string | null;
  setActiveSessionId: Dispatch<SetStateAction<string | null>>;
}

export function useCoreAppData(): CoreAppData {
  const [hydrated, setHydrated] = useState(false);
  const [ddls, setDdls] = useState<DdlItem[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [ddlRows, noteRows, chatRows] = await Promise.all([
          GetTaskListByApi().catch(() => []),
          GetNoteListByApi().catch(() => []),
          GetChatHistoryByApi().catch(() => ({ sessions: [], messages: [] })),
        ]);

        if (cancelled) return;

        if (ddlRows.length > 0) setDdls(ddlRows as DdlItem[]);
        if (noteRows.length > 0) setNotes(noteRows as Note[]);

        const sortedSessions = [...(chatRows.sessions as ChatSession[])]
          .sort((a, b) => b.updatedAt - a.updatedAt);
        if (sortedSessions.length === 0) {
          const fresh = makeFreshSession();
          setSessions([fresh]);
          setActiveSessionId(fresh.id);
        } else {
          setSessions(sortedSessions);
          setActiveSessionId(sortedSessions[0].id);
        }

        const msgRows = chatRows.messages as Array<Omit<ChatMessage, "timestamp"> & { timestamp: string | Date }>;
        if (msgRows.length > 0) setMessages(normalizeMessages(msgRows));
      } catch (e) {
        console.warn("[db] hydrate failed:", e);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void (async () => {
      try {
        await ReplaceTaskListByApi(ddls);
      } catch (e) {
        console.warn("[api] tasks sync failed:", e);
      }
    })();
  }, [ddls, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void (async () => {
      try {
        await ReplaceNoteListByApi(notes);
      } catch (e) {
        console.warn("[api] notes sync failed:", e);
      }
    })();
  }, [notes, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void (async () => {
      try {
        await ReplaceChatHistoryByApi({
          sessions,
          messages: toPersistableMessages(messages),
        });
      } catch (e) {
        console.warn("[api] chat history sync failed:", e);
      }
    })();
  }, [sessions, messages, hydrated]);

  return {
    hydrated,
    ddls,
    setDdls,
    notes,
    setNotes,
    messages,
    setMessages,
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
  };
}
