import { backlinkPaths, markdownDestination, resolveWiki } from './noteVault.js';

function resolveTargets(notes, owner, links) {
  const ids = new Set();
  for (const path of links.wiki) {
    const target = resolveWiki(notes, owner.title, path);
    if (target) ids.add(target.id);
  }
  for (const href of links.markdown) {
    const target = markdownDestination(notes, owner, href);
    if (target.kind === 'note') ids.add(target.note.id);
  }
  ids.delete(owner.id);
  return ids;
}

export function createBacklinkIndex() {
  let previous = new Map();
  return (notes) => {
    // Adding, moving, or deleting a path can resolve or disambiguate an unchanged link.
    const pathsChanged =
      notes.length !== previous.size || notes.some((note) => previous.get(note.id)?.title !== note.title);
    const next = new Map();
    const incoming = new Map();
    for (const note of notes) {
      let entry = previous.get(note.id);
      const sameContent = entry?.content === note.content;
      if (!entry || !sameContent || pathsChanged) {
        const links = sameContent && entry ? entry.links : backlinkPaths(note.content);
        entry = { title: note.title, content: note.content, links, targets: resolveTargets(notes, note, links) };
      }
      next.set(note.id, entry);
      for (const id of entry.targets) {
        const owners = incoming.get(id);
        if (owners) owners.push(note);
        else incoming.set(id, [note]);
      }
    }
    previous = next;
    return incoming;
  };
}
