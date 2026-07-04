"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { useToast } from "@/components/Toast";
import { streamChat } from "@/lib/chat-client";
import type { TFunc } from "@/lib/i18n";
import type { ChatMessage, ChatSession, NavId } from "@/lib/types";

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

interface UseChatSessionsArgs {
  activeNav: NavId;
  setActiveNav: Dispatch<SetStateAction<NavId>>;
  hydrated: boolean;
  isLoading: boolean;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  sessions: ChatSession[];
  setSessions: Dispatch<SetStateAction<ChatSession[]>>;
  activeSessionId: string | null;
  setActiveSessionId: Dispatch<SetStateAction<string | null>>;
  activeSessionIdRef: MutableRefObject<string | null>;
  t: TFunc;
}

export function useChatSessions({
  activeNav,
  setActiveNav,
  hydrated,
  isLoading,
  messages,
  setMessages,
  sessions,
  setSessions,
  activeSessionId,
  setActiveSessionId,
  activeSessionIdRef,
  t,
}: UseChatSessionsArgs) {
  const toast = useToast();
  const greetedSessionsRef = useRef<Set<string>>(new Set());
  const titleRequestedRef = useRef<Set<string>>(new Set());

  const visibleMessages = useMemo(
    () => (activeSessionId ? messages.filter((message) => message.sessionId === activeSessionId) : []),
    [messages, activeSessionId],
  );

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

  const generateSessionTitle = useCallback(async (sid: string, userText: string, assistantText: string) => {
    let title = "";
    try {
      await streamChat({
        messages: [{
          role: "user",
          content: `Create a concise 4-8 word English title for the conversation below. Output only the title text, with no explanation, punctuation, quotes, emoji, prefix, or suffix.\n\nUser:${userText.slice(0, 200)}\nAI:${assistantText.slice(0, 200)}`,
        }],
        userName: "Feng",
        includeTools: false,
        model: "deepseek-v4-flash",
        executeToolCall: async () => ({ ok: false, message: "not allowed" }),
        callbacks: {
          onContentDelta: (delta) => { title += delta; },
          onError: () => { /* title generation is best-effort */ },
        },
      });
    } catch {
      // ignore title generation failures
    }

    const cleaned = title.replace(/["""銆娿€嬨€屻€?>銆愩€慬\]:锛氥€?!锛?锛焅n\r\s]/g, "").trim().slice(0, 20);
    if (cleaned) {
      setSessions((prev) => prev.map((session) => (
        session.id === sid && session.title === "" ? { ...session, title: cleaned } : session
      )));
    }
  }, [setSessions]);

  useEffect(() => {
    if (isLoading || !hydrated) return;
    const sid = activeSessionIdRef.current;
    if (!sid) return;
    if (titleRequestedRef.current.has(sid)) return;

    const session = sessions.find((item) => item.id === sid);
    if (!session || session.title !== "") return;

    const sessMsgs = messages.filter((message) => (
      message.sessionId === sid && (message.role === "user" || message.role === "assistant")
    ));
    const lastUser = [...sessMsgs].reverse().find((message) => message.role === "user");
    const lastAssistant = [...sessMsgs].reverse().find((message) => (
      message.role === "assistant" && !message.isError && message.content.length > 5
    ));
    if (!lastUser || !lastAssistant) return;

    titleRequestedRef.current.add(sid);
    generateSessionTitle(sid, lastUser.content, lastAssistant.content);
  }, [isLoading, hydrated, sessions, messages, activeSessionIdRef, generateSessionTitle]);

  useEffect(() => {
    if (!hydrated) return;
    if (isLoading) return;
    if (activeNav !== "chat") return;
    const sid = activeSessionId;
    if (!sid) return;
    if (greetedSessionsRef.current.has(sid)) return;

    const sessionRealMsgs = messages.filter((message) => (
      message.sessionId === sid && (message.role === "user" || message.role === "assistant")
    ));
    if (sessionRealMsgs.length > 0) {
      greetedSessionsRef.current.add(sid);
      return;
    }

    greetedSessionsRef.current.add(sid);
  }, [hydrated, isLoading, activeNav, activeSessionId, messages]);

  const handleNewChat = useCallback(() => {
    const sid = activeSessionIdRef.current;
    const current = sid ? sessions.find((session) => session.id === sid) : null;
    const currentEmpty = current && current.title === "" && !messages.some((message) => message.sessionId === sid);
    if (currentEmpty) {
      setActiveNav("chat");
      return;
    }

    const fresh = makeFreshSession();
    setSessions((prev) => [fresh, ...prev]);
    setActiveSessionId(fresh.id);
    setActiveNav("chat");
  }, [activeSessionIdRef, sessions, messages, setActiveNav, setActiveSessionId, setSessions]);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    setActiveNav("chat");
  }, [setActiveNav, setActiveSessionId]);

  const handleRenameSession = useCallback((id: string, title: string) => {
    setSessions((prev) => prev.map((session) => (session.id === id ? { ...session, title } : session)));
  }, [setSessions]);

  const handleDeleteSession = useCallback((id: string) => {
    const sessionSnapshot = sessions.find((session) => session.id === id);
    if (!sessionSnapshot) return;
    const messagesSnapshot = messages.filter((message) => message.sessionId === id);
    const prevActive = activeSessionIdRef.current;

    setMessages((prev) => prev.filter((message) => message.sessionId !== id));
    setSessions((prev) => {
      const remaining = prev.filter((session) => session.id !== id);
      if (activeSessionIdRef.current === id) {
        if (remaining.length > 0) {
          const next = [...remaining].sort((a, b) => b.updatedAt - a.updatedAt)[0];
          setActiveSessionId(next.id);
        } else {
          const fresh = makeFreshSession();
          setActiveSessionId(fresh.id);
          return [fresh];
        }
      }
      return remaining;
    });

    toast.success(`Deleted chat "${sessionSnapshot.title}"`, {
      action: {
        label: t("pg.undo"),
        onClick: () => {
          setSessions((prev) => [sessionSnapshot, ...prev.filter((session) => session.id !== sessionSnapshot.id)]);
          setMessages((prev) => [...prev, ...messagesSnapshot]);
          setActiveSessionId(prevActive);
        },
      },
    });
  }, [activeSessionIdRef, messages, sessions, setActiveSessionId, setMessages, setSessions, t, toast]);

  const orderedSessions = useMemo(() => {
    const interacted = new Set(
      messages.filter((message) => message.role === "user").map((message) => message.sessionId),
    );
    return [...sessions]
      .filter((session) => interacted.has(session.id))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [sessions, messages]);

  return {
    visibleMessages,
    touchActiveSession,
    handleNewChat,
    handleSelectSession,
    handleRenameSession,
    handleDeleteSession,
    orderedSessions,
  };
}
