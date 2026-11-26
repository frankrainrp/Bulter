import test from 'node:test';
import assert from 'node:assert/strict';
import { createDashboardTool } from '../src/dashboard/dashboardTool.js';
import { changeDashboard, decodeDashboard } from '../src/dashboard/layout.js';

test('a retried chat turn reuses in-flight or committed card mutations and later turns can intentionally repeat them', async () => {
  let layout = decodeDashboard(undefined);
  let count = 0;
  const initial = layout.modules.length;
  const tool = createDashboardTool({ getDashboardLayout: async () => layout, applyDashboardAction: async action => {
    await Promise.resolve();
    layout = changeDashboard(layout, action, () => 'chart-' + ++count);
    return layout;
  }});
  const request = {op:'add', type:'pie', title:'Task status'};
  const first = tool('question-one');
  const retry = tool('question-one');
  const results = await Promise.all([first(request), retry({title:request.title, type:'pie', op:'add'})]);
  assert.equal(results[1].alreadyApplied, true);
  assert.equal(layout.modules.length, initial + 1);
  const inspected = await first({op:'inspect'});
  assert.equal(inspected.components.length, 6);
  await assert.rejects(first({op:'inspect', title:'ignored'}), /only/);
  await tool('question-two')(request);
  assert.equal(layout.modules.length, initial + 2);
});
