"use client";

interface ToastProps {
  toast: { msg: string; variant: "success" | "error" } | null;
}

// ── Toast ── (transient save/load feedback, bottom-left)
export function Toast({ toast }: ToastProps) {
  if (!toast) return null;
  return (
    <div
      className="toast"
      style={{
        position: "fixed",
        bottom: 28,
        left: 80,
        background:
          toast.variant === "success"
            ? "rgba(30,40,30,0.97)"
            : "rgba(40,22,22,0.97)",
        border:
          toast.variant === "success"
            ? "1px solid rgba(100,200,100,0.2)"
            : "1px solid rgba(255,100,100,0.2)",
        borderRadius: 12,
        padding: "8px 12px",
        fontSize: 12,
        fontWeight: 600,
        color: toast.variant === "success" ? "#86EFAC" : "#FCA5A5",
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
          background: toast.variant === "success" ? "#86EFAC" : "#FCA5A5",
        }}
      />
      {toast.msg}
    </div>
  );
}
