"use client";

// ============================================================
// components/NotesPanel.tsx — 笔记面板（浏览器内简易 Markdown 版）
//
// 双栏：左 280px 列表 + 右编辑区（textarea + preview 切换）
// Notes are stored through the Express API; this component edits React state.
// Phase 3 后会迁移到本地 Obsidian Vault（vaultPath 字段已留位）
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pin, PinOff, Eye, Edit3, FileText, Lock, Link2, Search, X as XIcon, Network } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Note, DdlItem } from "@/lib/types";
import { EmptyNotes, EmptyFilter } from "./EmptyIllustrations";
import { useIsMobile } from "@/lib/use-is-mobile";
import { useT, type TFunc } from "@/lib/i18n";

// ============================================================
// [053] Notes 100%：wikilink 工具
//   - WIKILINK_RE: 匹配 [[Title]]（避免贪婪 + 排除嵌套右括号）
//   - WIKI_HREF_PREFIX: 内部跳转 marker，ReactMarkdown 不会把它当外链
//   - 把 [[xxx]] 预处理成 markdown link [xxx](#butler-wikilink:id-or-missing:title)
//     既保留 ReactMarkdown 原生渲染又能在 a 组件覆写里拦截 click
// ============================================================
const WIKILINK_RE = /\[\[([^\[\]\n]+?)\]\]/g;
const WIKI_HREF_PREFIX = "#butler-wikilink:";

function preprocessWikilinks(content: string, titleToId: Map<string, string>): string {
  return content.replace(WIKILINK_RE, (_full, raw: string) => {
    const title = raw.trim();
    if (!title) return _full;
    const id = titleToId.get(title.toLowerCase());
    // 用 ! 前缀标记缺失，避免与合法 note id 混淆
    const target = id ?? `!missing:${encodeURIComponent(title)}`;
    // markdown link 文本里转义可能存在的 ] 防越界
    const safeText = title.replace(/[\[\]]/g, "");
    return `[${safeText}](${WIKI_HREF_PREFIX}${target})`;
  });
}

interface Props {
  notes: Note[];
  onCreate: () => Note;                         // 创建一条空笔记并返回（page.tsx 决定 ID + 持久化）
  onUpdate: (id: string, patch: Partial<Note>) => void;
  onDelete: (id: string) => void;
  // B1 跨面板联动
  /** 所有任务,用于反查"关联到此笔记的任务列表" */
  ddls?: DdlItem[];
  /** 外部要求选中某条笔记（B1/B3 跨面板跳转时传） */
  selectActiveId?: string | null;
  /** 点击关联任务跳转到 Tasks Tab + 打开 TaskDetailDrawer */
  onJumpToTask?: (taskId: string) => void;
  // B4 笔记 - [ ] todo 自动同步 Tasks（单向）
  /** 在笔记中发现新 todo 时调用；page.tsx 创建 task + 自动关联到 noteId */
  onAutoExtractTodos?: (noteId: string, newTodos: string[]) => void;
}

export default function NotesPanel({
  notes, onCreate, onUpdate, onDelete,
  ddls = [], selectActiveId, onJumpToTask, onAutoExtractTodos,
}: Props) {
  const isMobile = useIsMobile();
  const { t } = useT();
  const sorted = useMemo(() => {
    return [...notes].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [notes]);

  // [053] title (lowercase) → id 映射，用于 wikilink 解析
  const titleToId = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of notes) {
      const key = (n.title || "").trim().toLowerCase();
      if (key) m.set(key, n.id);
    }
    return m;
  }, [notes]);

  // [053] 本地搜索 query → 过滤 sorted（title + content + tags 子串）
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((n) => {
      const hay = `${n.title} ${n.content} ${(n.tags ?? []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sorted, query]);

  const [activeId, setActiveId] = useState<string | null>(sorted[0]?.id ?? null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  // 手机：列表 / 编辑 二选一全屏，避免 40vh 列表把编辑挤成豆腐块
  const [mobileShowList, setMobileShowList] = useState(true);

  // 当列表变化（新建/删除），自动调整 active
  useEffect(() => {
    if (sorted.length === 0) {
      setActiveId(null);
      return;
    }
    if (!activeId || !sorted.find((n) => n.id === activeId)) {
      setActiveId(sorted[0].id);
    }
  }, [sorted, activeId]);

  // B1 外部跳转：父组件传入 selectActiveId 变化时同步切换
  useEffect(() => {
    if (selectActiveId && sorted.find((n) => n.id === selectActiveId)) {
      setActiveId(selectActiveId);
      setMode("edit");
      setMobileShowList(false); // 手机：跳转后直接进编辑全屏
    }
  }, [selectActiveId, sorted]);

  const active = sorted.find((n) => n.id === activeId) ?? null;
  // B1 反查当前笔记关联的任务
  const linkedTasks = useMemo(
    () => (active ? ddls.filter((d) => d.noteId === active.id) : []),
    [active, ddls],
  );

  // [053] 反向 wikilink：扫描所有其他笔记，找到 `[[当前 title]]` 引用
  const backlinks = useMemo(() => {
    if (!active || !active.title.trim()) return [];
    const titleLower = active.title.trim().toLowerCase();
    const result: Note[] = [];
    for (const n of notes) {
      if (n.id === active.id) continue;
      // 扫描内容中所有 [[xxx]] 匹配
      const matches = n.content.match(WIKILINK_RE);
      if (!matches) continue;
      const has = matches.some((m) => m.slice(2, -2).trim().toLowerCase() === titleLower);
      if (has) result.push(n);
    }
    return result;
  }, [active, notes]);

  const handleCreate = () => {
    const fresh = onCreate();
    setActiveId(fresh.id);
    setMode("edit");
    setMobileShowList(false);
  };

  // [053] 处理 wikilink 点击：跳转 id，或缺失时新建该 title
  const handleWikilinkClick = (target: string) => {
    if (target.startsWith("!missing:")) {
      const title = decodeURIComponent(target.slice(9));
      if (!confirm(t("notes.linkCreateConfirm", { title }))) return;
      const fresh = onCreate();
      // 新建后立即用该 title 更新
      onUpdate(fresh.id, { title, updatedAt: Date.now() });
      setActiveId(fresh.id);
      setMode("edit");
      setMobileShowList(false);
    } else {
      setActiveId(target);
      setMode("preview");
      setMobileShowList(false);
    }
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        background: "transparent",
        overflow: "hidden",
      }}
    >
      {/* 左：笔记列表（手机：列表 / 编辑 二选一全屏） */}
      <aside
        style={{
          width: isMobile ? "100%" : 280,
          // 用 longhand 表达，避免 flex 简写与 flexShrink 混用触发 React 警告
          flexGrow: isMobile ? 1 : 0,
          flexShrink: 0,
          flexBasis: isMobile ? 0 : "auto",
          borderRight: isMobile ? "none" : "1px solid var(--color-border)",
          display: isMobile && !mobileShowList ? "none" : "flex",
          flexDirection: "column",
          background: "var(--color-surface)",
          minHeight: 0,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 14px 10px",
          }}
        >
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
            All Notes
          </h2>
          <button
            onClick={handleCreate}
            aria-label="New Note"
            title={t("notes.new")}
            style={{
              width: 28, height: 28, borderRadius: 6, border: "none",
              background: "var(--color-primary)", color: "white",
              cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Plus size={14} />
          </button>
        </header>

        {/* [053] 本地搜索框 */}
        <div style={{ padding: "0 12px 8px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            height: 28, borderRadius: 6,
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            padding: "0 8px",
          }}>
            <Search size={12} color="var(--color-text-faint)" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("notes.searchPh")}
              style={{
                flex: 1, border: "none", background: "transparent",
                outline: "none", fontSize: 12, color: "var(--color-text)",
                fontFamily: "inherit", width: 0,
              }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label={t("notes.clear")}
                style={{
                  width: 16, height: 16, borderRadius: 4, border: "none",
                  background: "transparent", cursor: "pointer", padding: 0,
                  color: "var(--color-text-faint)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <XIcon size={11} />
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
          {sorted.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "40px 12px",
              color: "var(--color-text-faint)", fontSize: 12,
            }}>
              {t("notes.emptyList")}<br />
              <span style={{ color: "var(--color-text-muted)" }}>{t("notes.tapNew")}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "20px 12px",
              color: "var(--color-text-faint)", fontSize: 12,
            }}>
              <div style={{ marginBottom: 6 }}><EmptyFilter size={80} /></div>
              {t("notes.noMatch", { query })}<br />
              <button
                onClick={() => setQuery("")}
                style={{
                  marginTop: 6, padding: "3px 10px", border: "1px solid var(--color-border)",
                  borderRadius: 4, background: "var(--color-bg)", color: "var(--color-text-muted)",
                  fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {t("notes.clearFilter")}
              </button>
            </div>
          ) : (
            filtered.map((n) => (
              <NoteListItem
                key={n.id}
                note={n}
                active={n.id === activeId}
                onClick={() => { setActiveId(n.id); setMobileShowList(false); }}
              />
            ))
          )}
        </div>

        <footer
          style={{
            padding: "10px 12px",
            borderTop: "1px solid var(--color-border)",
            fontSize: 11,
            color: "var(--color-text-faint)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Lock size={11} />
          {t("notes.localHint")}
        </footer>
      </aside>

      {/* 右：编辑区（手机：列表态隐藏，编辑态全屏并加返回） */}
      <main
        style={{
          flex: 1,
          display: isMobile && mobileShowList ? "none" : "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        {isMobile && active && (
          <button
            onClick={() => setMobileShowList(true)}
            aria-label={t("notes.backToList")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 14px",
              border: "none",
              borderBottom: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--color-primary)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
            }}
          >
            {t("notes.backList")}
          </button>
        )}
        {active ? (
          <NoteEditor
            key={active.id}
            note={active}
            mode={mode}
            onModeChange={setMode}
            onUpdate={(patch) => onUpdate(active.id, patch)}
            onDelete={() => {
              if (confirm(t("notes.deleteConfirm", { title: active.title || t("td.note.untitled") }))) onDelete(active.id);
            }}
            linkedTasks={linkedTasks}
            onJumpToTask={onJumpToTask}
            onAutoExtractTodos={onAutoExtractTodos}
            titleToId={titleToId}
            backlinks={backlinks}
            onWikilinkClick={handleWikilinkClick}
            onSelectBacklink={(id) => { setActiveId(id); setMode("preview"); setMobileShowList(false); }}
          />
        ) : (
          <EmptyHero onCreate={handleCreate} />
        )}
      </main>
    </div>
  );
}

// ============================================================
// 左侧列表项
// ============================================================
function NoteListItem({
  note, active, onClick,
}: {
  note: Note;
  active: boolean;
  onClick: () => void;
}) {
  const { t } = useT();
  const [hov, setHov] = useState(false);
  const preview = (note.content || "").replace(/[#*`>\-_\[\]()]/g, "").trim().slice(0, 60);
  const time = formatRelative(note.updatedAt, t);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "10px 12px",
        borderRadius: 6,
        background: active ? "var(--color-primary-soft)" : hov ? "rgba(0,0,0,0.04)" : "transparent",
        cursor: "pointer",
        marginBottom: 2,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
        {note.pinned && <Pin size={11} color="var(--color-warning)" style={{ flexShrink: 0 }} />}
        <span
          style={{
            fontSize: 13, fontWeight: 500,
            color: active ? "var(--color-primary)" : "var(--color-text)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {note.title || t("td.note.untitled")}
        </span>
      </div>
      <p
        style={{
          fontSize: 11, color: "var(--color-text-faint)",
          margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {time} · {preview || t("notes.empty")}
      </p>
    </div>
  );
}

// ============================================================
// 编辑器
// ============================================================
function NoteEditor({
  note, mode, onModeChange, onUpdate, onDelete, linkedTasks = [], onJumpToTask, onAutoExtractTodos,
  titleToId, backlinks = [], onWikilinkClick, onSelectBacklink,
}: {
  note: Note;
  mode: "edit" | "preview";
  onModeChange: (m: "edit" | "preview") => void;
  onUpdate: (patch: Partial<Note>) => void;
  onDelete: () => void;
  linkedTasks?: DdlItem[];
  onJumpToTask?: (taskId: string) => void;
  onAutoExtractTodos?: (noteId: string, newTodos: string[]) => void;
  // [053]
  titleToId?: Map<string, string>;
  backlinks?: Note[];
  onWikilinkClick?: (target: string) => void;
  onSelectBacklink?: (id: string) => void;
}) {
  const { t } = useT();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);

  // 切换不同 note 时同步本地 state
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
  }, [note.id, note.title, note.content]);

  // 防抖保存（500ms）
  useEffect(() => {
    if (title === note.title && content === note.content) return;
    const t = setTimeout(() => {
      onUpdate({ title, content, updatedAt: Date.now() });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content]);

  // B4 防抖（1.2s）扫描 markdown 中的 `- [ ] todo`，对比已同步列表，emit 新增的
  useEffect(() => {
    if (!onAutoExtractTodos) return;
    const t = setTimeout(() => {
      const synced = new Set(note.syncedTodos ?? []);
      const found = new Set<string>();
      // 正则匹配 - [ ] 或 * [ ] 开头的行（小写 x 表示已选，跳过）
      const re = /^[\s　]*[-*]\s+\[\s\]\s+(.+?)\s*$/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const todo = m[1].trim();
        if (todo.length > 0 && todo.length <= 80) found.add(todo);
      }
      const newOnes = Array.from(found).filter((t) => !synced.has(t));
      if (newOnes.length > 0) onAutoExtractTodos(note.id, newOnes);
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, note.id]);

  return (
    <>
      {/* Header */}
      <header
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 24px",
          borderBottom: "1px solid var(--color-border)",
          flexShrink: 0,
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("notes.titlePh")}
          style={{
            flex: 1, border: "none", background: "transparent",
            fontSize: 18, fontWeight: 700, color: "var(--color-text)",
            outline: "none", fontFamily: "inherit",
          }}
        />
        <button
          onClick={() => onUpdate({ pinned: !note.pinned, updatedAt: Date.now() })}
          title={note.pinned ? t("notes.unpin") : t("notes.pin")}
          aria-label="pin"
          style={iconBtnStyle(note.pinned)}
        >
          {note.pinned ? <Pin size={14} /> : <PinOff size={14} />}
        </button>
        <button
          onClick={() => onModeChange(mode === "edit" ? "preview" : "edit")}
          title={mode === "edit" ? t("notes.toPreview") : t("notes.toEdit")}
          aria-label="mode"
          style={iconBtnStyle(mode === "preview")}
        >
          {mode === "edit" ? <Eye size={14} /> : <Edit3 size={14} />}
        </button>
        <button onClick={onDelete} title={t("tasks.delete")} aria-label="delete" style={iconBtnStyle(false, true)}>
          <Trash2 size={14} />
        </button>
      </header>

      {/* [053] 反向 wikilink 条（仅有被引用时显示） */}
      {backlinks.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 6,
            padding: "8px 24px",
            background: "color-mix(in srgb, var(--color-info) 8%, var(--color-bg))",
            borderBottom: "1px solid color-mix(in srgb, var(--color-info) 20%, transparent)",
            fontSize: 12,
            color: "var(--color-text-muted)",
          }}
        >
          <Network size={12} color="var(--color-info)" />
          <span style={{ marginRight: 4 }}>{t("notes.backlinks", { n: backlinks.length })}</span>
          {backlinks.map((b) => (
            <button
              key={b.id}
              onClick={() => onSelectBacklink?.(b.id)}
              style={{
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid color-mix(in srgb, var(--color-info) 30%, transparent)",
                background: "var(--color-bg)",
                color: "var(--color-info)",
                fontSize: 11,
                fontWeight: 500,
                cursor: onSelectBacklink ? "pointer" : "default",
                fontFamily: "inherit",
              }}
            >
              {b.title || t("td.note.untitled")}
            </button>
          ))}
        </div>
      )}

      {/* B1 关联任务条（仅有关联时显示） */}
      {linkedTasks.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 6,
            padding: "8px 24px",
            background: "var(--color-primary-soft)",
            borderBottom: "1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)",
            fontSize: 12,
            color: "var(--color-text-muted)",
          }}
        >
          <Link2 size={12} color="var(--color-primary)" />
          <span style={{ marginRight: 4 }}>{t("notes.linkedTasks")}</span>
          {linkedTasks.map((t) => (
            <button
              key={t.id}
              onClick={() => onJumpToTask?.(t.id)}
              style={{
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)",
                background: "var(--color-bg)",
                color: "var(--color-primary)",
                fontSize: 11,
                fontWeight: 500,
                cursor: onJumpToTask ? "pointer" : "default",
                fontFamily: "inherit",
              }}
            >
              {t.taskName}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      {mode === "edit" ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("notes.bodyPh")}
          style={{
            flex: 1, width: "100%", padding: "16px 24px",
            border: "none", outline: "none", resize: "none",
            background: "var(--color-bg)", color: "var(--color-text)",
            fontSize: 14, lineHeight: 1.7, fontFamily: "inherit",
          }}
        />
      ) : (
        <div
          className="md-preview"
          style={{
            flex: 1, overflowY: "auto",
            padding: "16px 24px",
            fontSize: 14, lineHeight: 1.7, color: "var(--color-text)",
          }}
        >
          {content.trim() ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // [053] 拦截 wikilink href（# 前缀）→ 内部跳转；其余链接照常新窗口打开
                a: ({ href, children, ...rest }) => {
                  if (href && href.startsWith(WIKI_HREF_PREFIX)) {
                    const target = href.slice(WIKI_HREF_PREFIX.length);
                    const missing = target.startsWith("!missing:");
                    return (
                      <a
                        href={href}
                        onClick={(e) => { e.preventDefault(); onWikilinkClick?.(target); }}
                        style={{
                          color: missing ? "var(--color-danger)" : "var(--color-info)",
                          textDecoration: missing ? "underline dashed" : "underline",
                          fontWeight: 500,
                          cursor: "pointer",
                          background: missing ? "transparent" : "color-mix(in srgb, var(--color-info) 8%, transparent)",
                          padding: missing ? 0 : "0 3px",
                          borderRadius: 3,
                        }}
                        title={missing ? t("notes.linkMissing") : t("notes.linkGo")}
                      >
                        {children}
                      </a>
                    );
                  }
                  return <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>{children}</a>;
                },
              }}
            >
              {titleToId ? preprocessWikilinks(content, titleToId) : content}
            </ReactMarkdown>
          ) : (
            <p style={{ color: "var(--color-text-faint)" }}>{t("notes.bodyEmpty")}</p>
          )}
        </div>
      )}

      <style>{`
        .md-preview p { margin: 0 0 10px; }
        .md-preview ul, .md-preview ol { margin: 6px 0 10px; padding-left: 24px; }
        .md-preview h1, .md-preview h2, .md-preview h3 { font-weight: 700; margin: 14px 0 8px; }
        .md-preview h1 { font-size: 20px; }
        .md-preview h2 { font-size: 17px; }
        .md-preview h3 { font-size: 15px; }
        .md-preview code { background: var(--color-primary-soft); padding: 1px 6px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 12.5px; color: var(--color-primary); }
        .md-preview pre { background: var(--color-code-bg); color: var(--color-code-text); padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 12.5px; margin: 10px 0; }
        .md-preview pre code { background: transparent; color: inherit; }
        .md-preview a { color: var(--color-primary); text-decoration: underline; }
        .md-preview blockquote { border-left: 3px solid var(--color-primary); padding: 2px 12px; color: var(--color-text-muted); margin: 8px 0; }
        .md-preview table { border-collapse: collapse; margin: 8px 0; font-size: 13px; }
        .md-preview th, .md-preview td { border: 1px solid var(--color-border); padding: 6px 10px; }
        .md-preview th { background: var(--color-surface); font-weight: 600; }
      `}</style>
    </>
  );
}

// ============================================================
// 空状态
// ============================================================
function EmptyHero({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 14,
        padding: 40,
      }}
    >
      {/* [056] 插画替代纯 icon */}
      <EmptyNotes size={200} />
      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text)", margin: "0 0 4px" }}>
          No notes yet
        </h2>
        <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", margin: 0 }}>
          Create the first note from the button below
        </p>
      </div>
      {/* Epic 6.5 管家小气泡 */}
      <p
        style={{
          fontSize: 12,
          fontStyle: "italic",
          color: "var(--color-primary)",
          background: "var(--color-primary-soft)",
          padding: "6px 12px",
          borderRadius: 14,
          margin: 0,
        }}
      >
        Tip: ask Butler in Chat to save a note, and it can draft one for you.
      </p>
      <button
        onClick={onCreate}
        style={{
          padding: "8px 16px", borderRadius: 8, border: "none",
          background: "var(--color-primary)", color: "white",
          fontSize: 13, fontWeight: 500, cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: "inherit",
        }}
      >
        <Plus size={14} /> New Note
      </button>
    </div>
  );
}

// ============================================================
// 工具
// ============================================================
function iconBtnStyle(active: boolean, danger?: boolean): React.CSSProperties {
  return {
    width: 28, height: 28, borderRadius: 6,
    border: "1px solid " + (active ? "var(--color-primary)" : "var(--color-border)"),
    background: active ? "var(--color-primary-soft)" : "var(--color-bg)",
    color: danger ? "var(--color-danger)" : active ? "var(--color-primary)" : "var(--color-text-muted)",
    cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  };
}

function formatRelative(ts: number, t: TFunc): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return t("time.justNow");
  if (min < 60) return t("time.minAgo", { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t("time.hrAgo", { n: hr });
  const d = new Date(ts);
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, "0")}`;
}
