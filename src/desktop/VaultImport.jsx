import { useRef, useState } from 'react';

import { randomUUID } from '../id.js';
import { mergeMarkdownFiles, readMarkdownFiles } from './noteImport.js';

export function VaultImport({ commit, reserved }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState();
  const [error, setError] = useState('');
  const filePicker = useRef(null);
  const folderPicker = useRef(null);
  const inFlight = useRef(false);
  const reservedNow = useRef(reserved);
  reservedNow.current = reserved;

  async function importSelection(event) {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = '';
    if (!files.length || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setSummary(undefined);
    try {
      const selection = await readMarkdownFiles(files);
      let report;
      const ok = await commit((data) => {
        const { added, summary } = mergeMarkdownFiles(data.notes, selection, reservedNow.current, randomUUID);
        report = summary;
        return added.length ? { ...data, notes: [...data.notes, ...added] } : data;
      });
      if (!ok || !report)
        throw new Error(
          'Could not save this batch. No notes were imported. Check available browser storage and retry.'
        );
      setSummary(report);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not read this selection. No notes were imported.'
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="vault-import vault-export">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        Import Markdown
      </button>
      {open && (
        <div className="vault-import-options">
          <button type="button" disabled={busy} onClick={() => filePicker.current?.click()}>
            Choose files
          </button>
          {'webkitdirectory' in HTMLInputElement.prototype && (
            <button type="button" disabled={busy} onClick={() => folderPicker.current?.click()}>
              Choose vault folder
            </button>
          )}
        </div>
      )}
      <input
        hidden
        ref={filePicker}
        type="file"
        multiple
        accept=".md"
        aria-label="Markdown files"
        onChange={importSelection}
      />
      <input
        hidden
        ref={(node) => {
          folderPicker.current = node;
          node?.setAttribute('webkitdirectory', '');
        }}
        type="file"
        multiple
        aria-label="Markdown vault folder"
        onChange={importSelection}
      />
      {busy && <p role="status">Reading Markdown files…</p>}
      {error && <p role="alert">{error}</p>}
      {summary && (
        <div className="vault-import-result">
          <p role="status">
            Imported {summary.added}
            {summary.duplicates > 0 && ' · Unchanged ' + summary.duplicates}
            {summary.ignored > 0 && ' · Ignored ' + summary.ignored}
            {summary.conflicts.length > 0 && ' · Conflicts ' + summary.conflicts.length}
          </p>
          {summary.conflicts.length > 0 && (
            <details>
              <summary>Review skipped paths</summary>
              <ul>
                {summary.conflicts.map((item, index) => (
                  <li key={index}>
                    <b>{item.path}</b> — {item.reason}
                  </li>
                ))}
              </ul>
              <p>Rename the source file or folder, then import it again.</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
