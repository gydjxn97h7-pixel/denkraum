"use client";
import { useCallback, useEffect, useState } from "react";
import {
  applyFontSizeToSelection,
  FONT_SIZE_LADDER,
} from "../lib/rich-text";

type BarState = {
  x: number;
  y: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontSize: number;
};

// Floating inline-formatting bar. Fully self-contained: tracks the document
// selection and shows itself above any non-collapsed selection inside a
// node's contenteditable field. Buttons preventDefault on mousedown so the
// editable keeps focus and selection while formatting is applied.
export function FormatBar() {
  const [bar, setBar] = useState<BarState | null>(null);

  const refresh = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setBar(null);
      return;
    }
    const anchor = sel.anchorNode;
    const anchorEl =
      anchor instanceof Element ? anchor : (anchor?.parentElement ?? null);
    const editable = anchorEl?.closest('[contenteditable="true"]');
    if (
      !editable ||
      !anchorEl?.closest("[data-node-id], [data-doc-editor]")
    ) {
      setBar(null);
      return;
    }
    // The canvas is userSelect: none, so clicking it blurs the field without
    // collapsing the selection — require focus to still be in the editable.
    if (document.activeElement !== editable) {
      setBar(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setBar(null);
      return;
    }
    const focusEl =
      sel.focusNode instanceof Element
        ? sel.focusNode
        : (sel.focusNode?.parentElement ?? null);
    const fsPx = focusEl
      ? parseFloat(getComputedStyle(focusEl).fontSize)
      : 13;
    setBar({
      x: rect.left + rect.width / 2,
      y: rect.top,
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      fontSize: Math.round(fsPx),
    });
  }, []);

  useEffect(() => {
    // Focus events land before document.activeElement settles — defer a tick.
    const refreshSoon = () => setTimeout(refresh, 0);
    document.addEventListener("selectionchange", refresh);
    document.addEventListener("focusin", refreshSoon);
    document.addEventListener("focusout", refreshSoon);
    window.addEventListener("resize", refresh);
    // Selection rects go stale when the canvas pans/zooms under the wheel.
    window.addEventListener("wheel", refresh, true);
    return () => {
      document.removeEventListener("selectionchange", refresh);
      document.removeEventListener("focusin", refreshSoon);
      document.removeEventListener("focusout", refreshSoon);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("wheel", refresh, true);
    };
  }, [refresh]);

  if (!bar) return null;

  const exec = (cmd: "bold" | "italic" | "underline") => {
    document.execCommand(cmd);
    refresh();
  };

  const stepSize = (dir: 1 | -1) => {
    const cur = bar.fontSize;
    const next =
      dir === 1
        ? FONT_SIZE_LADDER.find((s) => s > cur)
        : [...FONT_SIZE_LADDER].reverse().find((s) => s < cur);
    if (next === undefined) return;
    applyFontSizeToSelection(next);
    refresh();
  };

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    width: 26,
    height: 26,
    border: "none",
    borderRadius: 6,
    background: active ? "rgba(241,178,74,0.18)" : "transparent",
    color: active ? "#F1B24A" : "rgba(255,255,255,0.85)",
    cursor: "pointer",
    fontSize: 12.5,
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  });

  return (
    <div
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        left: bar.x,
        top: Math.max(8, bar.y - 44),
        transform: "translateX(-50%)",
        background:
          "linear-gradient(180deg, rgba(157,200,141,0.04) 0%, rgba(157,200,141,0) 100%), rgba(22,64,56,0.97)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "0.5px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
        boxShadow:
          "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 0 rgba(255,255,255,0.12)",
        padding: "4px 6px",
        display: "flex",
        alignItems: "center",
        gap: 2,
        zIndex: 400,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        userSelect: "none",
      }}
    >
      <button
        title="Bold (⌘B)"
        onClick={() => exec("bold")}
        style={{ ...toggleStyle(bar.bold), fontWeight: 700 }}
      >
        B
      </button>
      <button
        title="Italic (⌘I)"
        onClick={() => exec("italic")}
        style={{ ...toggleStyle(bar.italic), fontStyle: "italic" }}
      >
        I
      </button>
      <button
        title="Underline (⌘U)"
        onClick={() => exec("underline")}
        style={{ ...toggleStyle(bar.underline), textDecoration: "underline" }}
      >
        U
      </button>

      <div
        style={{
          width: "0.5px",
          height: 14,
          background: "rgba(255,255,255,0.12)",
          margin: "0 4px",
          flexShrink: 0,
        }}
      />

      <button
        title="Smaller text"
        onClick={() => stepSize(-1)}
        style={{ ...toggleStyle(false), fontSize: 10.5 }}
      >
        A−
      </button>
      <span
        style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.75)",
          minWidth: 20,
          textAlign: "center",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {bar.fontSize}
      </span>
      <button
        title="Larger text"
        onClick={() => stepSize(1)}
        style={{ ...toggleStyle(false), fontSize: 12.5 }}
      >
        A+
      </button>
    </div>
  );
}
