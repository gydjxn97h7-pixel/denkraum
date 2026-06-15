"use client";
import { ACCENT } from "../lib/canvas-types";
import type { NodeType } from "../lib/canvas-types";
import { ShapeButton, renderShapeIcon } from "./ShapeButton";

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

// Shared glass background for each floating cluster.
const CLUSTER_BG =
  "linear-gradient(180deg, rgba(157,200,141,0.04) 0%, rgba(157,200,141,0) 100%), rgba(22,64,56,0.92)";

// Each related group of actions lives in its own pill-shaped floating cluster;
// the wrapper just positions them in a row with gaps between groups.
const cluster: React.CSSProperties = {
  background: CLUSTER_BG,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
  padding: "8px 16px",
  display: "flex",
  alignItems: "center",
  gap: 4,
  boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
};

// ── Export Toolbar ──
// Related actions are grouped into separate floating clusters (Shapes · Media ·
// Export · View) so the bar reads as distinct groups rather than one long rail.
// The wrapper centers within the space to the right of the sidebar so the
// clusters never overlap the strip or panel on narrow viewports.
export function CanvasToolbar({
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

  const exportBtn = (disabled: boolean): React.CSSProperties => ({
    height: 36,
    padding: "0 14px",
    borderRadius: 999,
    border: "none",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: disabled ? "default" : "pointer",
    background: "transparent",
    color: disabled ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.85)",
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
    borderRadius: 8,
    background: active ? `${ACCENT}22` : "transparent",
    color: !enabled
      ? "rgba(255,255,255,0.25)"
      : active && accent
        ? ACCENT
        : "rgba(255,255,255,0.85)",
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
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      }}
    >
      {/* ── Cluster: Shapes ── */}
      <div style={cluster}>
        {(
          [
            { type: "block" as NodeType, label: "Block" },
            { type: "rounded" as NodeType, label: "Area" },
            { type: "circle" as NodeType, label: "Circle" },
            { type: "oval" as NodeType, label: "Oval" },
            { type: "diamond" as NodeType, label: "Diamond" },
            { type: "text" as NodeType, label: "Text" },
          ] as { type: NodeType; label: string }[]
        ).map(({ type, label }) => (
          <ShapeButton
            key={type}
            label={label}
            isActive={activeShapeType === type}
            onClick={() => {
              const c = canvasCenter();
              if (!c) return;
              setActiveShapeType(type);
              addNode(c.cx, c.cy, type);
            }}
          >
            {(stroke, active) => renderShapeIcon(type, stroke, active)}
          </ShapeButton>
        ))}
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
            <svg width="20" height="20" viewBox="0 0 20 20">
              <path
                d="M3 1 L13 1 L19 7 L19 19 L3 19 Z"
                fill="url(#gShapeN)"
                stroke={stroke}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M13 1 L13 7 L19 7"
                fill="none"
                stroke={stroke}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M7 14.5 L12.5 9 L14.5 11 L9 16.5 L6.5 17 Z"
                fill="rgba(255,255,255,0.65)"
              />
            </svg>
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
              (e.currentTarget as HTMLElement).style.color = "#FFFFFF";
          }}
          onMouseLeave={(e) => {
            if (nodeCount > 0)
              (e.currentTarget as HTMLElement).style.color =
                "rgba(255,255,255,0.85)";
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export PDF
        </button>

        <button
          onClick={exportMarkdown}
          disabled={nodeCount === 0}
          style={exportBtn(nodeCount === 0)}
          onMouseEnter={(e) => {
            if (nodeCount > 0)
              (e.currentTarget as HTMLElement).style.color = "#FFFFFF";
          }}
          onMouseLeave={(e) => {
            if (nodeCount > 0)
              (e.currentTarget as HTMLElement).style.color =
                "rgba(255,255,255,0.85)";
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
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
              (e.currentTarget as HTMLElement).style.color = "#FFFFFF";
              (e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.07)";
            }
          }}
          onMouseLeave={(e) => {
            if (nodeCount > 1) {
              (e.currentTarget as HTMLElement).style.color =
                "rgba(255,255,255,0.85)";
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }
          }}
        >
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
            <circle cx="5" cy="5" r="2" />
            <circle cx="19" cy="5" r="2" />
            <circle cx="12" cy="19" r="2" />
            <line x1="5" y1="7" x2="12" y2="17" />
            <line x1="19" y1="7" x2="12" y2="17" />
          </svg>
        </button>

        <button
          title="Filter nodes (F)"
          onClick={() => setFilterOpen((o) => !o)}
          style={iconBtn(filterOpen, true, true)}
          onMouseEnter={(e) => {
            if (!filterOpen) {
              (e.currentTarget as HTMLElement).style.color = "#FFFFFF";
              (e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.07)";
            }
          }}
          onMouseLeave={(e) => {
            if (!filterOpen) {
              (e.currentTarget as HTMLElement).style.color =
                "rgba(255,255,255,0.85)";
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }
          }}
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
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>
    </div>
  );
}
