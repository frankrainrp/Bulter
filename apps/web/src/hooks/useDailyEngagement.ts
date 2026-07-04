"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useToast } from "@/components/Toast";
import { useT } from "@/lib/i18n";
import type { ChatMessage, DdlItem, NavId, Note } from "@/lib/types";

const BRIEF_KEY = "butler.brief.lastSeen";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface UseDailyEngagementArgs {
  hydrated: boolean;
  ddls: DdlItem[];
  notes: Note[];
  messages: ChatMessage[];
  setActiveNav: Dispatch<SetStateAction<NavId>>;
  setMiniAppsOpen: Dispatch<SetStateAction<boolean>>;
}

export function useDailyEngagement({
  hydrated,
  ddls,
  notes,
  messages,
  setActiveNav,
  setMiniAppsOpen,
}: UseDailyEngagementArgs) {
  const toast = useToast();
  const { t } = useT();
  const [streakDays, setStreakDays] = useState(0);
  const [showDailyBrief, setShowDailyBrief] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);

  const markBriefSeen = useCallback(() => {
    try {
      localStorage.setItem(BRIEF_KEY, todayKey());
    } catch {
      // Ignore storage failures in private or locked-down browser contexts.
    }
  }, []);

  const dismissDailyBrief = useCallback(() => {
    markBriefSeen();
    setShowDailyBrief(false);
  }, [markBriefSeen]);

  const handleStartFocus = useCallback(() => {
    markBriefSeen();
    setShowDailyBrief(false);
    setActiveNav("chat");
    setMiniAppsOpen(true);
  }, [markBriefSeen, setActiveNav, setMiniAppsOpen]);

  const bestHourLabel = useMemo(() => {
    if (!hydrated) return null;

    const buckets: Record<string, number> = {
      earlyMorning: 0,
      morning: 0,
      noon: 0,
      afternoon: 0,
      evening: 0,
      night: 0,
      dawn: 0,
    };
    const classify = (hour: number) => (
      hour < 6
        ? "dawn"
        : hour < 9
          ? "earlyMorning"
          : hour < 12
            ? "morning"
            : hour < 14
              ? "noon"
              : hour < 17
                ? "afternoon"
                : hour < 19
                  ? "evening"
                  : hour < 23
                    ? "night"
                    : "dawn"
    );

    for (const message of messages) {
      if (message.role !== "user") continue;
      const ts = message.timestamp instanceof Date
        ? message.timestamp
        : new Date(message.timestamp as unknown as string);
      buckets[classify(ts.getHours())] += 1;
    }

    const total = Object.values(buckets).reduce((sum, count) => sum + count, 0);
    if (total < 5) return null;

    const top = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
    if (!top || top[1] < 2) return null;
    return t(`pg.bucket.${top[0]}`);
  }, [hydrated, messages, t]);

  useEffect(() => {
    if (!hydrated) return;

    void (async () => {
      const { touchStreak } = await import("@/lib/streak");
      const { newDay, broken, state } = touchStreak();
      setStreakDays(state.currentDays);
      if (newDay && state.currentDays > 1 && !broken) {
        toast.success(t("pg.streakToast", { n: state.currentDays }), { duration: 5000 });
      } else if (newDay && broken) {
        toast.info(t("pg.welcomeBack"));
      }
    })();
  }, [hydrated, t, toast]);

  useEffect(() => {
    if (!hydrated) return;

    try {
      const lastSeen = localStorage.getItem(BRIEF_KEY);
      if (lastSeen !== todayKey()) setShowDailyBrief(true);
    } catch {
      // Daily brief is optional if storage is unavailable.
    }
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;

    void (async () => {
      const { detectNewUnlocks, getUnlockedSet, saveUnlockedSet, ACHIEVEMENTS } = await import("@/lib/streak");
      const unlocked = getUnlockedSet();
      const ctx = {
        ddlsTotal: ddls.length,
        ddlsDone: ddls.filter((task) => task.completed || (task.status ?? "todo") === "done").length,
        notesTotal: notes.length,
        streakDays,
        longestStreak: streakDays,
      };
      const newly = detectNewUnlocks(ctx, unlocked);
      if (newly.length === 0) return;

      for (const achievement of newly) unlocked.add(achievement.id);
      saveUnlockedSet(unlocked);
      newly.forEach((achievement, i) => {
        setTimeout(() => {
          toast.success(`${achievement.emoji} Achievement unlocked: ${achievement.label} - ${achievement.desc}`, {
            duration: 6000,
          });
        }, i * 500);
      });
      void ACHIEVEMENTS;
    })();
  }, [ddls, hydrated, notes, streakDays, toast]);

  return {
    streakDays,
    showDailyBrief,
    dismissDailyBrief,
    handleStartFocus,
    bestHourLabel,
    achievementsOpen,
    setAchievementsOpen,
  };
}
