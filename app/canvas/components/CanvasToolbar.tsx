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

// ── Export Toolbar ──
// Center within the space to the right of the sidebar so it never
// overlaps the strip or panel on narrow viewports.
// Left boundary: strip(left:12 + w:52) + gap:12 = 76 (strip only)
//                panel(left:76 + w:220) + gap:12 = 308 (panel open)
// Center = 50% + leftBoundary/2  (geometric midpoint of remaining space)
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
  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        left: panelOpen ? "calc(50% + 154px)" : "calc(50% + 38px)",
        transform: "translateX(-50%)",
        maxWidth: panelOpen ? "calc(100vw - 320px)" : "calc(100vw - 88px)",
        overflow: "hidden",
        background:
          "linear-gradient(180deg, rgba(157,200,141,0.04) 0%, rgba(157,200,141,0) 100%), rgba(22,64,56,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "0.5px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: "6px 10px",
        display: isPresenting ? "none" : "flex",
        gap: 8,
        alignItems: "center",
        boxShadow:
          "0 2px 24px rgba(0,0,0,0.3), inset 0 1px 0 0 rgba(255,255,255,0.12)",
        zIndex: 201,
      }}
    >
      {/* ── Shape insert buttons ── */}
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
            if (!canvasRef.current) return;
            const cx =
              (canvasRef.current.clientWidth / 2 - panRef.current.x) /
              zoomRef.current;
            const cy =
              (canvasRef.current.clientHeight / 2 - panRef.current.y) /
              zoomRef.current;
            setActiveShapeType(type);
            addNode(cx, cy, type);
          }}
        >
          {(stroke, active) => renderShapeIcon(type, stroke, active)}
        </ShapeButton>
      ))}

      {/* Image insert button */}
      <ShapeButton
        label="Insert Image"
        isActive={false}
        onClick={() => {
          if (!canvasRef.current) return;
          const cx =
            (canvasRef.current.clientWidth / 2 - panRef.current.x) /
            zoomRef.current;
          const cy =
            (canvasRef.current.clientHeight / 2 - panRef.current.y) /
            zoomRef.current;
          handleImageInsert(cx, cy);
        }}
      >
        {(stroke, active) => renderShapeIcon("image", stroke, active)}
      </ShapeButton>

      {/* Text file insert button */}
      <ShapeButton
        label="Insert Text File"
        isActive={false}
        onClick={() => {
          if (!canvasRef.current) return;
          const cx =
            (canvasRef.current.clientWidth / 2 - panRef.current.x) /
            zoomRef.current;
          const cy =
            (canvasRef.current.clientHeight / 2 - panRef.current.y) /
            zoomRef.current;
          handleTextFileInsert(cx, cy);
        }}
      >
        {(stroke, active) => renderShapeIcon("textfile", stroke, active)}
      </ShapeButton>

      {/* New document button — opens the editor panel */}
      <ShapeButton label="New Document" isActive={false} onClick={onNewDocument}>
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

      {/* Divider */}
      <div
        style={{
          width: "0.5px",
          height: 16,
          background: "rgba(255,255,255,0.1)",
          margin: "0 4px",
          flexShrink: 0,
        }}
      />

      <button
        onClick={exportPdfVector}
        disabled={nodeCount === 0}
        style={{
          padding: "6px 13px",
          borderRadius: 8,
          border: "none",
          fontSize: 12.5,
          fontFamily: "inherit",
          cursor: nodeCount === 0 ? "default" : "pointer",
          background: "transparent",
          color:
            nodeCount === 0
              ? "rgba(255,255,255,0.4)"
              : "rgba(255,255,255,0.85)",
          transition: "color 0.15s",
          display: "flex",
          alignItems: "center",
          gap: 6,
          letterSpacing: "-0.1px",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
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
        style={{
          padding: "6px 13px",
          borderRadius: 8,
          border: "none",
          fontSize: 12.5,
          fontFamily: "inherit",
          cursor: nodeCount === 0 ? "default" : "pointer",
          background: "transparent",
          color:
            nodeCount === 0
              ? "rgba(255,255,255,0.4)"
              : "rgba(255,255,255,0.85)",
          transition: "color 0.15s",
          display: "flex",
          alignItems: "center",
          gap: 6,
          letterSpacing: "-0.1px",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
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

      {/* Divider */}
      <div
        style={{
          width: "0.5px",
          height: 16,
          background: "rgba(255,255,255,0.1)",
          margin: "0 4px",
          flexShrink: 0,
        }}
      />

      {/* Auto-arrange layout button */}
      <button
        title="Auto-arrange layout"
        onClick={runForceLayout}
        disabled={nodeCount <= 1}
        style={{
          width: 28,
          height: 28,
          border: "none",
          background: "transparent",
          color:
            nodeCount <= 1
              ? "rgba(255,255,255,0.25)"
              : "rgba(255,255,255,0.85)",
          cursor: nodeCount <= 1 ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 7,
          padding: 0,
          transition: "color 0.12s, background 0.12s",
        }}
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

      {/* Divider */}
      <div
        style={{
          width: "0.5px",
          height: 16,
          background: "rgba(255,255,255,0.1)",
          margin: "0 4px",
          flexShrink: 0,
        }}
      />

      {/* Filter button */}
      <button
        title="Filter nodes (F)"
        onClick={() => setFilterOpen((o) => !o)}
        style={{
          width: 28,
          height: 28,
          border: "none",
          background: filterOpen ? `${ACCENT}22` : "transparent",
          color: filterOpen ? ACCENT : "rgba(255,255,255,0.85)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 7,
          padding: 0,
          transition: "color 0.12s, background 0.12s",
        }}
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
  );
}
