import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';

import { markdownDestination, wikiLinks } from './noteVault.js';
import { captureReading, noteSourcePositions, restoreReading } from './noteViewport.js';

const normalize = (text) => text.normalize('NFKC').trim().toLowerCase();
const slug = (text) =>
  normalize(text)
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .replace(/\s+/g, '-');

export function NoteReading({ content, notes, owner, anchor, viewport, onWiki, onOpen }) {
  const article = useRef(null);
  const lastJump = useRef(null);
  const [missing, setMissing] = useState('');
  const { source, links } = useMemo(() => {
    const markdown = content.replace(/\r\n?/g, '\n');
    const links = new Map();
    let source = '',
      last = 0;
    for (const link of wikiLinks(markdown)) {
      source += markdown.slice(last, link.from);
      // Preserve UTF-16 offsets for source positions after a Wiki link.
      links.set(link.from, link);
      source += '[' + 'w'.repeat(link.to - link.from - 4) + ']()';
      last = link.to;
    }
    return { source: source + markdown.slice(last), links };
  }, [content]);

  useLayoutEffect(() => {
    if (!article.current) return;
    const headings = Array.from(article.current.querySelectorAll('h1,h2,h3,h4,h5,h6'));
    const bySlug = new Map();
    for (const heading of headings) {
      const base = slug(heading.textContent || '') || 'heading';
      let name = base,
        index = 0;
      while (bySlug.has(name)) name = base + '-' + ++index;
      bySlug.set(name, heading);
      heading.id = 'vault-heading-' + name;
      heading.tabIndex = -1;
    }
    if (!anchor?.heading) {
      setMissing('');
      return;
    }
    if (lastJump.current === anchor) return;
    lastJump.current = anchor;
    const target =
      bySlug.get(normalize(anchor.heading)) ??
      headings.find((el) => normalize(el.textContent || '') === normalize(anchor.heading)) ??
      bySlug.get(slug(anchor.heading));
    setMissing(target ? '' : anchor.heading);
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: 'instant', block: 'center' });
    }
  }, [source, anchor]);
  useLayoutEffect(() => {
    const body = article.current;
    const pane = body.closest('.vault-document');
    viewport.capture = () => captureReading(body, pane);
    if (viewport.pending) restoreReading(body, pane, viewport.pending);
    viewport.pending = undefined;
    return () => {
      viewport.capture = undefined;
    };
  }, [viewport]);

  return (
    <article ref={article} className="vault-prose" aria-label="Markdown preview">
      {missing && (
        <p className="vault-warning" role="status">
          Heading “{missing}” was not found in this note.
        </p>
      )}
      {content ? (
        <Markdown
          rehypePlugins={[noteSourcePositions]}
          components={{
            a: ({ node, href, children }) => {
              const offset = node?.position?.start.offset;
              const link = offset !== undefined && links.get(offset);
              if (link)
                return (
                  <button
                    type="button"
                    className="vault-link"
                    data-note-from={link.from}
                    data-note-to={link.to}
                    onClick={() => onWiki(link.path)}
                  >
                    {link.label}
                  </button>
                );
              const destination = markdownDestination(notes, owner, href);
              if (destination.kind === 'note')
                return (
                  <button
                    type="button"
                    className="vault-link"
                    onClick={() => onOpen(destination.note.id, destination.heading)}
                  >
                    {children}
                  </button>
                );
              if (destination.kind === 'external')
                return (
                  <a href={destination.href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                );
              return (
                <span className="vault-unavailable" role="link" aria-disabled="true" title={destination.reason}>
                  {children}
                </span>
              );
            },
            img: ({ alt }) => (
              <span className="vault-unavailable" title="Attachment preview is unavailable">
                {alt || 'Attachment'}
              </span>
            ),
          }}
        >
          {source}
        </Markdown>
      ) : (
        <p className="vault-secondary">Empty note</p>
      )}
    </article>
  );
}
