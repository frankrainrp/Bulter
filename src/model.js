export const emptyWorkspace = { version: 1, tasks: [], notes: [], goals: [] };

export const priorities = { low: 'Low', med: 'Medium', high: 'High' };
export const statuses = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

export function dateKey(date) {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function dateFromKey(key) {
  // Noon keeps calendar arithmetic in the device's local civil day.
  const date = new Date(0);
  const [year, month, day] = key.split('-').map(Number);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return date;
}

export function validDate(key) {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && key.slice(0, 4) !== '0000' && dateKey(dateFromKey(key)) === key;
}

export function validTime(time) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function formatDate(key, options) {
  return new Intl.DateTimeFormat('en-SG', options).format(dateFromKey(key));
}

export function moveMonth(month, offset) {
  const date = dateFromKey(month);
  date.setMonth(date.getMonth() + offset, 1);
  return dateKey(date);
}

export function monthDays(month, minimumWeeks = 0) {
  const first = dateFromKey(month);
  const leadingDays = (first.getDay() + 6) % 7;
  const last = dateFromKey(moveMonth(month, 1));
  last.setDate(0);
  const cellCount = Math.max(minimumWeeks, Math.ceil((leadingDays + last.getDate()) / 7)) * 7;
  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(first);
    date.setDate(1 - leadingDays + index);
    return dateKey(date);
  });
}

export function blankTask(id, date, goalId = '') {
  return {
    id,
    taskName: '',
    description: '',
    dueDate: date,
    dueTime: '',
    status: 'todo',
    priority: 'med',
    tags: [],
    goalId,
  };
}

export function taskError(task) {
  if (!task.taskName.trim()) return 'Enter a task title.';
  if (task.dueDate && !validDate(task.dueDate)) return 'Enter a real date in YYYY-MM-DD format.';
  if (task.dueTime && !task.dueDate) return 'Add a date before setting a time.';
  if (task.dueTime && !validTime(task.dueTime)) return 'Enter a 24-hour time such as 14:30.';
}

export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const rank = { high: 0, med: 1, low: 2 };
    return (
      (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99') ||
      (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99') ||
      rank[a.priority] - rank[b.priority] ||
      a.taskName.localeCompare(b.taskName)
    );
  });
}

export function upsert(items, item) {
  return items.some(({ id }) => id === item.id)
    ? items.map((existing) => (existing.id === item.id ? item : existing))
    : [...items, item];
}

export function removeGoal(workspace, id) {
  return {
    ...workspace,
    goals: workspace.goals.filter((goal) => goal.id !== id),
    tasks: workspace.tasks.map((task) => (task.goalId === id ? { ...task, goalId: '' } : task)),
  };
}

export function goalProgress(tasks, goalId) {
  const linked = tasks.filter((task) => task.goalId === goalId);
  return { total: linked.length, done: linked.filter((task) => task.status === 'done').length };
}

function hasStrings(value, keys) {
  return value !== null && typeof value === 'object' && keys.every((key) => typeof value[key] === 'string');
}

function isTask(value) {
  if (!hasStrings(value, ['id', 'taskName', 'description', 'dueDate', 'dueTime', 'status', 'priority', 'goalId']))
    return false;
  const { tags } = value;
  return (
    Object.hasOwn(statuses, value.status) &&
    Object.hasOwn(priorities, value.priority) &&
    Array.isArray(tags) &&
    tags.every((tag) => typeof tag === 'string') &&
    !taskError(value)
  );
}

function isNote(value) {
  return hasStrings(value, ['id', 'title', 'content']) && Number.isFinite(value.updatedAt);
}

export function decodeWorkspace(raw) {
  if (raw === null) return emptyWorkspace;
  const data = JSON.parse(raw);
  if (
    data?.version !== 1 ||
    !Array.isArray(data.tasks) ||
    !data.tasks.every(isTask) ||
    !Array.isArray(data.notes) ||
    !data.notes.every(isNote) ||
    !Array.isArray(data.goals) ||
    !data.goals.every((goal) => hasStrings(goal, ['id', 'title', 'description']))
  ) {
    throw new Error('Unsupported study workspace');
  }
  return { version: 1, tasks: data.tasks, notes: data.notes, goals: data.goals };
}

export function studyBrief(tasks, today) {
  const ordered = sortTasks(tasks);
  const active = ordered.filter((task) => task.status !== 'done');
  return {
    today: active.filter((task) => task.dueDate === today),
    overdue: active.filter((task) => task.dueDate && task.dueDate < today),
    next: active.filter((task) => task.dueDate > today),
    unscheduled: active.filter((task) => !task.dueDate),
    doneToday: ordered.filter((task) => task.status === 'done' && task.dueDate === today).length,
  };
}

export function summarizeTasks(tasks) {
  const total = tasks.length;
  const completed = tasks.filter(({ status }) => status === 'done').length;
  return {
    total,
    completed,
    unfinished: total - completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}
