"use client";
import { memo } from "react";
import { tokens } from "../lib/design-tokens";

interface ToastProps {
  toast: { msg: string; variant: "success" | "error" } | null;
}

// ── Toast ── (transient save/load feedback, bottom-left)
function ToastImpl({ toast }: ToastProps) {
  if (!toast) return null;
  return (
    <div
      className="toast"
      style={{
        position: "fixed",
        bottom: 28,
        left: 80,
        background: tokens.color.muted,
        border:
          toast.variant === "success"
            ? `0.5px solid ${tokens.color.fern}`
            : `0.5px solid ${tokens.color.alert}`,
        borderRadius: tokens.radius.md,
        padding: "8px 12px",
        fontSize: 12,
        fontWeight: 600,
        color: toast.variant === "success" ? tokens.color.fern : tokens.color.alert,
        boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {/* Status dot + text */}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          flexShrink: 0,
          background: toast.variant === "success" ? tokens.color.fern : tokens.color.alert,
        }}
      />
      {toast.msg}
    </div>
  );
}

export const Toast = memo(ToastImpl);
