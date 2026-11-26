import test from 'node:test';
import assert from 'node:assert/strict';
import { markdownFileName, mergeMarkdownFiles, readMarkdownFiles } from '../src/desktop/noteImport.js';

const encoder = new TextEncoder();
function file(path, bytes) {
  return { name: path.split('/').at(-1), webkitRelativePath: path.includes('/') ? path : '',
    async arrayBuffer() { return typeof bytes === 'string' ? encoder.encode(bytes).buffer : bytes.buffer; } };
}
const record = (id, title, content) => ({id, title, content, updatedAt: 1});

test('folder selection ignores hidden paths and attachments without reading them; preserves UTF-8 and paths', async () => {
  const content = '\uFEFF# 笔记\r\n\r\n[[课程]]\r\n';
  const ignored = ['Vault/.obsidian/cache.md','Vault/Notes/.hidden/ref.md','Vault/image.jpg','.private.md'].map(path =>
    ({...file(path, ''), async arrayBuffer() { throw Error('Hidden content must not be read'); }}));
  const selection = await readMarkdownFiles([file('Vault/课程/总结.md',content), ...ignored, file('Letter.MD','A'), file('twice.md.md','B')]);
  const {added, summary} = mergeMarkdownFiles([], selection, [], () => 'fixture', 10);
  assert.deepEqual(added.map(n => markdownFileName(n.title)), ['课程/总结.md','Letter.MD','twice.md.md']);
  assert.equal(added[0].content, content);
  assert.equal(summary.ignored,4);
});

test('duplicate and conflicting paths never overwrite existing records or unsaved draft names', async () => {
  const notes=[record('a','one','A'),record('b','two.md','B')];
  const selection = await readMarkdownFiles([file('One.MD','A'),file('two.md','new'),file('draft.md','D'),file('new.md','OK'),file('New.md','OK')]);
  const result = mergeMarkdownFiles(notes,selection,['Draft'],()=>'new');
  assert.deepEqual(result.added.map(n=>n.title),['new']);
  assert.equal(result.summary.duplicates,2);
  assert.equal(result.summary.conflicts.length,2);
  assert.deepEqual(notes.map(n=>n.content),['A','B']);
});

test('mixed batches skip conflicting pairs and file/folder collisions deterministically', async () => {
  const selection=await readMarkdownFiles([file('Note.md','A'),file('note.md','B'),file('Vault/Doc.md/a.md','child'),file('doc.md','parent')]);
  const result=mergeMarkdownFiles([],selection,[],()=>'new');
  assert.equal(result.added.length,0);
  assert.equal(result.summary.conflicts.length,3);
});

test('bad UTF-8 aborts whole selection after earlier files were read', async () => {
  await assert.rejects(readMarkdownFiles([file('good.md','Keep'),file('bad.md',new Uint8Array([0xff]))]),/bad.md.*No notes were imported/);
});
