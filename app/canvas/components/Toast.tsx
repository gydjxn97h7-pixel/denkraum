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
            ? "0.5px solid rgba(100,200,100,0.2)"
            : "0.5px solid rgba(255,100,100,0.2)",
        borderRadius: 10,
        padding: "8px 14px",
        fontSize: 12.5,
        color: toast.variant === "success" ? "#86EFAC" : "#FCA5A5",
        boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        gap: 7,
        pointerEvents: "none",
      }}
    >
      {toast.variant === "success" ? (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <circle
            cx="6.5"
            cy="6.5"
            r="6"
            stroke="#86EFAC"
            strokeWidth="1.2"
          />
          <path
            d="M3.5 6.5l2 2 4-4"
            stroke="#86EFAC"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <circle
            cx="6.5"
            cy="6.5"
            r="6"
            stroke="#FCA5A5"
            strokeWidth="1.2"
          />
          <path
            d="M6.5 4v3.5M6.5 9.2v.3"
            stroke="#FCA5A5"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      )}
      {toast.msg}
    </div>
  );
}
