import { formatDate, monthDays } from '../model.js';

export function calendarMonth(month, tasks) {
  const counts = new Map();
  for (const task of tasks) {
    if (task.dueDate) counts.set(task.dueDate, (counts.get(task.dueDate) ?? 0) + 1);
  }
  return monthDays(month, 6).map((date) => ({
    date,
    count: counts.get(date) ?? 0,
    outside: !date.startsWith(month.slice(0, 7)),
    display: date.split('-')[2].replace(/^0/, ''),
    disabled: date.startsWith('0000') || date.startsWith('10000'),
  }));
}

export function dayLabel(date, count, isToday) {
  const label = formatDate(date, { month: 'long', day: 'numeric', year: 'numeric' });
  return `${label}, ${count} ${count === 1 ? 'task' : 'tasks'}${isToday ? ', today' : ''}`;
}
