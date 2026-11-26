import { useEffect, useLayoutEffect, useRef } from 'react';
import { autocompletion } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { defaultHighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language';
import { Annotation, EditorState, Text, Transaction } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { wikiSyntax } from './noteVault.js';

const positions = new Map();
const positionKey = (id) => 'bito-c304.note-editor.position.' + id;

function loadPosition(id) {
  const cached = positions.get(id);
  if (cached) return cached;
  try {
    const value = JSON.parse(sessionStorage.getItem(positionKey(id)) ?? 'null');
    if (
      value &&
      Number.isSafeInteger(value.anchor) &&
      Number.isSafeInteger(value.head) &&
      Number.isFinite(value.top) &&
      value.top >= 0
    )
      return value;
  } catch {
    /* The editor remains usable if browser storage is unavailable. */
  }
}

const parentUpdate = Annotation.define();

export function MarkdownEditor({ noteId, value, titles, viewport, onChange, onPublish, onWiki }) {
  const host = useRef(null);
  const editor = useRef(null);
  const composing = useRef(false);
  const props = useRef({ value, titles, onChange, onPublish, onWiki });
  props.current = { value, titles, onChange, onPublish, onWiki };

  useLayoutEffect(() => {
    const saved = loadPosition(noteId);
    const documentPane = host.current.closest('.vault-document');
    const doc = Text.of(props.current.value.split(/\r\n?|\n/));
    const clamp = (offset) => Math.max(0, Math.min(offset, doc.length));
    const complete = (context) => {
      const start = context.matchBefore(/\[\[[^\[\]\n|]*/);
      if (!start) return null;
      const options = props.current.titles.filter(Boolean).map((label) => ({
        label,
        type: 'text',
        apply(view, _completion, from, to) {
          const end = view.state.sliceDoc(to, to + 2) === ']]' ? to + 2 : to;
          view.dispatch({
            changes: { from, to: end, insert: label + ']]' },
            selection: { anchor: from + label.length + 2 },
          });
        },
      }));
      return { from: start.from + 2, options, validFor: /^[^\[\]\n|]*$/ };
    };
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc,
        selection: saved ? { anchor: clamp(saved.anchor), head: clamp(saved.head) } : undefined,
        extensions: [
          markdown({ extensions: [wikiSyntax] }),
          history(),
          autocompletion({ override: [complete] }),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.domEventHandlers({
            mousedown(event, view) {
              if (!(event.ctrlKey || event.metaKey) || event.button !== 0) return false;
              const position = view.posAtCoords({ x: event.clientX, y: event.clientY });
              if (position === null) return false;
              const node = syntaxTree(view.state).resolveInner(position);
              if (node.name !== 'WikiLink') return false;
              event.preventDefault();
              props.current.onWiki(
                view.state
                  .sliceDoc(node.from + 2, node.to - 2)
                  .split('|')[0]
                  .trim()
              );
              return true;
            },
          }),
          syntaxHighlighting(defaultHighlightStyle),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            'aria-label': 'Markdown editor',
            'aria-multiline': 'true',
            spellcheck: 'true',
          }),
          placeholder('Write in Markdown. Link a note with [[name]].'),
          EditorView.updateListener.of((update) => {
            if (
              update.docChanged &&
              !update.transactions.some((transaction) => transaction.annotation(parentUpdate))
            ) {
              props.current.onChange(update.state.doc.toString(), composing.current);
            }
          }),
        ],
      }),
    });
    editor.current = view;
    const startComposition = () => {
      composing.current = true;
    };
    const publish = () => {
      props.current.onPublish();
    };
    const endComposition = () => {
      composing.current = false;
      queueMicrotask(publish);
    };
    view.contentDOM.addEventListener('compositionstart', startComposition, true);
    view.contentDOM.addEventListener('compositionend', endComposition, true);
    view.contentDOM.addEventListener('blur', endComposition, true);
    const incoming = viewport.pending;
    viewport.pending = undefined;
    if (incoming) {
      // Ask CodeMirror to materialize the destination before measuring a wrapped line.
      view.dispatch({ effects: EditorView.scrollIntoView(clamp(incoming.offset), { y: 'center' }) });
    } else if (saved) documentPane.scrollTop = saved.top;
    let top = documentPane.scrollTop;
    let mark = saved?.mark;
    let captureFrame = 0,
      restoreFrame = 0;
    function captureView() {
      if (!documentPane.isConnected || !view.dom.isConnected) return;
      const pane = documentPane.getBoundingClientRect(),
        content = view.contentDOM.getBoundingClientRect();
      if (!pane.height || !content.height) return;
      const y = Math.min(pane.bottom - 1, Math.max(pane.top + 1, pane.top + pane.height / 2));
      const offset = view.posAtCoords({ x: content.left + 2, y });
      const box = offset === null ? null : view.coordsAtPos(offset);
      if (box && offset !== null) mark = { offset, y: box.top - pane.top };
      else mark = undefined;
      return mark;
    }
    viewport.capture = captureView;
    function onScroll() {
      top = documentPane.scrollTop;
      cancelAnimationFrame(captureFrame);
      captureFrame = requestAnimationFrame(captureView);
    }
    // CodeMirror estimates the heights of offscreen lines. The same pixel offset
    // can show a different paragraph when the editor is recreated.
    const target = incoming ?? saved?.mark;
    let measuring = true;
    const stopRestore = () => {
      measuring = false;
      cancelAnimationFrame(restoreFrame);
    };
    if ((incoming || saved?.top) && target && Number.isSafeInteger(target.offset) && Number.isFinite(target.y)) {
      let passes = 0;
      const align = () => {
        if (!measuring) return;
        const pos = clamp(target.offset);
        const box = view.coordsAtPos(pos);
        const lineTop = box?.top ?? view.documentTop + view.lineBlockAt(pos).top;
        const delta = lineTop - documentPane.getBoundingClientRect().top - target.y;
        if (Math.abs(delta) > 0.75) {
          documentPane.scrollTop += delta;
          view.requestMeasure();
        }
        if (++passes < 6) restoreFrame = requestAnimationFrame(align);
      };
      restoreFrame = requestAnimationFrame(align);
    }
    const remember = () => {
      const { anchor, head } = view.state.selection.main;
      captureView();
      const position = { anchor, head, top, mark };
      positions.set(noteId, position);
      try {
        sessionStorage.setItem(positionKey(noteId), JSON.stringify(position));
      } catch {
        /* In-tab navigation can restore the in-memory copy. */
      }
    };
    // The editor can unmount after its outer scroll pane is detached. Track
    // the last scroll event and persist only when leaving the tab or document.
    const onLeave = () => {
      publish();
      remember();
    };
    const onHidden = () => {
      if (document.visibilityState === 'hidden') onLeave();
    };
    documentPane.addEventListener('scroll', onScroll, { passive: true });
    const interruption = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    for (const event of interruption) documentPane.addEventListener(event, stopRestore, { passive: true });
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onLeave);
    return () => {
      view.contentDOM.removeEventListener('compositionstart', startComposition, true);
      view.contentDOM.removeEventListener('compositionend', endComposition, true);
      view.contentDOM.removeEventListener('blur', endComposition, true);
      composing.current = false;
      publish();
      viewport.capture = undefined;
      stopRestore();
      cancelAnimationFrame(captureFrame);
      for (const event of interruption) documentPane.removeEventListener(event, stopRestore);
      documentPane.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onLeave);
      remember();
      editor.current = null;
      view.destroy();
    };
  }, [noteId, viewport]);
  useEffect(() => {
    const view = editor.current;
    if (view && !composing.current && value !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
        annotations: [Transaction.addToHistory.of(false), parentUpdate.of(true)],
      });
    }
  }, [value]);
  return <div className="vault-source" ref={host} />;
}
