/** Normalize a user/AI supplied address for the sandboxed Web Panel. */
export function normalizePanelUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return "";

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    // Production pages cannot safely embed insecure HTTP, and non-web schemes
    // must never reach an iframe src.
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export function normalizePanelHtml(input: string): string {
  let html = input.trim();
  if (!html) return "";
  html = html.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // Do not impose an app-specific source-size ceiling here. AI-authored panels
  // can legitimately include substantial inline CSS, JavaScript and data; the
  // transport/database layers remain responsible for their own safety limits.
  if (!/<(?:html|body|main|div|canvas)\b/i.test(html)) return "";
  return html;
}

/**
 * Inject a restrictive CSP into AI-authored HTML before placing it in srcDoc.
 * Inline CSS/JS are allowed for self-contained games, while network access,
 * storage access and parent navigation remain blocked by CSP + iframe sandbox.
 */
export function buildSandboxedWebApp(input: string): string {
  const html = normalizePanelHtml(input);
  if (!html) return "";
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; media-src data: blob:;">`;
  if (/<head(?:\s[^>]*)?>/i.test(html)) return html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${csp}`);
  if (/<html(?:\s[^>]*)?>/i.test(html)) return html.replace(/<html(?:\s[^>]*)?>/i, (root) => `${root}<head>${csp}</head>`);
  return `<!doctype html><html><head>${csp}</head><body>${html}</body></html>`;
}
