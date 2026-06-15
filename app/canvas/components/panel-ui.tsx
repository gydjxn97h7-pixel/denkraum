"use client";
import type { ReactNode } from "react";

// Shared building blocks for sidebar-panel composition: small uppercase section
// labels (Finder "Favourites" / "Locations" style) and label-left / value-right
// status rows. Kept in one place so every panel groups content identically.

export function PanelSectionLabel({
  children,
  first,
}: {
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.4)",
        padding: "0 16px",
        marginTop: first ? 0 : 24,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

// Status row: label on the left, value/state on the right, with an optional
// colored status dot beside the value (saved/unsaved, online/offline, …).
export function StatusRow({
  label,
  value,
  dotColor,
}: {
  label: string;
  value: ReactNode;
  dotColor?: string;
}) {
  return (
    <div
      style={{
        height: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        fontSize: 12,
        color: "rgba(255,255,255,0.55)",
      }}
    >
      <span>{label}</span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "rgba(255,255,255,0.85)",
          fontWeight: 600,
        }}
      >
        {dotColor && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: dotColor,
              flexShrink: 0,
            }}
          />
        )}
        {value}
      </span>
    </div>
  );
}
