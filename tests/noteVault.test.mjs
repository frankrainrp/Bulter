import test from 'node:test';
import assert from 'node:assert/strict';
import { backlinkPaths, copyTitle, fileTree, markdownDestination, markdownLinks, resolveWiki, saveDraft, wikiLinks } from '../src/desktop/noteVault.js';

const note = (id, title, content = '') => ({ id, title, content, updatedAt: 1 });

test('the shared backlink parse separates wiki, Markdown and code references', () => {
  assert.deepEqual(backlinkPaths('Plain prose with an emoji 📚'), { wiki: [], markdown: [] });
  const text = ['[[Notes/Today|Diary]] and [Read][ref]', '', '[ref]: Article.md', '', '~~~', '[[Example]]', '~~~'].join('\n');
  assert.deepEqual(backlinkPaths(text), { wiki: ['Notes/Today'], markdown: ['Article.md'] });
});

test('wikilinks in Markdown text use aliases and leave code and escapes untouched', () => {
  const body = ['[[Reports/A|weekly notes]] and ' + String.fromCharCode(96) + '[[quoted]]' + String.fromCharCode(96),
    '\\[[escaped]]', '~~~md', '[[example]]', '~~~', '> [[One.md]]'].join('\n');
  const links = wikiLinks(body);
  assert.deepEqual(links.map(link => [link.path, link.label]), [['Reports/A', 'weekly notes'], ['One.md', 'One.md']]);
  assert.equal(body.slice(links[0].from, links[0].to), '[[Reports/A|weekly notes]]');
});

test('choose same-folder notes and require a qualified reference when ambiguous', () => {
  const a = note('a', 'A/Plans');
  const b = note('b', 'B/Plans');
  assert.equal(resolveWiki([a, b], 'A/Today', 'Plans.md'), a);
  assert.equal(resolveWiki([a, b], 'Today', 'Plans'), undefined);
  assert.equal(resolveWiki([a, b], 'Today', 'b/plans'), b);
  assert.deepEqual([...fileTree([b, a]).folders.keys()], ['A', 'B']);
});

test('moving notes fixes incoming and outgoing relative links as one transaction', () => {
  const a = note('a', 'A/Review', '[[Plans]]');
  const b = note('b', 'A/Plans', 'See [[Review|check]]');
  const c = note('c', 'B/Plans', 'See [[A/Review]]');
  const d = note('d', 'Archive', '~~~\n[[A/Review]]\n~~~');
  const result = saveDraft([a, b, c, d], { ...a, title: 'B/Review next', base: a }, 9);
  assert.equal(result.saved.content, '[[A/Plans]]');
  assert.equal(result.notes[1].content, 'See [[B/Review next|check]]');
  assert.equal(result.notes[2].content, 'See [[B/Review next]]');
  assert.equal(result.notes[3], d);
  assert.equal(b.content, 'See [[Review|check]]');
});

test('stale, removed, or colliding notes cannot overwrite a saved note', () => {
  const a = note('a', 'Inbox/A');
  const b = note('b', 'Inbox/B');
  assert.equal(saveDraft([a, b], { ...a, title: 'Inbox/b.md', base: a }).error.includes('already'), true);
  assert.equal(saveDraft([b], { ...a, base: a }).conflict, true);
  assert.equal(saveDraft([{ ...a, content: 'changed even with same timestamp' }], { ...a, base: a }).conflict, true);
  assert.equal(copyTitle([a], 'Inbox/a'), 'Inbox/a 2');
  const legacy = note('old', ' Old title ');
  assert.equal(saveDraft([legacy], { ...legacy, base: legacy, content: 'edited body' }).saved.title, legacy.title);
});

test('relative Markdown links and headings resolve within the vault exactly once', () => {
  const owner = note('from', 'Drafts/Weekly review');
  const plan = note('plan', 'Plans/Course plan.md');
  const notes = [owner, plan];
  assert.deepEqual(markdownDestination(notes, owner, '../Plans/Course%20plan.md#Next%20steps'),
    { kind: 'note', note: plan, heading: 'Next steps' });
  assert.equal(markdownDestination(notes, owner, '#two').note, owner);
  assert.equal(markdownDestination(notes, owner, 'Plans/Course%20plan.md').note, plan);
  assert.equal(resolveWiki(notes, owner.title, 'Plans/Course plan#Next steps'), plan);
  for (const path of ['../../etc.md', '%2e%2e/%2e%2e/etc.md', '//example.test/Report.md', '../x.pdf',
    'javascript:alert(1)', 'missing.md', 'bad%ZZ.md', '../bad%5Cpath.md']) {
    assert.equal(markdownDestination(notes, owner, path).kind, 'unavailable', path);
  }
  assert.equal(markdownDestination([...notes, note('other', 'Plans/Course plan')], owner, '../Plans/Course%20plan.md').kind, 'unavailable');
  assert.equal(markdownDestination(notes, owner, 'https://example.test/reference').kind, 'external');
});

test('Markdown and wiki heading links survive a rename, including a used reference definition', () => {
  const body = '[Go](../Plans/Course%20plan.md#Review) and [[Plans/Course plan#Review|notes]] and [reference][r]\n\n[r]: <../Plans/Course plan.md#Next> "Title"\n\n[unused]: ../Plans/Course%20plan.md';
  const owner = note('from', 'Journal/Overview', body);
  const plan = note('plan', 'Plans/Course plan');
  assert.equal(markdownLinks(body).length, 2);
  const renamed = saveDraft([owner, plan], { ...plan, title: 'Archive/Review (final)', base: plan });
  assert.equal(renamed.notes[0].content, '[Go](../Archive/Review%20%28final%29.md#Review) and [[Archive/Review (final)#Review|notes]] and [reference][r]\n\n[r]: <../Archive/Review%20%28final%29.md#Next> "Title"\n\n[unused]: ../Plans/Course%20plan.md');
});
