"use client";
import React from "react";
import type { NodeType } from "../lib/canvas-types";
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
} from "lucide-react";
import { OvalIcon, PolygonGlyph } from "./ShapeButton";
import { ICON, ICON_PROPS, tokens } from "../lib/design-tokens";

interface SidebarNodeItemProps {
  id: number;
  type: NodeType;
  label: string;
  defaultLabelValue: string;
  isActive: boolean;
  isEditingSidebar: boolean;
  focusNode: (id: number) => void;
  updateNodeLabel: (id: number, label: string) => void;
  setEditingSidebarNodeId: (id: number | null) => void;
}

const TYPE_LABELS: Record<NodeType, string> = {
  block: "Block",
  rounded: "Area",
  circle: "Circle",
  oval: "Oval",
  diamond: "Diamond",
  triangle: "Triangle",
  star: "Star",
  arrow: "Arrow",
  parallelogram: "Parallelogram",
  sticky: "Sticky Note",
  checklist: "Checklist",
  link: "Link",
  text: "Text",
  image: "Image",
  textfile: "File",
};

// Node-type glyphs from the shared Lucide set (oval / arrow / parallelogram have
// no Lucide match and use custom glyphs in NodeIcon below).
const TYPE_ICON: Partial<Record<NodeType, typeof Square>> = {
  block: Square,
  rounded: Squircle,
  circle: Circle,
  diamond: Diamond,
  triangle: Triangle,
  star: Star,
  sticky: StickyNote,
  checklist: ListChecks,
  link: Link,
  text: Type,
  image: ImageIcon,
  textfile: FileText,
};

function NodeIcon({ type, active }: { type: NodeType; active: boolean }) {
  const color = active ? tokens.color.wood : "rgba(42,40,35,0.6)";
  if (type === "oval") return <OvalIcon size={ICON.sm} color={color} />;
  if (type === "arrow" || type === "parallelogram")
    return <PolygonGlyph type={type} size={ICON.sm} color={color} />;
  const Icon = TYPE_ICON[type] ?? Square;
  return (
    <Icon
      size={ICON.sm}
      {...ICON_PROPS}
      color={color}
      style={{ flexShrink: 0 }}
    />
  );
}

export const SidebarNodeItem = React.memo(function SidebarNodeItem({
  id,
  type,
  label,
  defaultLabelValue,
  isActive,
  isEditingSidebar,
  focusNode,
  updateNodeLabel,
  setEditingSidebarNodeId,
}: SidebarNodeItemProps) {
  return (
    <div
      onClick={() => focusNode(id)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditingSidebarNodeId(id);
      }}
      style={{
        position: "relative",
        height: 36,
        display: "flex",
        alignItems: "center",
        cursor: "pointer",
        background: isActive ? tokens.color.sand : "transparent",
        padding: "0 16px",
      }}
      onMouseEnter={(e) => {
        if (!isActive)
          (e.currentTarget as HTMLElement).style.background =
            "rgba(42,40,35,0.03)";
      }}
      onMouseLeave={(e) => {
        if (!isActive)
          (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {/* Left accent bar — only when active */}
      {isActive && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 2.5,
            height: 36,
            background: tokens.color.wood,
            borderRadius: "0 1px 1px 0",
          }}
        />
      )}

      {/* Icon */}
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        <NodeIcon type={type} active={isActive} />
      </div>

      {/* Label + type tag */}
      {isEditingSidebar ? (
        <input
          autoFocus
          defaultValue={defaultLabelValue}
          maxLength={50}
          onFocus={(e) => e.target.select()}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => {
            updateNodeLabel(id, e.target.value.trim());
            setEditingSidebarNodeId(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              updateNodeLabel(id, (e.target as HTMLInputElement).value.trim());
              setEditingSidebarNodeId(null);
            }
            if (e.key === "Escape") setEditingSidebarNodeId(null);
            e.stopPropagation();
          }}
          style={{
            flex: 1,
            marginLeft: 12,
            fontSize: 12,
            fontFamily: "var(--font-clash), system-ui, sans-serif",
            background: "rgba(42,40,35,0.07)",
            border: "none",
            outline: `1px solid ${tokens.color.driftwood}`,
            borderRadius: 8,
            padding: "0 4px",
            color: "#2A2823",
            minWidth: 0,
          }}
        />
      ) : (
        <>
          <span
            style={{
              flex: 1,
              marginLeft: 12,
              fontSize: 12,
              fontWeight: isActive ? 500 : 400,
              color: isActive ? "#2A2823" : "rgba(42,40,35,0.75)",
              fontFamily: "var(--font-clash), system-ui, sans-serif",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {label}
          </span>
          {isActive && (
            <span
              style={{
                fontSize: 10,
                color: "rgba(42,40,35,0.45)",
                flexShrink: 0,
              }}
            >
              {TYPE_LABELS[type]}
            </span>
          )}
        </>
      )}
    </div>
  );
});
