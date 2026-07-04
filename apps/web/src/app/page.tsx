"use client";

// ============================================================
// app/page.tsx — 主页面：4 面板路由 + 真实 AI 对话 + AI 驱动 CRUD
// ============================================================

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import AuthGate from "@/components/AuthGate";
import TopBar from "@/components/layout/TopBar";
import LeftRail from "@/components/layout/LeftRail";
import MiniAppsDrawer from "@/components/MiniAppsDrawer";
import ChatRail from "@/components/layout/ChatRail";
import TasksRail from "@/components/layout/TasksRail";
import CalendarRail from "@/components/layout/CalendarRail";
import NotesRail from "@/components/layout/NotesRail";
import ChatCanvas from "@/components/ChatCanvas";
import TasksPanel from "@/components/TasksPanel";
import CalendarPanel from "@/components/CalendarPanel";
import NotesPanel from "@/components/NotesPanel";
import CustomPanelView from "@/components/CustomPanelView";
import { applyStoredPreferences } from "@/components/PreferencesPanel";
import WallpaperLayer from "@/components/WallpaperLayer";
import MobileTabBar from "@/components/layout/MobileTabBar";
import AppPortals from "@/components/AppPortals";
import { useIsMobile } from "@/lib/use-is-mobile";
import { applyStoredLang, useT } from "@/lib/i18n";
import type { NavId } from "@/lib/types";
import { createToolExecutor } from "@/lib/tool-executor";
import { type AiModelId, DEFAULT_MODEL_ID, MODEL_STORAGE_KEY, isValidModelId } from "@/lib/ai-models";
import type { TaskViewId } from "@/components/layout/TasksRail";
import { useToast } from "@/components/Toast";
import {
  LAYOUT_PREFS_EVENT,
  getHiddenTabs,
  getTabsOrder,
  setTabsOrder,
} from "@/lib/layout-prefs";
import { usePendingBatches } from "@/hooks/usePendingBatches";
import { useRecurringTasks } from "@/hooks/useRecurringTasks";
import { useImportExportActions } from "@/hooks/useImportExportActions";
import { useCustomPanels } from "@/hooks/useCustomPanels";
import { useFilePipeline } from "@/hooks/useFilePipeline";
import { useBillingFlow } from "@/hooks/useBillingFlow";
import { useCoreAppData } from "@/hooks/useCoreAppData";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useTaskNoteActions } from "@/hooks/useTaskNoteActions";
import { useChatFlow } from "@/hooks/useChatFlow";
import { useDeadlineNotifications } from "@/hooks/useDeadlineNotifications";
import { useDailyEngagement } from "@/hooks/useDailyEngagement";
import { usePanelDatasets } from "@/hooks/usePanelDatasets";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { useSearchJump } from "@/hooks/useSearchJump";

export default function HomePage() {
  return (
    <AuthGate>
      <ButlerApp />
    </AuthGate>
  );
}

function ButlerApp() {
  const toast = useToast();
  const { t } = useT();
  const [activeNav, setActiveNav] = useState<NavId>("chat");
  // 手机响应式：窄屏布局 + 左栏抽屉开关
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  // 抽屉内点操作按钮/项后自动关（用原生 click 监听，绕过 React 合成事件冒泡到容器的边界问题）
  useEffect(() => {
    const el = mobileDrawerRef.current;
    if (!el || !isMobile) return;
    const handler = (e: Event) => {
      if ((e.target as HTMLElement).closest('button, [role="button"]')) {
        // 微延迟让 rail 操作（切会话/建任务等）先执行，再收起抽屉
        setTimeout(() => setMobileNavOpen(false), 120);
      }
    };
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, [isMobile]);
  // Phase D 布局偏好（mount 后从 localStorage 读 + 监听 LAYOUT_PREFS_EVENT）
  const [tabsOrder, setTabsOrderState] = useState<NavId[]>(["chat", "tasks", "calendar", "notes"]);
  const [hiddenTabs, setHiddenTabsState] = useState<Set<NavId>>(new Set());
  const {
    customPanels,
    activeCustomPanelId,
    setActiveCustomPanelId,
    handleCreateCustomPanel,
    handleUpdateCustomPanel,
    handleDeleteCustomPanel,
  } = useCustomPanels({ setActiveNav });
  const {
    hydrated,
    ddls,
    setDdls,
    notes,
    setNotes,
    messages,
    setMessages,
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
  } = useCoreAppData();
  // 学习工具抽屉
  const [miniAppsOpen, setMiniAppsOpen] = useState(false);
  // Tasks 当前 view
  const [taskView, setTaskView] = useState<TaskViewId>("active");
  // AI 模型选择（localStorage 持久化）
  const [selectedModel, setSelectedModel] = useState<AiModelId>(DEFAULT_MODEL_ID);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODEL_STORAGE_KEY);
      if (saved && isValidModelId(saved)) setSelectedModel(saved);
    } catch { /* ignore */ }
  }, []);
  const handleSelectModel = useCallback((id: AiModelId) => {
    setSelectedModel(id);
    try { localStorage.setItem(MODEL_STORAGE_KEY, id); } catch { /* ignore */ }
  }, []);

  const {
    subscription,
    billingOpen,
    setBillingOpen,
    pricingOpen,
    setPricingOpen,
    checkout,
    setCheckout,
    quotaWallOpen,
    creditsWall,
    openPricing,
    openQuotaWall,
    openCreditsWall,
    closeQuotaWall,
    handleCheckout,
    handleBuyPack,
    handleCheckoutConfirmed,
    handleDowngradeFree,
    handleSwitchFlash,
    handleTopUp,
    canFallbackFlash,
    handleBillingCancelled,
  } = useBillingFlow({
    selectedModel,
    onSelectModel: handleSelectModel,
    t,
  });

  // ddlsRef 保证 AI tool 执行时拿到最新 state（避免闭包陷阱）
  const ddlsRef = useRef(ddls);
  useEffect(() => { ddlsRef.current = ddls; }, [ddls]);
  const notesRef = useRef(notes);
  useEffect(() => { notesRef.current = notes; }, [notes]);
  const activeSessionIdRef = useRef<string | null>(null);
  useEffect(() => { activeSessionIdRef.current = activeSessionId; }, [activeSessionId]);

  const {
    pendingBatches,
    resetCurrentBatch,
    addPendingBatch,
    addPendingChange,
    handleAcceptBatch,
    handleRejectBatch,
    handleDropChange,
  } = usePendingBatches({
    activeSessionIdRef,
    ddlsRef,
    setDdls,
    setNotes,
    setMessages,
  });

  const {
    pipelines,
    attachedFiles,
    setAttachedFiles,
    handleAttach,
    handleRemoveAttachment,
    runRealPipeline,
  } = useFilePipeline({
    activeSessionIdRef,
    addPendingBatch,
    setMessages,
    t,
  });

  const {
    recurringOpen,
    setRecurringOpen,
    runMaterialize,
    addRecurring,
  } = useRecurringTasks({ hydrated, ddlsRef, setDdls });

  const {
    handleExportIcs,
    handleExportJson,
    handleImportIcs,
    handleImportJson,
  } = useImportExportActions({ ddlsRef, setDdls });

  const {
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
  } = useTaskNoteActions({
    ddls,
    ddlsRef,
    notes,
    setDdls,
    setNotes,
    setActiveNav,
  });

  // ---------- Tool executor ----------
  const executeToolCall = useMemo(
    () => createToolExecutor({
      getDdls: () => ddlsRef.current,
      setDdls,
      getNotes: () => notesRef.current,
      setNotes,
      addPending: addPendingChange,
      addRecurring,
    }),
    [addPendingChange, addRecurring],
  );

  const {
    inputValue,
    setInputValue,
    isLoading,
    handleSend,
    handleStopGeneration,
    handleRegenerate,
  } = useChatFlow({
    activeSessionIdRef,
    ddlsRef,
    messages,
    setMessages,
    setSessions,
    attachedFiles,
    setAttachedFiles,
    runRealPipeline,
    executeToolCall,
    selectedModel,
    openQuotaWall,
    openCreditsWall,
    resetCurrentBatch,
  });

  const {
    visibleMessages,
    handleNewChat,
    handleSelectSession,
    handleRenameSession,
    handleDeleteSession,
    orderedSessions,
  } = useChatSessions({
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
  });

  useDeadlineNotifications({
    hydrated,
    ddlsRef,
    onJumpToTask: handleJumpToTask,
  });

  const handleQuickAction = useCallback((prompt: string) => {
    setInputValue(prompt);
  }, []);

  // Epic 2.3 快捷键帮助面板
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Epic 3 偏好设置 modal
  const [prefsOpen, setPrefsOpen] = useState(false);
  // C1 CalendarRail 迷你月历跳转目标
  const [calendarJumpDay, setCalendarJumpDay] = useState<string | null>(null);
  const [calendarTagFilter, setCalendarTagFilter] = useState<string | null>(null);
  const calendarDdls = useMemo(() => {
    if (!calendarTagFilter) return ddls;
    return ddls.filter((d) => (d.tags ?? []).some((tag) => tag === calendarTagFilter));
  }, [ddls, calendarTagFilter]);
  useEffect(() => {
    if (!calendarTagFilter) return;
    const stillExists = ddls.some((d) => (d.tags ?? []).some((tag) => tag === calendarTagFilter));
    if (!stillExists) setCalendarTagFilter(null);
  }, [ddls, calendarTagFilter]);

  // Epic 3 mount 时立即 apply localStorage 偏好(主题/字号/Phase B accent) + [072] 语言
  useEffect(() => { applyStoredPreferences(); applyStoredLang(); }, []);

  // Phase D 布局偏好：mount + 监听 LAYOUT_PREFS_EVENT 同步
  useEffect(() => {
    const sync = () => {
      setTabsOrderState(getTabsOrder());
      setHiddenTabsState(getHiddenTabs());
    };
    sync();
    window.addEventListener(LAYOUT_PREFS_EVENT, sync);
    return () => window.removeEventListener(LAYOUT_PREFS_EVENT, sync);
  }, []);

  const {
    streakDays,
    showDailyBrief,
    dismissDailyBrief,
    handleStartFocus,
    bestHourLabel,
    achievementsOpen,
    setAchievementsOpen,
  } = useDailyEngagement({
    hydrated,
    ddls,
    notes,
    messages,
    setActiveNav,
    setMiniAppsOpen,
  });

  usePanelDatasets({
    ddls,
    notes,
    sessions,
    messages,
    streakDays,
  });

  useGlobalShortcuts({
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
  });

  const {
    highlightTaskId,
    handleSearchJump,
  } = useSearchJump({
    setActiveNav,
    setNotesSelectId,
    setActiveSessionId,
  });

  // ---------- 渲染 ----------
  // 左栏二级导航内容（桌面常驻胶囊 / 手机抽屉复用同一份）
  const railContent = (
    <LeftRail>
      {!activeCustomPanelId && activeNav === "chat" && (
        <ChatRail
          sessions={orderedSessions}
          activeId={activeSessionId}
          onCreate={handleNewChat}
          onSelect={handleSelectSession}
          onRename={handleRenameSession}
          onDelete={handleDeleteSession}
        />
      )}
      {!activeCustomPanelId && activeNav === "tasks" && (
        <TasksRail
          onCreateTask={() => setEditing({ mode: "create" })}
          counts={taskCounts}
          view={taskView}
          onSelectView={setTaskView}
        />
      )}
      {!activeCustomPanelId && activeNav === "calendar" && (
        <CalendarRail
          onCreateEvent={() => setEditing({ mode: "create", presetTags: calendarTagFilter ? [calendarTagFilter] : undefined })}
          ddls={ddls}
          selectedTag={calendarTagFilter}
          onSelectTag={setCalendarTagFilter}
          onJumpToDay={(iso) => {
            setCalendarJumpDay(iso + "#" + Date.now());
          }}
        />
      )}
      {!activeCustomPanelId && activeNav === "notes" && (
        <NotesRail
          notes={notes}
          onCreate={() => {
            const fresh = handleCreateNote();
            setNotesSelectId(fresh.id);
            return fresh;
          }}
        />
      )}
    </LeftRail>
  );

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        maxWidth: isMobile ? undefined : 1600,
        margin: isMobile ? undefined : "0 auto",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "transparent",
        padding: isMobile ? "8px 8px 72px" : 12,
        gap: isMobile ? 8 : 12,
      }}
    >
      {/* [066] 壁纸层（固定全屏，在玻璃胶囊之后；无壁纸则露出 body 网格底）*/}
      <WallpaperLayer />

      {/* 顶 Bar（悬浮胶囊条）*/}
      <TopBar
        isMobile={isMobile}
        activeNav={activeNav}
        onNavChange={(id) => { setActiveNav(id); setActiveCustomPanelId(null); }}
        miniAppsOpen={miniAppsOpen}
        onToggleMiniApps={() => setMiniAppsOpen((v) => !v)}
        ddls={ddls}
        notes={notes}
        messages={messages}
        onSearchJump={handleSearchJump}
        onOpenPreferences={() => setPrefsOpen(true)}
        onOpenAchievements={() => setAchievementsOpen(true)}
        onOpenBilling={() => setBillingOpen(true)}
        onUpgrade={openPricing}
        tabsOrder={tabsOrder}
        hiddenTabs={hiddenTabs}
        onTabsReorder={(newOrder) => setTabsOrder(newOrder)}
        customPanels={customPanels}
        activeCustomPanelId={activeCustomPanelId}
        onSelectCustomPanel={(id) => setActiveCustomPanelId(id)}
        onCreateCustomPanel={handleCreateCustomPanel}
      />

      {/* 学习工具抽屉（fixed 浮在右侧，不阻塞主区操作） */}
      <MiniAppsDrawer
        open={miniAppsOpen}
        onClose={() => setMiniAppsOpen(false)}
        ddls={ddls}
        onAppendTaskNote={(taskId, line) => {
          setDdls((prev) => prev.map((d) => {
            if (d.id !== taskId) return d;
            const oldNotes = d.notes ?? "";
            const newNotes = oldNotes ? `${oldNotes}\n${line}` : line;
            return { ...d, notes: newNotes };
          }));
          toast.info("Appended to task notes");
        }}
      />

      {/* 主体：左栏 + 内容区（两个独立悬浮胶囊仓，互留间隙）*/}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", gap: isMobile ? 0 : 12 }}>
        {/* 左栏：桌面常驻胶囊；手机 fixed 抽屉（点底部菜单滑入，点遮罩关）*/}
        {isMobile ? (
          <>
            {mobileNavOpen && (
              <div
                onClick={() => setMobileNavOpen(false)}
                style={{ position: "fixed", inset: 0, background: "var(--color-overlay)", zIndex: 46 }}
              />
            )}
            <div
              ref={mobileDrawerRef}
              style={{
                position: "fixed",
                top: 8,
                left: 8,
                bottom: 8,
                width: 240,
                zIndex: 47,
                transform: mobileNavOpen ? "translateX(0)" : "translateX(-110%)",
                transition: "transform 0.3s cubic-bezier(.4,0,.2,1)",
              }}
            >
              {railContent}
            </div>
          </>
        ) : (
          railContent
        )}

        <main
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            borderRadius: "var(--radius-card)",
            border: "1px solid var(--glass-border)",
            background: "var(--glass-bg)",
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)",
            boxShadow: "var(--shadow-card-hover)",
          }}
        >
          {!activeCustomPanelId && activeNav === "chat" && (
            <ChatCanvas
              messages={visibleMessages}
              pipelines={pipelines}
              pendingBatches={pendingBatches}
              onAcceptBatch={handleAcceptBatch}
              onRejectBatch={handleRejectBatch}
              onDropChange={handleDropChange}
              onQuickAction={handleQuickAction}
              isLoading={isLoading}
              onJumpToTasks={() => setActiveNav("tasks")}
              onJumpToCalendar={() => setActiveNav("calendar")}
              inputValue={inputValue}
              onInputChange={setInputValue}
              onSend={handleSend}
              onStop={handleStopGeneration}
              onRegenerate={handleRegenerate}
              attachedFiles={attachedFiles}
              onAttach={handleAttach}
              onRemoveAttachment={handleRemoveAttachment}
              selectedModel={selectedModel}
              onSelectModel={handleSelectModel}
              ddls={ddls}
              onJumpToTask={handleJumpToTask}
              onLoadDemo={handleLoadDemo}
              hasAnyData={ddls.length > 0 || notes.length > 0}
              streakDays={streakDays}
              bestHourLabel={bestHourLabel}
              onStartFocus={handleStartFocus}
            />
          )}
          {!activeCustomPanelId && activeNav === "tasks" && (
            <TasksPanel
              ddls={ddls}
              view={taskView}
              onToggleComplete={handleToggleComplete}
              onRequestCreate={() => setEditing({ mode: "create" })}
              onQuickAdd={handleQuickAddTask}
              onRequestEdit={(d) => setEditing({ mode: "edit", item: d })}
              onRequestDelete={handleDeleteDdl}
              onRequestPreview={(a) => setPreviewing(a)}
              onRequestNotesPreview={(d) => setPreviewNotes(d)}
              onExportIcs={handleExportIcs}
              onExportJson={handleExportJson}
              onImportJson={handleImportJson}
              onImportIcs={handleImportIcs}
              onOpenRecurring={() => setRecurringOpen(true)}
              highlightTaskId={highlightTaskId}
            />
          )}
          {!activeCustomPanelId && activeNav === "calendar" && (
            <CalendarPanel
              ddls={calendarDdls}
              onRequestCreate={(presetDate, presetTime) => setEditing({ mode: "create", presetDate, presetTime, presetTags: calendarTagFilter ? [calendarTagFilter] : undefined })}
              onRequestEdit={(d) => setEditing({ mode: "edit", item: d })}
              jumpToDay={calendarJumpDay ? calendarJumpDay.split("#")[0] : null}
              onMoveEvent={handleMoveEvent}
            />
          )}
          {!activeCustomPanelId && activeNav === "notes" && (
            <NotesPanel
              notes={notes}
              onCreate={handleCreateNote}
              onUpdate={handleUpdateNote}
              onDelete={handleDeleteNote}
              ddls={ddls}
              selectActiveId={notesSelectId}
              onJumpToTask={handleJumpToTask}
              onAutoExtractTodos={handleAutoExtractTodos}
            />
          )}

          {/* Phase E 自定义面板：activeCustomPanelId 设置时盖过所有内置面板 */}
          {activeCustomPanelId && (() => {
            const panel = customPanels.find((p) => p.id === activeCustomPanelId);
            if (!panel) return null;
            return (
              <CustomPanelView
                key={panel.id}
                panel={panel}
                onUpdate={handleUpdateCustomPanel}
                onDelete={handleDeleteCustomPanel}
                dataCtx={{
                  ddls,
                  notes,
                  streakCurrent: streakDays,
                  streakLongest: streakDays,
                }}
              />
            );
          })()}

        </main>
      </div>

      {/* 手机底部主导航 tab bar（替代 TopBar pill-nav）*/}
      {isMobile && (
        <MobileTabBar
          activeNav={activeNav}
          inCustomPanel={!!activeCustomPanelId}
          onNavChange={(id) => { setActiveNav(id); setActiveCustomPanelId(null); }}
          onOpenNav={() => setMobileNavOpen(true)}
        />
      )}

      <AppPortals
        editing={editing}
        onCancelEditing={() => setEditing(null)}
        onSubmitEdit={handleSubmitEdit}
        onDeleteDdl={handleDeleteDdl}
        notes={notes}
        onCreateLinkedNote={handleCreateLinkedNote}
        onJumpToNote={handleJumpToNote}
        onUnlinkNote={handleUnlinkNote}
        previewing={previewing}
        onClosePreviewing={() => setPreviewing(null)}
        previewNotes={previewNotes}
        onClosePreviewNotes={() => setPreviewNotes(null)}
        shortcutsOpen={shortcutsOpen}
        onCloseShortcuts={() => setShortcutsOpen(false)}
        prefsOpen={prefsOpen}
        onClosePreferences={() => setPrefsOpen(false)}
        achievementsOpen={achievementsOpen}
        onCloseAchievements={() => setAchievementsOpen(false)}
        ddls={ddls}
        streakDays={streakDays}
        billingOpen={billingOpen}
        onCloseBilling={() => setBillingOpen(false)}
        onOpenPricing={openPricing}
        onBillingCancelled={handleBillingCancelled}
        pricingOpen={pricingOpen}
        onClosePricing={() => setPricingOpen(false)}
        subscription={subscription}
        onCheckout={handleCheckout}
        onBuyPack={handleBuyPack}
        onDowngradeFree={handleDowngradeFree}
        checkout={checkout}
        onCloseCheckout={() => setCheckout(null)}
        onCheckoutConfirmed={handleCheckoutConfirmed}
        quotaWallOpen={quotaWallOpen}
        creditsWall={creditsWall}
        canFallbackFlash={canFallbackFlash}
        onSwitchFlash={handleSwitchFlash}
        onTopUp={handleTopUp}
        onUpgrade={handleTopUp}
        onCloseQuotaWall={closeQuotaWall}
        recurringOpen={recurringOpen}
        onCloseRecurring={() => setRecurringOpen(false)}
        onRecurringChanged={runMaterialize}
      />
    </div>
  );
}
