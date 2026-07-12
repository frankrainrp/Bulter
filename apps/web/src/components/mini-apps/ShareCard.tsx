"use client";

import React, { useMemo, useRef, useState } from "react";
import { Check, Download, Share2 } from "lucide-react";
import type { DdlItem } from "@/lib/types";
import { useT } from "@/lib/i18n";

interface Props {
  ddls?: DdlItem[];
}

const CARD_WIDTH = 540;
const CARD_HEIGHT = 760;

function effStatus(d: DdlItem): "todo" | "in_progress" | "done" {
  return d.status ?? (d.completed ? "done" : "todo");
}

async function renderPng(svg: SVGSVGElement): Promise<Blob> {
  const source = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = CARD_WIDTH * scale;
    canvas.height = CARD_HEIGHT * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable");
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0, CARD_WIDTH, CARD_HEIGHT);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG export failed")), "image/png", 0.96);
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export default function ShareCard({ ddls = [] }: Props) {
  const { t, lang } = useT();
  const svgRef = useRef<SVGSVGElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "shared" | "error">("idle");

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    const totalDone = ddls.filter((d) => effStatus(d) === "done").length;
    const totalTodo = ddls.filter((d) => effStatus(d) !== "done").length;
    const weekDone = ddls.filter((d) => {
      if (effStatus(d) !== "done" || !d.dueDate) return false;
      const ts = new Date(d.dueDate).getTime();
      return ts >= weekStart.getTime() && ts < today.getTime() + 86400000;
    }).length;

    const days: { iso: string; count: number; label: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      days.push({
        iso,
        label: t(`dow.${date.getDay()}`),
        count: ddls.filter((item) => effStatus(item) === "done" && item.dueDate === iso).length,
      });
    }

    return { totalDone, totalTodo, weekDone, days, maxDay: Math.max(1, ...days.map((d) => d.count)) };
  }, [ddls, t]);

  const todayLabel = new Date().toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const makePng = async () => {
    if (!svgRef.current) throw new Error("Share card is not ready");
    return renderPng(svgRef.current);
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      downloadBlob(await makePng(), `butler-study-${new Date().toISOString().slice(0, 10)}.png`);
      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    setBusy(true);
    try {
      const blob = await makePng();
      const file = new File([blob], "butler-study-card.png", { type: "image/png" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: t("share.shareTitle"), text: t("share.slogan"), files: [file] });
        setStatus("shared");
      } else {
        downloadBlob(blob, `butler-study-${new Date().toISOString().slice(0, 10)}.png`);
        setStatus("saved");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("error");
    } finally {
      setBusy(false);
    }
  };

  const feedback = status === "shared"
    ? t("share.shared")
    : status === "saved"
      ? t("share.saved")
      : status === "error"
        ? t("share.error")
        : t("share.saveHint");

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          padding: "0 2px",
        }}
      >
        <div>
          <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)", lineHeight: 1.15 }}>
            {t("mini.share")}
          </div>
          <p style={{ margin: "5px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--color-text-muted)" }}>
            {feedback}
          </p>
        </div>
        {(status === "saved" || status === "shared") && <Check size={18} color="var(--color-success)" aria-hidden />}
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: `${CARD_WIDTH} / ${CARD_HEIGHT}`,
          overflow: "hidden",
          border: "2px solid var(--color-border)",
          borderRadius: "var(--radius-card)",
          background: "#F4EEDC",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`}
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label={t("share.previewAria")}
          style={{ display: "block", width: "100%", height: "100%" }}
        >
          <defs>
            <pattern id="paper-dots" width="18" height="18" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="#253C32" opacity="0.07" />
            </pattern>
            <clipPath id="card-clip"><rect width={CARD_WIDTH} height={CARD_HEIGHT} rx="18" /></clipPath>
          </defs>

          <g clipPath="url(#card-clip)">
            <rect width={CARD_WIDTH} height={CARD_HEIGHT} fill="#F4EEDC" />
            <rect width={CARD_WIDTH} height={CARD_HEIGHT} fill="url(#paper-dots)" />
            <rect x="0" y="0" width="16" height={CARD_HEIGHT} fill="#315747" />
            <path d="M390 -20 C450 45 470 110 560 140" fill="none" stroke="#C8B787" strokeWidth="28" opacity="0.4" />

            <text x="48" y="64" fontFamily="Arial, 'Noto Sans SC', sans-serif" fontSize="13" fontWeight="700" fill="#315747" letterSpacing="2.2">
              {t("share.brand")}
            </text>
            <text x="48" y="91" fontFamily="Arial, 'Noto Sans SC', sans-serif" fontSize="12" fill="#756B58">
              {todayLabel}
            </text>
            <rect x="420" y="46" width="72" height="34" rx="17" fill="#315747" />
            <text x="456" y="68" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="700" fill="#F7F1E2">
              07 DAYS
            </text>

            <line x1="48" y1="124" x2="492" y2="124" stroke="#292820" strokeWidth="2" />
            <text x="48" y="174" fontFamily="Georgia, 'Noto Serif SC', serif" fontSize="22" fill="#292820">
              {t("share.weekDone")}
            </text>
            <text x="46" y="285" fontFamily="Georgia, 'Noto Serif SC', serif" fontSize="112" fontWeight="700" fill="#292820">
              {stats.weekDone}
            </text>
            <text x={stats.weekDone < 10 ? 128 : stats.weekDone < 100 ? 192 : 254} y="274" fontFamily="Arial, 'Noto Sans SC', sans-serif" fontSize="18" fill="#756B58">
              {t("share.tasksUnit")}
            </text>

            <g transform="translate(48 322)">
              <rect width="208" height="68" rx="8" fill="#E2D9BD" stroke="#292820" strokeWidth="2" />
              <text x="18" y="28" fontFamily="Arial, 'Noto Sans SC', sans-serif" fontSize="12" fill="#756B58">{t("share.totalDone")}</text>
              <text x="18" y="53" fontFamily="Georgia, serif" fontSize="24" fontWeight="700" fill="#292820">{stats.totalDone}</text>
            </g>
            <g transform="translate(276 322)">
              <rect width="216" height="68" rx="8" fill="#DCE7DC" stroke="#292820" strokeWidth="2" />
              <text x="18" y="28" fontFamily="Arial, 'Noto Sans SC', sans-serif" fontSize="12" fill="#5D6C62">{t("share.inProgress")}</text>
              <text x="18" y="53" fontFamily="Georgia, serif" fontSize="24" fontWeight="700" fill="#292820">{stats.totalTodo}</text>
            </g>

            <text x="48" y="440" fontFamily="Arial, 'Noto Sans SC', sans-serif" fontSize="12" fontWeight="700" fill="#315747" letterSpacing="1.6">
              {t("share.trend7")}
            </text>
            <line x1="48" y1="600" x2="492" y2="600" stroke="#B9AD8D" strokeWidth="1" />
            {stats.days.map((day, index) => {
              const x = 52 + index * 63;
              const height = Math.max(day.count > 0 ? 14 : 4, (day.count / stats.maxDay) * 118);
              return (
                <g key={day.iso}>
                  <rect x={x} y={600 - height} width="38" height={height} rx="4" fill={day.count > 0 ? "#315747" : "#CFC4A8"} />
                  <text x={x + 19} y="625" textAnchor="middle" fontFamily="Arial, 'Noto Sans SC', sans-serif" fontSize="11" fill="#756B58">{day.label}</text>
                  {day.count > 0 && <text x={x + 19} y={587 - height} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="700" fill="#315747">{day.count}</text>}
                </g>
              );
            })}

            <line x1="48" y1="666" x2="492" y2="666" stroke="#292820" strokeWidth="2" />
            <text x="48" y="705" fontFamily="Georgia, 'Noto Serif SC', serif" fontSize="17" fontWeight="700" fill="#292820">
              {t("share.slogan")}
            </text>
            <text x="48" y="732" fontFamily="Arial, 'Noto Sans SC', sans-serif" fontSize="10" fill="#756B58">
              {t("share.footer")}
            </text>
            <circle cx="466" cy="712" r="25" fill="#315747" />
            <text x="466" y="720" textAnchor="middle" fontFamily="Georgia, serif" fontSize="23" fontWeight="700" fill="#F4EEDC">B</text>
          </g>
        </svg>
      </div>

      {ddls.length === 0 && (
        <div style={{ padding: "9px 11px", border: "1px dashed var(--color-border)", borderRadius: 8, fontSize: 11.5, color: "var(--color-text-muted)" }}>
          {t("share.empty")}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button className="glass-btn" type="button" onClick={() => void handleDownload()} disabled={busy} style={{ minHeight: 40, justifyContent: "center", gap: 7, fontSize: 12.5, fontFamily: "inherit" }}>
          <Download size={15} /> {busy ? t("share.preparing") : t("share.download")}
        </button>
        <button className="glass-btn glass-btn-primary" type="button" onClick={() => void handleShare()} disabled={busy} style={{ minHeight: 40, justifyContent: "center", gap: 7, fontSize: 12.5, fontFamily: "inherit" }}>
          <Share2 size={15} /> {t("share.share")}
        </button>
      </div>
    </section>
  );
}
