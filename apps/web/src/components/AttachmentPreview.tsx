"use client";

// ============================================================
// components/AttachmentPreview.tsx — 附件预览 modal
//
// URL：直接新窗口打开（不进 modal）
// filepath：显示路径 + 复制按钮（Tauri 后续接"打开所在地"）
// blob：PDF iframe / 图片 img / 其他下载
//
// [048] Phase A 重写：所有硬编码白底/紫色渐变/灰文字 → CSS 变量，
// 暗色模式可用；视觉对齐墨绿设计语言（[025] Stage E 没扫到的死角）。
// ============================================================

import React, { useEffect, useState } from "react";
import { X, ExternalLink, Copy, Download, FolderOpen } from "lucide-react";
import type { DdlAttachment } from "@/lib/types";
import { useT } from "@/lib/i18n";

interface Props {
  attachment: DdlAttachment;
  onClose: () => void;
}

export default function AttachmentPreview({ attachment, onClose }: Props) {
  const { t } = useT();
  const [blobInfo, setBlobInfo] = useState<{ url: string; mime: string; name: string } | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    let url: string | null = null;
    if (attachment.kind === "blob") {
      (async () => {
        try {
          const { getBlobUrl } = await import("@/lib/blobs");
          const info = await getBlobUrl(attachment.ref);
          if (!active) return;
          if (info) { url = info.url; setBlobInfo(info); }
          else setLoadErr(t("att.lost"));
        } catch (e) {
          if (active) setLoadErr((e as Error).message);
        }
      })();
    }
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment]);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 250,
        background: "var(--color-overlay)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{
        width: "100%", maxWidth: 880, maxHeight: "90vh",
        background: "var(--color-bg)",
        borderRadius: 18,
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-modal)",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        color: "var(--color-text)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px", borderBottom: "1px solid var(--color-border)",
          flexShrink: 0,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {attachment.label}
            </h2>
            <p style={{ fontSize: 11, color: "var(--color-text-faint)", margin: "2px 0 0", fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {attachment.ref}
            </p>
          </div>
          <button onClick={onClose} aria-label={t("common.close")} style={{
            width: 32, height: 32, borderRadius: 8, border: "none",
            background: "transparent", cursor: "pointer", color: "var(--color-text-muted)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
          {attachment.kind === "url" && <UrlView ref_={attachment.ref} />}
          {attachment.kind === "filepath" && <FilepathView path={attachment.ref} />}
          {attachment.kind === "blob" && (
            loadErr ? <ErrorView msg={loadErr} /> :
            blobInfo ? <BlobView info={blobInfo} /> :
            <LoadingView />
          )}
        </div>
      </div>
    </div>
  );
}

// ---- 子视图 ----

function UrlView({ ref_ }: { ref_: string }) {
  const { t } = useT();
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <ExternalLink size={36} color="var(--color-primary)" />
      <p style={{ fontSize: 14, color: "var(--color-text)", margin: "16px 0 6px" }}>{t("att.external")}</p>
      <p style={{ fontSize: 12, color: "var(--color-text-faint)", margin: "0 0 20px", wordBreak: "break-all" }}>{ref_}</p>
      <a href={ref_} target="_blank" rel="noopener noreferrer" style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "9px 18px", borderRadius: 10, border: "none",
        background: "var(--color-primary)",
        color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none",
        boxShadow: "var(--shadow-card-hover)",
      }}>
        <ExternalLink size={14} /> {t("att.openNew")}
      </a>
    </div>
  );
}

function FilepathView({ path }: { path: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <FolderOpen size={36} color="var(--color-success)" />
      <p style={{ fontSize: 14, color: "var(--color-text)", margin: "16px 0 6px" }}>{t("att.localPath")}</p>
      <p style={{
        fontSize: 12, color: "var(--color-text)", margin: "0 0 8px",
        wordBreak: "break-all", fontFamily: "ui-monospace, monospace",
        background: "var(--color-surface)", padding: "8px 12px", borderRadius: 8,
        display: "inline-block", maxWidth: "90%",
        border: "1px solid var(--color-border-soft)",
      }}>{path}</p>
      <p style={{ fontSize: 11, color: "var(--color-text-faint)", margin: "0 0 20px" }}>
        {t("att.localHint")}
      </p>
      <button onClick={copy} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "9px 18px", borderRadius: 10,
        border: "1px solid var(--color-border)",
        background: copied ? "var(--color-success-soft)" : "var(--color-bg)",
        color: copied ? "var(--color-success-strong)" : "var(--color-text)",
        fontSize: 13, fontWeight: 500,
        cursor: "pointer", fontFamily: "inherit",
      }}>
        <Copy size={14} /> {copied ? t("chat.copied") : t("att.copyPath")}
      </button>
    </div>
  );
}

function BlobView({ info }: { info: { url: string; mime: string; name: string } }) {
  const { t } = useT();
  const isImg = info.mime.startsWith("image/");
  const isPdf = info.mime === "application/pdf" || info.name.toLowerCase().endsWith(".pdf");

  if (isImg) {
    return (
      <div style={{ padding: 16, display: "flex", justifyContent: "center", background: "var(--color-surface)" }}>
        <img src={info.url} alt={info.name} style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 8 }} />
      </div>
    );
  }
  if (isPdf) {
    return (
      // SEC-15：上传文件是不可信内容（可能是伪装成 .pdf 的 HTML）。沙箱化 —— 不给
      // allow-same-origin / allow-scripts，即使是 HTML 也不会在应用源里执行脚本；
      // 浏览器原生 PDF 查看器在此沙箱下仍可正常渲染。
      <iframe
        src={info.url}
        title={info.name}
        sandbox=""
        style={{ width: "100%", height: "70vh", border: "none", background: "var(--color-surface)" }}
      />
    );
  }
  // 其他类型 → 下载
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <Download size={36} color="var(--color-primary)" />
      <p style={{ fontSize: 14, color: "var(--color-text)", margin: "16px 0 6px" }}>{info.name}</p>
      <p style={{ fontSize: 11, color: "var(--color-text-faint)", margin: "0 0 20px" }}>{info.mime}</p>
      <a href={info.url} download={info.name} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "9px 18px", borderRadius: 10,
        background: "var(--color-primary)",
        color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none",
        boxShadow: "var(--shadow-card-hover)",
      }}>
        <Download size={14} /> {t("att.download")}
      </a>
    </div>
  );
}

function LoadingView() {
  const { t } = useT();
  return <div style={{ padding: 60, textAlign: "center", color: "var(--color-text-faint)", fontSize: 13 }}>{t("att.loading")}</div>;
}

function ErrorView({ msg }: { msg: string }) {
  return <div style={{ padding: 60, textAlign: "center", color: "var(--color-danger)", fontSize: 13 }}>❌ {msg}</div>;
}
