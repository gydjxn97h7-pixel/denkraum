"use client";
import type { CanvasNode } from "../lib/canvas-types";
import { menuItem, hoverMenu } from "../lib/menu-styles";

interface NodeContextMenuProps {
  menu: { x: number; y: number; id: number };
  node: CanvasNode;
  copySelected: () => void;
  updateFontSize: (id: number, size: number) => void;
  pushHistory: () => void;
  updateNodeFormat: (
    id: number,
    field: "bold" | "italic" | "underline",
    value: boolean,
  ) => void;
  openColorPicker: (
    nodeId: number,
    currentColor: string,
    screenX: number,
    screenY: number,
  ) => void;
  openTextColorPicker: (
    nodeId: number,
    currentColor: string,
    screenX: number,
    screenY: number,
  ) => void;
  arrangeBringToFront: (id: number) => void;
  arrangeBringForward: (id: number) => void;
  arrangeSendBackward: (id: number) => void;
  arrangeSendToBack: (id: number) => void;
  toggleExcludeFromPresentation: (id: number, toExclude: boolean) => void;
  deleteSelected: () => void;
  onClose: () => void;
}

// ── Node Context Menu ──
export function NodeContextMenu({
  menu,
  node: n,
  copySelected,
  updateFontSize,
  pushHistory,
  updateNodeFormat,
  openColorPicker,
  openTextColorPicker,
  arrangeBringToFront,
  arrangeBringForward,
  arrangeSendBackward,
  arrangeSendToBack,
  toggleExcludeFromPresentation,
  deleteSelected,
  onClose,
}: NodeContextMenuProps) {
  const canColor = n.type !== "text" && n.type !== "image";
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        left: menu.x,
        top: menu.y,
        background:
          "linear-gradient(180deg, rgba(157,200,141,0.04) 0%, rgba(157,200,141,0) 100%), rgba(22,64,56,0.97)",
        backdropFilter: "blur(24px)",
        border: "0.5px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        boxShadow:
          "0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 0 rgba(255,255,255,0.12)",
        zIndex: 300,
        minWidth: 240,
        padding: "6px 0",
      }}
    >
      {/* ── Copy ── */}
      <div
        onClick={() => {
          copySelected();
          onClose();
        }}
        onMouseEnter={(e) => hoverMenu(e, true)}
        onMouseLeave={(e) => hoverMenu(e, false)}
        style={menuItem()}
      >
        <span style={{ width: 22, textAlign: "center", fontSize: 14 }}>⎘</span>
        Copy
      </div>
      <div
        style={{
          height: "0.5px",
          background: "rgba(255,255,255,0.10)",
          margin: "2px 0",
        }}
      />
      {/* ── Text formatting ── */}
      <div style={{ padding: "8px 14px 10px" }}>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.5)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: 9,
          }}
        >
          Text
        </div>
        {/* Font size slider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.7)",
              flexShrink: 0,
            }}
          >
            A
          </span>
          <input
            type="range"
            className="fmt-slider"
            min={8}
            max={72}
            value={n.fontSize ?? 13}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => updateFontSize(n.id, +e.target.value)}
            onPointerUp={() => pushHistory()}
            style={{ flex: 1, cursor: "pointer", minWidth: 0 }}
          />
          <span
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.85)",
              minWidth: 20,
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
            }}
          >
            {n.fontSize ?? 13}
          </span>
        </div>
        {/* B / I / U */}
        <div style={{ display: "flex", gap: 5 }}>
          {(
            [
              { field: "bold", label: "B", style: { fontWeight: 700 } },
              {
                field: "italic",
                label: "I",
                style: { fontStyle: "italic" },
              },
              {
                field: "underline",
                label: "U",
                style: { textDecoration: "underline" },
              },
            ] as {
              field: "bold" | "italic" | "underline";
              label: string;
              style: React.CSSProperties;
            }[]
          ).map(({ field, label, style }) => {
            const active = !!n[field];
            return (
              <button
                key={field}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => updateNodeFormat(n.id, field, !active)}
                style={{
                  flex: 1,
                  height: 28,
                  border: active
                    ? "1px solid rgba(255,255,255,0.25)"
                    : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 7,
                  background: active
                    ? "rgba(255,255,255,0.12)"
                    : "transparent",
                  color: active ? "#FFFFFF" : "rgba(255,255,255,0.7)",
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontFamily: "inherit",
                  transition: "all 0.1s",
                  ...style,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        {/* Text Color */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: n.textColor ?? "#FFFFFF",
              border: "1px solid rgba(255,255,255,0.1)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.7)",
              fontFamily: "monospace",
              flex: 1,
            }}
          >
            {n.textColor ?? "#FFFFFF"}
          </span>
          <div
            onClick={() =>
              openTextColorPicker(
                menu.id,
                n.textColor ?? "#FFFFFF",
                menu.x,
                menu.y,
              )
            }
            style={{
              padding: "5px 10px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.07)",
              border: "0.5px solid rgba(255,255,255,0.08)",
              cursor: "pointer",
              fontSize: 12,
              color: "rgba(255,255,255,0.85)",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.12)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.07)")
            }
          >
            ···
          </div>
        </div>
      </div>

      {canColor && (
        <>
          <div
            style={{
              height: "0.5px",
              background: "rgba(255,255,255,0.10)",
              margin: "2px 0",
            }}
          />
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.5)",
              padding: "6px 14px 4px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Color
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px 10px",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: n.color,
                border: "1px solid rgba(255,255,255,0.1)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.7)",
                fontFamily: "monospace",
                flex: 1,
              }}
            >
              {n.color}
            </span>
            <div
              onClick={() => openColorPicker(menu.id, n.color, menu.x, menu.y)}
              style={{
                padding: "5px 10px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.07)",
                border: "0.5px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
                fontSize: 12,
                color: "rgba(255,255,255,0.85)",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.12)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.07)")
              }
            >
              ···
            </div>
          </div>
        </>
      )}

      <div
        style={{
          height: "0.5px",
          background: "rgba(255,255,255,0.10)",
          margin: "2px 0",
        }}
      />
      <div
        style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.55)",
          padding: "6px 14px 4px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Arrange
      </div>
      {(
        [
          {
            label: "Bring to Front",
            icon: "⤒",
            action: () => arrangeBringToFront(menu.id),
          },
          {
            label: "Bring Forward",
            icon: "↑",
            action: () => arrangeBringForward(menu.id),
          },
          {
            label: "Send Backward",
            icon: "↓",
            action: () => arrangeSendBackward(menu.id),
          },
          {
            label: "Send to Back",
            icon: "⤓",
            action: () => arrangeSendToBack(menu.id),
          },
        ] as const
      ).map(({ label, icon, action }) => (
        <div
          key={label}
          onClick={() => {
            action();
            onClose();
          }}
          onMouseEnter={(e) => hoverMenu(e, true)}
          onMouseLeave={(e) => hoverMenu(e, false)}
          style={menuItem()}
        >
          <span
            style={{
              width: 22,
              textAlign: "center",
              fontSize: 14,
              fontFamily: "monospace",
            }}
          >
            {icon}
          </span>
          {label}
        </div>
      ))}

      <div
        style={{
          height: "0.5px",
          background: "rgba(255,255,255,0.10)",
          margin: "2px 0",
        }}
      />
      {/* ── Exclude / Include from presentation ── */}
      <div
        onClick={() => {
          toggleExcludeFromPresentation(menu.id, !n.excludeFromPresentation);
          onClose();
        }}
        onMouseEnter={(e) => hoverMenu(e, true)}
        onMouseLeave={(e) => hoverMenu(e, false)}
        style={menuItem()}
      >
        <span style={{ width: 22, textAlign: "center", fontSize: 13 }}>
          {n.excludeFromPresentation ? "▷" : "⊘"}
        </span>
        {n.excludeFromPresentation
          ? "Include in presentation"
          : "Exclude from presentation"}
      </div>
      <div
        style={{
          height: "0.5px",
          background: "rgba(255,255,255,0.10)",
          margin: "2px 0",
        }}
      />
      <div
        onClick={() => {
          deleteSelected();
          onClose();
        }}
        onMouseEnter={(e) => hoverMenu(e, true, true)}
        onMouseLeave={(e) => hoverMenu(e, false, true)}
        style={menuItem(true)}
      >
        <span style={{ width: 22, textAlign: "center", fontSize: 14 }}>✕</span>
        Delete
      </div>
    </div>
  );
}
