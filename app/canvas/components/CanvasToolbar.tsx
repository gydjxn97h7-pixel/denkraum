"use client";
import { memo, useEffect, useRef, useState } from "react";
import type { NodeType } from "../lib/canvas-types";
import { ShapeButton, renderShapeIcon } from "./ShapeButton";
import {
  FileDown,
  FileText,
  FilePlus,
  Network,
  Search,
  Ellipsis,
} from "lucide-react";
import { ICON, ICON_PROPS, tokens } from "../lib/design-tokens";

// Primary shapes live in the toolbar; secondary shapes hide behind the overflow
// "more shapes" button.
const PRIMARY_SHAPES: { type: NodeType; label: string }[] = [
  { type: "block", label: "Block" },
  { type: "rounded", label: "Area" },
  { type: "text", label: "Text" },
  { type: "sticky", label: "Sticky Note" },
  { type: "checklist", label: "Checklist" },
  { type: "link", label: "Link" },
  { type: "triangle", label: "Triangle" },
  { type: "star", label: "Star" },
  { type: "arrow", label: "Arrow" },
  { type: "parallelogram", label: "Parallelogram" },
];
const SECONDARY_SHAPES: { type: NodeType; label: string }[] = [
  { type: "circle", label: "Circle" },
  { type: "oval", label: "Oval" },
  { type: "diamond", label: "Diamond" },
];

interface CanvasToolbarProps {
  panelOpen: boolean;
  isPresenting: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  panRef: React.RefObject<{ x: number; y: number }>;
  zoomRef: React.RefObject<number>;
  activeShapeType: NodeType | null;
  setActiveShapeType: React.Dispatch<React.SetStateAction<NodeType | null>>;
  addNode: (cx: number, cy: number, type: NodeType) => void;
  handleImageInsert: (cx: number, cy: number) => void;
  handleTextFileInsert: (cx: number, cy: number) => void;
  onNewDocument: () => void;
  exportPdfVector: () => void;
  exportMarkdown: () => void;
  runForceLayout: () => void;
  nodeCount: number;
  filterOpen: boolean;
  setFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

// Each related group of actions lives in its own floating cluster; the wrapper
// just positions them in a row with gaps between groups.
const cluster: React.CSSProperties = {
  background: tokens.color.muted,
  borderRadius: tokens.radius.md,
  padding: "8px 16px",
  display: "flex",
  alignItems: "center",
  gap: 4,
  boxShadow: "0 4px 12px rgba(58,48,38,0.10), 0 16px 44px rgba(58,48,38,0.20)",
};

// ── Export Toolbar ──
// Related actions are grouped into separate floating clusters (Shapes · Media ·
// Export · View) so the bar reads as distinct groups rather than one long rail.
// The wrapper centers within the space to the right of the sidebar so the
// clusters never overlap the strip or panel on narrow viewports.
function CanvasToolbarImpl({
  panelOpen,
  isPresenting,
  canvasRef,
  panRef,
  zoomRef,
  activeShapeType,
  setActiveShapeType,
  addNode,
  handleImageInsert,
  handleTextFileInsert,
  onNewDocument,
  exportPdfVector,
  exportMarkdown,
  runForceLayout,
  nodeCount,
  filterOpen,
  setFilterOpen,
}: CanvasToolbarProps) {
  // Center of the canvas in world coords — where freshly inserted nodes land.
  const canvasCenter = () => {
    const el = canvasRef.current;
    if (!el) return null;
    return {
      cx: (el.clientWidth / 2 - panRef.current.x) / zoomRef.current,
      cy: (el.clientHeight / 2 - panRef.current.y) / zoomRef.current,
    };
  };

  const insertShape = (type: NodeType) => {
    const c = canvasCenter();
    if (!c) return;
    setActiveShapeType(type);
    addNode(c.cx, c.cy, type);
  };

  // "More shapes" overflow popover (secondary shapes). Closes on outside click
  // or Escape.
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  const exportBtn = (disabled: boolean): React.CSSProperties => ({
    height: 36,
    padding: "0 14px",
    borderRadius: tokens.radius.xs,
    border: "none",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: disabled ? "default" : "pointer",
    background: "transparent",
    color: disabled ? "rgba(42,40,35,0.4)" : "rgba(42,40,35,0.85)",
    transition: "color 0.15s, background 0.15s",
    display: "flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
    flexShrink: 0,
  });

  const iconBtn = (
    active: boolean,
    enabled: boolean,
    accent = false,
  ): React.CSSProperties => ({
    width: 36,
    height: 36,
    border: "none",
    borderRadius: tokens.radius.xs,
    background: active ? tokens.color.sand : "transparent",
    color: !enabled
      ? "rgba(42,40,35,0.25)"
      : active && accent
        ? tokens.color.ink
        : "rgba(42,40,35,0.85)",
    cursor: enabled ? "pointer" : "default",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    flexShrink: 0,
    transition: "color 0.12s, background 0.12s",
  });

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        // Anchored between the sidebar (strip or open panel) and the right edge
        // so the clusters center within the canvas area and only wrap when the
        // viewport is genuinely too narrow.
        left: panelOpen ? 308 : 76,
        right: 16,
        display: isPresenting ? "none" : "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
        zIndex: 201,
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
      }}
    >
      {/* ── Cluster: Shapes ── */}
      <div style={cluster}>
        {PRIMARY_SHAPES.map(({ type, label }) => (
          <ShapeButton
            key={type}
            label={label}
            isActive={activeShapeType === type}
            onClick={() => insertShape(type)}
          >
            {(stroke, active) => renderShapeIcon(type, stroke, active)}
          </ShapeButton>
        ))}

        {/* Overflow: more shapes */}
        <div ref={moreRef} style={{ position: "relative", display: "flex" }}>
          <button
            title="More shapes"
            aria-label="More shapes"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((o) => !o)}
            style={iconBtn(moreOpen, true)}
            onMouseEnter={(e) => {
              if (!moreOpen) {
                (e.currentTarget as HTMLElement).style.color = "#2A2823";
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(42,40,35,0.07)";
              }
            }}
            onMouseLeave={(e) => {
              if (!moreOpen) {
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(42,40,35,0.85)";
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
              }
            }}
          >
            <Ellipsis size={ICON.lg} {...ICON_PROPS} />
          </button>

          {moreOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                left: "50%",
                transform: "translateX(-50%)",
                ...cluster,
                padding: "6px 8px",
                zIndex: 1,
              }}
            >
              {SECONDARY_SHAPES.map(({ type, label }) => (
                <ShapeButton
                  key={type}
                  label={label}
                  isActive={activeShapeType === type}
                  onClick={() => {
                    insertShape(type);
                    setMoreOpen(false);
                  }}
                >
                  {(stroke, active) => renderShapeIcon(type, stroke, active)}
                </ShapeButton>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Cluster: Media ── */}
      <div style={cluster}>
        <ShapeButton
          label="Insert Image"
          isActive={false}
          onClick={() => {
            const c = canvasCenter();
            if (c) handleImageInsert(c.cx, c.cy);
          }}
        >
          {(stroke, active) => renderShapeIcon("image", stroke, active)}
        </ShapeButton>

        <ShapeButton
          label="Insert Text File"
          isActive={false}
          onClick={() => {
            const c = canvasCenter();
            if (c) handleTextFileInsert(c.cx, c.cy);
          }}
        >
          {(stroke, active) => renderShapeIcon("textfile", stroke, active)}
        </ShapeButton>

        <ShapeButton
          label="New Document"
          isActive={false}
          onClick={onNewDocument}
        >
          {(stroke) => (
            <FilePlus size={ICON.lg} {...ICON_PROPS} color={stroke} />
          )}
        </ShapeButton>
      </div>

      {/* ── Cluster: Export ── */}
      <div style={cluster}>
        <button
          onClick={exportPdfVector}
          disabled={nodeCount === 0}
          style={exportBtn(nodeCount === 0)}
          onMouseEnter={(e) => {
            if (nodeCount > 0)
              (e.currentTarget as HTMLElement).style.color = "#2A2823";
          }}
          onMouseLeave={(e) => {
            if (nodeCount > 0)
              (e.currentTarget as HTMLElement).style.color =
                "rgba(42,40,35,0.85)";
          }}
        >
          <FileDown size={ICON.sm} {...ICON_PROPS} />
          Export PDF
        </button>

        <button
          onClick={exportMarkdown}
          disabled={nodeCount === 0}
          style={exportBtn(nodeCount === 0)}
          onMouseEnter={(e) => {
            if (nodeCount > 0)
              (e.currentTarget as HTMLElement).style.color = "#2A2823";
          }}
          onMouseLeave={(e) => {
            if (nodeCount > 0)
              (e.currentTarget as HTMLElement).style.color =
                "rgba(42,40,35,0.85)";
          }}
        >
          <FileText size={ICON.sm} {...ICON_PROPS} />
          Export MD
        </button>
      </div>

      {/* ── Cluster: View (arrange + filter) ── */}
      <div style={cluster}>
        <button
          title="Auto-arrange layout"
          onClick={runForceLayout}
          disabled={nodeCount <= 1}
          style={iconBtn(false, nodeCount > 1)}
          onMouseEnter={(e) => {
            if (nodeCount > 1) {
              (e.currentTarget as HTMLElement).style.color = "#2A2823";
              (e.currentTarget as HTMLElement).style.background =
                "rgba(42,40,35,0.07)";
            }
          }}
          onMouseLeave={(e) => {
            if (nodeCount > 1) {
              (e.currentTarget as HTMLElement).style.color =
                "rgba(42,40,35,0.85)";
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }
          }}
        >
          <Network size={ICON.lg} {...ICON_PROPS} />
        </button>

        <button
          title="Filter nodes (F)"
          onClick={() => setFilterOpen((o) => !o)}
          style={iconBtn(filterOpen, true, true)}
          onMouseEnter={(e) => {
            if (!filterOpen) {
              (e.currentTarget as HTMLElement).style.color = "#2A2823";
              (e.currentTarget as HTMLElement).style.background =
                "rgba(42,40,35,0.07)";
            }
          }}
          onMouseLeave={(e) => {
            if (!filterOpen) {
              (e.currentTarget as HTMLElement).style.color =
                "rgba(42,40,35,0.85)";
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }
          }}
        >
          <Search size={ICON.lg} {...ICON_PROPS} />
        </button>
      </div>
    </div>
  );
}

export const CanvasToolbar = memo(CanvasToolbarImpl);
