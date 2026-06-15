"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasNode, RichText } from "../lib/canvas-types";
import { TrafficDot } from "./ColorPickerWindow";
import { DocToolbar } from "./DocToolbar";
import {
  MAX_DOC_CHARS,
  MAX_DOC_IMAGE_CHARS,
  editableRichText,
  setEditableContent,
} from "../lib/rich-text";

interface DocEditorPanelProps {
  // The document node being edited; null for a new, not-yet-saved document.
  // Only read at mount — the contenteditable owns the content while open.
  node: CanvasNode | null;
  onSave: (title: string, rich: RichText) => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

// A4 portrait: 210mm × 297mm.
const A4_RATIO = 297 / 210;

// Vertical chrome around the page, used to derive the panel width from the
// viewport height so the white sheet keeps an exact A4 aspect:
// 24 panel insets + 52 header + 50 footer + 48 desk padding.
const VERTICAL_CHROME = 174;
const DESK_PAD = 24;

// Right-side document editor: dark DNKRM chrome around a white A4 page.
// Content is a contenteditable backed by the same runs model as node fields
// (FormatBar works inside it via the data-doc-editor attribute). Save commits
// to board state; closing also saves, so there is no data-loss path —
// discarding is one Cmd+Z away.
export function DocEditorPanel({
  node,
  onSave,
  onClose,
  onNotify,
}: DocEditorPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(
    () => node?.title.trim() || node?.textFileName || "",
  );
  const [charCount, setCharCount] = useState(0);
  // Window mode — always opens standard; minimize keeps the editor mounted
  // so unsaved text survives, fullscreen turns the panel into a focus view.
  const [mode, setMode] = useState<"standard" | "min" | "full">("standard");

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

  const saveAndClose = () => {
    commit();
    onClose();
  };

  // ── Size limit, enforced gracefully ─────────────────────────────────────────
  const refreshCount = () => {
    setCharCount(contentRef.current?.textContent?.length ?? 0);
  };

  // Native listener: React's onBeforeInput polyfill doesn't expose inputType
  // for contenteditable, so the guard must hang off the real DOM event.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onBeforeInput = (e: InputEvent) => {
      if (!e.inputType?.startsWith("insert")) return; // deletions always allowed
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

  // Inserts the picked image at the caret (or document end) as a data URL —
  // it becomes an image run on its own line at parse time.
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

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          saveAndClose();
        }
      }}
      style={{
        position: "fixed",
        top: mode === "min" ? "auto" : 12,
        right: 12,
        // Minimized pill docks above the zoom controls so they stay usable.
        bottom: mode === "min" ? 68 : 12,
        left: mode === "full" ? 12 : "auto",
        height: mode === "min" ? 44 : undefined,
        // Width follows from viewport height so the sheet is exactly A4.
        width:
          mode === "full"
            ? "auto"
            : mode === "min"
              ? 300
              : `calc((100vh - ${VERTICAL_CHROME}px) / ${A4_RATIO} + ${DESK_PAD * 2}px)`,
        minWidth: mode === "min" ? 0 : 400,
        // In fullscreen the panel is anchored on both edges — a max-width
        // would override the right anchor and shift the whole panel left.
        maxWidth: mode === "full" ? undefined : "calc(100vw - 100px)",
        background:
          "linear-gradient(180deg, rgba(157,200,141,0.04) 0%, rgba(157,200,141,0) 100%), rgba(30,74,65,0.97)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderRadius: 16,
        boxShadow:
          "0 8px 24px rgba(0,0,0,0.22)",
        zIndex: 220,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily:
          "var(--font-geist-sans), system-ui, sans-serif",
      }}
    >
      {/* ── Header ── */}
      <div
        onClick={() => {
          if (mode === "min") setMode("standard");
        }}
        style={{
          height: mode === "min" ? 44 : 52,
          flexShrink: 0,
          background: "rgba(0,0,0,0.15)",
          borderBottom:
            mode === "min" ? "none" : "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 12,
          cursor: mode === "min" ? "pointer" : "default",
        }}
      >
        {/* Traffic lights */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}
        >
          <TrafficDot color="#ff5f57" title="Save and close" onClick={saveAndClose} />
          <TrafficDot
            color="#febc2e"
            title={mode === "min" ? "Restore" : "Minimize"}
            onClick={() => setMode(mode === "min" ? "standard" : "min")}
          />
          <TrafficDot
            color="#28c840"
            title={mode === "full" ? "Exit fullscreen" : "Fullscreen"}
            onClick={() => setMode(mode === "full" ? "standard" : "full")}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
            flex: 1,
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(201,168,118,0.75)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          {mode === "min" ? (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.75)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                letterSpacing: "-0.1px",
              }}
            >
              {title.trim() || "Untitled document"}
            </span>
          ) : (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.1em",
                color: "#FFFFFF",
              }}
            >
              DOCUMENT
            </span>
          )}
        </div>
      </div>
      <input
        ref={imageInputRef}
        data-doc-image-input="true"
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        style={{ display: "none" }}
        onChange={onImageFileChange}
      />

      {/* ── Desk: dark surface the white sheet floats on ── */}
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          display: mode === "min" ? "none" : "flex",
          padding: DESK_PAD,
          background:
            "radial-gradient(120% 90% at 50% 0%, rgba(157,200,141,0.05) 0%, rgba(0,0,0,0) 55%), rgba(8,22,17,0.55)",
          alignItems: "stretch",
          justifyContent: "center",
        }}
      >
        {/* Floating formatting toolbar, pinned to the top of the page */}
        <div
          style={{
            position: "absolute",
            top: 10,
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

        {/* ── A4 page ── */}
        <div
          onClick={(e) => {
            // Clicking the sheet's margins drops the caret into the text.
            if (e.target === e.currentTarget) contentRef.current?.focus();
          }}
          style={{
            width:
              mode === "full"
                ? `calc((100vh - ${VERTICAL_CHROME}px) / ${A4_RATIO})`
                : "100%",
            height: "100%",
            background: "#FDFCF9",
            borderRadius: 8,
            boxShadow:
              "0 8px 24px rgba(0,0,0,0.3)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            cursor: "text",
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled document"
            maxLength={120}
            className="doc-title-input"
            onKeyDown={(e) => {
              if (e.key === "Enter") contentRef.current?.focus();
              if (e.key !== "Escape") e.stopPropagation();
            }}
            style={{
              flexShrink: 0,
              margin: "64px 48px 0",
              fontSize: 30,
              fontWeight: 600,
              fontFamily: "inherit",
              background: "transparent",
              border: "none",
              outline: "none",
              padding: "0 0 16px",
              borderBottom: "1px solid rgba(20,40,33,0.08)",
              color: "#14201B",
              letterSpacing: "-0.5px",
              caretColor: "#A1834B",
            }}
          />
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
              padding: "28px 48px 64px",
              overflowY: "auto",
              overflowX: "hidden",
              outline: "none",
              fontSize: 14,
              lineHeight: 1.7,
              color: "#243029",
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
              wordBreak: "break-word",
              userSelect: "text",
              caretColor: "#A1834B",
              cursor: "text",
            }}
          />
        </div>
      </div>

      {/* ── Footer: counter + save ── */}
      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "12px 16px",
          display: mode === "min" ? "none" : "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
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
              ? "#FCA5A5"
              : nearLimit
                ? "#C9A876"
                : "rgba(255,255,255,0.45)",
          }}
        >
          {charCount.toLocaleString("en-US")} /{" "}
          {MAX_DOC_CHARS.toLocaleString("en-US")}
          {atLimit ? " — limit reached" : ""}
        </span>
        <button
          onClick={commit}
          // Keep focus (and the caret) in the editor across saves.
          onMouseDown={(e) => e.preventDefault()}
          style={{
            height: 30,
            padding: "0 16px",
            borderRadius: 8,
            border: "none",
            background: "#C9A876",
            color: "#0C2018",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
            letterSpacing: "-0.1px",
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
  );
}
