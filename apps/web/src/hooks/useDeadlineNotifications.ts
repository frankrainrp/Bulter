"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { useToast } from "@/components/Toast";
import type { DdlItem } from "@/lib/types";

interface UseDeadlineNotificationsArgs {
  hydrated: boolean;
  ddlsRef: MutableRefObject<DdlItem[]>;
  onJumpToTask: (taskId: string) => void;
}

export function useDeadlineNotifications({
  hydrated,
  ddlsRef,
  onJumpToTask,
}: UseDeadlineNotificationsArgs) {
  const toast = useToast();
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!hydrated) return;

    const check = () => {
      const now = Date.now();
      const horizon = now + 24 * 3600 * 1000;

      for (const task of ddlsRef.current) {
        if (task.completed || (task.status ?? "todo") === "done") continue;
        if (!task.dueDate) continue;
        if (notifiedRef.current.has(task.id)) continue;

        const dueTs = new Date(`${task.dueDate}T${task.dueTime || "23:59"}:00`).getTime();
        if (dueTs < now || dueTs > horizon) continue;

        const hoursLeft = Math.round((dueTs - now) / 3600000);
        notifiedRef.current.add(task.id);
        toast.warning(`⏰ ${task.taskName} is due in about ${hoursLeft} hour(s)`, {
          duration: 10000,
          action: { label: "View", onClick: () => onJumpToTask(task.id) },
        });

        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification("Butler · Upcoming deadline", {
              body: `${task.taskName} · ${task.dueDate} ${task.dueTime || "23:59"} (about ${hoursLeft}h)`,
              icon: "/assets/logo.png",
              tag: `deadline-${task.id}`,
            });
          } catch {
            // Browser notification support can vary by runtime.
          }
        }
      }
    };

    const t0 = setTimeout(check, 3000);
    const interval = setInterval(check, 60 * 1000);
    return () => {
      clearTimeout(t0);
      clearInterval(interval);
    };
  }, [ddlsRef, hydrated, onJumpToTask, toast]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;

    const timer = setTimeout(() => {
      Notification.requestPermission().catch(() => {
        // Notification permission is optional; toast remains the fallback.
      });
    }, 5000);
    return () => clearTimeout(timer);
  }, []);
}
