"use client";
import { memo } from "react";
import { MIN_ZOOM, MAX_ZOOM } from "../lib/canvas-types";
import { Minus, Plus } from "lucide-react";
import { ICON, ICON_PROPS, tokens } from "../lib/design-tokens";

interface ZoomControlsProps {
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  isPresenting: boolean;
}

// ── Zoom controls ── (bottom-right − / % / + / Reset cluster)
function ZoomControlsImpl({
  zoom,
  setZoom,
  setPan,
  isPresenting,
}: ZoomControlsProps) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        background: tokens.color.muted,
        border: `0.5px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
        padding: "8px 12px",
        display: isPresenting ? "none" : "flex",
        gap: 8,
        alignItems: "center",
        boxShadow: "0 4px 12px rgba(58,48,38,0.10), 0 16px 44px rgba(58,48,38,0.20)",
        zIndex: 100,
      }}
    >
      <button
        onClick={() =>
          setZoom((z) => Math.max(MIN_ZOOM, parseFloat((z - 0.1).toFixed(2))))
        }
        style={{
          border: "none",
          background: "none",
          cursor: "pointer",
          color: "rgba(42,40,35,0.85)",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Minus size={ICON.md} {...ICON_PROPS} />
      </button>
      <span
        style={{
          fontSize: 11,
          color: "rgba(42,40,35,0.7)",
          minWidth: 38,
          textAlign: "center",
        }}
      >
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() =>
          setZoom((z) => Math.min(MAX_ZOOM, parseFloat((z + 0.1).toFixed(2))))
        }
        style={{
          border: "none",
          background: "none",
          cursor: "pointer",
          color: "rgba(42,40,35,0.85)",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Plus size={ICON.md} {...ICON_PROPS} />
      </button>
      <div
        style={{
          width: "1px",
          height: 16,
          background: tokens.color.border,
        }}
      />
      <button
        onClick={() => {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }}
        style={{
          height: 24,
          padding: "0 12px",
          borderRadius: tokens.radius.xs,
          border: `0.5px solid ${tokens.color.border}`,
          background: "transparent",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          color: tokens.color.text,
        }}
      >
        Reset
      </button>
    </div>
  );
}

export const ZoomControls = memo(ZoomControlsImpl);
