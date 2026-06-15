"use client";
import { useState } from "react";

// ── Toolbar helpers ───────────────────────────────────────────────────────────

export function renderShapeIcon(
  type: string,
  stroke: string,
  active: boolean,
): React.ReactNode {
  const fid = active ? "gShapeA" : "gShapeN";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20">
      {type === "block" && (
        <>
          <rect
            x="1"
            y="1"
            width="18"
            height="18"
            rx="1.5"
            fill={`url(#${fid})`}
            stroke={stroke}
            strokeWidth="2"
          />
          <rect
            x="2"
            y="2"
            width="16"
            height="4"
            rx="1"
            fill="rgba(255,255,255,0.07)"
          />
        </>
      )}
      {type === "rounded" && (
        <>
          <rect
            x="1"
            y="1"
            width="18"
            height="18"
            rx="6"
            fill={`url(#${fid})`}
            stroke={stroke}
            strokeWidth="2"
          />
          <rect
            x="2"
            y="2"
            width="16"
            height="4"
            rx="2"
            fill="rgba(255,255,255,0.07)"
          />
        </>
      )}
      {type === "circle" && (
        <>
          <circle
            cx="10"
            cy="10"
            r="9"
            fill={`url(#${fid})`}
            stroke={stroke}
            strokeWidth="2"
          />
          <ellipse
            cx="7"
            cy="6"
            rx="4"
            ry="2.5"
            fill="rgba(255,255,255,0.07)"
          />
        </>
      )}
      {type === "oval" && (
        <>
          <ellipse
            cx="10"
            cy="10"
            rx="9"
            ry="6"
            fill={`url(#${fid})`}
            stroke={stroke}
            strokeWidth="2"
          />
          <ellipse cx="7" cy="7" rx="4" ry="2" fill="rgba(255,255,255,0.07)" />
        </>
      )}
      {type === "diamond" && (
        <>
          <polygon
            points="10,1 19,10 10,19 1,10"
            fill={`url(#${fid})`}
            stroke={stroke}
            strokeWidth="2"
            strokeLinejoin="miter"
          />
          <polygon
            points="10,1 19,10 10,10 1,10"
            fill="rgba(255,255,255,0.05)"
            stroke="none"
          />
          <line
            x1="10"
            y1="1"
            x2="10"
            y2="19"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="0.8"
          />
        </>
      )}
      {type === "text" && (
        <>
          <rect
            x="1"
            y="1"
            width="18"
            height="18"
            rx="1.5"
            fill={`url(#${fid})`}
            stroke={stroke}
            strokeWidth="2"
          />
          <rect
            x="3"
            y="5"
            width="14"
            height="3.5"
            rx="0.5"
            fill="rgba(255,255,255,0.82)"
          />
          <rect
            x="8.5"
            y="5"
            width="3"
            height="11"
            rx="0.5"
            fill="rgba(255,255,255,0.82)"
          />
        </>
      )}
      {type === "image" && (
        <>
          <rect
            x="1"
            y="1"
            width="18"
            height="18"
            rx="1.5"
            fill={`url(#${fid})`}
            stroke={stroke}
            strokeWidth="2"
          />
          <circle cx="5.5" cy="5.5" r="2.5" fill="rgba(255,255,255,0.55)" />
          <polyline
            points="1,14 6,9 10,13 14,8 19,14"
            fill="none"
            stroke="rgba(255,255,255,0.8)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {type === "textfile" && (
        <>
          <path
            d="M3 1 L13 1 L19 7 L19 19 L3 19 Z"
            fill={`url(#${fid})`}
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
          <rect
            x="6"
            y="10"
            width="9"
            height="2"
            rx="1"
            fill="rgba(255,255,255,0.55)"
          />
          <rect
            x="6"
            y="14"
            width="7"
            height="2"
            rx="1"
            fill="rgba(255,255,255,0.35)"
          />
        </>
      )}
    </svg>
  );
}

export function ShapeButton({
  label,
  isActive,
  onClick,
  children,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
  children: (stroke: string, isActive: boolean) => React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const stroke = isActive
    ? "#8E6F3F"
    : hovered
      ? "rgba(255,255,255,1)"
      : "rgba(255,255,255,0.8)";
  return (
    <button
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 36,
        height: 36,
        border: "none",
        background: isActive ? "rgba(201,168,118,0.06)" : "transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        padding: 0,
        transition: "background 0.12s",
      }}
    >
      {children(stroke, isActive)}
    </button>
  );
}
