import { parser } from '@lezer/markdown';
import { replyImageUrl } from './replyImages.js';

export function splitDesktopReplyImages(content) {
  const images = [];
  if (!content.includes('![')) return { text: content, images };
  let text = '',
    last = 0;
  for (const part of replyParts(content)) {
    if (part.rawSvg || !part.source.includes('![')) continue;
    parser.parse(part.source).iterate({
      enter(node) {
        if (node.name !== 'Image') return;
        const token = part.source.slice(node.from, node.to);
        const parts = /^!\[([^\]\r\n]*)\]\((<[^<>\r\n]+>|[^\s()]+)\)$/.exec(token);
        if (!parts) return;
        const raw = parts[2];
        const uri = replyImageUrl(raw.startsWith('<') ? raw.slice(1, -1) : raw);
        if (!uri) return;
        text += content.slice(last, part.start + node.from);
        last = part.start + node.to;
        images.push({ id: images.length, uri, label: parts[1].trim() || `Image ${images.length + 1}` });
        return false;
      },
    });
  }
  return { text: text + content.slice(last), images };
}

// An SVG on its own line is a diagram. An SVG inside Markdown code stays code.
export function replyParts(content) {
  const whole = { source: content, start: 0, rawSvg: false, closed: true };
  if (!content.includes('<svg')) return [whole];
  const protectedRanges = [];
  parser.parse(content).iterate({
    enter(node) {
      if (
        node.name === 'FencedCode' ||
        node.name === 'CodeBlock' ||
        node.name === 'InlineCode' ||
        node.name === 'CommentBlock'
      ) {
        protectedRanges.push({ from: node.from, to: node.to });
        return false;
      }
    },
  });
  const parts = [];
  const start = /^ {0,3}\uFEFF?(?:<\?xml(?=\s)[^?<>]*\?>[ \t]*(?:\r?\n {0,3})?)?<svg(?=[\s/>])/gm;
  const end = /<\/svg\s*>[ \t]*(?=\r?$)/gm;
  let last = 0,
    protectedIndex = 0;
  for (let match = start.exec(content); match; match = start.exec(content)) {
    while (protectedIndex < protectedRanges.length && protectedRanges[protectedIndex].to <= match.index)
      protectedIndex++;
    if (protectedRanges[protectedIndex]?.from <= match.index) continue;
    end.lastIndex = start.lastIndex;
    const rootEnd = content.indexOf('>', start.lastIndex);
    const selfClosed =
      rootEnd >= 0 && content[rootEnd - 1] === '/' && /^[ \t]*\r?(?:\n|$)/.test(content.slice(rootEnd + 1));
    const closed = selfClosed || !!end.exec(content);
    const to = selfClosed ? rootEnd + 1 : closed ? end.lastIndex : content.length;
    if (last < match.index) parts.push({ ...whole, source: content.slice(last, match.index), start: last });
    parts.push({ source: content.slice(match.index, to), start: match.index, rawSvg: true, closed });
    last = to;
    if (!closed) break;
    start.lastIndex = to;
  }
  if (!parts.length) return [whole];
  if (last < content.length) parts.push({ ...whole, source: content.slice(last), start: last });
  return parts;
}
