type ZoomControlsProps = {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
};

export default function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: ZoomControlsProps) {
  return (
    <>
      <div
        style={{
          position: "fixed", bottom: 24, right: 24,
          background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)",
          border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 12,
          padding: "6px 10px", display: "flex", gap: 8, alignItems: "center",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)", zIndex: 100,
        }}
      >
        <button
          onClick={onZoomOut}
          style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#555", lineHeight: 1 }}
        >
          −
        </button>
        <span style={{ fontSize: 11, color: "#999", minWidth: 38, textAlign: "center" }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={onZoomIn}
          style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#555", lineHeight: 1 }}
        >
          +
        </button>
        <div style={{ width: "0.5px", height: 16, background: "rgba(0,0,0,0.1)" }} />
        <button
          onClick={onReset}
          style={{ border: "none", background: "none", fontSize: 11, cursor: "pointer", color: "#aaa" }}
        >
          Reset
        </button>
      </div>

      <div
        style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "rgba(255,255,255,0.88)", backdropFilter: "blur(12px)",
          border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 10,
          padding: "7px 16px", fontSize: 11.5, color: "#aaa",
          letterSpacing: "-0.1px", whiteSpace: "nowrap", zIndex: 100,
        }}
      >
        Right-click → Shapes &amp; Images · Hover edge → drag to connect · Pinch / Ctrl+Scroll = Zoom
      </div>
    </>
  );
}
