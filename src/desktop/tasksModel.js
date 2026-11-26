import { dateFromKey, dateKey, sortTasks, studyBrief } from '../model.js';

export function desktopTaskList(tasks, today, view) {
  const brief = studyBrief(tasks, today);
  const weekEnd = dateFromKey(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndKey = dateKey(weekEnd);
  const completed = sortTasks(tasks.filter((task) => task.status === 'done'));
  const counts = {
    active: tasks.length - completed.length,
    in_progress: tasks.filter((task) => task.status === 'in_progress').length,
    upcoming: brief.today.length + brief.next.length,
    all: tasks.length,
    done: completed.length,
  };

  const groups = [
    { title: 'Due today', data: brief.today },
    { title: 'Overdue', data: brief.overdue },
    { title: 'Next 7 days', data: brief.next.filter((task) => task.dueDate <= weekEndKey) },
    { title: 'Later', data: brief.next.filter((task) => task.dueDate > weekEndKey) },
    { title: 'Unscheduled', data: brief.unscheduled },
    { title: 'Completed', data: completed },
  ];

  const matches = {
    active: (task) => task.status !== 'done',
    in_progress: (task) => task.status === 'in_progress',
    upcoming: (task) => task.status !== 'done' && task.dueDate >= today,
    all: () => true,
    done: (task) => task.status === 'done',
  };
  const sections = groups
    .map(({ title, data }) => ({ title, data: data.filter(matches[view]) }))
    .filter((section) => section.data.length > 0);

  const tagCounts = new Map();
  for (const task of tasks) {
    for (const tag of new Set(task.tags)) {
      const stats = tagCounts.get(tag) ?? { tag, total: 0, done: 0 };
      stats.total += 1;
      if (task.status === 'done') stats.done += 1;
      tagCounts.set(tag, stats);
    }
  }
  const tags = [...tagCounts.values()]
    .sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag))
    .slice(0, 12);
  return { counts, sections, tags, todayDone: brief.doneToday, todayTotal: brief.doneToday + brief.today.length };
}
