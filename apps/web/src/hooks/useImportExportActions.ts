"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { useToast } from "@/components/Toast";
import type { DdlItem } from "@/lib/types";

interface UseImportExportActionsArgs {
  ddlsRef: MutableRefObject<DdlItem[]>;
  setDdls: Dispatch<SetStateAction<DdlItem[]>>;
}

export function useImportExportActions({ ddlsRef, setDdls }: UseImportExportActionsArgs) {
  const toast = useToast();

  const handleExportIcs = useCallback(async () => {
    const { downloadIcs } = await import("@/lib/ics-export");
    const result = downloadIcs(ddlsRef.current);
    if (result.count === 0) {
      toast.warning("No exportable events yet. Tasks without dates are skipped.");
      return;
    }
    toast.success(`Exported ${result.count} event(s) to .ics`);
  }, [ddlsRef, toast]);

  const handleExportJson = useCallback(async () => {
    const { exportToJson } = await import("@/lib/json-export");
    exportToJson(ddlsRef.current);
    toast.success(`Exported ${ddlsRef.current.length} task(s) to .json`);
  }, [ddlsRef, toast]);

  const handleImportIcs = useCallback(async () => {
    const { pickIcsFile, parseIcs, icsEventsToDdls } = await import("@/lib/ics-import");
    const file = await pickIcsFile();
    if (!file) return;

    try {
      const text = await file.text();
      const events = parseIcs(text);
      if (events.length === 0) {
        toast.warning("No events were found in the .ics file");
        return;
      }

      const newDdls = icsEventsToDdls(events, file.name);
      const prevSnap = ddlsRef.current;
      setDdls((prev) => [...prev, ...newDdls]);
      toast.success(`Imported ${newDdls.length} event(s) from "${file.name}"`, {
        duration: 8000,
        action: { label: "Undo", onClick: () => setDdls(prevSnap) },
      });
    } catch (e) {
      toast.error("Failed to parse .ics: " + (e instanceof Error ? e.message : String(e)));
    }
  }, [ddlsRef, setDdls, toast]);

  const handleImportJson = useCallback(async () => {
    const { pickJsonFile, importFromFile } = await import("@/lib/json-export");
    const file = await pickJsonFile();
    if (!file) return;

    const result = await importFromFile(file, ddlsRef.current);
    if (result.ok !== true) {
      toast.error("Import failed: " + result.error);
      return;
    }

    setDdls(result.merged);
    toast.success(`Import complete: added ${result.added}, updated ${result.updated}`);
  }, [ddlsRef, setDdls, toast]);

  return {
    handleExportIcs,
    handleExportJson,
    handleImportIcs,
    handleImportJson,
  };
}
