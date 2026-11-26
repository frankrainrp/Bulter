import { useLayoutEffect, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native-web';
import { Calendar } from './bito/calendar.js';
import { calendarMonth, dayLabel } from './bito/calendarModel.js';
import { formatDate, moveMonth, sortTasks } from './model.js';
import { Button, DetroitContainer } from './ui.jsx';
import './bito/calendar.css';

function rollDateNumber(label, previous, direction, heading = false) {
  if (label.textContent === previous) return;

  const viewport = document.createElement('span');
  viewport.className = heading ? 'calendar-reel calendar-reel-title' : 'calendar-reel';
  label.replaceWith(viewport);
  const outgoing = label.cloneNode(true);
  outgoing.setAttribute('aria-hidden', 'true');
  outgoing.classList.add('calendar-reel-outgoing');
  (outgoing.querySelector('.dui-calendar__day-label__main') ?? outgoing).textContent = previous;
  if (!heading) outgoing.dataset.label = previous;
  viewport.append(outgoing, label);

  const timing = { duration: 260, easing: 'cubic-bezier(.25,.7,.32,1)' };
  outgoing.animate(
    [
      { transform: 'translateY(0)', opacity: 1 },
      { transform: `translateY(${-direction * 110}%)`, opacity: 0.15 },
    ],
    timing
  );
  const incoming = label.animate(
    [
      { transform: `translateY(${direction * 110}%)`, opacity: 0.35 },
      { transform: 'translateY(0)', opacity: 1 },
    ],
    timing
  );
  void incoming.finished
    .then(() => {
      if (viewport.isConnected) viewport.replaceWith(label);
    })
    .catch(() => {});
}

export function MonthGrid(props) {
  const { month, selected, today, tasks, onToday, desktop } = props;
  const host = useRef(null);
  const lastMonth = useRef(month);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  }, [props]);
  // The desktop drawer and search can outlive a parent render. Keep the Bito buttons
  // in the DOM until calendar data changes, with their actions bound to the latest props.
  const desktopActions = useMemo(
    () => ({
      onPick: (date) => latest.current.onPick(date),
      onMonth: (date) => latest.current.onMonth(date),
      onOpenTask: (task) => latest.current.onOpenTask?.(task),
    }),
    []
  );
  const onPick = desktop ? desktopActions.onPick : props.onPick;
  const onMonth = desktop ? desktopActions.onMonth : props.onMonth;
  const onOpenTask = desktop && props.onOpenTask ? desktopActions.onOpenTask : props.onOpenTask;

  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
    const previousMonth = lastMonth.current;
    lastMonth.current = month;
    const roll = previousMonth !== month && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const previousDays = roll ? calendarMonth(previousMonth, []) : [];
    const direction = month > previousMonth ? 1 : -1;
    const focus =
      node.contains(document.activeElement) && document.activeElement instanceof HTMLElement
        ? document.activeElement.dataset.key
        : undefined;
    const days = calendarMonth(month, tasks);
    const activeDays = days.filter(({ count, outside }) => count > 0 && !outside);
    const [year, monthNumber] = month.split('-').map(Number);

    // Bito's adapter remounts the imperative calendar from the selected month.
    delete node.dataset.duiMounted;
    Calendar(node, {
      year,
      month: monthNumber,
      events: activeDays.map(({ display }) => display).join(','),
      dates: days.map(({ date }) => date),
      onMove: (offset) => onMonth(moveMonth(month, offset)),
    });

    const title = node.querySelector('.dui-calendar__title');
    title?.setAttribute('role', 'heading');
    title?.setAttribute('aria-level', '2');
    title?.setAttribute('aria-label', formatDate(month, { month: 'long', year: 'numeric' }));
    if (roll && title) {
      const digits = document.createElement('span');
      digits.textContent = title.textContent;
      title.replaceChildren(digits);
      rollDateNumber(digits, `${previousMonth.slice(0, 4)} / ${previousMonth.slice(5, 7)}`, direction, true);
    }
    const countLabel = node.querySelector('.dui-calendar__sub');
    if (countLabel)
      countLabel.textContent = `${activeDays.length} ${activeDays.length === 1 ? 'ACTIVE DAY' : 'ACTIVE DAYS'}`;
    node.querySelector('.dui-calendar__weekdays')?.setAttribute('aria-hidden', 'true');
    const [previous, next] = node.querySelectorAll('.dui-calendar__nav button');
    previous.setAttribute('aria-label', 'Previous month');
    next.setAttribute('aria-label', 'Next month');
    previous.dataset.key = 'prev';
    next.dataset.key = 'next';
    previous.disabled = month === '0001-01-01';
    next.disabled = month === '9999-12-01';

    const tasksByDate = new Map();
    if (desktop) {
      for (const task of sortTasks(tasks)) {
        if (!task.dueDate) continue;
        const entries = tasksByDate.get(task.dueDate) ?? [];
        entries.push(task);
        tasksByDate.set(task.dueDate, entries);
      }
    }

    // The source console binds the original grid to each civil date and agenda.
    node.querySelectorAll('.dui-calendar__day').forEach((cell, index) => {
      const { date, count, disabled } = days[index];
      const current = date === selected;
      const isToday = date === today;
      cell.dataset.key = date;
      cell.disabled = disabled;
      cell.classList.toggle('is-today', isToday);
      cell.classList.toggle('is-selected', current);
      cell.setAttribute('aria-label', dayLabel(date, count, isToday));
      cell.setAttribute('aria-pressed', String(current));
      if (isToday) cell.setAttribute('aria-current', 'date');
      cell.addEventListener('click', () => onPick(date));
      const digits = cell.querySelector('.dui-calendar__day-label');
      if (roll && digits && previousDays[index]) rollDateNumber(digits, previousDays[index].display, direction);
      const entries = tasksByDate.get(date);
      if (entries?.length) {
        const group = document.createElement('div');
        group.className = 'butler-calendar-day-cell';
        cell.replaceWith(group);
        group.append(cell);
        const preview = document.createElement('span');
        preview.className = 'butler-calendar-previews';
        const visible = entries.slice(0, 3);
        for (const task of visible) {
          const label = document.createElement(onOpenTask ? 'button' : 'span');
          label.className = 'butler-calendar-entry';
          label.classList.toggle('is-complete', task.status === 'done');
          label.textContent = [task.dueTime, task.taskName].filter(Boolean).join(' ');
          label.title = label.textContent;
          if (label instanceof HTMLButtonElement && onOpenTask) {
            label.type = 'button';
            label.dataset.key = `task-${task.id}`;
            label.setAttribute('aria-label', `Edit calendar task ${task.taskName}`);
            label.addEventListener('click', () => onOpenTask(task));
          }
          preview.append(label);
        }
        if (entries.length > visible.length) {
          const more = document.createElement('small');
          more.textContent = `+${entries.length - visible.length} more`;
          preview.append(more);
        }
        group.append(preview);
        cell.setAttribute('aria-description', visible.map((task) => task.taskName).join(', '));
      }
    });
    if (focus) {
      const target = Array.from(node.querySelectorAll('button')).find(
        (button) => button.dataset.key === focus && !button.disabled
      );
      target?.focus({ preventScroll: true });
    }
  }, [month, selected, today, tasks, onPick, onMonth, desktop, onOpenTask]);

  return (
    <DetroitContainer tone="gray" style={styles.container}>
      <div ref={host} className={desktop ? 'bito-calendar butler-calendar-month' : 'bito-calendar'} />
      <Button label="Today" secondary icon="today-outline" onPress={onToday} />
    </DetroitContainer>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 8, marginBottom: 14 },
});
