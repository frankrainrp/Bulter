import test from 'node:test';
import assert from 'node:assert/strict';
import { reviseTasks, withSavedFields } from '../src/desktop/taskEdits.js';

const base = { id: 'a', taskName: 'Slides', description: '', dueDate: '2026-06-20', dueTime: '',
  status: 'todo', priority: 'med', tags: ['Course'], goalId: 'goal' };
const edit = draft => ({ kind: 'edit', base, draft: { ...base, ...draft } });

test('a stale task drawer saves only the changed fields and preserves a peer completion', () => {
  const remote = { ...base, status: 'done', priority: 'high', tags: ['New'] };
  const result = reviseTasks([remote], edit({ taskName: 'Final slides', tags: [...base.tags] }));
  assert.deepEqual(result.tasks, [{ ...remote, taskName: 'Final slides' }]);
  assert.equal(result.conflict, undefined);
});

test('overlapping edits keep both drafts and recheck the chosen resolution against further changes', () => {
  const remote = { ...base, taskName: 'Peer', description: 'Peer notes' };
  const rows = [remote];
  const result = reviseTasks(rows, edit({ taskName: 'Mine', tags: ['Review'] }));
  assert.equal(result.tasks, rows);
  const clash = result.conflict;
  assert.deepEqual(clash.fields, ['taskName']);
  assert.deepEqual(clash.merged, { ...remote, taskName: 'Mine', tags: ['Review'] });
  const savedValues = withSavedFields(clash.merged, clash.latest, clash.fields);
  assert.deepEqual(reviseTasks(rows, { kind: 'edit', base: clash.latest, draft: savedValues }).tasks,
    [{ ...remote, tags: ['Review'] }]);
  assert.deepEqual(reviseTasks([{ ...remote, taskName: 'Third' }], { kind: 'edit', base: clash.latest, draft: clash.merged }).conflict.fields, ['taskName']);
});

test('concurrent schedule edits cannot silently create a time without a date', () => {
  const result = reviseTasks([{ ...base, dueDate: '' }], edit({ dueTime: '12:00' }));
  assert.deepEqual(result.conflict.fields, ['dueDate', 'dueTime']);
  assert.equal(result.conflict.merged.dueDate, base.dueDate);
});

test('stale save and delete cannot revive a missing row or delete somebody’s updated task', () => {
  assert.deepEqual(reviseTasks([], edit({ taskName: 'Mine' })), { tasks: [], conflict: { kind: 'deleted' } });
  const remove = { kind: 'delete', base };
  assert.deepEqual(reviseTasks([], remove).conflict, { kind: 'deleted' });
  const latest = { ...base, status: 'done' };
  const result = reviseTasks([latest], remove);
  assert.deepEqual(result.conflict, { kind: 'deleteChanged', latest, fields: ['status'] });
  assert.deepEqual(reviseTasks([latest], { kind: 'delete', base: latest }), { tasks: [] });
});
