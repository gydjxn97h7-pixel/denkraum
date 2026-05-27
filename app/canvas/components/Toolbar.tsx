const ACCENT = "#C8A847";

type ConnectDrag = { fromId: number; x: number; y: number } | null;

type ToolbarProps = {
  connectDrag: ConnectDrag;
  onDeleteSelected: () => void;
  onCancelConnect: () => void;
};

export default function Toolbar({
  connectDrag,
  onDeleteSelected,
  onCancelConnect,
}: ToolbarProps) {
  return (
    <div
      style={{
        position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
        background: "rgba(255,255,255,0.94)", backdropFilter: "blur(20px)",
        border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 16,
        padding: "8px 14px", display: "flex", gap: 4, alignItems: "center",
        boxShadow: "0 2px 24px rgba(0,0,0,0.08)", zIndex: 200,
      }}
    >
      <button
        onClick={onDeleteSelected}
        style={{
          padding: "6px 13px", borderRadius: 8, border: "none", fontSize: 12.5,
          fontFamily: "inherit", cursor: "pointer", background: "transparent", color: "#c0392b",
        }}
      >
        Delete
      </button>
      <div style={{ width: "0.5px", height: 20, background: "rgba(0,0,0,0.12)", margin: "0 4px" }} />
      <div style={{ fontSize: 11, color: "#ccc" }}>
        Right-click → Shapes &amp; Options
      </div>

      {/* Live indicator while connecting */}
      {connectDrag && (
        <>
          <div style={{ width: "0.5px", height: 20, background: "rgba(0,0,0,0.12)", margin: "0 4px" }} />
          <div style={{ fontSize: 11, color: ACCENT, fontWeight: 500, letterSpacing: "-0.1px" }}>
            Connecting… drop on a shape
          </div>
          <div
            onClick={onCancelConnect}
            style={{
              fontSize: 11, color: "#aaa", cursor: "pointer",
              padding: "2px 6px", borderRadius: 5, marginLeft: 2,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.06)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            ✕ Cancel
          </div>
        </>
      )}
    </div>
  );
}
