import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  BackHandler,
  Keyboard,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native-web';
import { BitoText as Text } from './src/bito/Typography.jsx';
import { BitoGlyph } from './src/bito/BitoGlyph.jsx';
import { AgentMark } from './src/chat/AgentMark.jsx';
import { PageBackground } from './src/bito/PageBackground.jsx';
import { randomUUID } from './src/id.js';
import { AssistantScreen } from './src/AssistantScreen.jsx';
import { TaskSummary } from './src/TaskSummary.jsx';
import { useAssistant } from './src/useAssistant.js';
import { TaskEditor, TextEditor } from './src/editors.jsx';
import { blankTask, dateKey, upsert } from './src/model.js';
import { CalendarScreen, NotesScreen, TasksScreen } from './src/screens.jsx';
import { DesktopTasks } from './src/desktop/DesktopTasks.jsx';
import { playTaskSound, prepareTaskSound } from './src/desktop/taskFeedback.js';
import { dismissDesktopTaskEffects } from './src/desktop/useTaskCompletion.js';
import { reviseTasks } from './src/desktop/taskEdits.js';
import { DesktopNotes } from './src/desktop/DesktopVault.jsx';
import { DesktopBrand } from './src/desktop/DesktopBrand.jsx';
import { DesktopSearch } from './src/desktop/DesktopSearch.jsx';
import { DesktopDashboard } from './src/dashboard/DesktopDashboard.jsx';
import { desktopTabKeyboard } from './src/desktop/tabKeyboard.js';
import { EditorSurface } from './src/desktop/EditorSurface.jsx';

import { Button, Empty, SourceButton, colors, s } from './src/ui.jsx';
import { useScreenTransition } from './src/useScreenTransition.js';
import { useKeyboardLayout } from './src/useKeyboardLayout.js';
import { useWorkspace } from './src/useWorkspace.js';

const tabs = [
  { id: 'assistant', label: 'Assistant', icon: 'chatbubble-ellipses-outline' },
  { id: 'tasks', label: 'Tasks', icon: 'list-outline' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar-outline' },
  { id: 'notes', label: 'Notes', icon: 'document-text-outline' },
  { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
];

const refreshColors = [
  colors.deep,
  colors.navy,
  '#21445E',
  '#2B526D',
  '#35627F',
  '#467B99',
  '#6798B3',
  '#91B3C5',
  colors.border,
  colors.soft,
];

function TabBar({ current, onPick, desktop = false, disabled = false }) {
  const { width } = useWindowDimensions();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Workspace"
      style={desktop ? styles.railTabs : styles.tabs}
      {...(desktop ? desktopTabKeyboard : undefined)}
    >
      {tabs
        .filter(({ id }) => id !== 'dashboard' || Platform.OS === 'web')
        .map(({ id, label, icon }) => {
          const selected = current === id;
          const name = desktop && id === 'assistant' ? 'Agent' : label;
          return (
            <SourceButton
              key={id}
              accessibilityRole="tab"
              accessibilityLabel={name}
              selected={selected}
              tabIndex={desktop ? (selected && !disabled ? 0 : -1) : undefined}
              onPress={() => onPick(id)}
              tab
              visualMinHeight={34}
              disabled={disabled}
              style={desktop ? [styles.railTab, id === 'dashboard' && styles.railDashboardTab] : styles.tab}
            >
              {(dark) => {
                const color = dark || selected ? '#FFFFFF' : colors.deep;
                return (
                  <View style={desktop ? styles.railTabContent : styles.tabContent}>
                    {id === 'assistant' ? (
                      <AgentMark size={desktop ? 22 : 19} color={color} selected={selected} />
                    ) : (
                      <BitoGlyph
                        name={icon}
                        color={dark ? colors.onDark : colors.accent}
                        size={!desktop && id === 'dashboard' ? 14 : 19}
                        strokeWidth={5.5}
                      />
                    )}
                    <Text
                      style={[
                        styles.tabLabel,
                        desktop && styles.railTabLabel,
                        !desktop && id === 'dashboard' && width < 365 && styles.smallDashboardLabel,
                        { color },
                        selected && styles.tabLabelSelected,
                      ]}
                    >
                      {name}
                    </Text>
                  </View>
                );
              }}
            </SourceButton>
          );
        })}
    </View>
  );
}

function StudyPlanner() {
  const { workspace, saving, saveError, clearSaveError, loadError, retry, commit } = useWorkspace();
  const motion = useScreenTransition();
  const keyboard = useKeyboardLayout();
  const assistant = useAssistant(workspace);
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
  const [tab, setTab] = useState('assistant');
  const [filter, setFilter] = useState('active');
  const [taskView, setTaskView] = useState('active');
  const [calendarView, setCalendarView] = useState('month');
  const [today, setToday] = useState(() => dateKey(new Date()));
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(`${today.slice(0, 7)}-01`);
  const [showSummary, setShowSummary] = useState(false);
  const [searchMessageId, setSearchMessageId] = useState();
  const [editor, setEditor] = useState(null);
  const finishingEditor = useRef(false);
  const [editorOpenedOnDesktop, setEditorOpenedOnDesktop] = useState(false);
  const [editorFromSearch, setEditorFromSearch] = useState(false);
  const [searchNote, setSearchNote] = useState();
  const [selectedTaskId, setSelectedTaskId] = useState();
  const [addedTask, setAddedTask] = useState();

  useEffect(() => {
    if (desktop && showSummary) setShowSummary(false);
  }, [desktop, showSummary]);

  useEffect(() => {
    setAddedTask(undefined);
  }, [tab, desktop]);
  useEffect(() => {
    if (!addedTask) return;
    const timer = setTimeout(() => setAddedTask(undefined), 2400);
    return () => clearTimeout(timer);
  }, [addedTask]);

  useEffect(() => {
    const refresh = () => setToday(dateKey(new Date()));
    const id = setInterval(refresh, 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(id);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (motion.visible || saving) return true;
      if (editor) {
        clearSaveError();
        motion.transition(() => setEditor(null), true);
        return true;
      }
      if (showSummary) {
        motion.transition(() => setShowSummary(false), true);
        return true;
      }
      if (tab !== 'assistant') {
        motion.transition(() => setTab('assistant'), true);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [editor, motion, saving, showSummary, tab, clearSaveError]);

  function pickDate(date) {
    if (desktop && date !== selected) dismissDesktopTaskEffects();
    setSelected(date);
    setMonth(`${date.slice(0, 7)}-01`);
  }

  function open(route) {
    if (saving) return;
    if (desktop) dismissDesktopTaskEffects();
    clearSaveError();
    motion.transition(() => {
      setEditorFromSearch(false);
      setEditorOpenedOnDesktop(desktop);
      finishingEditor.current = false;
      if (desktop && route.kind === 'task' && route.existing) setSelectedTaskId(route.item.id);
      setEditor(route);
    });
  }

  function close() {
    if (saving) return;
    Keyboard.dismiss();
    clearSaveError();
    motion.transition(() => setEditor(null), true);
  }

  function finishSave(onSaved) {
    finishingEditor.current = true;
    Keyboard.dismiss();
    motion.transition(() => {
      setEditor(null);
      onSaved?.();
    }, true);
  }

  async function save(change, onSaved) {
    if (finishingEditor.current) return;
    if (await commit(change)) finishSave(onSaved);
  }

  async function reviseTask(request) {
    if (finishingEditor.current) return;
    let conflict;
    const written = await commit((data) => {
      const result = reviseTasks(data.tasks, request);
      conflict = result.conflict;
      return result.tasks === data.tasks ? data : { ...data, tasks: result.tasks };
    });
    if (written && !conflict) finishSave();
    return conflict;
  }

  function saveTask(task, announce) {
    if (announce) prepareTaskSound();
    void save(
      (data) => ({ ...data, tasks: upsert(data.tasks, task) }),
      announce
        ? () => {
            setAddedTask(task);
            playTaskSound('added');
          }
        : undefined
    );
  }

  function newTask(date = dateKey(new Date()), dueTime = '') {
    open({ kind: 'task', existing: false, item: { ...blankTask(randomUUID(), date), dueTime } });
  }

  function deleteRecord() {
    if (!editor) return;
    const id = editor.item.id;
    void save((data) => {
      switch (editor.kind) {
        case 'task':
          return { ...data, tasks: data.tasks.filter((task) => task.id !== id) };
        case 'note':
          return { ...data, notes: data.notes.filter((note) => note.id !== id) };
      }
    });
  }

  const taskActions = {
    saving,
    onOpen: (task) => open({ kind: 'task', existing: true, item: task }),
    onToggle: async (task) => {
      let changed = false;
      const wasDone = task.status === 'done';
      const success = await commit((data) => {
        const stored = data.tasks.find((item) => item.id === task.id);
        if (!stored || (stored.status === 'done') !== wasDone) return data;
        changed = true;
        return {
          ...data,
          tasks: data.tasks.map((item) =>
            item === stored ? { ...item, status: wasDone ? 'todo' : 'done' } : item
          ),
        };
      });
      return success && changed;
    },
  };

  function openSummary() {
    motion.transition(() => setShowSummary(true));
  }

  function pickTab(next) {
    if (editor || (tab === next && !showSummary && !motion.isDesktopTransitioning())) return;
    if (desktop) dismissDesktopTaskEffects();
    const backwards =
      (showSummary && tab === next) ||
      tabs.findIndex(({ id }) => id === next) < tabs.findIndex(({ id }) => id === tab);
    motion.transition(() => {
      setShowSummary(false);
      setSearchMessageId(undefined);
      setSearchNote(undefined);
      setTab(next);
    }, backwards);
  }

  function addNote() {
    open({ kind: 'note', existing: false, item: { id: randomUUID(), title: '', content: '', updatedAt: 0 } });
  }

  function openNote(item) {
    open({ kind: 'note', existing: true, item });
  }

  function openSearchResult(route) {
    if (saving || editor) return;
    dismissDesktopTaskEffects();
    clearSaveError();
    motion.transition(() => {
      setTab(route.kind === 'note' ? 'notes' : 'tasks');
      setShowSummary(false);
      if (route.kind === 'note') {
        setSearchNote({ id: route.item.id });
        return;
      }
      const view = route.item.status === 'done' ? 'done' : 'active';
      setFilter(view);
      setTaskView(view);
      setSelectedTaskId(route.item.id);
      setEditorFromSearch(true);
      setEditorOpenedOnDesktop(true);
      finishingEditor.current = false;
      setEditor(route);
    });
  }

  function openChatMessage(id) {
    if (saving || editor) return;
    dismissDesktopTaskEffects();
    motion.transition(() => {
      setTab('assistant');
      setShowSummary(false);
      setSearchMessageId((previous) => ({ id, request: (previous?.request ?? 0) + 1 }));
    });
  }

  function moveTask(task, dueDate, dueTime) {
    void commit((data) => ({
      ...data,
      tasks: data.tasks.map((item) => (item.id === task.id ? { ...item, dueDate, dueTime } : item)),
    }));
  }

  function editorContent(route) {
    const actions = { saving, saveError, onClose: close, onDelete: deleteRecord };
    if (route.kind === 'task') {
      return (
        <TaskEditor
          key={route.item.id}
          route={route}
          {...actions}
          onRevise={(desktop || editorOpenedOnDesktop) && route.existing ? reviseTask : undefined}
          onCopy={(task) => saveTask({ ...task, id: randomUUID() }, desktop)}
          onSave={(task) => saveTask(task, desktop && !route.existing)}
        />
      );
    }
    return (
      <TextEditor
        key={route.item.id}
        route={route}
        {...actions}
        onSave={(item) => void save((data) => ({ ...data, notes: upsert(data.notes, item) }))}
      />
    );
  }

  function content() {
    if (!workspace) {
      return (
        <View style={[s.content, styles.loading]}>
          {loadError ? (
            <Empty
              icon="alert-circle-outline"
              title="Study data couldn’t be opened"
              hint="Your saved data hasn’t been changed."
              action={<Button label="Try again" onPress={retry} />}
            />
          ) : (
            <ActivityIndicator accessibilityLabel="Loading study data" color={colors.accent} size="large" />
          )}
        </View>
      );
    }
    if (!desktop && showSummary) {
      return (
        <TaskSummary tasks={workspace.tasks} onBack={() => motion.transition(() => setShowSummary(false), true)} />
      );
    }

    switch (tab) {
      case 'assistant':
        return (
          <AssistantScreen
            assistant={assistant}
            keyboardOpen={keyboard.open}
            desktop={desktop}
            searchMessageId={searchMessageId}
          />
        );
      case 'tasks':
        if (desktop)
          return (
            <DesktopTasks
              tasks={workspace.tasks}
              today={today}
              filter={filter}
              onFilter={setFilter}
              view={taskView}
              onView={setTaskView}
              selectedId={selectedTaskId}
              onAdd={() => newTask()}
              {...taskActions}
            />
          );
        return (
          <TasksScreen
            tasks={workspace.tasks}
            today={today}
            filter={filter}
            onFilter={setFilter}
            onAdd={() => newTask()}
            onSummary={openSummary}
            {...taskActions}
          />
        );
      case 'calendar':
        return (
          <CalendarScreen
            tasks={workspace.tasks}
            today={today}
            selected={selected}
            month={month}
            desktop={desktop}
            view={calendarView}
            onViewChange={setCalendarView}
            onPick={pickDate}
            onMonth={pickDate}
            onAdd={newTask}
            onMove={saving ? undefined : moveTask}
            {...taskActions}
          />
        );
      case 'notes':
        return desktop ? (
          <DesktopNotes notes={workspace.notes} commit={commit} searchNote={searchNote} />
        ) : (
          <NotesScreen notes={workspace.notes} onAdd={addNote} onOpen={openNote} />
        );
      case 'dashboard':
        return <DesktopDashboard workspace={workspace} today={today} />;
    }
  }

  return (
    <View
      testID="butler-app"
      style={[styles.safe, keyboard.viewport && { ...styles.keyboardViewport, ...keyboard.viewport }]}
    >
      <PageBackground />
      <View
        testID={desktop ? 'desktop-workspace' : 'mobile-workspace'}
        style={[styles.frame, desktop && styles.desktopFrame]}
        pointerEvents={motion.visible ? 'none' : 'auto'}
        accessibilityElementsHidden={motion.visible}
        importantForAccessibility={motion.visible ? 'no-hide-descendants' : 'auto'}
      >
        {desktop && (
          <View role="banner" style={styles.desktopHeader}>
            <DesktopBrand />
            {!!workspace && <TabBar current={tab} onPick={pickTab} desktop disabled={!!editor || saving} />}
            {!!workspace && (
              <DesktopSearch
                tasks={workspace.tasks}
                notes={workspace.notes}
                messages={assistant.messages}
                disabled={!!editor || saving}
                onChatMessage={openChatMessage}
                onTask={(item) => openSearchResult({ kind: 'task', existing: true, item })}
                onNote={(item) => openSearchResult({ kind: 'note', existing: true, item })}
              />
            )}
          </View>
        )}
        {(!editor || desktop) && (
          <View style={styles.contentFrame}>
            {!editor && saveError && (
              <Text accessibilityRole="alert" style={[s.error, styles.banner]}>
                Couldn’t save changes. Please try again.
              </Text>
            )}
            {content()}
            {desktop && (
              <div role="status" aria-live="polite" aria-atomic="true" className="desktop-task-status">
                {!editor && addedTask && (
                  <div key={addedTask.id} className="desktop-task-added">
                    Task added · {addedTask.taskName}
                  </div>
                )}
              </div>
            )}
            {!desktop && !keyboard.open && !editor && workspace && <TabBar current={tab} onPick={pickTab} />}
          </View>
        )}
        {editor && (
          <EditorSurface
            desktop={desktop}
            label={`${editor.existing ? 'Edit' : 'New'} ${editor.kind}`}
            saving={saving}
            fromSearch={editorFromSearch}
            onCancel={close}
          >
            {editorContent(editor)}
          </EditorSurface>
        )}
      </View>
      {motion.visible && (
        <View
          pointerEvents="none"
          accessible={false}
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          testID="screen-refresh"
          style={styles.cover}
        >
          {motion.strips.map((translateX, index) => (
            <View key={index} style={styles.strip}>
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: refreshColors[motion.reverse ? refreshColors.length - 1 - index : index],
                    transform: [{ translateX }],
                  },
                ]}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function App() {
  return <StudyPlanner />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page, overflow: 'hidden' },
  keyboardViewport: { position: 'absolute', left: 0, right: 0, flex: 0, minHeight: 0 },
  frame: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
  desktopFrame: { maxWidth: 1600, paddingTop: 22, paddingHorizontal: 28, paddingBottom: 28, gap: 12 },
  contentFrame: { flex: 1, minWidth: 0, minHeight: 0 },
  desktopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 22,
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(250,250,250,.84)',
    zIndex: 2,
  },
  railTabs: { flexDirection: 'row', gap: 4 },
  railTab: { width: 104, height: 56, alignItems: 'center', justifyContent: 'center' },
  railDashboardTab: { width: 132 },
  railTabContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  railTabLabel: { fontSize: 13, lineHeight: 17, textAlign: 'left' },
  loading: { flex: 1, justifyContent: 'center' },
  banner: { marginHorizontal: 20, marginTop: 8 },
  tabs: { flexDirection: 'row', paddingHorizontal: 3, gap: 2 },
  tab: { flex: 1, minWidth: 0, height: 64, alignItems: 'center', justifyContent: 'center' },
  tabContent: { alignItems: 'center', gap: 2 },
  tabLabel: { fontSize: 11, lineHeight: 12, textAlign: 'center', fontWeight: '600' },
  smallDashboardLabel: { fontSize: 9.5 },
  tabLabelSelected: { fontWeight: '800' },
  cover: { ...StyleSheet.absoluteFill, zIndex: 10, overflow: 'hidden' },
  strip: { flex: 1 },
});
