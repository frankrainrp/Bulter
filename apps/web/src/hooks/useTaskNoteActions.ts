"use client";

import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { EditingTarget, FormPayload } from "@/components/TaskDetailDrawer";
import { useToast } from "@/components/Toast";
import { useT } from "@/lib/i18n";
import { playSound } from "@/lib/sound";
import type { DdlAttachment, DdlItem, NavId, Note } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

interface UseTaskNoteActionsArgs {
  ddls: DdlItem[];
  ddlsRef: MutableRefObject<DdlItem[]>;
  notes: Note[];
  setDdls: Dispatch<SetStateAction<DdlItem[]>>;
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setActiveNav: Dispatch<SetStateAction<NavId>>;
}

export function useTaskNoteActions({
  ddls,
  ddlsRef,
  notes,
  setDdls,
  setNotes,
  setActiveNav,
}: UseTaskNoteActionsArgs) {
  const toast = useToast();
  const { t } = useT();
  const [editing, setEditing] = useState<EditingTarget | null>(null);
  const [previewing, setPreviewing] = useState<DdlAttachment | null>(null);
  const [previewNotes, setPreviewNotes] = useState<DdlItem | null>(null);
  const [notesSelectId, setNotesSelectId] = useState<string | null>(null);

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
  }, [setNotes]);

  const handleUpdateNote = useCallback((id: string, patch: Partial<Note>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, [setNotes]);

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
  }, [notes, setNotes, t, toast]);

  const handleToggleComplete = useCallback((id: string) => {
    setDdls((prev) => prev.map((d) => {
      if (d.id !== id) return d;
      const next = { ...d, completed: !d.completed };
      playSound(next.completed ? "task-complete" : "task-uncomplete");
      return next;
    }));
  }, [setDdls]);

  const handleCreateLinkedNote = useCallback((taskId: string) => {
    const task = ddlsRef.current.find((d) => d.id === taskId);
    if (!task) return;

    const now = Date.now();
    const fresh: Note = {
      id: "note-" + uid(),
      title: task.taskName,
      content: `# ${task.taskName}\n\n`,
      createdAt: now,
      updatedAt: now,
    };

    setNotes((prev) => [fresh, ...prev]);
    setDdls((prev) => prev.map((d) => (d.id === taskId ? { ...d, noteId: fresh.id } : d)));
    setEditing(null);
    setNotesSelectId(fresh.id);
    setActiveNav("notes");
  }, [ddlsRef, setActiveNav, setDdls, setNotes]);

  const handleJumpToNote = useCallback((noteId: string) => {
    setEditing(null);
    setNotesSelectId(noteId);
    setActiveNav("notes");
  }, [setActiveNav]);

  const handleUnlinkNote = useCallback((taskId: string) => {
    setDdls((prev) => prev.map((d) => (d.id === taskId ? { ...d, noteId: undefined } : d)));
  }, [setDdls]);

  const handleJumpToTask = useCallback((taskId: string) => {
    const target = ddlsRef.current.find((d) => d.id === taskId);
    if (!target) return;

    setActiveNav("tasks");
    setEditing({ mode: "edit", item: target });
  }, [ddlsRef, setActiveNav]);

  const handleMoveEvent = useCallback((id: string, newDate: string, newTime: string) => {
    setDdls((prev) => prev.map((d) => (d.id === id ? { ...d, dueDate: newDate, dueTime: newTime } : d)));
    toast.info(`Moved to ${newDate} ${newTime}`);
  }, [setDdls, toast]);

  const handleLoadDemo = useCallback(async () => {
    const { buildDemoData } = await import("@/lib/demo-data");
    const { ddls: demoDdls, notes: demoNotes } = buildDemoData();
    const prevDdls = ddlsRef.current;
    const prevNotes = notes;

    setDdls((p) => [...p, ...demoDdls]);
    setNotes((p) => [...demoNotes, ...p]);
    toast.success(`Added ${demoDdls.length} sample task(s) + ${demoNotes.length} note(s)`, {
      duration: 8000,
      action: {
        label: t("pg.undo"),
        onClick: () => {
          setDdls(prevDdls);
          setNotes(prevNotes);
        },
      },
    });
  }, [ddlsRef, notes, setDdls, setNotes, t, toast]);

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
      source: "Note auto-sync",
      completed: false,
      status: "todo",
      noteId,
    }));

    setDdls((prev) => [...prev, ...newTasks]);
    setNotes((prev) => prev.map((n) => {
      if (n.id !== noteId) return n;
      return { ...n, syncedTodos: [...(n.syncedTodos ?? []), ...newTodos] };
    }));
    console.log(`[B4] auto-synced ${newTodos.length} todo(s) from note ${noteId}`);
  }, [setDdls, setNotes]);

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
      source: "Recommended task",
      completed: false,
      status: "todo",
    }]);
    toast.success(`Added: ${title}`);
    playSound("panel-create");
  }, [setDdls, toast]);

  const handleSubmitEdit = useCallback((data: FormPayload) => {
    if (editing?.mode === "edit") {
      const oldBlobIds = (editing.item.attachments ?? [])
        .filter((a) => a.kind === "blob")
        .map((a) => a.ref);
      const newBlobIds = new Set(data.attachments.filter((a) => a.kind === "blob").map((a) => a.ref));
      const orphans = oldBlobIds.filter((id) => !newBlobIds.has(id));
      if (orphans.length > 0) {
        import("@/lib/blobs").then(({ deleteBlobs }) => deleteBlobs(orphans));
      }
    }

    const completed = data.status === "done";
    setDdls((prev) => {
      if (editing?.mode === "edit") {
        return prev.map((d) => (d.id === editing.item.id ? { ...d, ...data, completed } : d));
      }
      return [...prev, { ...data, id: uid(), completed, source: "Manual entry" }];
    });
    setEditing(null);
  }, [editing, setDdls]);

  const handleDeleteDdl = useCallback((id: string) => {
    const target = ddlsRef.current.find((d) => d.id === id);
    if (!target) return;

    setDdls((prev) => prev.filter((d) => d.id !== id));
    setEditing(null);
    toast.success(`Deleted task "${target.taskName}"`, {
      action: {
        label: t("pg.undo"),
        onClick: () => setDdls((prev) => [...prev, target]),
      },
    });
  }, [ddlsRef, setDdls, t, toast]);

  return {
    editing,
    setEditing,
    previewing,
    setPreviewing,
    previewNotes,
    setPreviewNotes,
    notesSelectId,
    setNotesSelectId,
    taskCounts,
    handleCreateNote,
    handleUpdateNote,
    handleDeleteNote,
    handleToggleComplete,
    handleCreateLinkedNote,
    handleJumpToNote,
    handleUnlinkNote,
    handleJumpToTask,
    handleMoveEvent,
    handleLoadDemo,
    handleAutoExtractTodos,
    handleQuickAddTask,
    handleSubmitEdit,
    handleDeleteDdl,
  };
}
