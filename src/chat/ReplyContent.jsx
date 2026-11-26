import {
  Component,
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { inspectPassiveSvg } from './passiveSvg.js';
import { replyParts } from './replyMarkdown.js';
export { splitDesktopReplyImages } from './replyMarkdown.js';
import './replyContent.css';

const Markdown = lazy(() => import('react-markdown'));
export const ReplyReadyContext = createContext(() => {});
const noFailures = new Set();
const DecodeFailures = createContext(noFailures);

const ReplySource = createContext({ source: '', streaming: false });
class MarkdownFallback extends Component {
  state = { failed: false, expanded: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <details
        className="reply-format-failure"
        onToggle={(event) => this.setState({ expanded: event.currentTarget.open })}
      >
        <summary>Formatting unavailable. View source</summary>
        {this.state.expanded && <pre tabIndex={0}>{this.props.source}</pre>}
      </details>
    ) : (
      this.props.children
    );
  }
}
const hasMarkdown =
  /[\[\]*_`<>\\&]|^ {0,3}(?:#{1,6}\s|[-+>]\s|\d+[.)]\s|[-=]{3,}\s*$|~{3,})|^(?: {4}|\t)|\n\s*\n/m;

function CodeBlock({ source, language, closed, streaming }) {
  const svg =
    /^(?:svg|image\/svg\+xml)$/i.test(language) ||
    (/^(?:xml|html)?$/i.test(language) && /^\s*(?:<\?xml\s[^?]*\?>\s*)?<svg(?=[\s/>])/.test(source));
  const result = useMemo(
    () => (svg && (closed || !streaming) ? inspectPassiveSvg(source) : undefined),
    [svg, closed, streaming, source]
  );
  const failures = useContext(DecodeFailures);
  const preview = result?.status === 'ready' && !failures.has(result.uri) ? result : undefined;
  const [requestedSource, setRequestedSource] = useState(null);
  const showSource = requestedSource === source;
  const [copied, setCopied] = useState('idle');
  const code = useRef(null);
  useEffect(() => {
    if (copied !== 'copied') return;
    const timer = setTimeout(() => setCopied('idle'), 1800);
    return () => clearTimeout(timer);
  }, [copied]);
  useLayoutEffect(() => {
    if (copied !== 'manual' || !code.current) return;
    code.current.parentElement?.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(code.current);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(source);
      setCopied('copied');
    } catch {
      setRequestedSource(source);
      setCopied('manual');
    }
  }
  return (
    <figure className="reply-code">
      <figcaption className="reply-code-tools">
        <span className="reply-code-language">{svg ? 'SVG' : language || 'Code'}</span>
        {svg && (
          <div role="group" aria-label="SVG display" className="reply-code-modes">
            <button
              type="button"
              aria-pressed={!showSource}
              onClick={() => {
                setRequestedSource(null);
                setCopied('idle');
              }}
            >
              Preview
            </button>
            <button type="button" aria-pressed={showSource} onClick={() => setRequestedSource(source)}>
              Source
            </button>
          </div>
        )}
        <button type="button" aria-label="Copy code" onClick={copy}>
          {copied === 'copied' ? 'Copied' : 'Copy'}
        </button>
      </figcaption>
      {preview && (
        <div className="reply-svg-image" hidden={showSource}>
          <img src={preview.uri} alt={preview.label} />
        </div>
      )}
      {svg && !preview && !showSource && (
        <span className="reply-code-status">
          {result ? svgStatus[result.status] : 'Waiting for the rest of the diagram.'}
        </span>
      )}
      {(!svg || showSource) && (
        <pre aria-label={svg ? 'SVG source' : 'Code'} tabIndex={0}>
          <code ref={code}>{source}</code>
        </pre>
      )}
      <span role="status" className={copied === 'manual' ? 'reply-code-status' : 'reply-visually-hidden'}>
        {copied === 'manual'
          ? 'Code selected. Use your copy shortcut.'
          : copied === 'copied'
            ? 'Code copied.'
            : ''}
      </span>
    </figure>
  );
}

const svgStatus = {
  ready: 'The browser could not display this diagram.',
  invalid: 'The SVG markup is incomplete or invalid.',
  unsupported: 'This diagram uses unsupported SVG features.',
  'too-large': 'This diagram is too large for a preview.',
  empty: 'This SVG contains no visible graphics.',
};

const components = {
  img: ({ alt }) => <span>{alt || 'Image'}</span>,
  a: ({ href, children }) =>
    /^https?:\/\//i.test(href ?? '') ? (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  pre: function MarkdownCode({ node }) {
    const { source, streaming } = useContext(ReplySource);
    const block = node?.children[0];
    if (block?.type !== 'element' || block.tagName !== 'code') return null;
    const value = block.children
      .map((child) => (child.type === 'text' ? child.value : ''))
      .join('')
      .replace(/\n$/, '');
    const classes = block.properties.className;
    const language =
      (Array.isArray(classes) ? classes.map(String).find((name) => name.startsWith('language-')) : '')?.slice(9) ??
      '';
    const rawBlock = source.slice(node?.position?.start.offset, node?.position?.end.offset);
    const fence = /^[ \t]*(`{3,}|~{3,})/.exec(rawBlock)?.[1];
    const finalLine = rawBlock.slice(rawBlock.lastIndexOf('\n') + 1).trim();
    const closed =
      !fence ||
      (rawBlock.includes('\n') &&
        finalLine.length >= fence.length &&
        [...finalLine].every((ch) => ch === fence[0]));
    return <CodeBlock source={value} language={language} closed={closed} streaming={streaming} />;
  },
};
function MarkdownPart(props) {
  const { source } = props;
  if (!source.trim()) return null;
  if (!hasMarkdown.test(source)) return <p className="reply-plain">{source}</p>;
  return (
    <MarkdownFallback source={source}>
      <ReplySource.Provider value={props}>
        <Markdown components={components}>{source}</Markdown>
      </ReplySource.Provider>
    </MarkdownFallback>
  );
}

function decodeImage(image) {
  if (typeof image.decode === 'function') return image.decode();
  if (image.complete) return image.naturalWidth > 0 ? Promise.resolve() : Promise.reject();
  return new Promise((resolve, reject) => {
    image.addEventListener('load', () => resolve(), { once: true });
    image.addEventListener('error', () => reject(), { once: true });
  });
}

function PreparedReply({ content, streaming = false }) {
  const parts = useMemo(() => replyParts(content), [content]);
  const container = useRef(null);
  const onReady = useContext(ReplyReadyContext);
  const [prepared, setPrepared] = useState();
  const ready = prepared?.parts === parts && prepared.streaming === streaming;

  useLayoutEffect(() => {
    const images = Array.from(container.current.querySelectorAll('.reply-svg-image img'));
    const failures = new Set();
    let active = true;
    function finish() {
      if (active) setPrepared({ parts, streaming, failures });
    }
    if (images.length) {
      Promise.all(
        images.map(async (image) => {
          try {
            await decodeImage(image);
          } catch {
            failures.add(image.getAttribute('src'));
          }
        })
      ).then(finish);
    } else finish();
    return () => {
      active = false;
    };
  }, [parts, streaming]);
  useLayoutEffect(() => {
    if (ready) onReady();
  }, [ready, onReady]);

  return (
    <div ref={container} className="reply-markdown" aria-busy={!ready} inert={!ready}>
      <DecodeFailures.Provider value={ready ? prepared.failures : noFailures}>
        {parts.map((part) =>
          part.rawSvg ? (
            <CodeBlock
              key={part.start}
              source={part.source}
              language="svg"
              closed={part.closed}
              streaming={streaming}
            />
          ) : (
            <MarkdownPart key={part.start} source={part.source} streaming={streaming} />
          )
        )}
      </DecodeFailures.Provider>
    </div>
  );
}
export function ReplyContent(props) {
  return (
    <Suspense fallback={null}>
      <PreparedReply {...props} />
    </Suspense>
  );
}
