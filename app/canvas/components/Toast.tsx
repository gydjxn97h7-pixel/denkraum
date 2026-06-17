"use client";
import { memo } from "react";

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
        background: "rgba(252,251,248,0.97)",
        border:
          toast.variant === "success"
            ? "1px solid rgba(124,122,78,0.35)"
            : "1px solid rgba(176,67,43,0.35)",
        borderRadius: 12,
        padding: "8px 12px",
        fontSize: 12,
        fontWeight: 600,
        color: toast.variant === "success" ? "#7C7A4E" : "#B0432B",
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
          background: toast.variant === "success" ? "#7C7A4E" : "#B0432B",
        }}
      />
      {toast.msg}
    </div>
  );
}

export const Toast = memo(ToastImpl);
