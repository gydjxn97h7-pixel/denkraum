"use client";
import { memo } from "react";
import type { CanvasNode } from "../lib/canvas-types";

// ── Connection line ───────────────────────────────────────────────────────────
export const ConnectionLine = memo(function ConnectionLine({
  connKey,
  fromNode,
  toNode,
  isHovered,
  zoom,
  connDimmed,
  onHoverEnter,
  onHoverLeave,
  onDelete,
}: {
  connKey: string;
  fromNode: CanvasNode;
  toNode: CanvasNode;
  isHovered: boolean;
  zoom: number;
  connDimmed: boolean;
  onHoverEnter: (key: string) => void;
  onHoverLeave: (key: string) => void;
  onDelete: (from: number, to: number) => void;
}) {
  // Centers of each node
  const fcx = fromNode.x + fromNode.w / 2;
  const fcy = fromNode.y + fromNode.h / 2;
  const tcx = toNode.x + toNode.w / 2;
  const tcy = toNode.y + toNode.h / 2;

  const dx = tcx - fcx;
  const dy = tcy - fcy;

  // Pick exit/entry edges based on which axis dominates center-to-center
  let x1: number, y1: number, x2: number, y2: number;
  let cpOffset: number;

  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal dominant: use right/left edges
    const dist = Math.abs(dx);
    cpOffset = Math.max(40, dist * 0.4);
    if (dx >= 0) {
      // target is to the right
      x1 = fromNode.x + fromNode.w;
      y1 = fcy;
      x2 = toNode.x;
      y2 = tcy;
    } else {
      // target is to the left
      x1 = fromNode.x;
      y1 = fcy;
      x2 = toNode.x + toNode.w;
      y2 = tcy;
    }
  } else {
    // Vertical dominant: use top/bottom edges
    const dist = Math.abs(dy);
    cpOffset = Math.max(40, dist * 0.4);
    if (dy >= 0) {
      // target is below
      x1 = fcx;
      y1 = fromNode.y + fromNode.h;
      x2 = tcx;
      y2 = toNode.y;
    } else {
      // target is above
      x1 = fcx;
      y1 = fromNode.y;
      x2 = tcx;
      y2 = toNode.y + toNode.h;
    }
  }

  // Control points: tangent perpendicular to the chosen edge
  let c1x: number, c1y: number, c2x: number, c2y: number;
  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal: offset control points along x
    const sign = dx >= 0 ? 1 : -1;
    c1x = x1 + sign * cpOffset;
    c1y = y1;
    c2x = x2 - sign * cpOffset;
    c2y = y2;
  } else {
    // Vertical: offset control points along y
    const sign = dy >= 0 ? 1 : -1;
    c1x = x1;
    c1y = y1 + sign * cpOffset;
    c2x = x2;
    c2y = y2 - sign * cpOffset;
  }

  const d = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
  return (
    <g
      style={{
        opacity: connDimmed ? 0.15 : 1,
        transition: "opacity 0.2s ease",
      }}
    >
      <path
        d={d}
        stroke={isHovered ? "rgba(20,71,56,0.85)" : "rgba(20,71,56,0.55)"}
        strokeWidth={isHovered ? 2.5 / zoom : 1.5 / zoom}
        fill="none"
        strokeLinecap="round"
        style={{
          pointerEvents: "none",
          transition: "stroke 0.12s, stroke-width 0.12s",
        }}
      />
      <path
        d={d}
        stroke="transparent"
        strokeWidth={12 / zoom}
        fill="none"
        style={{ cursor: "pointer" }}
        onMouseEnter={() => onHoverEnter(connKey)}
        onMouseLeave={() => onHoverLeave(connKey)}
        onDoubleClick={() => onDelete(fromNode.id, toNode.id)}
      />
    </g>
  );
});
