import test from 'node:test';
import assert from 'node:assert/strict';
import { requestReply } from '../src/assistant.js';
import { createWorkspaceTools, toolsOff } from '../src/chat/workspaceTools.js';
import { blankTask } from '../src/model.js';

const task = (id, date, status = 'todo') => ({ ...blankTask(id, date), taskName: id, status,
  description: 'Unshared description', goalId: 'Unshared goal' });
const workspace = { version: 1, goals: [], tasks: [task('Sample seminar','2026-11-24'),
  task('Archived quiz','2026-11-24','done'),task('Next seminar','2026-12-01'),task('Later class','2026-12-02')],
  notes: [{ id: 'n1', title: 'Sample file', content: 'Unrelated prefix '.repeat(30) + 'maple worksheet', updatedAt: 0 }] };
const tools = (enabled = {}, connection = 'model') => createWorkspaceTools(workspace, { ...toolsOff, ...enabled },
  connection, '2026-11-24','2026-12-01');
const profile = { provider: 'custom', model: 'fixture', key: 'fixture-only', baseUrl: 'https://model.example/v1' };
const endpoint = 'https://workspace.example/api/chat';
const messages = [{ id:'m', role:'user',content:'Look up the example.' }];
const event = data => 'data: '+JSON.stringify(data)+'\n\n';
const stream = data => new Response(data,{headers:{'Content-Type':'text/event-stream'}});
const done = 'data: [DONE]\n\n';
const output = text => stream(event({choices:[{delta:{content:text}}]})+done);
const call = (name,args,id='c',finish='tool_calls') => stream(event({choices:[{delta:{
  tool_calls:[{index:0,id,type:'function',function:{name,arguments:args}}]}}]})
  +event({choices:[{delta:{},finish_reason:finish}]})+done);
const ask = (connection,request,access,signal=new AbortController().signal) => requestReply(connection,messages,signal,request,undefined,access);

test('read-only registry enforces permission, original date windows, note excerpts and result bounds',()=>{
  assert.deepEqual(tools().definitions,[]);
  const all=tools({list_items:true,list_calendar:true,search_notes:true});
  assert.deepEqual(all.execute('list_items',{filter:'today'}).data.map(t=>t.taskName),['Sample seminar']);
  assert.deepEqual(all.execute('list_items',{filter:'thisWeek'}).data.map(t=>t.taskName),['Sample seminar','Next seminar']);
  assert.deepEqual(all.execute('list_items',{filter:'later'}).data.map(t=>t.taskName),['Later class']);
  assert.equal(all.execute('list_calendar',{}).data.length,2);
  assert.equal(all.execute('list_calendar',{date:'2026-02-30'}).ok,false);
  assert.equal(all.execute('list_items',{filter:'nonsense'}).ok,false);
  assert.equal(all.execute('list_items',{includeBody:true}).ok,false);
  const found=all.execute('search_notes',{query:'MAPLE'});
  assert.equal(found.data[0].title,'Sample file');assert.match(found.data[0].excerpt,/maple/);
  assert.ok(found.data[0].excerpt.length<=160);
  assert.deepEqual(all.execute('search_notes',{query:'Sample file'}).data,[{title:'Sample file'}]);
  assert.equal(all.execute('search_notes',{query:' '}).ok,false);
  assert.equal(all.execute('delete_item',{}).ok,false);
  assert.equal(tools({list_items:true}).execute('search_notes',{query:'maple'}).ok,false);
  const many=createWorkspaceTools({...workspace,tasks:Array(12).fill(workspace.tasks[0]),notes:Array(12).fill(workspace.notes[0])},
    {list_items:true,list_calendar:true,search_notes:true},'model','2026-11-24','2026-12-01');
  assert.equal(many.execute('list_items',{}).data.length,8);assert.equal(many.execute('search_notes',{query:'maple'}).data.length,5);
});

test('compatible model consumes parallel, fragmented calls and sees only requested results on the next turn',async()=>{
  const rounds=[];
  const answer=await ask(profile,async(url,init)=>{
    assert.equal(url,'https://model.example/v1/chat/completions');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');
    const payload=JSON.parse(init.body);rounds.push(payload);
    if(rounds.length===1){
      assert.deepEqual(payload.tools.map(t=>t.function.name),['list_calendar','search_notes']);
      assert.doesNotMatch(init.body,/Sample seminar|Sample file|Unrelated prefix|Unshared/);
      return stream(event({choices:[{delta:{reasoning_content:'provider continuation',tool_calls:[
        {index:0,id:'date-call',function:{name:'list_calendar',arguments:'{"da'},extra_content:{google:{thought_signature:'fixture-signature'}}},
        {index:1,id:'note-call',function:{name:'search_notes',arguments:'{"que'}}]}}]})
        +event({choices:[{delta:{tool_calls:[{index:1,function:{arguments:'ry":"maple"}'}},{index:0,function:{arguments:'te":"2026-12-01"}'}}]}}]})
        +event({choices:[{finish_reason:'tool_calls',delta:{}}]})+done);
    }
    const [assistant,calendar,note]=payload.messages.slice(-3);
    assert.equal(assistant.reasoning_content,'provider continuation');assert.equal(assistant.tool_calls[0].extra_content.google.thought_signature,'fixture-signature');
    assert.deepEqual([calendar.tool_call_id,note.tool_call_id],['date-call','note-call']);
    assert.deepEqual(JSON.parse(calendar.content).data.map(t=>t.taskName),['Next seminar']);
    assert.match(note.content,/maple worksheet/);assert.doesNotMatch(init.body,/Unshared description|Sample seminar|fixture-only/);
    return output('The example is available.');
  },tools({list_calendar:true,search_notes:true}));
  assert.equal(answer,'The example is available.');assert.equal(rounds.length,2);
});

test('workspace server gets only its upstream read contract and denies mutations and unsupported names',async()=>{
  const access=tools({list_items:true,search_notes:true},'server');
  assert.deepEqual(access.definitions.map(t=>t.name),['list_items']);
  const calls=[];
  await ask(endpoint,async(url,init)=>{
    const p=JSON.parse(init.body);calls.push(p);
    assert.equal(p.includeTools,true);assert.equal(p.tools,undefined);assert.match(p.contextSummary,/list_items/);
    if(calls.length===1){assert.doesNotMatch(init.body,/Sample seminar/);return call('create_item','{"taskName":"rogue"}','denied');}
    if(calls.length===2){assert.equal(JSON.parse(p.messages.at(-1).content).ok,false);return call('list_items','{"filter":"today"}','allowed');}
    assert.equal(p.messages.at(-1).tool_call_id,'allowed');assert.deepEqual(JSON.parse(p.messages.at(-1).content).data.map(x=>x.taskName),['Sample seminar']);
    return output('Sample seminar');
  },access);
  assert.equal(calls.length,3);assert.equal(workspace.tasks.length,4);
});

test('Claude Messages uses tool_use/input_json_delta and returns matching tool_result blocks',async()=>{
  let step=0;
  const answer=await ask({...profile,provider:'claude'},async(url,init)=>{
    const p=JSON.parse(init.body);step++;
    assert.equal(init.headers['anthropic-version'],'2023-06-01');assert.equal(init.headers['x-api-key'],'fixture-only');
    if(step===1){
      assert.equal(p.tools[0].name,'list_items');assert.equal(p.tools[0].input_schema.type,'object');
      return stream(event({type:'content_block_start',index:1,content_block:{type:'tool_use',id:'t1',name:'list_items',input:{}}})
        +event({type:'content_block_delta',index:1,delta:{type:'input_json_delta',partial_json:'{"filter":'}})
        +event({type:'content_block_delta',index:1,delta:{type:'input_json_delta',partial_json:'"active"}'}})
        +event({type:'message_delta',delta:{stop_reason:'tool_use'}})+event({type:'message_stop'}));
    }
    const [assistant,user]=p.messages.slice(-2);assert.equal(assistant.content[0].type,'tool_use');
    assert.deepEqual(assistant.content[0].input,{filter:'active'});assert.equal(user.content[0].tool_use_id,'t1');
    assert.equal(user.content[0].type,'tool_result');assert.equal(user.content[0].is_error,false);
    return stream(event({type:'content_block_delta',delta:{type:'text_delta',text:'Complete.'}})+event({type:'message_stop'}));
  },tools({list_items:true}));
  assert.equal(answer,'Complete.');assert.equal(step,2);
});

test('off, incomplete, invalid, aborted and excessive tool calls cannot send a result',async()=>{
  for(const [response,access,reason] of [[call('list_items','{}'),tools(),/off/],[call('list_items','{}','id','length'),tools({list_items:true}),/did not complete/],
    [call('list_items','{'),tools({list_items:true}),/invalid tool arguments/i]]){
    let requests=0;await assert.rejects(ask(profile,async()=>{requests++;return response;},access),reason);assert.equal(requests,1);
  }
  let count=0;
  await assert.rejects(ask(profile,async()=>{count++;return call('list_items','{}','r'+count);},tools({list_items:true})),/limit/);
  assert.equal(count,4);
  const controller=new AbortController();
  let requests=0;
  await assert.rejects(ask(profile,async()=>{requests++;controller.abort();return call('list_items','{}');},tools({list_items:true}),controller.signal));
  assert.equal(requests,1);
});

test('cancelling between tool execution and continuation prevents transmission of the local result',async()=>{
  const controller = new AbortController();
  const enabled = tools({ list_items: true });
  let requests = 0, executions = 0;
  const access = { ...enabled, execute(name, args) {
    executions++;
    const result = enabled.execute(name, args);
    controller.abort();
    return result;
  } };
  await assert.rejects(ask(profile, async () => {
    requests++;
    return call('list_items', '{"filter":"today"}');
  }, access, controller.signal), /stopped/);
  assert.equal(executions, 1);
  assert.equal(requests, 1);
});
