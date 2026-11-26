import assert from 'node:assert/strict';
import test from 'node:test';
import { searchWorkspace } from '../src/desktop/searchWorkspace.js';

const task = (id, taskName, description = '', tags = []) => ({ id, taskName, description, tags });
const note = (id, title, content = '') => ({ id, title, content });

test('a matching filename in a folder outranks partial titles and body/tag matches', () => {
  const tasks = [task('t1', 'Project setup'), task('t2', 'Setup', '', ['Project'])];
  const notes = [note('n1', 'Course/Project'), note('n2', 'Notes', 'project report')];
  const messages = [{ id: 'c1', role: 'user', content: 'How is the project?' }];
  const hits = searchWorkspace(tasks, notes, messages, '  PrOjEcT ');
  assert.deepEqual(hits.map(hit => hit.item.id), ['n1', 't1', 't2', 'n2', 'c1']);
  assert.equal(hits[0].title, 'Course/Project');
  assert.deepEqual(searchWorkspace(tasks, notes, messages, '   '), []);
});

test('pagination can reach all matches, including records below the initial window', () => {
  const notes = Array.from({ length: 55 }, (_, i) => note(String(i), 'File ' + i, '复习'));
  const hits = searchWorkspace([], notes, [], '复习');
  assert.equal(hits.length, 55);
  assert.equal(hits.at(-1).item, notes.at(-1));
});
