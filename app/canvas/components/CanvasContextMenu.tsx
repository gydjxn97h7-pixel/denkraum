"use client";
import type { NodeType } from "../lib/canvas-types";
import { menuItem, hoverMenu, menuSectionLabel } from "../lib/menu-styles";
import {
  Square,
  Squircle,
  Circle,
  Diamond,
  Triangle,
  Star,
  StickyNote,
  ListChecks,
  Link,
  Type,
  Image as ImageIcon,
  FileText,
  ClipboardPaste,
} from "lucide-react";
import { OvalIcon, PolygonGlyph } from "./ShapeButton";
import { ICON, ICON_PROPS } from "../lib/design-tokens";

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
          "linear-gradient(180deg, rgba(216,201,168,0.04) 0%, rgba(216,201,168,0) 100%), rgba(252,251,248,0.97)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(42,40,35,0.1)",
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
        zIndex: 300,
        minWidth: 220,
        padding: "8px 0",
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
        <span style={{ width: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ClipboardPaste size={ICON.sm} {...ICON_PROPS} />
        </span>
        Paste
      </div>
      <div
        style={{
          height: "1px",
          background: "rgba(42,40,35,0.1)",
          margin: "4px 0",
        }}
      />
      <div style={menuSectionLabel}>Insert</div>
      {(
        [
          {
            type: "block" as const,
            label: "Block",
            icon: (
              <Square size={ICON.sm} {...ICON_PROPS} />
            ),
          },
          {
            type: "rounded" as const,
            label: "Area",
            icon: (
              <Squircle size={ICON.sm} {...ICON_PROPS} />
            ),
          },
          {
            type: "circle" as const,
            label: "Circle",
            icon: (
              <Circle size={ICON.sm} {...ICON_PROPS} />
            ),
          },
          {
            type: "oval" as const,
            label: "Oval",
            icon: (
              <OvalIcon size={ICON.sm} />
            ),
          },
          {
            type: "diamond" as const,
            label: "Diamond",
            icon: (
              <Diamond size={ICON.sm} {...ICON_PROPS} />
            ),
          },
          {
            type: "triangle" as const,
            label: "Triangle",
            icon: (
              <Triangle size={ICON.sm} {...ICON_PROPS} />
            ),
          },
          {
            type: "star" as const,
            label: "Star",
            icon: (
              <Star size={ICON.sm} {...ICON_PROPS} />
            ),
          },
          {
            type: "arrow" as const,
            label: "Arrow",
            icon: <PolygonGlyph type="arrow" size={ICON.sm} />,
          },
          {
            type: "parallelogram" as const,
            label: "Parallelogram",
            icon: <PolygonGlyph type="parallelogram" size={ICON.sm} />,
          },
          {
            type: "sticky" as const,
            label: "Sticky Note",
            icon: (
              <StickyNote size={ICON.sm} {...ICON_PROPS} />
            ),
          },
          {
            type: "checklist" as const,
            label: "Checklist",
            icon: (
              <ListChecks size={ICON.sm} {...ICON_PROPS} />
            ),
          },
          {
            type: "link" as const,
            label: "Link",
            icon: (
              <Link size={ICON.sm} {...ICON_PROPS} />
            ),
          },
          {
            type: "text" as const,
            label: "Free Text",
            icon: (
              <Type size={ICON.sm} {...ICON_PROPS} />
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
              color: "rgba(42,40,35,0.75)",
            }}
          >
            {icon}
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
          <ImageIcon size={ICON.sm} {...ICON_PROPS} color="rgba(42,40,35,0.75)" />
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
          <FileText size={ICON.sm} {...ICON_PROPS} color="rgba(42,40,35,0.75)" />
        </span>
        Text File
      </div>
    </div>
  );
}
