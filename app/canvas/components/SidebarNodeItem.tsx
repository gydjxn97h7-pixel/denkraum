"use client";
import React from "react";
import type { NodeType } from "../lib/canvas-types";

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
  text: "Text",
  image: "Image",
  textfile: "File",
};

// Gradient IDs are defined once in page.tsx above the node list
const GRAD: Record<NodeType, string> = {
  block: "iconGradBlock",
  rounded: "iconGradRounded",
  circle: "iconGradCircle",
  oval: "iconGradOval",
  diamond: "iconGradDiamond",
  text: "iconGradText",
  image: "iconGradImage",
  textfile: "iconGradTextfile",
};

function NodeIcon({ type, active }: { type: NodeType; active: boolean }) {
  const gid = GRAD[type];
  const fill = `url(#${gid})`;
  const stroke = active ? "rgba(241,178,74,0.65)" : "rgba(255,255,255,0.6)";
  const sw = 1.7;

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ flexShrink: 0, display: "block" }}
    >
      {type === "block" && (
        <>
          <rect x="1" y="1" width="14" height="14" rx="1.5" fill={fill} stroke={stroke} strokeWidth={sw} />
          <rect x="1.5" y="1.5" width="13" height="3.5" rx="0.5" fill="rgba(255,255,255,0.07)" />
        </>
      )}
      {type === "rounded" && (
        <>
          <rect x="1" y="1" width="14" height="14" rx="5" fill={fill} stroke={stroke} strokeWidth={sw} />
          <rect x="1.5" y="1.5" width="13" height="3.5" rx="0.5" fill="rgba(255,255,255,0.07)" />
        </>
      )}
      {type === "circle" && (
        <>
          <circle cx="8" cy="8" r="7" fill={fill} stroke={stroke} strokeWidth={sw} />
          <ellipse cx="5.5" cy="5" rx="3" ry="1.8" fill="rgba(255,255,255,0.07)" />
        </>
      )}
      {type === "oval" && (
        <>
          <ellipse cx="8" cy="8" rx="7" ry="4.5" fill={fill} stroke={stroke} strokeWidth={sw} />
          <ellipse cx="5.5" cy="6" rx="3" ry="1.5" fill="rgba(255,255,255,0.06)" />
        </>
      )}
      {type === "diamond" && (
        <>
          <polygon
            points="8,1 15,8 8,15 1,8"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="miter"
          />
          <polygon points="8,1 15,8 8,8 1,8" fill="rgba(255,255,255,0.04)" stroke="none" />
        </>
      )}
      {type === "text" && (
        <>
          <rect x="1" y="1" width="14" height="14" rx="1.5" fill={fill} stroke={stroke} strokeWidth={sw} />
          <rect x="3" y="4" width="10" height="3" rx="0.4" fill="rgba(255,255,255,0.75)" />
          <rect x="6.5" y="4" width="3" height="8" rx="0.4" fill="rgba(255,255,255,0.75)" />
        </>
      )}
      {type === "image" && (
        <>
          <rect x="1" y="1" width="14" height="14" rx="1.5" fill={fill} stroke={stroke} strokeWidth={sw} />
          <circle cx="4.5" cy="4.5" r="2" fill="rgba(255,255,255,0.55)" />
          <polyline
            points="1,11 5,7 8,10 11,6 15,11"
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {type === "textfile" && (
        <>
          <path
            d="M2 1 L10 1 L14 5 L14 15 L2 15 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          <path d="M10 1 L10 5 L14 5" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          <rect x="4" y="8" width="7" height="1.8" rx="0.8" fill="rgba(255,255,255,0.5)" />
          <rect x="4" y="11" width="5" height="1.8" rx="0.8" fill="rgba(255,255,255,0.32)" />
        </>
      )}
    </svg>
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
        background: isActive
          ? "linear-gradient(to right, rgba(241,178,74,0.07), transparent)"
          : "transparent",
        padding: "0 16px",
      }}
      onMouseEnter={(e) => {
        if (!isActive)
          (e.currentTarget as HTMLElement).style.background =
            "rgba(255,255,255,0.03)";
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
            background: "#F1B24A",
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
            marginLeft: 10,
            fontSize: 12.5,
            fontFamily: "inherit",
            background: "rgba(255,255,255,0.07)",
            border: "none",
            outline: "1px solid rgba(241,178,74,0.4)",
            borderRadius: 5,
            padding: "1px 5px",
            color: "#FFFFFF",
            minWidth: 0,
          }}
        />
      ) : (
        <>
          <span
            style={{
              flex: 1,
              marginLeft: 10,
              fontSize: 12.5,
              fontWeight: isActive ? 500 : 400,
              color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.75)",
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
                color: "rgba(255,255,255,0.45)",
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
