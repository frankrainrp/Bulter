export const markdownFileName = (title) => (/\.md$/i.test(title) ? title : title + '.md');

export function portableFile(path) {
  return path
    .split('/')
    .every(
      (part) =>
        part &&
        !part.startsWith('.') &&
        !/[. ]$|[<>:"\\|?*\u0000-\u001f]/.test(part) &&
        !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)
    );
}

const pathKey = (path) => path.normalize('NFC').toLowerCase();
function parents(path) {
  const parts = path.split('/');
  return parts.slice(1).map((_, index) => parts.slice(0, index + 1).join('/'));
}

export async function readMarkdownFiles(files) {
  const result = [];
  const conflicts = [];
  let ignored = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  for (const file of files) {
    const parts = (file.webkitRelativePath || file.name).split('/');
    if (!/\.md$/i.test(file.name) || parts.some((part) => part.startsWith('.'))) {
      ignored++;
      continue;
    }
    const path = (file.webkitRelativePath ? parts.slice(1) : parts).join('/');
    if (!/\.md$/i.test(path) || !portableFile(path)) {
      conflicts.push({ path: path || file.name, reason: 'Unsupported filename' });
      continue;
    }
    try {
      result.push({ path, content: decoder.decode(await file.arrayBuffer()) });
    } catch {
      throw new Error('Could not read “' + path + '” as UTF-8. No notes were imported.');
    }
  }
  return { files: result, ignored, conflicts };
}

export function mergeMarkdownFiles(notes, selection, reserved, makeId, time = Date.now()) {
  const summary = { added: 0, duplicates: 0, ignored: selection.ignored, conflicts: [...selection.conflicts] };
  const records = new Map();
  const reservedFiles = new Set(reserved.filter(Boolean).map((title) => pathKey(markdownFileName(title))));
  const folders = new Set();
  const incoming = new Map();
  for (const note of notes) {
    const key = pathKey(markdownFileName(note.title));
    const group = records.get(key);
    if (group) group.push(note);
    else records.set(key, [note]);
    parents(key).forEach((parent) => folders.add(parent));
  }
  for (const key of reservedFiles) parents(key).forEach((parent) => folders.add(parent));
  for (const file of selection.files) {
    const key = pathKey(file.path);
    const group = incoming.get(key);
    if (group) group.push(file);
    else incoming.set(key, [file]);
    parents(key).forEach((parent) => folders.add(parent));
  }
  const added = [];
  for (const [key, group] of incoming) {
    const file = group[0];
    const existing = records.get(key);
    let reason = '';
    if (group.some((item) => item.content !== file.content))
      reason = 'Selected files have different contents at this path';
    else if (existing) {
      if (existing.every((note) => note.content === file.content)) {
        summary.duplicates += group.length;
        continue;
      }
      reason = 'A saved note at this path has different contents';
    } else if (reservedFiles.has(key)) reason = 'An unsaved draft uses this path';
    else if (
      folders.has(key) ||
      parents(key).some((parent) => records.has(parent) || incoming.has(parent) || reservedFiles.has(parent))
    ) {
      reason = 'A file and folder would share this path';
    }
    if (reason) {
      summary.conflicts.push({ path: file.path, reason });
      continue;
    }
    // Keep the exact filename when removing its suffix would change a later export.
    const stem = file.path.slice(0, -3);
    const title = markdownFileName(stem) === file.path ? stem : file.path;
    added.push({ id: makeId(), title, content: file.content, updatedAt: time });
    summary.duplicates += group.length - 1;
  }
  summary.added = added.length;
  return { added, summary };
}
