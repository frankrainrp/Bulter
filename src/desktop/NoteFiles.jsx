import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Button, Icon, colors } from '../ui.jsx';
import { fileTree, leaf } from './noteVault.js';

const FileRow = memo(function FileRow({ id, title, name, snippet, depth, active, dirty, open }) {
  return (
    <li>
      <button
        type="button"
        className="vault-file"
        aria-label={'Open ' + (title || 'Untitled')}
        aria-current={active ? 'page' : undefined}
        style={{ paddingLeft: 9 + depth * 13 }}
        title={title}
        onClick={() => open(id)}
      >
        <Icon name="document-text-outline" size={16} color={colors.muted} />
        <span>
          <span>{name}</span>
          {snippet && <small>{snippet}</small>}
        </span>
        {dirty && <i title="Unsaved changes" aria-label="Unsaved changes" />}
      </button>
    </li>
  );
});

const VaultTree = memo(
  function VaultTree({ notes, activeId, draftIds, query, onOpen }) {
    const [collapsed, setCollapsed] = useState(new Set());
    const nav = useRef(null);
    const tree = useMemo(() => fileTree(notes), [notes]);
    const term = query.trim().toLowerCase();
    const activePath = notes.find((note) => note.id === activeId)?.title;
    const hits = term
      ? notes.filter(
          (note) => note.title.toLowerCase().includes(term) || note.content.toLowerCase().includes(term)
        )
      : [];

    useLayoutEffect(() => {
      if (!activeId || activePath === undefined || term) return;
      setCollapsed((old) => {
        const hidden = [...old].filter((path) => activePath.startsWith(path + '/'));
        if (!hidden.length) return old;
        const next = new Set(old);
        hidden.forEach((path) => next.delete(path));
        return next;
      });
      const frame = requestAnimationFrame(() => {
        const rail = nav.current;
        const selected = rail?.querySelector('[aria-current="page"]');
        if (!rail || !selected) return;
        const row = selected.getBoundingClientRect(),
          bounds = rail.getBoundingClientRect();
        if (row.top < bounds.top) rail.scrollTop += row.top - bounds.top;
        else if (row.bottom > bounds.bottom) rail.scrollTop += row.bottom - bounds.bottom;
      });
      return () => cancelAnimationFrame(frame);
    }, [activeId, activePath, term]);
    function toggle(path) {
      setCollapsed((old) => {
        const next = new Set(old);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
    }
    function file(note, depth, result = false) {
      const snippet = result
        ? note.content.split(/\r?\n/).find((line) => line.toLowerCase().includes(term))
        : undefined;
      return (
        <FileRow
          key={note.id}
          id={note.id}
          title={note.title}
          name={result ? note.title || 'Untitled' : leaf(note.title)}
          depth={depth}
          snippet={snippet}
          active={activeId === note.id}
          dirty={draftIds.has(note.id)}
          open={onOpen}
        />
      );
    }
    function folder(node, depth) {
      return (
        <ul>
          {Array.from(node.folders.values(), (child) => {
            const open = !collapsed.has(child.path);
            return (
              <li key={'folder/' + child.path}>
                <button
                  className="vault-folder"
                  type="button"
                  style={{ paddingLeft: 5 + depth * 13 }}
                  aria-expanded={open}
                  onClick={() => toggle(child.path)}
                >
                  <span className="vault-caret" data-open={open}>
                    <Icon name="chevron-forward" size={12} color={colors.muted} />
                  </span>
                  <Icon name={open ? 'folder-open-outline' : 'folder-outline'} size={16} color={colors.muted} />
                  <span>{child.name}</span>
                </button>
                {open && folder(child, depth + 1)}
              </li>
            );
          })}
          {node.notes.map((note) => file(note, depth))}
        </ul>
      );
    }
    return (
      <nav ref={nav} className="vault-tree" aria-label="Vault files">
        {term ? (
          hits.length ? (
            <ul>{hits.map((note) => file(note, 0, true))}</ul>
          ) : (
            <p className="vault-secondary">No matching notes</p>
          )
        ) : (
          folder(tree, 0)
        )}
      </nav>
    );
  },
  (before, after) => {
    if (
      before.activeId !== after.activeId ||
      before.query !== after.query ||
      before.onOpen !== after.onOpen ||
      before.notes.length !== after.notes.length ||
      before.draftIds.size !== after.draftIds.size
    )
      return false;
    for (const id of before.draftIds) if (!after.draftIds.has(id)) return false;
    // An unfiltered tree shows paths and draft markers. Body changes only
    // affect its rendered output when searching for matching snippets.
    const searching = Boolean(after.query.trim());
    return before.notes.every((note, i) => {
      const next = after.notes[i];
      return note.id === next.id && note.title === next.title && (!searching || note.content === next.content);
    });
  }
);

export function NoteFiles({ notes, activeId, draftIds, query, setQuery, onOpen, onCreate, search, children }) {
  return (
    <section className="vault-rail" aria-label="All notes">
      <Button label="New note" icon="add" onPress={onCreate} />
      <div className="vault-rail-title">
        <h2>Vault</h2>
        <span>{notes.length}</span>
      </div>
      <label className="vault-filter">
        <Icon name="search-outline" size={16} color={colors.muted} />
        <input
          ref={search}
          type="search"
          value={query}
          aria-label="Search notes"
          placeholder="Search notes"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <VaultTree notes={notes} activeId={activeId} draftIds={draftIds} query={query} onOpen={onOpen} />
      {children}
    </section>
  );
}
