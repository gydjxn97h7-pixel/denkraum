"use client";

interface PresentationOverlaysProps {
  isPresenting: boolean;
  showPresentOverlay: boolean;
  presentationIndex: number;
  presentActiveCount: number;
}

// Presentation-mode chrome: viewport frame, entry overlay, and bottom HUD.
export function PresentationOverlays({
  isPresenting,
  showPresentOverlay,
  presentationIndex,
  presentActiveCount,
}: PresentationOverlaysProps) {
  return (
    <>
      {/* ── Presentation viewport frame ── */}
      {isPresenting && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 249,
            boxShadow:
              "inset 0 0 0 2px rgba(197,107,71,0.38), inset 0 0 28px rgba(216,201,168,0.07)",
            borderRadius: 0,
          }}
        />
      )}

      {/* ── Presentation entry overlay ── */}
      {showPresentOverlay && (
        <div
          className="present-overlay"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background:
              "linear-gradient(180deg, rgba(216,201,168,0.12) 0%, rgba(216,201,168,0) 100%), rgba(252,251,248,0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(216,201,168,0.18)",
            borderRadius: 16,
            boxShadow:
              "0 8px 24px rgba(0,0,0,0.22)",
            padding: "20px 32px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            zIndex: 350,
            userSelect: "none",
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#2A2823",
              letterSpacing: "-0.2px",
              fontFamily: "var(--font-clash), system-ui, sans-serif",
            }}
          >
            Presentation mode
          </span>
          <span
            style={{
              fontSize: 12,
              color: "rgba(42,40,35,0.5)",
              fontFamily:
                "var(--font-geist-mono), ui-monospace, monospace",
            }}
          >
            ← → navigate &nbsp;·&nbsp;{" "}
            <span style={{ color: "#C56B47" }}>Esc</span> to exit
          </span>
        </div>
      )}

      {/* ── Presentation HUD ── */}
      {isPresenting && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(252,251,248,0.92)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(42,40,35,0.1)",
            borderRadius: 12,
            padding: "8px 20px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 11,
            color: "rgba(42,40,35,0.55)",
            zIndex: 300,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <span style={{ color: "#C56B47", fontWeight: 600 }}>
            {presentationIndex + 1} / {presentActiveCount}
          </span>
          <span>← → navigate · Esc exit</span>
        </div>
      )}
    </>
  );
}
