// Annotate rendered text runs with the Markdown offsets supplied by the parser.
// Blocks also provide a target for empty lines, fenced code and list punctuation.
export function noteSourcePositions() {
  function visit(node) {
    const from = node.position?.start.offset,
      to = node.position?.end.offset;
    if (node.type === 'element') {
      node.children = node.children.map(visit);
      if (from !== undefined && to !== undefined && /^(p|li|pre|h[1-6])$/.test(node.tagName)) {
        node.properties['data-note-from'] = from;
        node.properties['data-note-to'] = to;
      }
    } else if (node.type === 'text' && from !== undefined && to !== undefined) {
      return {
        type: 'element',
        tagName: 'span',
        properties: { 'data-note-from': from, 'data-note-to': to },
        children: [node],
      };
    }
    return node;
  }
  return (tree) => {
    tree.children = tree.children.map(visit);
  };
}

const positioned = '[data-note-from]';

function textRange(element, index) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  range.selectNodeContents(element);
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const length = text.textContent?.length ?? 0;
    if (index <= length) {
      range.setStart(text, index);
      range.collapse(true);
      break;
    }
    index -= length;
  }
  return range;
}

export function captureReading(article, pane) {
  const bounds = pane.getBoundingClientRect(),
    body = article.getBoundingClientRect();
  const x = body.left + Math.min(24, body.width / 2);
  const y = Math.max(body.top + 1, Math.min(body.bottom - 1, bounds.top + bounds.height / 2));
  const position = document.caretPositionFromPoint?.(x, y);
  let caret = null;
  if (position) {
    caret = document.createRange();
    caret.setStart(position.offsetNode, position.offset);
    caret.collapse(true);
  } else {
    caret = document.caretRangeFromPoint?.(x, y) ?? null;
  }
  const at = caret?.startContainer;
  const element = (at instanceof Element ? at : at?.parentElement)?.closest(positioned);
  if (!caret || !element || !article.contains(element)) {
    let nearest,
      distance = Infinity;
    for (const block of article.querySelectorAll(
      'p[data-note-from],li[data-note-from],pre[data-note-from],:is(h1,h2,h3,h4,h5,h6)[data-note-from]'
    )) {
      const rect = block.getBoundingClientRect();
      if (rect.bottom < bounds.top || rect.top > bounds.bottom) continue;
      const line = Math.max(rect.top, Math.min(y, rect.bottom)),
        gap = Math.abs(y - line);
      if (gap >= distance) continue;
      const from = Number(block.dataset.noteFrom),
        to = Number(block.dataset.noteTo);
      const fraction = (line - rect.top) / Math.max(1, rect.height);
      nearest = { offset: from + Math.round((to - from) * fraction), y: line - bounds.top };
      distance = gap;
    }
    return nearest;
  }
  const prefix = document.createRange();
  prefix.selectNodeContents(element);
  prefix.setEnd(caret.startContainer, caret.startOffset);
  const from = Number(element.dataset.noteFrom),
    to = Number(element.dataset.noteTo);
  const fraction = prefix.toString().length / Math.max(1, element.textContent.length);
  const rect = caret.getBoundingClientRect();
  return { offset: from + Math.round((to - from) * fraction), y: (rect.height ? rect.top : y) - bounds.top };
}

export function restoreReading(article, pane, mark) {
  let nearest,
    distance = Infinity,
    width = Infinity;
  for (const element of article.querySelectorAll(positioned)) {
    const from = Number(element.dataset.noteFrom),
      to = Number(element.dataset.noteTo);
    const gap = Math.max(from - mark.offset, mark.offset - to, 0);
    if (gap < distance || (gap === distance && to - from <= width)) {
      nearest = element;
      distance = gap;
      width = to - from;
    }
  }
  if (!nearest) return;
  const from = Number(nearest.dataset.noteFrom);
  const fraction = Math.min(1, Math.max(0, (mark.offset - from) / Math.max(1, width)));
  const range = textRange(nearest, Math.round(fraction * nearest.textContent.length));
  const box = range.getBoundingClientRect();
  pane.scrollTop +=
    (box.height ? box.top : nearest.getBoundingClientRect().top) - pane.getBoundingClientRect().top - mark.y;
}
