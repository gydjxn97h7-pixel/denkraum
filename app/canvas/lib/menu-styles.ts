import type { CSSProperties, MouseEvent } from "react";

// Shared styling for context-menu rows (node + canvas menus).

export const menuItem = (danger = false): CSSProperties => ({
  padding: "9px 14px",
  cursor: "pointer",
  fontSize: 13.5,
  color: danger ? "#FF6B6B" : "#FFFFFF",
  display: "flex",
  alignItems: "center",
  gap: 10,
});

export const hoverMenu = (e: MouseEvent, on: boolean, danger = false) => {
  (e.currentTarget as HTMLElement).style.background = on
    ? danger
      ? "rgba(255,107,107,0.1)"
      : "rgba(255,255,255,0.06)"
    : "transparent";
};
