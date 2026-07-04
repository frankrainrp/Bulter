"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { NavId } from "@/lib/types";

interface UseSearchJumpArgs {
  setActiveNav: Dispatch<SetStateAction<NavId>>;
  setNotesSelectId: Dispatch<SetStateAction<string | null>>;
  setActiveSessionId: Dispatch<SetStateAction<string | null>>;
}

export function useSearchJump({
  setActiveNav,
  setNotesSelectId,
  setActiveSessionId,
}: UseSearchJumpArgs) {
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
  }, []);

  const handleSearchJump = useCallback((target: NavId, refId?: string) => {
    setActiveNav(target);
    if (!refId) return;

    if (target === "tasks") {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      setHighlightTaskId(refId);
      highlightTimerRef.current = setTimeout(() => setHighlightTaskId(null), 2000);
    } else if (target === "notes") {
      setNotesSelectId(refId);
    } else if (target === "chat") {
      setActiveSessionId(refId);
    }
  }, [setActiveNav, setActiveSessionId, setNotesSelectId]);

  return {
    highlightTaskId,
    handleSearchJump,
  };
}
