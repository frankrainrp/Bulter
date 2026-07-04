"use client";

import {
  useEffect,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { EditingTarget } from "@/components/TaskDetailDrawer";
import type { DdlAttachment, DdlItem, NavId, Note } from "@/lib/types";

interface UseGlobalShortcutsArgs {
  activeNav: NavId;
  shortcutsOpen: boolean;
  setShortcutsOpen: Dispatch<SetStateAction<boolean>>;
  previewNotes: DdlItem | null;
  setPreviewNotes: Dispatch<SetStateAction<DdlItem | null>>;
  previewing: DdlAttachment | null;
  setPreviewing: Dispatch<SetStateAction<DdlAttachment | null>>;
  editing: EditingTarget | null;
  setEditing: Dispatch<SetStateAction<EditingTarget | null>>;
  miniAppsOpen: boolean;
  setMiniAppsOpen: Dispatch<SetStateAction<boolean>>;
  handleNewChat: () => void;
  handleCreateNote: () => Note;
  setNotesSelectId: Dispatch<SetStateAction<string | null>>;
}

export function useGlobalShortcuts({
  activeNav,
  shortcutsOpen,
  setShortcutsOpen,
  previewNotes,
  setPreviewNotes,
  previewing,
  setPreviewing,
  editing,
  setEditing,
  miniAppsOpen,
  setMiniAppsOpen,
  handleNewChat,
  handleCreateNote,
  setNotesSelectId,
}: UseGlobalShortcutsArgs) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const tag = target?.tagName?.toLowerCase();
      const isInput = tag === "input" || tag === "textarea" || target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        if (activeNav === "chat") handleNewChat();
        else if (activeNav === "tasks") setEditing({ mode: "create" });
        else if (activeNav === "calendar") setEditing({ mode: "create" });
        else if (activeNav === "notes") {
          const fresh = handleCreateNote();
          setNotesSelectId(fresh.id);
        }
        return;
      }

      if (event.key === "Escape") {
        if (shortcutsOpen) {
          setShortcutsOpen(false);
          return;
        }
        if (previewNotes) {
          setPreviewNotes(null);
          return;
        }
        if (previewing) {
          setPreviewing(null);
          return;
        }
        if (editing) {
          setEditing(null);
          return;
        }
        if (miniAppsOpen) {
          setMiniAppsOpen(false);
        }
        return;
      }

      if (!isInput && event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    activeNav,
    editing,
    handleCreateNote,
    handleNewChat,
    miniAppsOpen,
    previewNotes,
    previewing,
    setEditing,
    setMiniAppsOpen,
    setNotesSelectId,
    setPreviewNotes,
    setPreviewing,
    setShortcutsOpen,
    shortcutsOpen,
  ]);
}
