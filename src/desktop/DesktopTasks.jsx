import { useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, View } from 'react-native-web';
import { Progress } from '../bito/Progress.jsx';
import { BitoText as Text } from '../bito/Typography.jsx';
import { formatDate, priorities, statuses, summarizeTasks } from '../model.js';
import { CompletionGauge } from '../TaskSummary.jsx';

import { Button, Empty, Icon, PageTitle, colors, s } from '../ui.jsx';
import { desktopTaskList } from './tasksModel.js';
import { setTaskSoundsEnabled, subscribeTaskSounds, taskSoundsEnabled } from './taskFeedback.js';
import { useTaskCompletion } from './useTaskCompletion.js';
import { DesktopTaskCheck } from './DesktopTaskCheck.jsx';

const views = [
  { id: 'active', label: 'Active', title: 'Active tasks', icon: 'file-tray-outline' },
  { id: 'in_progress', label: 'In progress', title: 'In progress', icon: 'play-circle-outline' },
  { id: 'upcoming', label: 'Upcoming', title: 'Upcoming tasks', icon: 'time-outline' },
  { id: 'all', label: 'All tasks', title: 'All tasks', icon: 'list-outline' },
  { id: 'done', label: 'Completed', title: 'Completed tasks', icon: 'checkmark-circle-outline' },
];

function DesktopTaskRow({ task, today, saving, onOpen, onToggle, onDrawn, selected, phase }) {
  const done = task.status === 'done';
  const settled = done && (!phase || phase === 'settled');
  const overdue = !done && !!task.dueDate && task.dueDate < today;
  const date = task.dueDate
    ? formatDate(task.dueDate, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Unscheduled';
  return (
    <div className="desktop-task-row" data-selected={selected} data-done={settled} data-phase={phase}>
      <DesktopTaskCheck task={task} saving={saving} onToggle={onToggle} onDrawn={onDrawn} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${task.taskName}`}
        onPress={() => onOpen(task)}
        style={({ pressed }) => [styles.details, pressed && s.dim]}
      >
        <View style={s.grow}>
          <Text style={[s.itemTitle, settled && styles.doneTitle]}>{task.taskName}</Text>
          {!!task.description && (
            <Text style={styles.note} numberOfLines={2}>
              {task.description}
            </Text>
          )}
          {task.tags.length > 0 && (
            <Text style={styles.tags} numberOfLines={2}>
              {task.tags.map((tag) => '#' + tag).join('   ')}
            </Text>
          )}
        </View>
        <View style={styles.metadata}>
          <Text style={[styles.date, overdue && styles.overdue]}>
            {[date, task.dueTime].filter(Boolean).join(' · ')}
          </Text>
          <Text style={styles.note}>
            {statuses[task.status]} · {priorities[task.priority]} priority
          </Text>
        </View>
      </Pressable>
    </div>
  );
}

export function DesktopTasks({
  tasks,
  today,
  filter,
  onFilter,
  onAdd,
  onToggle,
  view: controlledView,
  selectedId,
  onView,
  ...actions
}) {
  const [localView, setLocalView] = useState('active');
  const sounds = useSyncExternalStore(subscribeTaskSounds, taskSoundsEnabled, taskSoundsEnabled);
  const completion = useTaskCompletion(onToggle);
  const preferredView = controlledView ?? localView;
  const view = filter === 'done' ? 'done' : preferredView === 'done' ? 'active' : preferredView;
  const {
    counts,
    sections: actualSections,
    tags,
    todayDone,
    todayTotal,
  } = useMemo(() => desktopTaskList(tasks, today, view), [tasks, today, view]);
  const summary = useMemo(() => summarizeTasks(tasks), [tasks]);
  // Keep transitioning items in their original section while all statistics use the saved tasks.
  const sections = completion.rows.size
    ? desktopTaskList(
        tasks.map((task) => completion.rows.get(task.id)?.original ?? task),
        today,
        view
      ).sections
    : actualSections;
  const savedTasks = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const title = views.find((option) => option.id === view).title;

  function select(next) {
    if (view !== next) completion.reset();
    setLocalView(next);
    onView?.(next);
    onFilter(next === 'done' ? 'done' : 'active');
  }

  return (
    <View testID="desktop-tasks" style={styles.workspace}>
      <ScrollView
        role="complementary"
        accessibilityLabel="Task views"
        style={styles.rail}
        contentContainerStyle={styles.railContent}
      >
        <Button label="New task" icon="add" onPress={onAdd} />
        <Text accessibilityRole="header" style={styles.railHeading}>
          Views
        </Text>
        {views.map((option) => {
          const selected = view === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              aria-pressed={selected}
              accessibilityLabel={option.label}
              onPress={() => select(option.id)}
              style={({ pressed }) => [styles.railItem, selected && styles.selected, pressed && s.dim]}
            >
              <Icon name={option.icon} size={17} color={selected ? colors.accent : colors.muted} />
              <Text style={[styles.railLabel, selected && styles.selectedLabel]}>{option.label}</Text>
              <Text style={styles.count}>{counts[option.id]}</Text>
            </Pressable>
          );
        })}
        <View style={styles.summary}>
          <Text accessibilityRole="header" style={styles.railHeading}>
            Task summary
          </Text>
          <CompletionGauge {...summary} compact />
          <Text style={styles.tally}>
            {summary.completed} of {summary.total} tasks completed
          </Text>
          <button
            type="button"
            role="switch"
            aria-label="Task sounds"
            aria-checked={sounds}
            className="desktop-task-sound"
            onClick={() => setTaskSoundsEnabled(!sounds)}
          >
            Task sounds · {sounds ? 'On' : 'Off'}
          </button>
        </View>
        <View style={styles.brief}>
          <Text style={styles.railHeading}>Today’s progress</Text>
          <Text style={s.itemTitle}>
            {todayDone} of {todayTotal} done
          </Text>
          <Progress done={todayDone} total={todayTotal} />
        </View>
      </ScrollView>
      <SectionList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        sections={sections}
        keyExtractor={(task) => task.id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text accessibilityRole="header" style={styles.group}>
            {section.title} · {section.data.length}
          </Text>
        )}
        renderItem={({ item }) => (
          <DesktopTaskRow
            task={savedTasks.get(item.id) ?? item}
            selected={item.id === selectedId}
            today={today}
            phase={completion.rows.get(item.id)?.phase}
            onToggle={completion.toggle}
            onDrawn={completion.drawn}
            {...actions}
          />
        )}
        ListHeaderComponent={
          <>
            <PageTitle
              title={title}
              subtitle={formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}
            />
            {tags.length > 0 && (
              <View style={styles.tagCloud}>
                {tags.map((tag) => (
                  <View key={tag.tag} style={styles.tagChip}>
                    <Text style={styles.tagName} numberOfLines={1}>
                      #{tag.tag}
                    </Text>
                    <Text style={styles.tagCount} accessibilityLabel={`${tag.done} of ${tag.total} completed`}>
                      {tag.done}/{tag.total}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <Empty
            icon={view === 'done' ? 'checkmark-done-outline' : 'list-outline'}
            title={
              view === 'done'
                ? 'No completed tasks yet'
                : view === 'active'
                  ? 'You’re all caught up'
                  : 'No tasks in this view'
            }
            hint={
              view === 'done'
                ? 'Tasks you mark as done will appear here.'
                : view === 'upcoming'
                  ? 'Tasks due today or later appear here.'
                  : view === 'in_progress'
                    ? 'Set a task’s status to In progress to see it here.'
                    : 'Add a task for your next study session.'
            }
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  workspace: { flex: 1, minWidth: 0, minHeight: 0, flexDirection: 'row', gap: 12 },
  rail: { width: 220, flexGrow: 0, flexShrink: 0, backgroundColor: 'rgba(250,250,250,.84)' },
  railContent: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 24, gap: 3 },
  railHeading: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 16, marginBottom: 4 },
  railItem: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 9, paddingHorizontal: 10 },
  selected: { backgroundColor: colors.soft },
  railLabel: { flex: 1, fontSize: 14, color: colors.ink },
  selectedLabel: { color: colors.deep, fontWeight: '700' },
  count: { fontSize: 13, color: colors.muted },
  brief: { marginTop: 18, gap: 6, paddingHorizontal: 8 },
  summary: { gap: 6, paddingHorizontal: 8 },
  tally: { color: colors.ink, fontSize: 14, textAlign: 'center' },
  list: { flex: 1, minWidth: 0 },
  listContent: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  group: { paddingTop: 16, paddingBottom: 8, color: colors.muted, fontSize: 13, fontWeight: '700' },
  details: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingRight: 14,
  },
  doneTitle: { color: colors.muted, textDecorationLine: 'line-through' },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  tags: { color: colors.accent, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  metadata: { width: '32%', maxWidth: 170, alignItems: 'flex-end', gap: 2 },
  date: { color: colors.ink, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  overdue: { color: colors.danger },
  tagCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  tagChip: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: colors.soft,
  },
  tagName: { flexShrink: 1, fontSize: 12, fontWeight: '700', color: colors.deep },
  tagCount: { fontSize: 12, color: colors.muted },
});
