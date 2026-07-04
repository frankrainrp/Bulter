"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

export const WIKILINK_RE = /!?\[\[([^\[\]\n]+?)\]\]/g;
const WIKI_HREF_PREFIX = "#butler-wikilink:";

interface ObsidianMarkdownProps {
  content: string;
  emptyText?: string;
  titleToId?: Map<string, string>;
  onWikilinkClick?: (target: string) => void;
  onTaskToggle?: (taskIndex: number, checked: boolean) => void;
}

interface ParsedWikilink {
  title: string;
  heading: string;
  alias: string;
}

interface CalloutMeta {
  type: string;
  title: string;
  rest: string;
}

const CALLOUT_LABELS: Record<string, string> = {
  abstract: "Abstract",
  bug: "Bug",
  caution: "Caution",
  danger: "Danger",
  error: "Error",
  example: "Example",
  failure: "Failure",
  faq: "Question",
  help: "Question",
  hint: "Hint",
  important: "Important",
  info: "Info",
  missing: "Missing",
  note: "Note",
  question: "Question",
  quote: "Quote",
  success: "Success",
  summary: "Summary",
  tip: "Tip",
  todo: "Todo",
  warning: "Warning",
};

const CALLOUT_ICONS: Record<string, string> = {
  bug: "B",
  caution: "!",
  danger: "!",
  error: "!",
  example: "E",
  failure: "X",
  faq: "?",
  help: "?",
  hint: "*",
  important: "!",
  info: "i",
  missing: "?",
  note: "N",
  question: "?",
  quote: ">",
  success: "+",
  tip: "*",
  todo: "-",
  warning: "!",
};

export function parseWikilink(raw: string): ParsedWikilink {
  const [targetPart, aliasPart] = raw.split("|", 2);
  const [titlePart, headingPart] = (targetPart ?? "").split("#", 2);
  const title = titlePart.trim();
  const heading = (headingPart ?? "").trim();
  return {
    title,
    heading,
    alias: (aliasPart ?? (heading || title)).trim(),
  };
}

export function preprocessObsidianMarkdown(content: string, titleToId?: Map<string, string>): string {
  return content.replace(WIKILINK_RE, (full, raw: string) => {
    const isEmbed = full.startsWith("!");
    const parsed = parseWikilink(raw);
    if (!parsed.title) return full;
    const id = titleToId?.get(parsed.title.toLowerCase());
    const suffix = parsed.heading ? `#${encodeURIComponent(parsed.heading)}` : "";
    const target = id ? `${id}${suffix}` : `!missing:${encodeURIComponent(parsed.title)}`;
    const label = parsed.alias.replace(/[\[\]]/g, "");
    return `[${isEmbed ? `!${label}` : label}](${WIKI_HREF_PREFIX}${target})`;
  });
}

export default function ObsidianMarkdown({
  content,
  emptyText,
  titleToId,
  onWikilinkClick,
  onTaskToggle,
}: ObsidianMarkdownProps) {
  const rendered = titleToId ? preprocessObsidianMarkdown(content, titleToId) : content;
  let taskIndex = 0;

  if (!content.trim()) {
    return <p style={{ color: "var(--color-text-faint)", margin: 0 }}>{emptyText ?? "Nothing to preview yet."}</p>;
  }

  return (
    <div className="obsidian-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={buildComponents(onWikilinkClick, onTaskToggle, () => taskIndex++)}
      >
        {rendered}
      </ReactMarkdown>
      <ObsidianMarkdownStyles />
    </div>
  );
}

function buildComponents(
  onWikilinkClick?: (target: string) => void,
  onTaskToggle?: (taskIndex: number, checked: boolean) => void,
  nextTaskIndex?: () => number,
): Components {
  return {
    a: ({ href, children, ...rest }) => {
      if (href && href.startsWith(WIKI_HREF_PREFIX)) {
        const target = href.slice(WIKI_HREF_PREFIX.length);
        const missing = target.startsWith("!missing:");
        return (
          <a
            href={href}
            onClick={(event) => {
              event.preventDefault();
              onWikilinkClick?.(target);
            }}
            className={missing ? "obsidian-wikilink obsidian-wikilink-missing" : "obsidian-wikilink"}
            title={missing ? "Create linked note" : "Open linked note"}
          >
            {children}
          </a>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
          {children}
        </a>
      );
    },
    blockquote: ({ children }) => {
      const meta = readCallout(children);
      if (!meta) return <blockquote>{children}</blockquote>;
      return (
        <blockquote className={`obsidian-callout obsidian-callout-${meta.type}`}>
          <div className="obsidian-callout-title">
            <span className="obsidian-callout-icon">{CALLOUT_ICONS[meta.type] ?? "i"}</span>
            <span>{meta.title || CALLOUT_LABELS[meta.type] || meta.type}</span>
          </div>
          <div className="obsidian-callout-body">{stripCalloutMarker(children, meta)}</div>
        </blockquote>
      );
    },
    input: ({ type, checked, ...rest }) => {
      if (type !== "checkbox") return <input type={type} {...rest} />;
      const taskIndex = nextTaskIndex?.() ?? 0;
      return (
        <input
          type="checkbox"
          checked={!!checked}
          readOnly={!onTaskToggle}
          onChange={(event) => onTaskToggle?.(taskIndex, event.currentTarget.checked)}
          className="obsidian-task-checkbox"
        />
      );
    },
  };
}

function readCallout(children: React.ReactNode): CalloutMeta | null {
  const text = flattenText(React.Children.toArray(children)[0]);
  const match = text.match(/^\s*\[!([a-zA-Z0-9_-]+)\]\s*([^\r\n]*)/);
  if (!match) return null;
  const type = match[1].toLowerCase();
  return {
    type,
    title: match[2].trim() || CALLOUT_LABELS[type] || type,
    rest: text.replace(/^\s*\[![^\]]+\]\s*[^\r\n]*(\r?\n)?/, ""),
  };
}

function stripCalloutMarker(children: React.ReactNode, meta: CalloutMeta): React.ReactNode {
  const nodes = React.Children.toArray(children);
  if (nodes.length === 0) return null;
  const [first, ...rest] = nodes;
  if (!React.isValidElement(first)) return rest;
  if (!meta.rest.trim()) return rest;
  return [
    React.cloneElement(first, { key: "callout-rest" }, meta.rest),
    ...rest,
  ];
}

function flattenText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (React.isValidElement(node)) return flattenText(node.props.children);
  return "";
}

function ObsidianMarkdownStyles() {
  return (
    <style>{`
      .obsidian-md {
        color: var(--color-text);
        font-size: inherit;
        line-height: inherit;
      }
      .obsidian-md p { margin: 0 0 10px; }
      .obsidian-md p:last-child { margin-bottom: 0; }
      .obsidian-md h1,
      .obsidian-md h2,
      .obsidian-md h3,
      .obsidian-md h4 {
        color: var(--color-text);
        font-weight: 700;
        line-height: 1.25;
        margin: 18px 0 8px;
      }
      .obsidian-md h1 {
        font-size: 24px;
        padding-bottom: 6px;
        border-bottom: 1px solid var(--color-border);
      }
      .obsidian-md h2 { font-size: 20px; }
      .obsidian-md h3 { font-size: 17px; }
      .obsidian-md h4 { font-size: 15px; }
      .obsidian-md ul,
      .obsidian-md ol { margin: 6px 0 12px; padding-left: 24px; }
      .obsidian-md li { margin: 4px 0; }
      .obsidian-md li > p { margin: 0; }
      .obsidian-md .contains-task-list { list-style: none; padding-left: 8px; }
      .obsidian-md .task-list-item {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }
      .obsidian-task-checkbox {
        width: 15px;
        height: 15px;
        margin: 5px 0 0;
        accent-color: var(--color-primary);
        flex: 0 0 auto;
      }
      .obsidian-md a {
        color: var(--color-primary);
        text-decoration: none;
        border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 35%, transparent);
      }
      .obsidian-md a:hover {
        border-bottom-color: var(--color-primary);
      }
      .obsidian-wikilink {
        color: var(--color-info) !important;
        background: color-mix(in srgb, var(--color-info) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--color-info) 24%, transparent);
        border-radius: 4px;
        padding: 0 4px;
        font-weight: 500;
      }
      .obsidian-wikilink-missing {
        color: var(--color-danger) !important;
        background: color-mix(in srgb, var(--color-danger) 8%, transparent);
        border-color: color-mix(in srgb, var(--color-danger) 25%, transparent);
      }
      .obsidian-md code {
        background: var(--color-primary-soft);
        padding: 1px 5px;
        border-radius: 4px;
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace;
        font-size: 0.9em;
        color: var(--color-primary);
      }
      .obsidian-md pre {
        background: var(--color-code-bg, #1f2937);
        color: var(--color-code-text, #f3f4f6);
        padding: 12px 14px;
        border-radius: 8px;
        overflow-x: auto;
        font-size: 12.5px;
        line-height: 1.55;
        margin: 12px 0;
        border: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
      }
      .obsidian-md pre code {
        background: transparent;
        color: inherit;
        padding: 0;
        border-radius: 0;
      }
      .obsidian-md blockquote {
        margin: 10px 0;
        padding: 6px 12px;
        border-left: 3px solid var(--color-primary);
        background: var(--color-surface);
        border-radius: 0 8px 8px 0;
        color: var(--color-text-muted);
      }
      .obsidian-callout {
        --callout-color: var(--color-info);
        border: 1px solid color-mix(in srgb, var(--callout-color) 26%, transparent) !important;
        border-left: 4px solid var(--callout-color) !important;
        background: color-mix(in srgb, var(--callout-color) 8%, var(--color-bg)) !important;
        border-radius: 8px !important;
        padding: 10px 12px !important;
      }
      .obsidian-callout-tip,
      .obsidian-callout-hint,
      .obsidian-callout-success { --callout-color: var(--color-success); }
      .obsidian-callout-warning,
      .obsidian-callout-caution,
      .obsidian-callout-important { --callout-color: var(--color-warning); }
      .obsidian-callout-danger,
      .obsidian-callout-error,
      .obsidian-callout-bug,
      .obsidian-callout-failure { --callout-color: var(--color-danger); }
      .obsidian-callout-title {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--callout-color);
        font-weight: 700;
        margin-bottom: 6px;
      }
      .obsidian-callout-icon {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--callout-color) 14%, transparent);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        flex: 0 0 auto;
      }
      .obsidian-callout-body p:last-child { margin-bottom: 0; }
      .obsidian-md table {
        width: 100%;
        border-collapse: collapse;
        margin: 12px 0;
        font-size: 13px;
      }
      .obsidian-md th,
      .obsidian-md td {
        border: 1px solid var(--color-border);
        padding: 7px 10px;
        text-align: left;
        vertical-align: top;
      }
      .obsidian-md th {
        background: var(--color-surface);
        font-weight: 700;
      }
      .obsidian-md tr:nth-child(even) td {
        background: color-mix(in srgb, var(--color-surface) 45%, transparent);
      }
      .obsidian-md hr {
        border: none;
        border-top: 1px solid var(--color-border);
        margin: 18px 0;
      }
      .obsidian-md img {
        max-width: 100%;
        border-radius: 8px;
        border: 1px solid var(--color-border);
      }
    `}</style>
  );
}
