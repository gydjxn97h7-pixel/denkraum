import type { CSSProperties, MouseEvent } from "react";

// Shared styling for context-menu rows (node + canvas menus).

export const menuItem = (danger = false): CSSProperties => ({
  padding: "8px 12px",
  cursor: "pointer",
  fontSize: 13,
  color: danger ? "#FF6B6B" : "#FFFFFF",
  display: "flex",
  alignItems: "center",
  gap: 8,
});

// Small uppercase section label inside menus / panels.
export const menuSectionLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "rgba(255,255,255,0.55)",
  padding: "8px 12px 4px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

export const hoverMenu = (e: MouseEvent, on: boolean, danger = false) => {
  (e.currentTarget as HTMLElement).style.background = on
    ? danger
      ? "rgba(255,107,107,0.1)"
      : "rgba(255,255,255,0.06)"
    : "transparent";
};
