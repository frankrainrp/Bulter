import React, { useState } from 'react';
import { strToU8, zipSync } from 'fflate';

import { markdownFileName, portableFile } from './noteImport.js';

function markdownArchive(notes) {
  const files = Object.create(null);
  const names = new Map();
  for (const note of notes) {
    const title = note.title;
    const path = markdownFileName(title);
    const parts = path.split('/');
    if (!portableFile(path)) {
      throw new Error('Rename “' + (title || 'Untitled') + '” to a portable file path before exporting.');
    }
    let parent = '';
    for (const [index, part] of parts.entries()) {
      const name = parent + part.normalize('NFC').toLowerCase();
      const kind = index === parts.length - 1 ? 'file' : 'folder';
      const existing = names.get(name);
      if (existing && (existing === 'file' || kind === 'file')) {
        throw new Error('Rename “' + title + '” to resolve a duplicate file or folder path before exporting.');
      }
      names.set(name, kind);
      parent = name + '/';
    }
    files[path] = strToU8(note.content);
  }
  return new Uint8Array(zipSync(files, { level: 1 })).buffer;
}

export function VaultExport({ notes, hasDrafts }) {
  const [error, setError] = useState('');
  function download() {
    try {
      const archive = markdownArchive(notes);
      const url = URL.createObjectURL(new Blob([archive], { type: 'application/zip' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'BiTo Notes.zip';
      document.body.append(anchor);
      try {
        anchor.click();
      } finally {
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The notes could not be exported.');
    }
  }
  return (
    <div className="vault-export">
      <button
        type="button"
        disabled={!notes.length}
        onClick={download}
        title="Download saved notes as Markdown files"
      >
        Export Markdown
      </button>
      {hasDrafts && (
        <p>{notes.length ? 'Save drafts to include their latest edits.' : 'Save a note to export it.'}</p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
