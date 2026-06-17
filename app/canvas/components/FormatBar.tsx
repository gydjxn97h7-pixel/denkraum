"use client";
import { useCallback, useEffect, useState, memo } from "react";
import { applyFontSizeToSelection, FONT_SIZE_LADDER } from "../lib/rich-text";
import { Bold, Italic, Underline } from "lucide-react";
import { ICON, ICON_PROPS } from "../lib/design-tokens";

type BarState = {
  x: number;
  y: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontSize: number;
};

// Floating inline-formatting bar for canvas node fields. Tracks the document
// selection and shows itself above any non-collapsed selection inside a node's
// contenteditable. The document editor has its own persistent DocToolbar, so
// this bar deliberately ignores selections inside [data-doc-editor].
// Buttons preventDefault on mousedown so the editable keeps focus and
// selection while formatting is applied.
function FormatBarImpl() {
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
    // Canvas node fields only — the document editor uses its own toolbar.
    if (
      !editable ||
      !anchorEl?.closest("[data-node-id]") ||
      anchorEl?.closest("[data-doc-editor]")
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
    const fsPx = focusEl ? parseFloat(getComputedStyle(focusEl).fontSize) : 13;
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
    borderRadius: 8,
    background: active ? "rgba(197,107,71,0.18)" : "transparent",
    color: active ? "#C56B47" : "rgba(42,40,35,0.85)",
    cursor: "pointer",
    fontSize: 12,
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
          "linear-gradient(180deg, rgba(216,201,168,0.04) 0%, rgba(216,201,168,0) 100%), rgba(252,251,248,0.97)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(42,40,35,0.1)",
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
        padding: "4px 8px",
        display: "flex",
        alignItems: "center",
        gap: 4,
        zIndex: 400,
        fontFamily:
          "var(--font-geist-mono), ui-monospace, monospace",
        userSelect: "none",
      }}
    >
      <button
        title="Bold (⌘B)"
        onClick={() => exec("bold")}
        style={toggleStyle(bar.bold)}
      >
        <Bold size={ICON.sm} {...ICON_PROPS} />
      </button>
      <button
        title="Italic (⌘I)"
        onClick={() => exec("italic")}
        style={toggleStyle(bar.italic)}
      >
        <Italic size={ICON.sm} {...ICON_PROPS} />
      </button>
      <button
        title="Underline (⌘U)"
        onClick={() => exec("underline")}
        style={toggleStyle(bar.underline)}
      >
        <Underline size={ICON.sm} {...ICON_PROPS} />
      </button>

      <div
        style={{
          width: "1px",
          height: 14,
          background: "rgba(42,40,35,0.12)",
          margin: "0 4px",
          flexShrink: 0,
        }}
      />

      <button
        title="Smaller text"
        onClick={() => stepSize(-1)}
        style={{ ...toggleStyle(false), fontSize: 11 }}
      >
        A−
      </button>
      <span
        style={{
          fontSize: 11,
          color: "rgba(42,40,35,0.75)",
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
        style={{ ...toggleStyle(false), fontSize: 12 }}
      >
        A+
      </button>
    </div>
  );
}

export const FormatBar = memo(FormatBarImpl);
