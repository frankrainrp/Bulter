import { parser } from '@lezer/markdown';

export const wikiSyntax = {
  defineNodes: ['WikiLink'],
  parseInline: [
    {
      name: 'WikiLink',
      before: 'Link',
      parse(context, next, position) {
        if (next !== 91 || context.char(position + 1) !== 91 || context.hasOpenLink) return -1;
        const match = /^\[\[([^\[\]\r\n]+?)\]\]/.exec(context.text.slice(position - context.offset));
        if (!match || !match[1].split('|')[0].trim()) return -1;
        return context.addElement(context.elt('WikiLink', position, position + match[0].length));
      },
    },
  ],
};

const noteParser = parser.configure(wikiSyntax);

export function wikiLinks(source, tree) {
  const links = [];
  if (!source.includes('[[')) return links;
  (tree ?? noteParser.parse(source)).iterate({
    enter(node) {
      if (node.name !== 'WikiLink') return;
      const raw = source.slice(node.from + 2, node.to - 2);
      const separator = raw.indexOf('|');
      const path = (separator === -1 ? raw : raw.slice(0, separator)).trim();
      const alias = separator === -1 ? '' : raw.slice(separator);
      links.push({ from: node.from, to: node.to, path, label: alias.slice(1).trim() || path, alias });
    },
  });
  return links;
}

export function leaf(title) {
  return title.split('/').at(-1) || title || 'Untitled';
}

export function directory(title) {
  return title.slice(0, Math.max(0, title.lastIndexOf('/')));
}

const key = (path) => path.trim().replace(/\.md$/i, '').toLowerCase();

export function splitAnchor(value) {
  const index = value.indexOf('#');
  return index === -1
    ? { file: value, heading: '' }
    : { file: value.slice(0, index), heading: value.slice(index + 1) };
}

export function resolveWiki(notes, owner, path) {
  const name = key(splitAnchor(path).file || owner);
  const exact = (value) => notes.filter((note) => key(note.title) === value);
  if (name.includes('/')) {
    const matches = exact(name);
    return matches.length === 1 ? matches[0] : undefined;
  }
  const folder = key(directory(owner));
  const nearby = exact(folder ? folder + '/' + name : name);
  if (nearby.length) return nearby.length === 1 ? nearby[0] : undefined;
  const matches = notes.filter((note) => key(leaf(note.title)) === name);
  return matches.length === 1 ? matches[0] : undefined;
}

export function markdownDestination(notes, owner, href) {
  if (!href) return { kind: 'unavailable', reason: 'This link has no supported destination.' };
  if (/^(https?:\/\/|mailto:)/i.test(href)) return { kind: 'external', href };
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(href))
    return { kind: 'unavailable', reason: 'This link points outside the vault.' };
  const raw = splitAnchor(href);
  let file, heading;
  try {
    file = decodeURIComponent(raw.file);
    heading = decodeURIComponent(raw.heading);
  } catch {
    return { kind: 'unavailable', reason: 'This link contains invalid URL encoding.' };
  }
  if (!file) return { kind: 'note', note: owner, heading };
  if (/[\\\u0000-\u001f?]/.test(file) || file.startsWith('//'))
    return { kind: 'unavailable', reason: 'Unsupported vault path.' };
  if (/\.[^/.]+$/.test(file) && !/\.md$/i.test(file))
    return { kind: 'unavailable', reason: 'This attachment is unavailable in the notes vault.' };
  const parts = file.startsWith('/') ? [] : directory(owner.title).split('/').filter(Boolean);
  for (const segment of file.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (!parts.length) return { kind: 'unavailable', reason: 'This path goes outside the vault.' };
      parts.pop();
    } else parts.push(segment);
  }
  const relative = parts.join('/');
  let matches = notes.filter((note) => key(note.title) === key(relative));
  if (!matches.length && !file.startsWith('/') && !file.split('/').some((part) => part === '.' || part === '..')) {
    // Obsidian also writes vault-root-relative paths without a leading slash.
    matches = notes.filter((note) => key(note.title) === key(file));
  }
  if (matches.length !== 1)
    return {
      kind: 'unavailable',
      reason: matches.length
        ? 'Several notes use this path. Rename a duplicate to open this link.'
        : 'This note does not exist in the vault.',
    };
  return { kind: 'note', note: matches[0], heading };
}

export function markdownLinks(source, tree) {
  const locations = [];
  if (!source.includes('[')) return locations;
  const definitions = new Map();
  const used = new Set();
  const labelKey = (label) => label.trim().replace(/\s+/g, ' ').toLowerCase();
  (tree ?? noteParser.parse(source)).iterate({
    enter({ node }) {
      if (node.name !== 'Link' && node.name !== 'LinkReference') return;
      const url = node.getChild('URL');
      const ref = node.getChild('LinkLabel');
      let label = ref ? source.slice(ref.from + 1, ref.to - 1) : '';
      if (!label && node.name === 'Link') {
        const marks = node.getChildren('LinkMark');
        if (marks.length >= 2) label = source.slice(marks[0].to, marks[1].from);
      }
      if (!url) {
        if (label) used.add(labelKey(label));
        return;
      }
      const angle = source[url.from] === '<' && source[url.to - 1] === '>';
      const from = url.from + Number(angle),
        to = url.to - Number(angle);
      const location = { from, to, href: source.slice(from, to) };
      if (node.name === 'Link') locations.push(location);
      else if (label && !definitions.has(labelKey(label))) definitions.set(labelKey(label), location);
    },
  });
  for (const label of used) {
    const link = definitions.get(label);
    if (link) locations.push(link);
  }
  return locations.sort((a, b) => a.from - b.from);
}

export function backlinkPaths(source) {
  if (!source.includes('[')) return { wiki: [], markdown: [] };
  const tree = noteParser.parse(source);
  return {
    wiki: wikiLinks(source, tree).map((link) => link.path),
    markdown: markdownLinks(source, tree).map((link) => link.href),
  };
}

function relativeHref(owner, target) {
  const from = directory(owner).split('/').filter(Boolean),
    to = target.split('/');
  while (from.length && to.length > 1 && from[0] === to[0]) {
    from.shift();
    to.shift();
  }
  if (!/\.md$/i.test(to[to.length - 1])) to[to.length - 1] += '.md';
  return [
    ...from.map(() => '..'),
    ...to.map((part) => encodeURIComponent(part).replace(/\(/g, '%28').replace(/\)/g, '%29')),
  ].join('/');
}

export function validPath(path) {
  return (
    path.trim().length > 0 &&
    path
      .split('/')
      .every(
        (part) =>
          part.trim() === part && part.length > 0 && part !== '.' && part !== '..' && !/[\r\n\[\]|]/.test(part)
      )
  );
}

export function copyTitle(notes, path) {
  let title = path;
  let suffix = 1;
  while (notes.some((note) => key(note.title) === key(title))) title = path + ' ' + ++suffix;
  return title;
}

export function sameVersion(a, b) {
  return (
    (!a && !b) || (!!a && !!b && a.updatedAt === b.updatedAt && a.title === b.title && a.content === b.content)
  );
}

export function saveDraft(notes, draft, time = Date.now()) {
  const current = notes.find((note) => note.id === draft.id);
  if (!sameVersion(current, draft.base))
    return { error: 'This note changed elsewhere. Keep your edits as a copy.', conflict: true };
  const renamed = !current || current.title !== draft.title;
  const path = renamed ? draft.title.trim() : current.title;
  if (renamed && !validPath(path)) return { error: 'Enter a name, using / between folder names.' };
  if (renamed && notes.some((note) => note.id !== draft.id && key(note.title) === key(path))) {
    return { error: 'A note already uses this path. Choose another name.' };
  }
  const saved = { id: draft.id, title: renamed ? path : current.title, content: draft.content, updatedAt: time };
  let updated = current ? notes.map((note) => (note.id === saved.id ? saved : note)) : [...notes, saved];
  if (renamed && current) {
    const moved = updated;
    updated = moved.map((note) => {
      const originalOwner = note.id === saved.id ? current.title : note.title;
      let content = note.content;
      const changes = [];
      for (const link of wikiLinks(content)) {
        const oldTarget = resolveWiki(notes, originalOwner, link.path);
        if (!oldTarget) continue;
        const target = oldTarget.id === saved.id ? saved : oldTarget;
        if (resolveWiki(moved, note.title, link.path)?.id === target.id) continue;
        const anchor = splitAnchor(link.path).heading;
        changes.push({ ...link, value: '[[' + target.title + (anchor ? '#' + anchor : '') + link.alias + ']]' });
      }
      for (const link of markdownLinks(content)) {
        const before = markdownDestination(notes, { ...note, title: originalOwner }, link.href);
        if (before.kind !== 'note' || !splitAnchor(link.href).file) continue;
        const after = markdownDestination(moved, note, link.href);
        if (after.kind === 'note' && after.note.id === before.note.id) continue;
        const target = before.note.id === saved.id ? saved : before.note;
        const hash = link.href.indexOf('#');
        changes.push({
          ...link,
          value: relativeHref(note.title, target.title) + (hash === -1 ? '' : link.href.slice(hash)),
        });
      }
      for (const change of changes.sort((a, b) => b.from - a.from)) {
        content = content.slice(0, change.from) + change.value + content.slice(change.to);
      }
      return content === note.content ? note : { ...note, content, updatedAt: time };
    });
  }
  return { notes: updated, saved: updated.find((note) => note.id === saved.id) };
}

const fileNameOrder = new Intl.Collator(undefined, { numeric: true });

export function fileTree(notes) {
  const root = { name: '', path: '', folders: new Map(), notes: [] };
  for (const note of [...notes].sort((a, b) => fileNameOrder.compare(a.title, b.title))) {
    let parent = root;
    for (const name of note.title.split('/').slice(0, -1).filter(Boolean)) {
      const path = parent.path ? parent.path + '/' + name : name;
      if (!parent.folders.has(name)) parent.folders.set(name, { name, path, folders: new Map(), notes: [] });
      parent = parent.folders.get(name);
    }
    parent.notes.push(note);
  }
  return root;
}
