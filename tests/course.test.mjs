import assert from 'node:assert/strict';
import test from 'node:test';
import { createSampleWorkspace } from '../src/course/sampleWorkspace.js';

const firstDay = new Date(2027, 0, 1, 0, 5);
const dueDates = workspace => workspace.tasks.map(task => task.dueDate);

test('fresh workspaces have stable IDs and independent task, tag, note and goal records', () => {
  const one = createSampleWorkspace(firstDay);
  const two = createSampleWorkspace(firstDay);
  assert.deepEqual(one, two);
  assert.deepEqual(Object.keys(one).sort(), ['goals', 'notes', 'tasks', 'version']);
  assert.equal(one.version, 1);
  assert.deepEqual(one.goals, []);
  const ids = [...one.tasks, ...one.notes].map(record => record.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...createSampleWorkspace(new Date(2028, 4, 20)).tasks].map(task => task.id), one.tasks.map(task => task.id));

  one.tasks[0].tags.push('Changed');
  one.tasks[0].status = 'todo';
  one.notes[0].content = '';
  one.goals.push({ id: 'new', title: 'New goal', description: '' });
  assert(!two.tasks[0].tags.includes('Changed'));
  assert.equal(two.tasks[0].status, 'done');
  assert(two.notes[0].content.length > 0);
  assert.deepEqual(two.goals, []);
  assert.deepEqual(createSampleWorkspace(firstDay), two);
});

test('relative due dates cross the new year and leap day using the supplied local civil date', () => {
  const before = firstDay.getTime();
  assert.deepEqual(dueDates(createSampleWorkspace(firstDay)), ['2026-12-29', '2026-12-31', '2027-01-01', '2027-01-01', '2027-01-04', '2027-01-08']);
  assert.equal(firstDay.getTime(), before);
  assert.deepEqual(dueDates(createSampleWorkspace(new Date(2028, 1, 29, 23, 59))), ['2028-02-26', '2028-02-28', '2028-02-29', '2028-02-29', '2028-03-03', '2028-03-07']);
  const beforeMidnight = createSampleWorkspace(new Date(2027, 0, 1, 23, 59));
  assert.deepEqual(beforeMidnight, createSampleWorkspace(firstDay));
  for (const note of beforeMidnight.notes) {
    assert(Number.isFinite(note.updatedAt) && note.updatedAt <= firstDay.getTime());
    assert.equal(new Date(note.updatedAt).getHours(), 12);
  }
});

test('the task list, calendar and summary have usable overdue, daily, upcoming and completed records', () => {
  const {tasks} = createSampleWorkspace(firstDay);
  for (const task of tasks) {
    assert.deepEqual(Object.keys(task).sort(), ['description','dueDate','dueTime','goalId','id','priority','status','tags','taskName']);
    assert(task.taskName && task.description && Array.isArray(task.tags));
    assert.equal(task.goalId, '');
    assert.match(task.dueTime, /^(?:[01]\d|2[0-3]):[0-5]\d$/);
  }
  const active = tasks.filter(task => task.status !== 'done');
  assert.equal(active.length, 5);
  assert.equal(tasks.length - active.length, 1);
  assert.equal(active.filter(task => task.dueDate < '2027-01-01').length, 1);
  assert.deepEqual(active.filter(task => task.dueDate === '2027-01-01').map(task => task.status), ['in_progress', 'todo']);
  assert.equal(active.filter(task => task.dueDate > '2027-01-01' && task.dueDate <= '2027-01-08').length, 2);
  assert.deepEqual([...new Set(tasks.map(task => task.priority))].sort(), ['high','low','med']);
});

test('notes link to existing unique entries and the sample contains no contact, student-ID or filesystem references', () => {
  const {notes, tasks} = createSampleWorkspace(firstDay);
  const titles = new Set(notes.map(note => note.title));
  assert.equal(titles.size, notes.length);
  for (const note of notes) {
    assert.deepEqual(Object.keys(note).sort(), ['content','id','title','updatedAt']);
    const links = Array.from(note.content.matchAll(/\[\[([^\]]+)\]\]/g), match => match[1]);
    assert(links.length > 0);
    assert(links.every(title => title !== note.title && titles.has(title)));
  }
  const text = [...tasks.map(task => task.taskName+' '+task.description), ...notes.map(note => note.title+' '+note.content)].join('\n');
  assert.doesNotMatch(text, /[\w.+-]+@[\w.-]+\.\w+|\b\d{8}\b|\b(?:https?|file):\/\/|\b[A-Z]:[\\/]/i);
});
