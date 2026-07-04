"use client";

import { useEffect } from "react";
import { setLocalDataset } from "@/lib/panel-local";
import type { ChatMessage, ChatSession, DdlItem, Note } from "@/lib/types";

interface UsePanelDatasetsArgs {
  ddls: DdlItem[];
  notes: Note[];
  sessions: ChatSession[];
  messages: ChatMessage[];
  streakDays: number;
}

export function usePanelDatasets({
  ddls,
  notes,
  sessions,
  messages,
  streakDays,
}: UsePanelDatasetsArgs) {
  useEffect(() => {
    setLocalDataset("ddls", ddls.map((task) => ({
      title: task.taskName,
      completed: task.completed || task.status === "done",
      status: task.status ?? (task.completed ? "done" : "todo"),
      priority: task.priority ?? "",
      dueDate: task.dueDate,
      weight: task.weight ?? 0,
      isGroupWork: task.isGroupWork,
      tags: (task.tags ?? []).join(","),
    })));
  }, [ddls]);

  useEffect(() => {
    setLocalDataset("notes", notes.map((note) => ({
      title: note.title,
      wordCount: note.content.length,
      pinned: Boolean(note.pinned),
      tags: (note.tags ?? []).join(","),
      updatedAt: note.updatedAt,
      createdAt: note.createdAt,
    })));
  }, [notes]);

  useEffect(() => {
    setLocalDataset("sessions", sessions.map((session) => ({
      title: session.title,
      messageCount: messages.filter((message) => message.sessionId === session.id).length,
      updatedAt: session.updatedAt,
    })));
  }, [messages, sessions]);

  useEffect(() => {
    setLocalDataset("streak", [{ current: streakDays, longest: streakDays }]);
  }, [streakDays]);
}
