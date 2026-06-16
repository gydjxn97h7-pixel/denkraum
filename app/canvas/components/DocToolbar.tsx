"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  applyColorToSelection,
  applyFontSizeToSelection,
  FONT_SIZE_LADDER,
} from "../lib/rich-text";
import { rgbToHex } from "../lib/color-helpers";
import { ColorPickerWindow } from "./ColorPickerWindow";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Baseline,
  Highlighter,
  Image as ImageIcon,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  RADIUS,
  SPACE,
  BORDER_DARK,
  FONT_SANS,
  CONTROL,
  ICON,
  ICON_PROPS,
} from "../lib/design-tokens";

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
  bullet: boolean;
  numbered: boolean;
  align: "left" | "center" | "right";
};

type PickerState = {
  prop: "color" | "backgroundColor";
  x: number;
  y: number;
  color: string;
};

function computedHex(el: Element | null): string {
  if (!el) return "#2A2823";
  const v = getComputedStyle(el).color;
  const m = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  return m ? rgbToHex(+m[1], +m[2], +m[3]) : "#2A2823";
}

// A soft, low shadow keeps the pill integrated with the otherwise-flat app
// (most surfaces use ELEVATION ≈ 0 8px 24px / .22). A faint top rim-light
// preserves a hint of tactility without reading as a foreign overlay.
const TACTILE_SHADOW =
  "0 4px 14px rgba(0,0,0,0.20), inset 0 1px 0 rgba(42,40,35,0.06)";

// Shared dark sage-green glass used by both the full bar and the compact
// trigger so they read as the same surface.
const GLASS_BG =
  "linear-gradient(180deg, rgba(216,201,168,0.06) 0%, rgba(216,201,168,0) 100%), rgba(252,251,248,0.97)";

// Hover tooltip that names what a control does (e.g. "Bold"). Sits just below
// its button, over the white page where it reads clearly.
function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        position: "absolute",
        top: "100%",
        left: "50%",
        transform: "translateX(-50%)",
        marginTop: SPACE.sm,
        background: "rgba(12,32,24,0.97)",
        color: "rgba(42,40,35,0.92)",
        border: "1px solid rgba(42,40,35,0.1)",
        borderRadius: RADIUS.pill,
        padding: "4px 10px",
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
        zIndex: 30,
      }}
    >
      {children}
    </span>
  );
}

// A single circular icon button. `swatch` turns it into a filled color swatch
// (for the text-color / highlight pickers); otherwise it's a ring-style icon
// button that highlights in ocher when active. Each carries its own tooltip.
function IconButton({
  label,
  onClick,
  children,
  active = false,
  swatch,
  glyphStyle,
  diameter = CONTROL.md,
}: {
  label: string;
  onClick: () => void;
  children?: React.ReactNode;
  active?: boolean;
  swatch?: string;
  glyphStyle?: React.CSSProperties;
  diameter?: number;
}) {
  const [hover, setHover] = useState(false);
  const base: React.CSSProperties = {
    width: diameter,
    height: diameter,
    borderRadius: RADIUS.pill,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    flexShrink: 0,
    fontFamily: "inherit",
    transition:
      "background 0.12s, color 0.12s, border-color 0.12s, box-shadow 0.12s",
  };
  const style: React.CSSProperties = swatch
    ? {
        ...base,
        background: swatch,
        border: `2px solid rgba(42,40,35,${hover ? 0.55 : 0.3})`,
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)",
      }
    : {
        ...base,
        background: active
          ? "rgba(197,107,71,0.20)"
          : hover
            ? "rgba(42,40,35,0.12)"
            : "rgba(42,40,35,0.05)",
        border: active
          ? "1px solid rgba(197,107,71,0.5)"
          : "1px solid rgba(42,40,35,0.09)",
        color: active ? "#C56B47" : "rgba(42,40,35,0.85)",
        ...glyphStyle,
      };
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        title={label}
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={style}
      >
        {children}
      </button>
      {hover && <Tooltip>{label}</Tooltip>}
    </span>
  );
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
    textColor: "#2A2823",
    bullet: false,
    numbered: false,
    align: "left",
  });
  const [picker, setPicker] = useState<PickerState | null>(null);
  // Contextual visibility: the full bar shows whenever text is selected; when
  // nothing is selected it collapses to a compact trigger unless pinned open.
  const [hasSel, setHasSel] = useState(false);
  const [pinned, setPinned] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  // The picker steals focus and collapses the visual selection — keep the
  // Range so each color change can be applied to the original text.
  const savedRangeRef = useRef<Range | null>(null);

  // Reflect the caret/selection state into the toolbar (active marks, size,
  // color) whenever the selection lives inside this editor.
  const refresh = useCallback(() => {
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || sel.rangeCount === 0) {
      setHasSel(false);
      return;
    }
    const anchor = sel.anchorNode;
    const anchorEl =
      anchor instanceof Element ? anchor : (anchor?.parentElement ?? null);
    if (!anchorEl || !editor.contains(anchorEl)) {
      setHasSel(false);
      return;
    }
    setHasSel(!sel.isCollapsed);
    const focusEl =
      sel.focusNode instanceof Element
        ? sel.focusNode
        : (sel.focusNode?.parentElement ?? null);
    const fsPx = focusEl ? parseFloat(getComputedStyle(focusEl).fontSize) : 14;
    const align = document.queryCommandState("justifyCenter")
      ? "center"
      : document.queryCommandState("justifyRight")
        ? "right"
        : "left";
    setFmt({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      fontSize: Math.round(fsPx),
      textColor: computedHex(focusEl),
      bullet: document.queryCommandState("insertUnorderedList"),
      numbered: document.queryCommandState("insertOrderedList"),
      align,
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

  const exec = (
    cmd:
      | "bold"
      | "italic"
      | "underline"
      | "insertUnorderedList"
      | "insertOrderedList"
      | "justifyLeft"
      | "justifyCenter"
      | "justifyRight",
  ) => {
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
      color: prop === "color" ? fmt.textColor : "#C56B47",
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

  const divider = (
    <div
      style={{
        width: "1px",
        height: SPACE.lg,
        background: "rgba(42,40,35,0.12)",
        margin: `0 ${SPACE.xs}px`,
        flexShrink: 0,
      }}
    />
  );

  // Portaled to body: position:fixed must be viewport-relative, but an ancestor
  // transform would otherwise become the containing block and push it off-screen.
  const pickerPortal =
    picker && typeof document !== "undefined"
      ? createPortal(
          <ColorPickerWindow
            picker={{
              nodeId: -1,
              x: picker.x,
              y: picker.y,
              color: picker.color,
            }}
            onColorChange={(_, color) => applyPickedColor(color)}
            onClose={() => {
              setPicker(null);
              savedRangeRef.current = null;
            }}
          />,
          document.body,
        )
      : null;

  // The full bar is shown while text is selected, or when the user pins it open
  // from the compact trigger.
  const showFull = hasSel || pinned;

  if (!showFull) {
    return (
      <>
        <button
          title="Formatting"
          // Keep the editor selection/focus when opening the bar.
          onMouseDown={(e) => {
            captureSelection();
            e.preventDefault();
          }}
          onClick={() => setPinned(true)}
          style={{
            height: 40,
            padding: "0 14px",
            borderRadius: RADIUS.pill,
            background: GLASS_BG,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: BORDER_DARK,
            boxShadow: TACTILE_SHADOW,
            color: "rgba(42,40,35,0.9)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            fontFamily: FONT_SANS,
            fontSize: 14,
            fontWeight: 600,
            userSelect: "none",
          }}
        >
          <span style={{ letterSpacing: "-0.3px" }}>Aa</span>
          <ChevronDown size={ICON.sm} {...ICON_PROPS} />
        </button>
        {pickerPortal}
      </>
    );
  }

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
          background: GLASS_BG,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: BORDER_DARK,
          borderRadius: RADIUS.lg,
          boxShadow: TACTILE_SHADOW,
          padding: `${SPACE.sm}px ${SPACE.md}px`,
          display: "flex",
          alignItems: "center",
          gap: SPACE.xs,
          userSelect: "none",
          fontFamily: FONT_SANS,
        }}
      >
        <IconButton label="Bold" active={fmt.bold} onClick={() => exec("bold")}>
          <Bold size={ICON.md} {...ICON_PROPS} />
        </IconButton>
        <IconButton
          label="Italic"
          active={fmt.italic}
          onClick={() => exec("italic")}
        >
          <Italic size={ICON.md} {...ICON_PROPS} />
        </IconButton>
        <IconButton
          label="Underline"
          active={fmt.underline}
          onClick={() => exec("underline")}
        >
          <Underline size={ICON.md} {...ICON_PROPS} />
        </IconButton>

        {divider}

        <IconButton
          label="Smaller text"
          onClick={() => stepSize(-1)}
          glyphStyle={{ fontSize: 12 }}
        >
          A−
        </IconButton>
        <span
          style={{
            fontSize: 11,
            color: "rgba(42,40,35,0.75)",
            minWidth: 18,
            textAlign: "center",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmt.fontSize}
        </span>
        <IconButton
          label="Larger text"
          onClick={() => stepSize(1)}
          glyphStyle={{ fontSize: 14 }}
        >
          A+
        </IconButton>

        {divider}

        {/* Lists */}
        <IconButton
          label="Bullet list"
          active={fmt.bullet}
          onClick={() => exec("insertUnorderedList")}
        >
          <List size={ICON.md} {...ICON_PROPS} />
        </IconButton>
        <IconButton
          label="Numbered list"
          active={fmt.numbered}
          onClick={() => exec("insertOrderedList")}
        >
          <ListOrdered size={ICON.md} {...ICON_PROPS} />
        </IconButton>

        {divider}

        {/* Alignment */}
        <IconButton
          label="Align left"
          active={fmt.align === "left"}
          onClick={() => exec("justifyLeft")}
        >
          <AlignLeft size={ICON.md} {...ICON_PROPS} />
        </IconButton>
        <IconButton
          label="Align center"
          active={fmt.align === "center"}
          onClick={() => exec("justifyCenter")}
        >
          <AlignCenter size={ICON.md} {...ICON_PROPS} />
        </IconButton>
        <IconButton
          label="Align right"
          active={fmt.align === "right"}
          onClick={() => exec("justifyRight")}
        >
          <AlignRight size={ICON.md} {...ICON_PROPS} />
        </IconButton>

        {divider}

        {/* Color + highlight pickers as circular swatches */}
        <IconButton label="Text color" onClick={() => openPicker("color")}>
          <Baseline size={ICON.md} {...ICON_PROPS} />
        </IconButton>
        <IconButton
          label="Highlight"
          onClick={() => openPicker("backgroundColor")}
        >
          <Highlighter size={ICON.md} {...ICON_PROPS} />
        </IconButton>

        {divider}

        <IconButton label="Insert image" onClick={onInsertImage}>
          <ImageIcon size={ICON.md} {...ICON_PROPS} />
        </IconButton>

        {divider}

        {/* Collapse back to the compact trigger (only sticks when nothing is
            selected — a live selection keeps the full bar up). */}
        <IconButton label="Hide" onClick={() => setPinned(false)}>
          <ChevronUp size={ICON.md} {...ICON_PROPS} />
        </IconButton>
      </div>
      {pickerPortal}
    </>
  );
}
