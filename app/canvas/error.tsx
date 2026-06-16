"use client";

import { useEffect } from "react";

// Route-level error boundary for the canvas. A render/lifecycle throw anywhere
// in the canvas tree (a node, the toolbar, a menu) is caught here and shown as a
// recoverable screen instead of a blank white page. The board itself is saved in
// localStorage/IndexedDB, so a reload (or "Try again") recovers it.
export default function CanvasError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dnkrm] canvas crashed:", error);
  }, [error]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 32,
        background: "#EBE8E1",
        color: "#2A2823",
        textAlign: "center",
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-clash), system-ui, sans-serif",
          fontWeight: 600,
          fontSize: 22,
          letterSpacing: "-0.3px",
        }}
      >
        Something went wrong
      </div>
      <p
        style={{
          maxWidth: 380,
          fontSize: 13,
          lineHeight: 1.6,
          color: "rgba(42,40,35,0.6)",
          margin: 0,
        }}
      >
        The canvas hit an unexpected error. Your board is saved on this device —
        try again, or reload the page to recover it.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
        <button
          onClick={reset}
          style={{
            height: 36,
            padding: "0 18px",
            borderRadius: 999,
            border: "none",
            background: "#C56B47",
            color: "#FCFBF8",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{
            height: 36,
            padding: "0 18px",
            borderRadius: 999,
            border: "1px solid rgba(42,40,35,0.18)",
            background: "transparent",
            color: "#2A2823",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </div>
    </div>
  );
}
