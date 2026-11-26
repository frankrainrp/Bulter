import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blankTask, dateKey, dateFromKey, decodeWorkspace, emptyWorkspace, goalProgress,
  monthDays, moveMonth, removeGoal, sortTasks, summarizeTasks, taskError, validDate,
} from '../src/model.js';

test('calendar keeps civil dates, including leap days and year boundaries', () => {
  assert.equal(dateKey(dateFromKey('2028-02-29')), '2028-02-29');
  assert.equal(validDate('2027-02-29'), false);
  assert.equal(validDate('2028-02-29'), true);
  assert.equal(validDate('0000-01-01'), false);
  assert.equal(moveMonth('2026-12-01', 1), '2027-01-01');
  const cells = monthDays('2028-02-01');
  assert.equal(cells[0], '2028-01-31');
  assert.equal(cells.at(-1), '2028-03-05');
  assert.equal(cells.length % 7, 0);
  const fixedGrid = monthDays('2028-02-01', 6);
  assert.equal(fixedGrid.length, 42);
  assert.equal(fixedGrid[0], '2028-01-31');
  assert.equal(fixedGrid.at(-1), '2028-03-12');
  assert.equal(monthDays('9999-12-01', 6).at(-1), '10000-01-09');
});

test('task validation keeps unscheduled tasks and rejects impossible schedules', () => {
  const blank = blankTask('task', '2026-11-23');
  assert.equal(taskError(blank), 'Enter a task title.');
  const task = { ...blank, taskName: 'Review SQL' };
  assert.equal(taskError({ ...task, dueDate: '', dueTime: '' }), undefined);
  assert.match(taskError({ ...task, dueDate: '', dueTime: '14:30' }), /Add a date/);
  assert.match(taskError({ ...task, dueTime: '24:00' }), /24-hour/);
  assert.match(taskError({ ...task, dueDate: '2026-04-31' }), /real date/);
});

test('due tasks sort before unscheduled work, with time before priority', () => {
  const template = { ...blankTask('base', '2026-11-23'), taskName: 'Review SQL' };
  const tasks = [
    { ...template, id: 'late', dueTime: '17:00' },
    { ...template, id: 'unscheduled', dueDate: '' },
    { ...template, id: 'medium', dueTime: '08:00' },
    { ...template, id: 'high', dueTime: '08:00', priority: 'high' },
  ];
  assert.deepEqual(sortTasks(tasks).map(({ id }) => id), ['high', 'medium', 'late', 'unscheduled']);
  assert.equal(tasks[0].id, 'late');
});

test('completion survives serialization and deleting a goal keeps linked tasks', () => {
  const completed = {
    ...blankTask('task', '2026-11-23', 'goal'),
    taskName: 'Review SQL',
    status: 'done',
  };
  const workspace = {
    ...emptyWorkspace,
    goals: [{ id: 'goal', title: 'Prepare for quiz', description: '' }],
    tasks: [completed],
  };
  const restored = decodeWorkspace(JSON.stringify(workspace));
  assert.deepEqual(restored, workspace);
  assert.deepEqual(goalProgress(restored.tasks, 'goal'), { done: 1, total: 1 });
  assert.deepEqual(removeGoal(restored, 'goal'), {
    ...emptyWorkspace,
    tasks: [{ ...completed, goalId: '' }],
  });
});

test('malformed and unsupported storage cannot become an empty workspace silently', () => {
  assert.deepEqual(decodeWorkspace(null), emptyWorkspace);
  assert.throws(() => decodeWorkspace('invalid JSON'));
  assert.throws(() => decodeWorkspace(JSON.stringify({ ...emptyWorkspace, version: 2 })));
  assert.throws(() => decodeWorkspace(JSON.stringify({
    ...emptyWorkspace,
    tasks: [{ ...blankTask('task', ''), taskName: 'Read', priority: 'toString' }],
  })));
});

test('overall summary includes existing completed, scheduled and undated tasks regardless of list filters', () => {
  const scheduled = blankTask('todo', '2026-11-23');
  const undated = { ...blankTask('active', ''), status: 'in_progress' };
  const complete = { ...blankTask('done', '2026-11-01'), status: 'done' };
  assert.deepEqual(summarizeTasks([]), { total: 0, completed: 0, unfinished: 0, percent: 0 });
  assert.deepEqual(summarizeTasks([scheduled, undated, complete]), {
    total: 3, completed: 1, unfinished: 2, percent: 33,
  });
  assert.deepEqual(summarizeTasks([complete]), { total: 1, completed: 1, unfinished: 0, percent: 100 });
});
