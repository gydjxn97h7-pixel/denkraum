"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ACCENT } from "../lib/canvas-types";
import type { CanvasNode, RichText } from "../lib/canvas-types";
import {
  MAX_DOC_CHARS,
  editableRichText,
  setEditableContent,
} from "../lib/rich-text";

interface DocEditorPanelProps {
  // The document node being edited; null for a new, not-yet-saved document.
  // Only read at mount — the contenteditable owns the content while open.
  node: CanvasNode | null;
  onSave: (title: string, rich: RichText) => void;
  onClose: () => void;
}

// Right-side document editor. Content is a contenteditable backed by the
// same runs model as node fields (FormatBar works inside it via the
// data-doc-editor attribute). Save commits to board state; closing also
// saves, so there is no data-loss path — discarding is one Cmd+Z away.
export function DocEditorPanel({ node, onSave, onClose }: DocEditorPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(
    () => node?.title.trim() || node?.textFileName || "",
  );
  const [charCount, setCharCount] = useState(0);

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
        top: 12,
        right: 12,
        bottom: 12,
        width: 420,
        maxWidth: "calc(100vw - 100px)",
        background:
          "linear-gradient(180deg, rgba(157,200,141,0.04) 0%, rgba(157,200,141,0) 100%), rgba(30,74,65,0.97)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderRadius: 16,
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 0 rgba(255,255,255,0.12)",
        zIndex: 220,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          height: 52,
          flexShrink: 0,
          background: "rgba(0,0,0,0.15)",
          borderBottom: "0.5px solid rgba(255,255,255,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px 0 16px",
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "1.4px",
            color: "#FFFFFF",
            flexShrink: 0,
          }}
        >
          DOCUMENT
        </span>
        <button
          onClick={saveAndClose}
          title="Save and close (Esc)"
          style={{
            border: "none",
            background: "transparent",
            color: "rgba(255,255,255,0.7)",
            fontSize: 13,
            cursor: "pointer",
            padding: "4px 6px",
            lineHeight: 1,
            borderRadius: 5,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color =
              "rgba(255,255,255,0.9)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color =
              "rgba(255,255,255,0.7)";
          }}
        >
          ✕
        </button>
      </div>

      {/* ── Title ── */}
      <div style={{ padding: "14px 16px 10px", flexShrink: 0 }}>
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
            width: "100%",
            boxSizing: "border-box",
            fontSize: 16,
            fontWeight: 600,
            fontFamily: "inherit",
            background: "transparent",
            border: "none",
            outline: "none",
            borderBottom: "0.5px solid rgba(255,255,255,0.1)",
            padding: "2px 0 8px",
            color: "#FFFFFF",
            letterSpacing: "-0.2px",
            caretColor: ACCENT,
          }}
        />
      </div>

      {/* ── Content ── */}
      <div
        ref={contentRef}
        data-doc-editor="true"
        contentEditable
        suppressContentEditableWarning
        onInput={refreshCount}
        onPaste={onPaste}
        style={{
          flex: 1,
          margin: "0 4px 0 0",
          padding: "6px 16px 16px",
          overflowY: "auto",
          overflowX: "hidden",
          outline: "none",
          fontSize: 13.5,
          lineHeight: 1.65,
          color: "rgba(255,255,255,0.88)",
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
          wordBreak: "break-word",
          userSelect: "text",
          caretColor: ACCENT,
          cursor: "text",
        }}
      />

      {/* ── Footer: counter + save ── */}
      <div
        style={{
          flexShrink: 0,
          borderTop: "0.5px solid rgba(255,255,255,0.06)",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span
          title={
            atLimit
              ? "Document is at its size limit — further input is blocked"
              : undefined
          }
          style={{
            fontSize: 10.5,
            fontVariantNumeric: "tabular-nums",
            color: atLimit
              ? "#FCA5A5"
              : nearLimit
                ? "#F1B24A"
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
            background: "#F1B24A",
            color: "#0C2018",
            fontSize: 12.5,
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
