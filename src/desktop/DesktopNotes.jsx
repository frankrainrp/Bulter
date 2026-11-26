import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { randomUUID } from '../id.js';

import { colors, Icon } from '../ui.jsx';
import { MarkdownEditor } from './NoteEditor.jsx';
import { NoteFiles } from './NoteFiles.jsx';
import { NoteReading } from './NoteReading.jsx';
import { VaultExport } from './VaultExport.jsx';
import { VaultImport } from './VaultImport.jsx';
import { useNoteDrafts } from './noteDrafts.js';
import { createBacklinkIndex } from './noteBacklinks.js';

import {
  copyTitle,
  directory,
  leaf,
  markdownDestination,
  resolveWiki,
  sameVersion,
  saveDraft,
  splitAnchor,
  validPath,
} from './noteVault.js';
import './noteVault.css';

export function DesktopNotes({ notes, commit, searchNote }) {
  const { session, update, publish, storageWarning } = useNoteDrafts();
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState('');
  const [actionsOpen, setActionsOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const viewport = useRef({});
  const search = useRef(null);
  const pathInput = useRef(null);
  const drafts = useMemo(() => new Map(session.drafts.map((item) => [item.id, item])), [session.drafts]);
  const files = useMemo(() => {
    const merged = new Map(notes.map((note) => [note.id, note]));
    for (const draft of drafts.values())
      merged.set(draft.id, {
        id: draft.id,
        title: draft.base?.title ?? draft.title,
        content: draft.content,
        updatedAt: draft.base?.updatedAt ?? 0,
      });
    return [...merged.values()];
  }, [notes, drafts]);
  const active = files.find((note) => note.id === session.activeId) ?? files[0];
  const draft = active && drafts.get(active.id);
  const current = active && notes.find((note) => note.id === active.id);
  const title = draft?.title ?? active?.title ?? '';
  const content = draft?.content ?? active?.content ?? '';
  const stale = !!draft && !sameVersion(current, draft.base);
  const buildIndex = useMemo(createBacklinkIndex, []);
  const incoming = useMemo(() => buildIndex(files), [buildIndex, files]);
  const backlinks = active ? (incoming.get(active.id) ?? []) : [];

  const open = useCallback(
    (id, read, heading = '') => {
      viewport.current.pending = undefined;
      setAnchor(heading ? { heading } : null);
      update((old) => ({ ...old, activeId: id, reading: read ?? old.reading }));
      setRenaming(false);
      setWarning('');
      setActionsOpen(false);
    },
    [update]
  );
  useEffect(() => {
    if (searchNote) {
      open(searchNote.id);
      setQuery('');
    }
  }, [searchNote, open]);
  useEffect(() => {
    if (renaming) {
      pathInput.current?.focus();
      pathInput.current?.select();
    }
  }, [renaming, active?.id]);
  function create(path) {
    const folder = directory(active?.title ?? '');
    const title = path || copyTitle(files, (folder ? folder + '/' : '') + 'Untitled');
    const draft = { id: randomUUID(), title, content: '', base: null };
    setAnchor(null);
    update((old) => ({ activeId: draft.id, reading: false, drafts: [...old.drafts, draft] }));
    setQuery('');
    setWarning('');
    setRenaming(!path);
    setActionsOpen(false);
  }
  function edit(patch, composing = false) {
    if (!active) return;
    setWarning('');
    update((old) => {
      const previous = old.drafts.find((item) => item.id === active.id);
      const next = {
        ...(previous ?? { id: active.id, title: active.title, content: active.content, base: current ?? null }),
        ...patch,
      };
      const remaining = old.drafts.filter((item) => item.id !== active.id);
      const clean = next.base && next.base.title === next.title && next.base.content === next.content;
      return { ...old, activeId: active.id, drafts: clean ? remaining : [...remaining, next] };
    }, composing);
  }
  async function save(asCopy = false) {
    const snapshot = active && publish().drafts.find((item) => item.id === active.id);
    if (!snapshot || busy) return;
    const copyId = asCopy ? randomUUID() : '';
    let saved;
    let error = '';
    setBusy(true);
    try {
      const ok = await commit((data) => {
        const candidate = asCopy
          ? {
              ...snapshot,
              id: copyId,
              title: copyTitle(
                data.notes,
                (validPath(snapshot.title.trim()) ? snapshot.title.trim() : 'Untitled') + ' (copy)'
              ),
              base: null,
            }
          : snapshot;
        const result = saveDraft(data.notes, candidate);
        if ('error' in result) {
          error = result.error;
          return data;
        }
        saved = result.saved;
        return { ...data, notes: result.notes };
      });
      if (!ok || !saved) {
        setWarning(error || 'Could not save. Your draft is still available.');
        return;
      }
      const committed = saved;
      update((old) => {
        const others = old.drafts.filter((item) => item.id !== snapshot.id);
        const latest = old.drafts.find((item) => item.id === snapshot.id);
        if (latest && latest !== snapshot) others.push({ ...latest, id: committed.id, base: committed });
        return { ...old, activeId: old.activeId === snapshot.id ? committed.id : old.activeId, drafts: others };
      });
      setRenaming(false);
      setWarning('');
    } finally {
      setBusy(false);
    }
  }
  function revert() {
    if (!draft || !window.confirm('Discard the unsaved changes to this note?')) return;
    update((old) => ({ ...old, drafts: old.drafts.filter((item) => item.id !== draft.id) }));
    setWarning('');
    setActionsOpen(false);
    setRenaming(false);
  }
  async function remove() {
    if (!current || busy || !window.confirm('Delete “' + current.title + '” from this vault?')) return;
    let deleted = false;
    setBusy(true);
    try {
      const ok = await commit((data) => {
        if (
          !sameVersion(
            data.notes.find((note) => note.id === current.id),
            draft ? draft.base : current
          )
        )
          return data;
        deleted = true;
        return { ...data, notes: data.notes.filter((note) => note.id !== current.id) };
      });
      if (!ok || !deleted) {
        setWarning('Could not delete this version. Check the latest note and try again.');
        return;
      }
      update((old) => ({ ...old, activeId: '', drafts: old.drafts.filter((item) => item.id !== current.id) }));
      setWarning('');
      setActionsOpen(false);
      setRenaming(false);
    } finally {
      setBusy(false);
    }
  }
  function follow(path) {
    const { file, heading } = splitAnchor(path);
    const target = file ? resolveWiki(files, active?.title ?? '', file) : active;
    if (target) {
      open(target.id, true, heading);
      setQuery('');
      return;
    }
    const destination = file.replace(/\.md$/i, '');
    if (
      !validPath(destination) ||
      files.some((note) => leaf(note.title).toLowerCase() === destination.toLowerCase())
    ) {
      setWarning('Use the full folder path to link to this note.');
      return;
    }
    create(destination);
  }
  function changeMode(reading) {
    if (reading === session.reading || !active) return;
    viewport.current.pending = viewport.current.capture?.();
    setAnchor(null);
    update((old) => ({ ...old, reading }));
  }
  useEffect(() => {
    function keys(event) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 's' && !event.shiftKey) {
        event.preventDefault();
        void save();
        return;
      }
      if (event.isComposing) return;
      if (key === 'e' && !event.shiftKey && active) {
        event.preventDefault();
        changeMode(!session.reading);
      }
      if (key === 'f' && event.shiftKey) {
        event.preventDefault();
        search.current?.focus();
      }
    }
    document.addEventListener('keydown', keys);
    return () => document.removeEventListener('keydown', keys);
  });

  const parent = directory(title);
  return (
    <div className="vault-workspace">
      <NoteFiles
        notes={files}
        activeId={active?.id}
        draftIds={new Set(drafts.keys())}
        search={search}
        query={query}
        setQuery={setQuery}
        onOpen={open}
        onCreate={() => create()}
      >
        <VaultImport commit={commit} reserved={session.drafts.map((draft) => draft.title)} />
        <VaultExport notes={notes} hasDrafts={drafts.size > 0} />
      </NoteFiles>
      <section className="vault-main" aria-label="Note workspace">
        {active ? (
          <>
            <header className="vault-toolbar">
              <div className="vault-location" title={title}>
                <Icon name="folder-open-outline" size={16} color={colors.muted} />
                <span>Vault</span>
                <span aria-hidden="true">/</span>
                <span>{parent || leaf(title)}</span>
              </div>
              <div className="vault-tools">
                <div className="vault-modes" aria-label="Note view" role="group">
                  <button type="button" aria-pressed={!session.reading} onClick={() => changeMode(false)}>
                    Edit
                  </button>
                  <button type="button" aria-pressed={session.reading} onClick={() => changeMode(true)}>
                    Read
                  </button>
                </div>
                <button
                  type="button"
                  className="vault-save"
                  disabled={!draft || stale || busy}
                  onClick={() => void save()}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="vault-more"
                  aria-expanded={actionsOpen}
                  aria-label="Note actions"
                  onClick={() => setActionsOpen(!actionsOpen)}
                >
                  <Icon name="ellipsis-horizontal" size={18} color={colors.ink} />
                </button>
              </div>
            </header>
            {actionsOpen && (
              <div className="vault-actions">
                <button
                  onClick={() => {
                    setRenaming(true);
                    setActionsOpen(false);
                  }}
                >
                  Rename or move
                </button>
                {draft && <button onClick={revert}>Discard draft</button>}
                {current && (
                  <button onClick={() => void remove()} disabled={busy}>
                    Delete note
                  </button>
                )}
              </div>
            )}
            <div className="vault-document" key={active.id}>
              <div className="vault-page">
                {renaming ? (
                  <label className="vault-path">
                    Note path
                    <input
                      ref={pathInput}
                      aria-label="Note path"
                      placeholder="Folder/Note name"
                      value={title}
                      onChange={(e) => edit({ title: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          setRenaming(false);
                        }
                        if (e.key === 'Escape') {
                          setRenaming(false);
                        }
                      }}
                    />
                    <small>Use / to move this note into a folder.</small>
                  </label>
                ) : (
                  <h1 className="vault-title">
                    <button type="button" title="Rename or move" onClick={() => setRenaming(true)}>
                      {leaf(title)}
                    </button>
                  </h1>
                )}
                <div className="vault-status" role="status">
                  {stale
                    ? 'Another version was saved.'
                    : draft
                      ? storageWarning
                        ? 'Draft in memory. Save before closing.'
                        : 'Draft saved in this tab'
                      : 'Saved'}
                </div>
                {(warning || stale) && (
                  <div role="alert" className="vault-warning">
                    {warning || 'Your draft and the latest saved version differ.'}
                    {stale && (
                      <>
                        <button type="button" disabled={busy} onClick={() => void save(true)}>
                          Save as copy
                        </button>
                        <button type="button" disabled={busy} onClick={revert}>
                          Discard draft
                        </button>
                      </>
                    )}
                  </div>
                )}
                {session.reading ? (
                  <NoteReading
                    content={content}
                    owner={active}
                    notes={files}
                    onWiki={follow}
                    anchor={anchor}
                    viewport={viewport.current}
                    onOpen={(id, heading) => {
                      open(id, true, heading);
                      setQuery('');
                    }}
                  />
                ) : (
                  <MarkdownEditor
                    noteId={active.id}
                    value={content}
                    viewport={viewport.current}
                    titles={files.map((note) => note.title)}
                    onWiki={follow}
                    onPublish={publish}
                    onChange={(value, composing) => edit({ content: value }, composing)}
                  />
                )}
                {backlinks.length > 0 && (
                  <section className="vault-backlinks" aria-label="Backlinks">
                    <h2>
                      <Icon name="link-outline" size={17} color={colors.muted} /> Backlinks{' '}
                      <span>{backlinks.length}</span>
                    </h2>
                    {backlinks.map((note) => (
                      <button type="button" key={note.id} onClick={() => open(note.id, true)}>
                        {note.title}
                      </button>
                    ))}
                  </section>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="vault-empty">
            <Icon name="book-outline" size={34} color={colors.muted} />
            <h1>No notes yet</h1>
            <button className="vault-link" type="button" onClick={() => create()}>
              Create your first note
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
