"use client";
import type { CanvasNode } from "../lib/canvas-types";
import { menuItem, hoverMenu } from "../lib/menu-styles";
import {
  Copy,
  Trash2,
  Bold,
  Italic,
  Underline,
  Pipette,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  ArrowUpToLine,
  ArrowDownToLine,
  Sparkles,
} from "lucide-react";
import { ICON, ICON_PROPS, tokens } from "../lib/design-tokens";

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
  // AI: "Expand with AI" entry shows only when an API key is set.
  hasKey: boolean;
  onExpand: (id: number) => void;
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
  hasKey,
  onExpand,
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
        background: tokens.color.muted,
        borderRadius: tokens.radius.md,
        boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
        zIndex: 300,
        minWidth: 240,
        padding: "8px 0",
      }}
    >
      {/* ── Expand with AI (only when an API key is set) ── */}
      {hasKey && (
        <>
          <div
            onClick={() => {
              onExpand(menu.id);
              onClose();
            }}
            onMouseEnter={(e) => hoverMenu(e, true)}
            onMouseLeave={(e) => hoverMenu(e, false)}
            style={menuItem()}
          >
            <span
              style={{
                width: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: tokens.color.wood,
              }}
            >
              <Sparkles size={ICON.sm} {...ICON_PROPS} />
            </span>
            Expand with AI
          </div>
          <div
            style={{
              height: "1px",
              background: "rgba(42,40,35,0.10)",
              margin: "4px 0",
            }}
          />
        </>
      )}

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
        <span style={{ width: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Copy size={ICON.sm} {...ICON_PROPS} />
        </span>
        Copy
      </div>
      <div
        style={{
          height: "1px",
          background: "rgba(42,40,35,0.10)",
          margin: "4px 0",
        }}
      />
      {/* ── Text formatting ── */}
      <div style={{ padding: "8px 16px 12px" }}>
        <div
          style={{
            fontSize: 11,
            color: "rgba(42,40,35,0.5)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 8,
          }}
        >
          Text
        </div>
        {/* Font size slider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: "rgba(42,40,35,0.7)",
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
              color: "rgba(42,40,35,0.85)",
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
        <div style={{ display: "flex", gap: 4 }}>
          {(
            [
              { field: "bold", Icon: Bold },
              { field: "italic", Icon: Italic },
              { field: "underline", Icon: Underline },
            ] as {
              field: "bold" | "italic" | "underline";
              Icon: typeof Bold;
            }[]
          ).map(({ field, Icon }) => {
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
                    ? "1px solid rgba(42,40,35,0.25)"
                    : "1px solid rgba(42,40,35,0.08)",
                  borderRadius: tokens.radius.xs,
                  background: active
                    ? "rgba(42,40,35,0.12)"
                    : "transparent",
                  color: active ? "#2A2823" : "rgba(42,40,35,0.7)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.1s",
                }}
              >
                <Icon size={ICON.sm} {...ICON_PROPS} />
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
              borderRadius: tokens.radius.xs,
              background: n.textColor ?? "#2A2823",
              border: "1px solid rgba(42,40,35,0.1)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: "rgba(42,40,35,0.7)",
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              flex: 1,
            }}
          >
            {n.textColor ?? "#2A2823"}
          </span>
          <div
            onClick={() =>
              openTextColorPicker(
                menu.id,
                n.textColor ?? "#2A2823",
                menu.x,
                menu.y,
              )
            }
            style={{
              padding: "4px 12px",
              borderRadius: tokens.radius.xs,
              background: "rgba(42,40,35,0.07)",
              border: "1px solid rgba(42,40,35,0.1)",
              cursor: "pointer",
              fontSize: 12,
              color: "rgba(42,40,35,0.85)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(42,40,35,0.12)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(42,40,35,0.07)")
            }
          >
            <Pipette size={ICON.sm} {...ICON_PROPS} />
          </div>
        </div>
      </div>

      {canColor && (
        <>
          <div
            style={{
              height: "1px",
              background: "rgba(42,40,35,0.10)",
              margin: "4px 0",
            }}
          />
          <div
            style={{
              fontSize: 11,
              color: "rgba(42,40,35,0.5)",
              padding: "8px 16px 4px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Color
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px 12px",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: tokens.radius.xs,
                background: n.color,
                border: "1px solid rgba(42,40,35,0.1)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: "rgba(42,40,35,0.7)",
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                flex: 1,
              }}
            >
              {n.color}
            </span>
            <div
              onClick={() => openColorPicker(menu.id, n.color, menu.x, menu.y)}
              style={{
                padding: "4px 12px",
                borderRadius: tokens.radius.xs,
                background: "rgba(42,40,35,0.07)",
                border: "1px solid rgba(42,40,35,0.1)",
                cursor: "pointer",
                fontSize: 12,
                color: "rgba(42,40,35,0.85)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(42,40,35,0.12)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(42,40,35,0.07)")
              }
            >
              <Pipette size={ICON.sm} {...ICON_PROPS} />
            </div>
          </div>
        </>
      )}

      <div
        style={{
          height: "1px",
          background: "rgba(42,40,35,0.10)",
          margin: "4px 0",
        }}
      />
      <div
        style={{
          fontSize: 11,
          color: "rgba(42,40,35,0.55)",
          padding: "8px 16px 4px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        Arrange
      </div>
      {(
        [
          {
            label: "Bring to Front",
            Icon: ArrowUpToLine,
            action: () => arrangeBringToFront(menu.id),
          },
          {
            label: "Bring Forward",
            Icon: ArrowUp,
            action: () => arrangeBringForward(menu.id),
          },
          {
            label: "Send Backward",
            Icon: ArrowDown,
            action: () => arrangeSendBackward(menu.id),
          },
          {
            label: "Send to Back",
            Icon: ArrowDownToLine,
            action: () => arrangeSendToBack(menu.id),
          },
        ] as const
      ).map(({ label, Icon, action }) => (
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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={ICON.sm} {...ICON_PROPS} />
          </span>
          {label}
        </div>
      ))}

      <div
        style={{
          height: "1px",
          background: "rgba(42,40,35,0.10)",
          margin: "4px 0",
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
        <span style={{ width: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {n.excludeFromPresentation ? (
            <Eye size={ICON.sm} {...ICON_PROPS} />
          ) : (
            <EyeOff size={ICON.sm} {...ICON_PROPS} />
          )}
        </span>
        {n.excludeFromPresentation
          ? "Include in presentation"
          : "Exclude from presentation"}
      </div>
      <div
        style={{
          height: "1px",
          background: "rgba(42,40,35,0.10)",
          margin: "4px 0",
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
        <span style={{ width: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Trash2 size={ICON.sm} {...ICON_PROPS} />
        </span>
        Delete
      </div>
    </div>
  );
}
