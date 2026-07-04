"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useToast } from "@/components/Toast";
import { useT } from "@/lib/i18n";
import {
  CUSTOM_PANEL_EVENT,
  createCustomPanel,
  deleteCustomPanel,
  getAllCustomPanels,
  updateCustomPanel,
} from "@/lib/custom-panels";
import { playSound } from "@/lib/sound";
import type { CustomPanel, NavId } from "@/lib/types";

type CustomPanelPatch = Partial<
  Pick<CustomPanel, "label" | "emoji" | "content" | "kind" | "url" | "modules" | "spec">
>;

interface UseCustomPanelsArgs {
  setActiveNav: Dispatch<SetStateAction<NavId>>;
}

export function useCustomPanels({ setActiveNav }: UseCustomPanelsArgs) {
  const toast = useToast();
  const { t } = useT();
  const [customPanels, setCustomPanels] = useState<CustomPanel[]>([]);
  const [activeCustomPanelId, setActiveCustomPanelId] = useState<string | null>(null);

  useEffect(() => {
    const sync = async () => {
      try {
        const list = await getAllCustomPanels();
        setCustomPanels(list);
        if (activeCustomPanelId && !list.find((panel) => panel.id === activeCustomPanelId)) {
          setActiveCustomPanelId(null);
        }
      } catch {
        // IndexedDB-backed panels are optional; keep the shell usable if loading fails.
      }
    };

    sync();
    window.addEventListener(CUSTOM_PANEL_EVENT, sync);
    return () => window.removeEventListener(CUSTOM_PANEL_EVENT, sync);
  }, [activeCustomPanelId]);

  const handleCreateCustomPanel = useCallback(async () => {
    try {
      const panel = await createCustomPanel(t("pg.newPanel"));
      setActiveCustomPanelId(panel.id);
      playSound("panel-create");
    } catch (e) {
      toast.error(`Create failed: ${(e as Error).message}`);
    }
  }, [t, toast]);

  const handleUpdateCustomPanel = useCallback(async (id: string, patch: CustomPanelPatch) => {
    try {
      await updateCustomPanel(id, patch);
    } catch {
      // The editor is optimistic; the panel event listener will resync after successful writes.
    }
  }, []);

  const handleDeleteCustomPanel = useCallback(async (id: string) => {
    try {
      await deleteCustomPanel(id);
      if (activeCustomPanelId === id) {
        setActiveCustomPanelId(null);
        setActiveNav("chat");
      }
      toast.success("Deleted panel");
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    }
  }, [activeCustomPanelId, setActiveNav, toast]);

  return {
    customPanels,
    activeCustomPanelId,
    setActiveCustomPanelId,
    handleCreateCustomPanel,
    handleUpdateCustomPanel,
    handleDeleteCustomPanel,
  };
}
