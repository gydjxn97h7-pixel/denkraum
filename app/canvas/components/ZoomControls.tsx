"use client";
import { MIN_ZOOM, MAX_ZOOM } from "../lib/canvas-types";

interface ZoomControlsProps {
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  isPresenting: boolean;
}

// ── Zoom controls ── (bottom-right − / % / + / Reset cluster)
export function ZoomControls({
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
        background: "rgba(22,64,56,0.92)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16,
        padding: "8px 12px",
        display: isPresenting ? "none" : "flex",
        gap: 8,
        alignItems: "center",
        boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
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
          fontSize: 18,
          cursor: "pointer",
          color: "rgba(255,255,255,0.85)",
          lineHeight: 1,
        }}
      >
        −
      </button>
      <span
        style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.7)",
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
          fontSize: 18,
          cursor: "pointer",
          color: "rgba(255,255,255,0.85)",
          lineHeight: 1,
        }}
      >
        +
      </button>
      <div
        style={{
          width: "1px",
          height: 16,
          background: "rgba(255,255,255,0.1)",
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
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "none",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          color: "rgba(255,255,255,0.7)",
        }}
      >
        Reset
      </button>
    </div>
  );
}
