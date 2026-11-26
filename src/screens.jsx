import {
  FlatList,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native-web';
import { BitoText as Text } from './bito/Typography.jsx';
import { dateKey, formatDate, priorities, sortTasks, statuses, studyBrief } from './model.js';
import { MonthGrid } from './MonthGrid.jsx';
import { DesktopCalendar } from './desktop/DesktopCalendar.jsx';
import { DesktopTaskCheck } from './desktop/DesktopTaskCheck.jsx';
import { useTaskCompletion } from './desktop/useTaskCompletion.js';
import { Progress } from './bito/Progress.jsx';
import { Button, Choices, DetroitContainer, Empty, Icon, PageTitle, colors, s } from './ui.jsx';

function TaskRow({ task, saving, onOpen, onToggle, onDark = false, control, settled }) {
  const done = task.status === 'done';
  const secondaryText = onDark ? styles.lightText : undefined;
  const schedule = task.dueDate
    ? [formatDate(task.dueDate, { month: 'short', day: 'numeric' }), task.dueTime].filter(Boolean).join(' · ')
    : 'Unscheduled';

  return (
    <View style={[s.card, styles.taskCard, onDark && styles.agendaTask]}>
      {control ?? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`Mark ${task.taskName} as ${done ? 'to do' : 'done'}`}
          aria-checked={done}
          aria-disabled={saving}
          disabled={saving}
          onPress={() => onToggle(task)}
          style={({ pressed }) => [styles.checkboxTarget, pressed && s.dim]}
        >
          <View style={[styles.checkbox, done && styles.checked]}>
            {done && <Icon name="checkmark" size={16} color="#FFFFFF" />}
          </View>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${task.taskName}`}
        onPress={() => onOpen(task)}
        style={({ pressed }) => [styles.taskBody, pressed && s.dim]}
      >
        <Text style={[s.itemTitle, (settled ?? done) && styles.doneTitle, secondaryText]}>{task.taskName}</Text>
        <Text style={[s.subtitle, secondaryText]}>
          {schedule} · {priorities[task.priority]} · {statuses[task.status]}
        </Text>
        {!!task.description && (
          <Text style={[s.subtitle, secondaryText]} numberOfLines={2}>
            {task.description}
          </Text>
        )}
        {task.tags.length > 0 && (
          <Text style={[styles.tags, secondaryText]} numberOfLines={2}>
            {task.tags.join('  ·  ')}
          </Text>
        )}
      </Pressable>
      <View style={styles.chevron} pointerEvents="none">
        <Icon name="chevron-forward" size={17} color={onDark ? colors.onDark : colors.muted} />
      </View>
    </View>
  );
}

function DesktopAgendaTask({ task, ...actions }) {
  const completion = useTaskCompletion(actions.onToggle);
  const phase = completion.rows.get(task.id)?.phase;
  const settled = task.status === 'done' && (!phase || phase === 'settled');
  return (
    <div className="desktop-task-row desktop-agenda-task" data-phase={phase} data-done={settled}>
      <TaskRow
        task={task}
        {...actions}
        onDark
        settled={settled}
        control={
          <DesktopTaskCheck
            task={task}
            saving={actions.saving}
            onToggle={completion.toggle}
            onDrawn={completion.drawn}
          />
        }
      />
    </div>
  );
}

const filterOptions = [
  { value: 'active', label: 'Active' },
  { value: 'done', label: 'Completed' },
];

export function TasksScreen({ tasks, today, filter, onFilter, onAdd, onSummary, ...actions }) {
  const brief = studyBrief(tasks, today);
  const todayTotal = brief.doneToday + brief.today.length;
  const sections = (
    filter === 'done'
      ? [{ title: 'Completed', data: sortTasks(tasks.filter((task) => task.status === 'done')) }]
      : [
          { title: 'Due today', data: brief.today },
          { title: 'Overdue', data: brief.overdue },
          { title: 'Coming up', data: brief.next },
          { title: 'Unscheduled', data: brief.unscheduled },
        ]
  ).filter(({ data }) => data.length > 0);

  return (
    <SectionList
      style={s.screen}
      contentContainerStyle={s.content}
      sections={sections}
      stickySectionHeadersEnabled={false}
      keyExtractor={(task) => task.id}
      renderSectionHeader={({ section }) => (
        <Text accessibilityRole="header" style={s.section}>
          {section.title} · {section.data.length}
        </Text>
      )}
      renderItem={({ item }) => <TaskRow task={item} {...actions} />}
      ListHeaderComponent={
        <>
          <PageTitle
            title="Tasks"
            subtitle={formatDate(today, { weekday: 'long', month: 'long', day: 'numeric' })}
            action={<Button label="New task" icon="add" onPress={onAdd} />}
          />
          <DetroitContainer variant="stacked" style={styles.focus}>
            <View style={s.row}>
              <Icon name="today-outline" color={colors.onDark} size={18} />
              <Text style={styles.focusLabel}>Today’s progress</Text>
            </View>
            <Text style={styles.focusTitle}>
              {brief.doneToday} of {todayTotal} done
            </Text>
            <Progress done={brief.doneToday} total={todayTotal} onDark />
          </DetroitContainer>
          <View style={styles.taskControls}>
            <Button label="View summary" icon="pie-chart-outline" secondary onPress={onSummary} />
            <Choices label="Tasks" options={filterOptions} current={filter} onChange={onFilter} />
          </View>
        </>
      }
      ListEmptyComponent={
        <View style={styles.afterHeader}>
          <Empty
            icon={filter === 'done' ? 'checkmark-done-outline' : 'list-outline'}
            title={filter === 'done' ? 'No completed tasks yet' : 'You’re all caught up'}
            hint={
              filter === 'done'
                ? 'Tasks you mark as done will appear here.'
                : 'Add a task for your next study session.'
            }
          />
        </View>
      }
    />
  );
}

export function CalendarScreen({
  tasks,
  today,
  selected,
  month,
  onPick,
  onMonth,
  onAdd,
  desktop,
  view,
  onViewChange,
  onMove,
  ...actions
}) {
  const agenda = sortTasks(tasks.filter((task) => task.dueDate === selected));
  const wide = useWindowDimensions().width > 980;
  const heading = <PageTitle title="Calendar" subtitle="See what’s due and when." />;
  const grid = (
    <MonthGrid
      month={month}
      selected={selected}
      today={today}
      tasks={tasks}
      desktop={desktop}
      onPick={onPick}
      onMonth={onMonth}
      onToday={() => onPick(dateKey(new Date()))}
      onOpenTask={
        desktop
          ? (task) => {
              onPick(task.dueDate);
              actions.onOpen(task);
            }
          : undefined
      }
    />
  );
  const selectedAgenda = (
    <DetroitContainer variant="stacked" style={styles.agenda}>
      <Text accessibilityRole="header" style={styles.agendaTitle}>
        {formatDate(selected, { weekday: 'long', month: 'long', day: 'numeric' })}
      </Text>
      <Text style={styles.agendaCount}>
        {agenda.length} {agenda.length === 1 ? 'task' : 'tasks'}
      </Text>
      {agenda.map((task) =>
        desktop ? (
          <DesktopAgendaTask key={task.id} task={task} {...actions} />
        ) : (
          <TaskRow key={task.id} task={task} onDark {...actions} />
        )
      )}
      {!agenda.length && <Text style={[s.itemTitle, styles.lightText]}>Nothing due</Text>}
      {!desktop && <Button icon="add" label="New task" onDark secondary onPress={() => onAdd(selected)} />}
    </DetroitContainer>
  );

  if (desktop)
    return (
      <DesktopCalendar
        monthGrid={grid}
        agenda={selectedAgenda}
        tasks={tasks}
        selected={selected}
        today={today}
        view={view}
        onViewChange={onViewChange}
        onPick={onPick}
        onOpen={actions.onOpen}
        onAdd={onAdd}
        onMove={onMove}
      />
    );
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      {heading}
      <View style={wide && styles.calendarColumns}>
        <View style={wide && s.grow}>{grid}</View>
        <View style={wide && styles.agendaColumn}>{selectedAgenda}</View>
      </View>
    </ScrollView>
  );
}

export function NotesScreen({ notes, onAdd, onOpen }) {
  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={s.content}
      data={[...notes].sort((a, b) => b.updatedAt - a.updatedAt)}
      keyExtractor={(note) => note.id}
      ListHeaderComponent={
        <PageTitle
          title="Notes"
          subtitle="Keep your study ideas in one place."
          action={<Button label="New note" icon="add" onPress={onAdd} />}
        />
      }
      ListEmptyComponent={
        <Empty
          icon="document-text-outline"
          title="No notes yet"
          hint="Start with a revision summary or a question to revisit."
        />
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.title}`}
          onPress={() => onOpen(item)}
          style={({ pressed }) => [s.card, pressed && s.dim]}
        >
          <View style={s.row}>
            <Icon name="document-text-outline" color={colors.accent} size={17} />
            <Text style={[s.itemTitle, s.grow]}>{item.title}</Text>
            <Icon name="chevron-forward" size={17} color={colors.muted} />
          </View>
          <Text style={s.subtitle} numberOfLines={3}>
            {item.content || 'Empty note'}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  taskControls: { gap: 12 },
  focus: { padding: 18, gap: 9 },
  focusLabel: { fontSize: 14, fontWeight: '600', color: colors.onDark },
  focusTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', letterSpacing: -0.6 },
  afterHeader: { marginTop: 14 },
  taskCard: { flexDirection: 'row', alignItems: 'center', padding: 0, gap: 0 },
  agendaTask: { backgroundColor: 'transparent', marginBottom: 0 },
  lightText: { color: colors.onDark },
  checkboxTarget: { minHeight: 48, width: 48, alignItems: 'center', justifyContent: 'center' },
  checkbox: {
    width: 22,
    height: 22,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: { backgroundColor: colors.accent },
  taskBody: { flex: 1, minWidth: 0, paddingVertical: 12, paddingRight: 28, gap: 2 },
  doneTitle: { textDecorationLine: 'line-through', color: colors.muted },
  tags: { fontSize: 12, lineHeight: 18, color: colors.accent, fontWeight: '600' },
  chevron: { position: 'absolute', right: 10 },
  calendarColumns: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  agendaColumn: { width: 320 },
  agenda: { minHeight: 220, padding: 20, gap: 9 },
  agendaTitle: { color: colors.onDark, fontSize: 16, fontWeight: '700', lineHeight: 21 },
  agendaCount: { color: colors.onDark, fontSize: 12, lineHeight: 18 },
});
