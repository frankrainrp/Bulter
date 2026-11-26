import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { dateFromKey, formatDate, sortTasks, validDate } from '../model.js';
import { Choices, PageTitle } from '../ui.jsx';
import { CalendarRail } from './CalendarRail.jsx';
import { monthKeyboardDate, shiftDate } from './calendarDates.js';

import './calendar.css';

const views = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
];

const taskMime = 'application/x-butler-task';
const shortDate = { month: 'short', day: 'numeric' };
const fullDate = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };

function Planner({ tasks, selected, today, view, onPick, onOpen, onAdd, onMove, onViewChange }) {
  const week = view === 'week';
  const mondayOffset = (dateFromKey(selected).getDay() + 6) % 7;
  const days = week
    ? Array.from({ length: 7 }, (_, index) => shiftDate(selected, index - mondayOffset))
    : [selected];
  const availableDays = days.filter(validDate);
  const entries = sortTasks(tasks.filter((task) => availableDays.includes(task.dueDate)));
  const slots = new Map();
  let firstHour = 6;
  for (const task of entries) {
    const hour = task.dueTime.slice(0, 2);
    if (hour) firstHour = Math.min(firstHour, Number(hour));
    const key = `${task.dueDate}/${hour}`;
    const bucket = slots.get(key) ?? [];
    bucket.push(task);
    slots.set(key, bucket);
  }
  const hours = ['', ...Array.from({ length: 24 - firstHour }, (_, i) => String(i + firstHour).padStart(2, '0'))];
  const firstDay = availableDays[0];
  const lastDay = availableDays[availableDays.length - 1];
  const fullRangeDate = { ...shortDate, year: 'numeric' };
  const range = week
    ? `${formatDate(firstDay, firstDay.slice(0, 4) === lastDay.slice(0, 4) ? shortDate : fullRangeDate)} – ${formatDate(lastDay, fullRangeDate)}`
    : formatDate(selected, fullDate);
  function pageDate(direction) {
    const target = shiftDate(selected, direction * (week ? 7 : 1));
    if (week && !validDate(target)) return shiftDate(direction < 0 ? firstDay : lastDay, direction);
    return target;
  }
  const previous = pageDate(-1);
  const next = pageDate(1);
  const [focusedSlot, setFocusedSlot] = useState('');
  const firstSlot = `${selected}/`;
  const activeSlot =
    availableDays.includes(focusedSlot.split('/')[0]) && hours.includes(focusedSlot.split('/')[1])
      ? focusedSlot
      : firstSlot;
  const [dropSlot, setDropSlot] = useState('');
  const table = useRef(null);
  const focusDay = useRef(false);
  useLayoutEffect(() => {
    if (!week && focusDay.current) {
      table.current?.querySelector(`[data-slot="${selected}/"]`)?.focus({ preventScroll: true });
      focusDay.current = false;
    }
  }, [week, selected]);

  function moveFocus(event, date, hour) {
    const column = availableDays.indexOf(date);
    const row = hours.indexOf(hour);
    let dayIndex = column;
    let hourIndex = row;
    switch (event.key) {
      case 'ArrowRight':
        dayIndex++;
        break;
      case 'ArrowLeft':
        dayIndex--;
        break;
      case 'ArrowUp':
        hourIndex--;
        break;
      case 'ArrowDown':
        hourIndex++;
        break;
      case 'Home':
        dayIndex = 0;
        if (event.ctrlKey) hourIndex = 0;
        break;
      case 'End':
        dayIndex = availableDays.length - 1;
        if (event.ctrlKey) hourIndex = hours.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target =
      availableDays[dayIndex] && hours[hourIndex] !== undefined
        ? `${availableDays[dayIndex]}/${hours[hourIndex]}`
        : '';
    if (target) event.currentTarget.closest('table')?.querySelector(`[data-slot="${target}"]`)?.focus();
  }

  return (
    <section className="butler-calendar-planner" aria-label={week ? 'Week planner' : 'Day planner'}>
      <header className="butler-calendar-planner-head">
        <div>
          <h2 aria-live="polite">{range}</h2>
          <p>
            {entries.length} {entries.length === 1 ? 'task' : 'tasks'}
          </p>
        </div>
        <div className="butler-calendar-planner-nav">
          <button
            type="button"
            className="dui-nav"
            data-direction="prev"
            aria-label={week ? 'Previous week' : 'Previous day'}
            disabled={!validDate(previous)}
            onClick={() => onPick(previous)}
          />
          <button type="button" className="butler-calendar-today" onClick={() => onPick(today)}>
            Today
          </button>
          <button
            type="button"
            className="dui-nav"
            data-direction="next"
            aria-label={week ? 'Next week' : 'Next day'}
            disabled={!validDate(next)}
            onClick={() => onPick(next)}
          />
        </div>
      </header>
      <table
        ref={table}
        className="butler-calendar-timeline"
        aria-label={week ? 'Weekly schedule' : 'Daily schedule'}
      >
        <thead>
          <tr>
            <th scope="col" aria-label="Time" />
            {days.map((day) => (
              <th scope="col" key={day}>
                {validDate(day) &&
                  (week ? (
                    <button
                      type="button"
                      className="butler-calendar-date"
                      aria-current={day === today ? 'date' : undefined}
                      aria-label={`Open ${formatDate(day, fullDate)} in Day view`}
                      onClick={() => {
                        focusDay.current = true;
                        onPick(day);
                        onViewChange('day');
                      }}
                    >
                      <span>{formatDate(day, { weekday: 'short' })}</span>
                      <strong>{Number(day.slice(-2))}</strong>
                    </button>
                  ) : (
                    <span className="butler-calendar-day-heading">Schedule</span>
                  ))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.map((hour) => (
            <tr key={hour}>
              <th scope="row">{hour ? `${hour}:00` : 'All day'}</th>
              {days.map((date) => {
                const key = `${date}/${hour}`;
                const time = hour ? `${hour}:00` : '';
                if (!validDate(date)) return <td key={key} />;
                const label = `Add task on ${date}${time ? ` at ${time}` : ', all day'}`;
                return (
                  <td
                    key={key}
                    data-selected={date === selected}
                    data-drop={dropSlot === key}
                    onDragOver={(event) => {
                      if (!onMove || !event.dataTransfer.types.includes(taskMime)) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      setDropSlot(key);
                    }}
                    onDragLeave={(event) => {
                      if (
                        !(event.relatedTarget instanceof Node) ||
                        !event.currentTarget.contains(event.relatedTarget)
                      )
                        setDropSlot('');
                    }}
                    onDrop={(event) => {
                      setDropSlot('');
                      if (!onMove || !event.dataTransfer.types.includes(taskMime)) return;
                      event.preventDefault();
                      const item = tasks.find((task) => task.id === event.dataTransfer.getData(taskMime));
                      if (!item) return;
                      const newTime = hour ? `${hour}:${item.dueTime.slice(3) || '00'}` : '';
                      if (item.dueDate !== date || item.dueTime !== newTime) onMove(item, date, newTime);
                    }}
                  >
                    <button
                      type="button"
                      className="butler-calendar-add-slot"
                      aria-label={label}
                      title={label}
                      data-slot={key}
                      tabIndex={activeSlot === key ? 0 : -1}
                      onFocus={() => setFocusedSlot(key)}
                      onKeyDown={(event) => moveFocus(event, date, hour)}
                      onClick={() => {
                        onPick(date);
                        onAdd(date, time);
                      }}
                    >
                      <span aria-hidden="true">+</span>
                    </button>
                    {slots.get(key)?.map((task) => (
                      <button
                        type="button"
                        key={task.id}
                        className="butler-calendar-event"
                        data-done={task.status === 'done'}
                        draggable={Boolean(onMove)}
                        aria-label={`Edit ${task.taskName}`}
                        title={[task.dueTime, task.taskName].filter(Boolean).join(' ')}
                        onDragStart={(event) => {
                          event.dataTransfer.setData(taskMime, task.id);
                          event.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => setDropSlot('')}
                        onClick={() => {
                          onPick(date);
                          onOpen(task);
                        }}
                      >
                        {task.dueTime && <time>{task.dueTime}</time>}
                        {task.taskName}
                      </button>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function DesktopCalendar(props) {
  const { view, monthGrid, agenda, tasks, selected, onOpen, onViewChange } = props;
  const primary = useRef(null);
  const focusDate = useRef('');
  // The Bito month rebuilds its date buttons when the selection or tasks change.
  useLayoutEffect(() => {
    if (view !== 'month' || !primary.current) return;
    for (const cell of primary.current.querySelectorAll('.dui-calendar__day')) {
      cell.tabIndex = cell.dataset.key === selected ? 0 : -1;
      if (cell.dataset.key === focusDate.current) cell.focus();
    }
    focusDate.current = '';
  }, [view, monthGrid, selected]);

  function selectByKeyboard(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const button = event.target;
    if (!(button instanceof HTMLButtonElement) || !button.matches('.dui-calendar__day') || !button.dataset.key)
      return;
    const date = monthKeyboardDate(button.dataset.key, event.key);
    if (!date) return;
    event.preventDefault();
    if (date !== selected) {
      focusDate.current = date;
      props.onPick(date);
    }
  }

  const upcoming = useMemo(
    () => sortTasks(tasks.filter((task) => task.status !== 'done' && task.dueDate > selected)).slice(0, 5),
    [tasks, selected]
  );
  return (
    <div className="butler-desktop-calendar">
      <CalendarRail
        selected={selected}
        today={props.today}
        tasks={tasks}
        onAdd={props.onAdd}
        onJump={(date) => {
          props.onPick(date);
          onViewChange('day');
        }}
      />
      <section className="butler-calendar-workspace" aria-label="Calendar workspace">
        <div className="butler-calendar-views">
          <PageTitle title="Calendar" />
          <Choices label="Calendar view" options={views} current={view} onChange={onViewChange} />
        </div>
        <div className="butler-calendar-columns" data-view={view}>
          <div
            ref={primary}
            className="butler-calendar-primary"
            onKeyDown={view === 'month' ? selectByKeyboard : undefined}
          >
            {view === 'month' ? monthGrid : <Planner {...props} />}
          </div>
          <aside className="butler-calendar-agenda" aria-label="Selected day agenda">
            {agenda}
            {!!upcoming.length && (
              <section className="butler-calendar-upcoming" aria-label="Upcoming tasks">
                <h2>Upcoming</h2>
                {upcoming.map((task) => (
                  <button
                    type="button"
                    key={task.id}
                    onClick={() => onOpen(task)}
                    aria-label={`Edit upcoming task ${task.taskName}`}
                  >
                    <time dateTime={task.dueDate}>{formatDate(task.dueDate, shortDate)}</time>
                    <span>{task.taskName}</span>
                  </button>
                ))}
              </section>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
