"use client";

import React from "react";
import AchievementsRoom from "@/components/AchievementsRoom";
import AttachmentPreview from "@/components/AttachmentPreview";
import BillingPanel from "@/components/BillingPanel";
import CheckoutModal, { type CheckoutProduct } from "@/components/CheckoutModal";
import KeyboardShortcutsHelp from "@/components/KeyboardShortcutsHelp";
import NotesPreview from "@/components/NotesPreview";
import OnboardingTour from "@/components/OnboardingTour";
import PreferencesPanel from "@/components/PreferencesPanel";
import PricingModal from "@/components/PricingModal";
import QuotaWallModal from "@/components/QuotaWallModal";
import RecurringTasksManager from "@/components/RecurringTasksManager";
import TaskDetailDrawer, { type EditingTarget, type FormPayload } from "@/components/TaskDetailDrawer";
import Portal from "@/components/ui/Portal";
import { getNextResetAt } from "@/lib/usage";
import type { BillingCycle, CardInfo, PlanId, Subscription } from "@/lib/billing";
import type { DdlAttachment, DdlItem, Note } from "@/lib/types";

interface AppPortalsProps {
  editing: EditingTarget | null;
  onCancelEditing: () => void;
  onSubmitEdit: (data: FormPayload) => void;
  onDeleteDdl: (id: string) => void;
  notes: Note[];
  onCreateLinkedNote: (taskId: string) => void;
  onJumpToNote: (noteId: string) => void;
  onUnlinkNote: (taskId: string) => void;

  previewing: DdlAttachment | null;
  onClosePreviewing: () => void;
  previewNotes: DdlItem | null;
  onClosePreviewNotes: () => void;

  shortcutsOpen: boolean;
  onCloseShortcuts: () => void;
  prefsOpen: boolean;
  onClosePreferences: () => void;
  achievementsOpen: boolean;
  onCloseAchievements: () => void;
  ddls: DdlItem[];
  streakDays: number;

  billingOpen: boolean;
  onCloseBilling: () => void;
  onOpenPricing: () => void;
  onBillingCancelled: () => void;
  pricingOpen: boolean;
  onClosePricing: () => void;
  subscription: Subscription;
  onCheckout: (plan: PlanId, cycle: BillingCycle) => void;
  onBuyPack: (packId: string) => void;
  onDowngradeFree: () => void;
  checkout: CheckoutProduct | null;
  onCloseCheckout: () => void;
  onCheckoutConfirmed: (card: CardInfo) => void;

  quotaWallOpen: boolean;
  creditsWall: number | null;
  canFallbackFlash: boolean;
  onSwitchFlash: () => void;
  onTopUp: () => void;
  onUpgrade: () => void;
  onCloseQuotaWall: () => void;

  recurringOpen: boolean;
  onCloseRecurring: () => void;
  onRecurringChanged: () => void;
}

export default function AppPortals({
  editing,
  onCancelEditing,
  onSubmitEdit,
  onDeleteDdl,
  notes,
  onCreateLinkedNote,
  onJumpToNote,
  onUnlinkNote,
  previewing,
  onClosePreviewing,
  previewNotes,
  onClosePreviewNotes,
  shortcutsOpen,
  onCloseShortcuts,
  prefsOpen,
  onClosePreferences,
  achievementsOpen,
  onCloseAchievements,
  ddls,
  streakDays,
  billingOpen,
  onCloseBilling,
  onOpenPricing,
  onBillingCancelled,
  pricingOpen,
  onClosePricing,
  subscription,
  onCheckout,
  onBuyPack,
  onDowngradeFree,
  checkout,
  onCloseCheckout,
  onCheckoutConfirmed,
  quotaWallOpen,
  creditsWall,
  canFallbackFlash,
  onSwitchFlash,
  onTopUp,
  onUpgrade,
  onCloseQuotaWall,
  recurringOpen,
  onCloseRecurring,
  onRecurringChanged,
}: AppPortalsProps) {
  const linkedNote =
    editing?.mode === "edit" && editing.item.noteId
      ? notes.find((note) => note.id === editing.item.noteId) ?? null
      : null;

  return (
    <Portal>
      {editing && (
        <TaskDetailDrawer
          target={editing}
          onCancel={onCancelEditing}
          onSubmit={onSubmitEdit}
          onDelete={onDeleteDdl}
          linkedNote={linkedNote}
          onCreateLinkedNote={onCreateLinkedNote}
          onJumpToNote={onJumpToNote}
          onUnlinkNote={onUnlinkNote}
        />
      )}

      {previewing && (
        <AttachmentPreview attachment={previewing} onClose={onClosePreviewing} />
      )}

      {previewNotes && (
        <NotesPreview
          title={previewNotes.taskName}
          notes={previewNotes.notes ?? ""}
          onClose={onClosePreviewNotes}
        />
      )}

      <KeyboardShortcutsHelp open={shortcutsOpen} onClose={onCloseShortcuts} />
      <PreferencesPanel open={prefsOpen} onClose={onClosePreferences} />
      <AchievementsRoom
        open={achievementsOpen}
        onClose={onCloseAchievements}
        ctx={{
          ddlsTotal: ddls.length,
          ddlsDone: ddls.filter((d) => d.completed).length,
          notesTotal: notes.length,
          streakDays,
          longestStreak: streakDays,
        }}
      />

      <BillingPanel
        open={billingOpen}
        onClose={onCloseBilling}
        onViewPlans={onOpenPricing}
        onBuyPack={onOpenPricing}
        onCancelled={onBillingCancelled}
      />
      <PricingModal
        open={pricingOpen}
        onClose={onClosePricing}
        subscription={subscription}
        onCheckout={onCheckout}
        onBuyPack={onBuyPack}
        onDowngradeFree={onDowngradeFree}
      />
      <CheckoutModal
        open={checkout !== null}
        product={checkout}
        onClose={onCloseCheckout}
        onConfirmed={onCheckoutConfirmed}
      />
      <QuotaWallModal
        open={quotaWallOpen || creditsWall !== null}
        mode={creditsWall !== null ? "credits" : "window"}
        creditsNeed={creditsWall ?? 0}
        resetAt={getNextResetAt()}
        canFallbackFlash={canFallbackFlash}
        onSwitchFlash={onSwitchFlash}
        onTopUp={onTopUp}
        onUpgrade={onUpgrade}
        onClose={onCloseQuotaWall}
      />

      <RecurringTasksManager
        open={recurringOpen}
        onClose={onCloseRecurring}
        onChanged={onRecurringChanged}
      />

      <OnboardingTour />
    </Portal>
  );
}
