export function replyImageUrl(input) {
  try {
    const url = new URL(input);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch {
    return undefined;
  }
}

export function splitReplyImages(content) {
  const images = [];
  const text = content.replace(/!\[([^\]\r\n]*)\]\((<[^<>\r\n]+>|[^\s()]+)\)/g, (match, alt, raw) => {
    const uri = replyImageUrl(raw.startsWith('<') ? raw.slice(1, -1) : raw);
    if (!uri) return match;
    images.push({ id: images.length, uri, label: alt.trim() || `Image ${images.length + 1}` });
    return '';
  });
  return { text: text.trim(), images };
}
