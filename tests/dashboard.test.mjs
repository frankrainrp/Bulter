import assert from 'node:assert/strict';
import test from 'node:test';
import { changeDashboard, decodeDashboard } from '../src/dashboard/layout.js';

test('updating one binding keeps other saved options on the same module', () => {
  const layout = decodeDashboard(undefined);
  const filter = changeDashboard(layout, {op:'update',id:'upcoming-tasks',config:{filter:'completed'}});
  const limit = changeDashboard(filter, {op:'update',id:'upcoming-tasks',config:{limit:2}});
  assert.deepEqual(limit.modules.find(m=>m.id==='upcoming-tasks').config,{filter:'completed',limit:2});
  assert.deepEqual(layout.modules.find(m=>m.id==='upcoming-tasks').config,{filter:'upcoming',limit:6});
});

test('add, reorder and remove keep stable module identity and allow an intentionally empty layout', () => {
  const empty = decodeDashboard({version:1,modules:[]});
  const first = changeDashboard(empty,{op:'add',type:'stat',config:{metric:'notes-total'}},()=> 'notes');
  const second = changeDashboard(first,{op:'add',type:'heatmap',index:0},()=> 'heat');
  const moved = changeDashboard(second,{op:'move',id:'notes',index:0});
  assert.deepEqual(moved.modules.map(m=>m.id),['notes','heat']);
  const removed = changeDashboard(changeDashboard(moved,{op:'remove',id:'notes'}),{op:'remove',id:'heat'});
  assert.deepEqual(decodeDashboard(removed),empty);
});

test('invalid binding, fields, duplicate identities, stale cards and impossible positions fail without resetting saved layout', () => {
  const layout = decodeDashboard(undefined);
  const requests=[
    {op:'update',id:'active-count',config:{metric:'tasks-by-priority'}},
    {op:'add',type:'countdown',config:{targetDate:'2026-02-31'}},
    {op:'remove',id:'missing'}, {op:'move',id:'active-count',index:1000},
    {op:'update',id:'active-count',config:{url:'https://example.test'}},
    {op:'update',id:'active-count',span:3},
  ];
  for (const request of requests) assert.throws(()=>changeDashboard(layout,request,()=> 'new-card'));
  assert.throws(()=>decodeDashboard({...layout,modules:[layout.modules[0],layout.modules[0]]}));
  assert.throws(()=>decodeDashboard({version:2,modules:[]}));
  assert.equal(layout.modules.length,4);
});
