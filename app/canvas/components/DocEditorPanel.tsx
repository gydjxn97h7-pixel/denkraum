"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasNode, RichText } from "../lib/canvas-types";
import { TrafficDot } from "./ColorPickerWindow";
import { DocToolbar } from "./DocToolbar";
import { RADIUS } from "../lib/design-tokens";
import {
  MAX_DOC_CHARS,
  MAX_DOC_IMAGE_CHARS,
  editableRichText,
  setEditableContent,
} from "../lib/rich-text";

// Screen-space rect of the source node (already in viewport px), used as the
// origin/target of the zoom animation.
export type OriginRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

interface DocEditorPanelProps {
  // The document node being edited; null for a new, not-yet-saved document.
  // Only read at mount — the contenteditable owns the content while open.
  node: CanvasNode | null;
  onSave: (title: string, rich: RichText) => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
  // Live screen rect of the source node, recomputed on demand so the zoom
  // animation targets the node's current on-screen position (it may have been
  // panned). Returns null for a brand-new document with no node yet.
  getOriginRect: () => OriginRect | null;
}

const NODE_GREEN = "#1D5C50";
const SHEET_SHADOW =
  "0 24px 70px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.30)";
type Mode = "standard" | "min" | "full";
type Phase = "enter" | "open" | "close";
type From = { transform: string; origin: string; opacity: number };

// Centered focus-sheet geometry (viewport px). Fullscreen insets to the edges.
function sheetGeom(mode: Mode, vw: number, vh: number) {
  if (mode === "full") {
    const m = 24;
    return { left: m, top: m, width: vw - 2 * m, height: vh - 2 * m };
  }
  const width = Math.min(880, Math.round(vw * 0.62), vw - 96);
  const height = Math.min(vh - 72, Math.round(width * 1.2));
  return {
    left: Math.round((vw - width) / 2),
    top: Math.round((vh - height) / 2),
    width,
    height,
  };
}

// The document opens by zooming the sheet out of its node's canvas position
// and reverses on close — a "node expanding into focus mode". The dimmed,
// blurred canvas stays visible behind so it never feels like a separate window.
export function DocEditorPanel({
  node,
  onSave,
  onClose,
  onNotify,
  getOriginRect,
}: DocEditorPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(
    () => node?.title.trim() || node?.textFileName || "",
  );
  const [charCount, setCharCount] = useState(0);
  const [mode, setMode] = useState<Mode>("standard");

  const [vp, setVp] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1280,
    h: typeof window !== "undefined" ? window.innerHeight : 800,
  }));
  useEffect(() => {
    const onResize = () =>
      setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Zoom animation ──────────────────────────────────────────────────────────
  // `from` is the collapsed transform that maps the centered sheet back onto
  // the node rect (FLIP). Computed at open and recomputed at close so it always
  // targets the node's current position.
  const computeFrom = useCallback(
    (m: Mode): From => {
      const g = sheetGeom(m, vp.w, vp.h);
      const o = getOriginRect();
      if (o && o.width > 0) {
        const scale = o.width / g.width;
        return {
          transform: `translate(${o.left - g.left}px, ${o.top - g.top}px) scale(${scale})`,
          origin: "0 0",
          opacity: 0.35,
        };
      }
      // New document: no node to zoom from — a gentle scale-up from center.
      return { transform: "scale(0.94)", origin: "center", opacity: 0 };
    },
    [vp.w, vp.h, getOriginRect],
  );

  const fromRef = useRef<From>(computeFrom("standard"));
  const [phase, setPhase] = useState<Phase>("enter");
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Kick the entrance: two rAFs ensure the collapsed first frame is painted
  // before transitioning to the open state.
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setPhase("open")),
    );
    return () => {
      cancelAnimationFrame(id);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    setEditableContent(el, node?.docRich, node?.textFileContent ?? "");
    setCharCount(el.textContent?.length ?? 0);
    el.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    onSave(title, editableRichText(el));
  }, [onSave, title]);

  // Reverse-zoom, then unmount once the transform settles (with a fallback so a
  // missed transitionend never leaves the editor stuck open).
  const beginClose = useCallback(() => {
    if (phase === "close") return;
    commit();
    fromRef.current = computeFrom(mode);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(onClose, 420);
    setPhase("close");
  }, [phase, commit, computeFrom, mode, onClose]);

  const onSheetTransitionEnd = (e: React.TransitionEvent) => {
    if (phase === "close" && e.propertyName === "transform") {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      onClose();
    }
  };

  // ── Size limit, enforced gracefully ─────────────────────────────────────────
  const refreshCount = () => {
    setCharCount(contentRef.current?.textContent?.length ?? 0);
  };

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onBeforeInput = (e: InputEvent) => {
      if (!e.inputType?.startsWith("insert")) return;
      const len = el.textContent?.length ?? 0;
      if (len + (e.data?.length ?? 1) > MAX_DOC_CHARS) e.preventDefault();
    };
    el.addEventListener("beforeinput", onBeforeInput);
    return () => el.removeEventListener("beforeinput", onBeforeInput);
  }, []);

  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const len = contentRef.current?.textContent?.length ?? 0;
    const remaining = Math.max(0, MAX_DOC_CHARS - len);
    const text = e.clipboardData.getData("text/plain").slice(0, remaining);
    if (text) document.execCommand("insertText", false, text);
  };

  const onImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      if (!url) return;
      if (url.length > MAX_DOC_IMAGE_CHARS) {
        onNotify("Image too large — max ~1.5 MB per image");
        return;
      }
      const el = contentRef.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (!sel) return;
      if (sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
        const r = document.createRange();
        r.selectNodeContents(el);
        r.collapse(false);
        sel.removeAllRanges();
        sel.addRange(r);
      }
      document.execCommand("insertImage", false, url);
    };
    reader.readAsDataURL(file);
  };

  const nearLimit = charCount >= MAX_DOC_CHARS * 0.9;
  const atLimit = charCount >= MAX_DOC_CHARS;

  const imageInput = (
    <input
      ref={imageInputRef}
      data-doc-image-input="true"
      type="file"
      accept="image/png,image/jpeg,image/gif,image/webp"
      style={{ display: "none" }}
      onChange={onImageFileChange}
    />
  );

  // ── Minimized: a compact node-coloured pill docked above the zoom controls ──
  if (mode === "min") {
    return (
      <>
        <div
          onClick={() => setMode("standard")}
          title={title.trim() || "Untitled document"}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            height: 44,
            maxWidth: 280,
            padding: "0 16px",
            borderRadius: RADIUS.pill,
            background: NODE_GREEN,
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.30)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            zIndex: 220,
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(201,168,118,0.85)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(255,255,255,0.85)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title.trim() || "Untitled document"}
          </span>
        </div>
        {imageInput}
      </>
    );
  }

  const g = sheetGeom(mode, vp.w, vp.h);
  const open = phase === "open";
  const from = fromRef.current;

  return (
    <>
      {/* Dimmed + blurred canvas behind — focus without hiding the board. */}
      <div
        onClick={beginClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.18)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
          opacity: open ? 1 : 0,
          transition: "opacity 260ms ease",
          zIndex: 219,
        }}
      />

      {/* Focus sheet — FLIP-zooms from the node rect on open / back on close. */}
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={onSheetTransitionEnd}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            beginClose();
          }
        }}
        style={{
          position: "fixed",
          left: g.left,
          top: g.top,
          width: g.width,
          height: g.height,
          transform: open ? "none" : from.transform,
          transformOrigin: from.origin,
          opacity: open ? 1 : from.opacity,
          transition:
            "transform 320ms cubic-bezier(0.4,0,0.2,1), opacity 260ms ease, left 300ms ease, top 300ms ease, width 300ms ease, height 300ms ease",
          zIndex: 220,
          display: "flex",
          flexDirection: "column",
          borderRadius: RADIUS.lg,
          overflow: "hidden",
          boxShadow: SHEET_SHADOW,
          willChange: "transform, opacity",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        }}
      >
        {/* ── Green header (the node, expanded): traffic lights + title ── */}
        <div
          style={{
            flexShrink: 0,
            height: 52,
            background: NODE_GREEN,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "0 16px",
          }}
        >
          <div
            style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}
          >
            <TrafficDot
              color="#ff5f57"
              title="Save and close"
              onClick={beginClose}
            />
            <TrafficDot
              color="#febc2e"
              title="Minimize"
              onClick={() => setMode("min")}
            />
            <TrafficDot
              color="#28c840"
              title={mode === "full" ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => setMode(mode === "full" ? "standard" : "full")}
            />
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled document"
            maxLength={120}
            onKeyDown={(e) => {
              if (e.key === "Enter") contentRef.current?.focus();
              if (e.key !== "Escape") e.stopPropagation();
            }}
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#FFFFFF",
              fontSize: 16,
              fontWeight: 600,
              fontFamily: "inherit",
              letterSpacing: "-0.2px",
            }}
          />
        </div>

        {/* ── White sheet: toolbar over it, then the writing area + footer ── */}
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) contentRef.current?.focus();
          }}
          style={{
            position: "relative",
            flex: 1,
            minHeight: 0,
            background: "#FDFCF9",
            display: "flex",
            flexDirection: "column",
            cursor: "text",
          }}
        >
          {/* Floating formatting toolbar, over the top of the sheet */}
          <div
            style={{
              position: "absolute",
              top: 14,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10,
            }}
          >
            <DocToolbar
              editorRef={contentRef}
              onInsertImage={() => imageInputRef.current?.click()}
            />
          </div>

          <div
            ref={contentRef}
            data-doc-editor="true"
            data-placeholder="Start writing…"
            contentEditable
            suppressContentEditableWarning
            onInput={refreshCount}
            onPaste={onPaste}
            className="doc-page-scroll"
            style={{
              flex: 1,
              minHeight: 0,
              // Top padding clears the floating toolbar.
              padding: "84px 56px 32px",
              overflowY: "auto",
              overflowX: "hidden",
              outline: "none",
              fontSize: 15,
              lineHeight: 1.75,
              color: "#243029",
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
              wordBreak: "break-word",
              userSelect: "text",
              caretColor: "#A1834B",
              cursor: "text",
            }}
          />

          {/* Footer: counter + save (light, on the sheet) */}
          <div
            style={{
              flexShrink: 0,
              borderTop: "1px solid rgba(20,40,33,0.08)",
              padding: "10px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              background: "#FDFCF9",
            }}
          >
            <span
              title={
                atLimit
                  ? "Document is at its size limit — further input is blocked"
                  : undefined
              }
              style={{
                fontSize: 11,
                fontVariantNumeric: "tabular-nums",
                color: atLimit
                  ? "#C0392B"
                  : nearLimit
                    ? "#A1834B"
                    : "rgba(20,40,33,0.4)",
              }}
            >
              {charCount.toLocaleString("en-US")} /{" "}
              {MAX_DOC_CHARS.toLocaleString("en-US")}
              {atLimit ? " — limit reached" : ""}
            </span>
            <button
              onClick={commit}
              onMouseDown={(e) => e.preventDefault()}
              style={{
                height: 30,
                padding: "0 16px",
                borderRadius: RADIUS.pill,
                border: "none",
                background: "#C9A876",
                color: "#0C2018",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = "0.88";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = "1";
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
      {imageInput}
    </>
  );
}
