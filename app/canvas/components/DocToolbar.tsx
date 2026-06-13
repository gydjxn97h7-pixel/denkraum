"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyColorToSelection,
  applyFontSizeToSelection,
  FONT_SIZE_LADDER,
} from "../lib/rich-text";
import { rgbToHex } from "../lib/color-helpers";
import { ColorPickerWindow } from "./ColorPickerWindow";

interface DocToolbarProps {
  // The document's contenteditable; toolbar actions operate on its selection.
  editorRef: React.RefObject<HTMLDivElement | null>;
  onInsertImage: () => void;
}

type FmtState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontSize: number;
  textColor: string;
};

type PickerState = {
  prop: "color" | "backgroundColor";
  x: number;
  y: number;
  color: string;
};

function computedHex(el: Element | null): string {
  if (!el) return "#243029";
  const v = getComputedStyle(el).color;
  const m = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  return m ? rgbToHex(+m[1], +m[2], +m[3]) : "#243029";
}

// Persistent floating formatting toolbar for the document editor. Mirrors the
// FormatBar's dark-glass aesthetic but is always visible and acts on whatever
// is selected in the editor. The selection FormatBar is suppressed inside the
// editor so this is the single formatting surface there.
export function DocToolbar({ editorRef, onInsertImage }: DocToolbarProps) {
  const [fmt, setFmt] = useState<FmtState>({
    bold: false,
    italic: false,
    underline: false,
    fontSize: 14,
    textColor: "#243029",
  });
  const [picker, setPicker] = useState<PickerState | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  // The picker steals focus and collapses the visual selection — keep the
  // Range so each color change can be applied to the original text.
  const savedRangeRef = useRef<Range | null>(null);

  // Reflect the caret/selection state into the toolbar (active marks, size,
  // color) whenever the selection lives inside this editor.
  const refresh = useCallback(() => {
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || sel.rangeCount === 0) return;
    const anchor = sel.anchorNode;
    const anchorEl =
      anchor instanceof Element ? anchor : (anchor?.parentElement ?? null);
    if (!anchorEl || !editor.contains(anchorEl)) return;
    const focusEl =
      sel.focusNode instanceof Element
        ? sel.focusNode
        : (sel.focusNode?.parentElement ?? null);
    const fsPx = focusEl ? parseFloat(getComputedStyle(focusEl).fontSize) : 14;
    setFmt({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      fontSize: Math.round(fsPx),
      textColor: computedHex(focusEl),
    });
  }, [editorRef]);

  useEffect(() => {
    document.addEventListener("selectionchange", refresh);
    return () => document.removeEventListener("selectionchange", refresh);
  }, [refresh]);

  // Captured on the toolbar's mousedown (before any focus shift) so commands
  // act on what was selected even if the click moves focus or the browser
  // collapses the live selection. Restored just before each command.
  const liveRangeRef = useRef<Range | null>(null);
  const captureSelection = () => {
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (
      editor &&
      sel &&
      sel.rangeCount > 0 &&
      editor.contains(sel.anchorNode)
    ) {
      liveRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };
  const restoreSelection = (): Selection | null => {
    const range = liveRangeRef.current;
    const editor = editorRef.current;
    if (!range || !editor) return window.getSelection();
    editor.focus();
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    return sel;
  };

  const exec = (cmd: "bold" | "italic" | "underline") => {
    restoreSelection();
    document.execCommand(cmd);
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0)
      liveRangeRef.current = sel.getRangeAt(0).cloneRange();
    refresh();
  };

  const stepSize = (dir: 1 | -1) => {
    const sel = restoreSelection();
    if (!sel || sel.isCollapsed) return;
    const cur = fmt.fontSize;
    const next =
      dir === 1
        ? FONT_SIZE_LADDER.find((s) => s > cur)
        : [...FONT_SIZE_LADDER].reverse().find((s) => s < cur);
    if (next === undefined) return;
    applyFontSizeToSelection(next);
    if (sel.rangeCount > 0)
      liveRangeRef.current = sel.getRangeAt(0).cloneRange();
    refresh();
  };

  const openPicker = (prop: "color" | "backgroundColor") => {
    const sel = restoreSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    const r = toolbarRef.current?.getBoundingClientRect();
    setPicker({
      prop,
      x: (r ? r.left + r.width / 2 : window.innerWidth / 2) - 130,
      y: (r ? r.bottom : 80) + 8,
      color: prop === "color" ? fmt.textColor : "#F1B24A",
    });
  };

  const applyPickedColor = (color: string) => {
    const range = savedRangeRef.current;
    if (!range || !picker) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
    applyColorToSelection(picker.prop, color);
    if (sel.rangeCount > 0)
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    setPicker((p) => (p ? { ...p, color } : p));
  };

  const btn = (active: boolean): React.CSSProperties => ({
    width: 28,
    height: 28,
    border: "none",
    borderRadius: 7,
    background: active ? "rgba(241,178,74,0.18)" : "transparent",
    color: active ? "#F1B24A" : "rgba(255,255,255,0.85)",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    transition: "background 0.12s, color 0.12s",
  });

  const divider = (
    <div
      style={{
        width: "0.5px",
        height: 16,
        background: "rgba(255,255,255,0.12)",
        margin: "0 3px",
        flexShrink: 0,
      }}
    />
  );

  return (
    <>
      <div
        ref={toolbarRef}
        // Capture the editor selection and keep focus there: mousedown fires
        // before the click and before any focus shift, so this snapshots what
        // the user selected and preventDefault stops the button from stealing
        // focus. Commands restore this range before applying.
        onMouseDown={(e) => {
          captureSelection();
          e.preventDefault();
        }}
        style={{
          background:
            "linear-gradient(180deg, rgba(157,200,141,0.04) 0%, rgba(157,200,141,0) 100%), rgba(22,64,56,0.97)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "0.5px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
          boxShadow:
            "0 6px 28px rgba(0,0,0,0.32), inset 0 1px 0 0 rgba(255,255,255,0.12)",
          padding: "5px 8px",
          display: "flex",
          alignItems: "center",
          gap: 3,
          userSelect: "none",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        }}
      >
        <button
          title="Bold (⌘B)"
          onClick={() => exec("bold")}
          style={{ ...btn(fmt.bold), fontWeight: 700 }}
        >
          B
        </button>
        <button
          title="Italic (⌘I)"
          onClick={() => exec("italic")}
          style={{ ...btn(fmt.italic), fontStyle: "italic" }}
        >
          I
        </button>
        <button
          title="Underline (⌘U)"
          onClick={() => exec("underline")}
          style={{ ...btn(fmt.underline), textDecoration: "underline" }}
        >
          U
        </button>

        {divider}

        <button
          title="Smaller text"
          onClick={() => stepSize(-1)}
          style={{ ...btn(false), fontSize: 11 }}
        >
          A−
        </button>
        <span
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.75)",
            minWidth: 18,
            textAlign: "center",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmt.fontSize}
        </span>
        <button
          title="Larger text"
          onClick={() => stepSize(1)}
          style={{ ...btn(false), fontSize: 13 }}
        >
          A+
        </button>

        {divider}

        <button
          title="Text color"
          onClick={() => openPicker("color")}
          style={{ ...btn(false), flexDirection: "column", gap: 1 }}
        >
          <span style={{ fontSize: 12, lineHeight: 1 }}>A</span>
          <span
            style={{
              width: 13,
              height: 3,
              borderRadius: 1.5,
              background: fmt.textColor,
              border: "0.5px solid rgba(255,255,255,0.25)",
            }}
          />
        </button>
        <button
          title="Highlight color"
          onClick={() => openPicker("backgroundColor")}
          style={btn(false)}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 11l-6 6v3h9l3-3" />
            <path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
          </svg>
        </button>

        {divider}

        <button title="Insert image" onClick={onInsertImage} style={btn(false)}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </button>
      </div>

      {picker && (
        <ColorPickerWindow
          picker={{ nodeId: -1, x: picker.x, y: picker.y, color: picker.color }}
          onColorChange={(_, color) => applyPickedColor(color)}
          onClose={() => {
            setPicker(null);
            savedRangeRef.current = null;
          }}
        />
      )}
    </>
  );
}
