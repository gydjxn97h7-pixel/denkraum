"use client";
import { useState } from "react";
import {
  Square,
  Squircle,
  Circle,
  Diamond,
  Type,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import { ICON, ICON_STROKE } from "../lib/design-tokens";

// ── Toolbar helpers ───────────────────────────────────────────────────────────

// Lucide has no ellipse; this matches the Lucide grid (24 viewBox) and the same
// absolute stroke weight as the rest of the set. Used wherever the "oval" node
// type needs a glyph (toolbar, context menu, sidebar list).
export function OvalIcon({
  size = ICON.lg,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={(ICON_STROKE * 24) / size}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="12" rx="10" ry="7" />
    </svg>
  );
}

// Shape-tool glyphs from the single Lucide set. Oval has no Lucide match, so it
// keeps a custom ellipse drawn at the same absolute stroke weight as the rest.
export function renderShapeIcon(
  type: string,
  stroke: string,
  _active: boolean,
): React.ReactNode {
  const size = ICON.lg;
  const common = {
    size,
    strokeWidth: ICON_STROKE,
    absoluteStrokeWidth: true,
    color: stroke,
  } as const;
  switch (type) {
    case "block":
      return <Square {...common} />;
    case "rounded":
      return <Squircle {...common} />;
    case "circle":
      return <Circle {...common} />;
    case "oval":
      return <OvalIcon size={size} color={stroke} />;
    case "diamond":
      return <Diamond {...common} />;
    case "text":
      return <Type {...common} />;
    case "image":
      return <ImageIcon {...common} />;
    case "textfile":
      return <FileText {...common} />;
    default:
      return null;
  }
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
    ? "#C56B47"
    : hovered
      ? "rgba(42,40,35,1)"
      : "rgba(42,40,35,0.8)";
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
        background: isActive ? "rgba(197,107,71,0.06)" : "transparent",
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
