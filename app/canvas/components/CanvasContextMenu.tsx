"use client";
import type { NodeType } from "../lib/canvas-types";
import { menuItem, hoverMenu } from "../lib/menu-styles";

interface CanvasContextMenuProps {
  menu: { x: number; y: number; cx: number; cy: number };
  hasCopiedNode: boolean;
  pasteNode: (cx?: number, cy?: number) => void;
  addNode: (cx: number, cy: number, type: NodeType) => void;
  handleImageInsert: (cx: number, cy: number) => void;
  handleTextFileInsert: (cx: number, cy: number) => void;
  onClose: () => void;
}

// ── Canvas Context Menu ──
export function CanvasContextMenu({
  menu,
  hasCopiedNode,
  pasteNode,
  addNode,
  handleImageInsert,
  handleTextFileInsert,
  onClose,
}: CanvasContextMenuProps) {
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
        minWidth: 220,
        padding: "6px 0",
      }}
    >
      <div
        onClick={() => {
          if (!hasCopiedNode) return;
          pasteNode(menu.cx, menu.cy);
        }}
        onMouseEnter={(e) => hoverMenu(e, true)}
        onMouseLeave={(e) => hoverMenu(e, false)}
        style={{
          ...menuItem(),
          opacity: hasCopiedNode ? 1 : 0.35,
          cursor: hasCopiedNode ? "pointer" : "default",
        }}
      >
        <span style={{ width: 22, textAlign: "center", fontSize: 14 }}>⎘</span>
        Paste
      </div>
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
        Insert
      </div>
      {(
        [
          {
            type: "block" as const,
            label: "Block",
            icon: (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect
                  x="1"
                  y="1"
                  width="11"
                  height="11"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
              </svg>
            ),
          },
          {
            type: "rounded" as const,
            label: "Area",
            icon: (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect
                  x="1"
                  y="1"
                  width="11"
                  height="11"
                  rx="5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
              </svg>
            ),
          },
          {
            type: "circle" as const,
            label: "Circle",
            icon: (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle
                  cx="6.5"
                  cy="6.5"
                  r="5.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
              </svg>
            ),
          },
          {
            type: "oval" as const,
            label: "Oval",
            icon: (
              <svg width="13" height="9" viewBox="0 0 13 9" fill="none">
                <ellipse
                  cx="6.5"
                  cy="4.5"
                  rx="5.5"
                  ry="3.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
              </svg>
            ),
          },
          {
            type: "diamond" as const,
            label: "Diamond",
            icon: (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <polygon
                  points="6.5,1 12,6.5 6.5,12 1,6.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  fill="none"
                />
              </svg>
            ),
          },
          {
            type: "text" as const,
            label: "Free Text",
            icon: (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <text
                  x="1"
                  y="11"
                  fontSize="11"
                  fill="currentColor"
                  fontFamily="serif"
                  fontWeight="bold"
                >
                  T
                </text>
              </svg>
            ),
          },
        ] as const
      ).map(({ type, label, icon }) => (
        <div
          key={type}
          onClick={() => {
            addNode(menu.cx, menu.cy, type);
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
              color: "rgba(255,255,255,0.75)",
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
      <div
        onClick={() => handleImageInsert(menu.cx, menu.cy)}
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
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <rect
              x="1"
              y="1"
              width="11"
              height="11"
              rx="2"
              stroke="rgba(255,255,255,0.75)"
              strokeWidth="1.3"
            />
            <circle
              cx="4.5"
              cy="4.5"
              r="1.2"
              fill="rgba(255,255,255,0.75)"
            />
            <path
              d="M1 9l3-3 2.5 2.5L9 6l3 4"
              stroke="rgba(255,255,255,0.75)"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        Image
      </div>
      <div
        onClick={() => {
          onClose();
          handleTextFileInsert(menu.cx, menu.cy);
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
          <svg width="11" height="13" viewBox="0 0 11 13" fill="none">
            <path
              d="M2 1h5l3 3v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"
              stroke="rgba(255,255,255,0.75)"
              strokeWidth="1.2"
            />
            <path
              d="M7 1v3h3"
              stroke="rgba(255,255,255,0.75)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        Text File
      </div>
    </div>
  );
}
