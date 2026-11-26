import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { calendarMonth, dayLabel } from '../bito/calendarModel.js';
import { formatDate, moveMonth } from '../model.js';
import { Button } from '../ui.jsx';
import { monthKeyboardDate } from './calendarDates.js';

const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function CalendarRail({ selected, today, tasks, onJump, onAdd }) {
  const selectedMonth = selected.slice(0, 7) + '-01';
  const [month, setMonth] = useState(selectedMonth);
  const [focusedDate, setFocusedDate] = useState(selected);
  const grid = useRef(null);
  const pendingFocus = useRef('');
  useLayoutEffect(() => {
    setMonth(selectedMonth);
    setFocusedDate(selected);
  }, [selected, selectedMonth]);
  useLayoutEffect(() => {
    if (pendingFocus.current) {
      grid.current?.querySelector(`[data-date="${pendingFocus.current}"]`)?.focus();
      pendingFocus.current = '';
    }
  }, [month]);
  const days = useMemo(
    () =>
      calendarMonth(month, tasks).map((day) => ({
        ...day,
        label: dayLabel(day.date, day.count, day.date === today),
      })),
    [month, tasks, today]
  );
  const tabStop = focusedDate.slice(0, 7) === month.slice(0, 7) ? focusedDate : month;

  function moveFocus(event, date) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = monthKeyboardDate(date, event.key);
    if (!target) return;
    event.preventDefault();
    const targetMonth = target.slice(0, 7) + '-01';
    if (targetMonth === month) {
      grid.current?.querySelector(`[data-date="${target}"]`)?.focus();
    } else {
      pendingFocus.current = target;
      setMonth(targetMonth);
    }
  }

  return (
    <aside className="butler-calendar-rail" aria-label="Calendar navigation">
      <section aria-label="Date navigator" className="butler-calendar-mini">
        <header>
          <button
            type="button"
            className="dui-nav"
            data-direction="prev"
            aria-label="Previous mini calendar month"
            disabled={month === '0001-01-01'}
            onClick={() => setMonth(moveMonth(month, -1))}
          />
          <h2 aria-live="polite">{formatDate(month, { month: 'long', year: 'numeric' })}</h2>
          <button
            type="button"
            className="dui-nav"
            data-direction="next"
            aria-label="Next mini calendar month"
            disabled={month === '9999-12-01'}
            onClick={() => setMonth(moveMonth(month, 1))}
          />
        </header>
        <div ref={grid} className="butler-calendar-mini-grid">
          {weekdays.map((day, index) => (
            <span aria-hidden="true" key={index}>
              {day}
            </span>
          ))}
          {days.map((day) => (
            <button
              type="button"
              key={day.date}
              data-date={day.date}
              data-outside={day.outside}
              data-marked={day.count > 0}
              disabled={day.disabled}
              aria-pressed={day.date === selected}
              aria-current={day.date === today ? 'date' : undefined}
              aria-label={`Open ${day.label} in planner`}
              tabIndex={day.date === tabStop ? 0 : -1}
              onFocus={() => setFocusedDate(day.date)}
              onKeyDown={(event) => moveFocus(event, day.date)}
              onClick={() => {
                setMonth(day.date.slice(0, 7) + '-01');
                onJump(day.date);
              }}
            >
              {day.display}
            </button>
          ))}
        </div>
      </section>
      <Button label="New task" icon="add" onPress={() => onAdd(selected)} />
    </aside>
  );
}
