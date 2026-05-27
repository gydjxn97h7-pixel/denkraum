import React from "react";

type NodeType = "block" | "text" | "circle" | "diamond" | "rounded" | "image";

type CanvasNode = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  body: string;
  type: NodeType;
  color: string;
  fontSize?: number;
  imageUrl?: string;
};

type ContextMenuState =
  | { kind: "canvas"; x: number; y: number; cx: number; cy: number }
  | { kind: "node"; x: number; y: number; id: number }
  | null;

const FONT_SIZES = [11, 13, 15, 18, 22, 28, 36];

const SHAPE_ITEMS: { type: NodeType; label: string; icon: string }[] = [
  { type: "block",   label: "Block",          icon: "▭" },
  { type: "rounded", label: "Area (rounded)",  icon: "▢" },
  { type: "circle",  label: "Circle",          icon: "○" },
  { type: "diamond", label: "Diamond",         icon: "◇" },
  { type: "text",    label: "Free Text",       icon: "T" },
];

function menuItem(danger = false): React.CSSProperties {
  return {
    padding: "9px 14px", cursor: "pointer", fontSize: 13.5,
    color: danger ? "#c0392b" : "#222", display: "flex", alignItems: "center", gap: 10,
  };
}

function hoverMenu(e: React.MouseEvent, on: boolean, danger = false) {
  (e.currentTarget as HTMLElement).style.background = on
    ? danger ? "rgba(192,57,43,0.07)" : "rgba(0,0,0,0.04)"
    : "transparent";
}

type ContextMenusProps = {
  contextMenu: ContextMenuState;
  nodeMap: Map<number, CanvasNode>;
  addNode: (cx: number, cy: number, type: NodeType) => void;
  handleImageInsert: (cx: number, cy: number) => void;
  updateFontSize: (id: number, size: number) => void;
  openColorPicker: (id: number, color: string, x: number, y: number) => void;
  onDelete: () => void;
  onClose: () => void;
};

export default function ContextMenus({
  contextMenu,
  nodeMap,
  addNode,
  handleImageInsert,
  updateFontSize,
  openColorPicker,
  onDelete,
  onClose,
}: ContextMenusProps) {
  return (
    <>
      {/* ── Canvas Context Menu ── */}
      {contextMenu?.kind === "canvas" && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed", left: contextMenu.x, top: contextMenu.y,
            background: "rgba(252,251,249,0.97)", backdropFilter: "blur(24px)",
            border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 14,
            boxShadow: "0 8px 40px rgba(0,0,0,0.12)", zIndex: 300,
            minWidth: 210, padding: "6px 0",
          }}
        >
          <div style={{ fontSize: 11, color: "#bbb", padding: "6px 14px 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Insert Shape
          </div>
          {SHAPE_ITEMS.map(({ type, label, icon }) => (
            <div
              key={type}
              onClick={() => addNode(contextMenu.cx, contextMenu.cy, type)}
              onMouseEnter={(e) => hoverMenu(e, true)}
              onMouseLeave={(e) => hoverMenu(e, false)}
              style={menuItem()}
            >
              <span style={{ fontSize: 15, color: "#aaa", width: 22, textAlign: "center" }}>{icon}</span>
              {label}
            </div>
          ))}
          <div style={{ height: "0.5px", background: "rgba(0,0,0,0.07)", margin: "4px 0" }} />
          <div
            onClick={() => handleImageInsert(contextMenu.cx, contextMenu.cy)}
            onMouseEnter={(e) => hoverMenu(e, true)}
            onMouseLeave={(e) => hoverMenu(e, false)}
            style={menuItem()}
          >
            <span style={{ fontSize: 15, width: 22, textAlign: "center" }}>🖼</span>
            Insert Image
          </div>
        </div>
      )}

      {/* ── Node Context Menu ── */}
      {contextMenu?.kind === "node" && (() => {
        const n = nodeMap.get(contextMenu.id);
        if (!n) return null;
        const canColor = n.type !== "text" && n.type !== "image";
        return (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed", left: contextMenu.x, top: contextMenu.y,
              background: "rgba(252,251,249,0.97)", backdropFilter: "blur(24px)",
              border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 14,
              boxShadow: "0 8px 40px rgba(0,0,0,0.12)", zIndex: 300,
              minWidth: 240, padding: "6px 0",
            }}
          >
            <div style={{ fontSize: 11, color: "#bbb", padding: "6px 14px 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Font Size</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "4px 14px 10px" }}>
              {FONT_SIZES.map((size) => (
                <div
                  key={size}
                  onClick={() => updateFontSize(contextMenu.id, size)}
                  style={{
                    width: 34, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 500,
                    background: n.fontSize === size ? "#222" : "rgba(0,0,0,0.05)",
                    color: n.fontSize === size ? "#fff" : "#444", transition: "all 0.12s",
                  }}
                >
                  {size}
                </div>
              ))}
            </div>

            {canColor && (
              <>
                <div style={{ height: "0.5px", background: "rgba(0,0,0,0.07)", margin: "2px 0" }} />
                <div style={{ fontSize: 11, color: "#bbb", padding: "6px 14px 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Color</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px 10px" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: n.color, border: "1px solid rgba(0,0,0,0.12)", flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "#aaa", fontFamily: "monospace", flex: 1 }}>{n.color}</span>
                  <div
                    onClick={() => openColorPicker(contextMenu.id, n.color, contextMenu.x, contextMenu.y)}
                    style={{ padding: "5px 10px", borderRadius: 8, background: "rgba(0,0,0,0.05)", border: "0.5px solid rgba(0,0,0,0.1)", cursor: "pointer", fontSize: 12, color: "#555", display: "flex", alignItems: "center", gap: 5 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.09)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.05)"; }}
                  >
                    ···
                  </div>
                </div>
              </>
            )}

            <div style={{ height: "0.5px", background: "rgba(0,0,0,0.07)", margin: "2px 0" }} />
            <div
              onClick={onDelete}
              onMouseEnter={(e) => hoverMenu(e, true, true)}
              onMouseLeave={(e) => hoverMenu(e, false, true)}
              style={menuItem(true)}
            >
              <span style={{ width: 22, textAlign: "center", fontSize: 14 }}>✕</span>
              Delete
            </div>
          </div>
        );
      })()}
    </>
  );
}
