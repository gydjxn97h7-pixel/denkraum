"use client";
import React from "react";
import { ACCENT } from "../lib/canvas-types";
import type { CanvasNode, ConnectDrag } from "../lib/canvas-types";
import { parseColor } from "../lib/color-helpers";

interface NodeViewProps {
  n: CanvasNode;
  selected: number | null;
  connectDrag: ConnectDrag;
  hoveredId: number | null;
  editingNodeIdRef: React.RefObject<number | null>;
  connectDragRef: React.RefObject<ConnectDrag>;
  onNodeMouseDown: (e: React.MouseEvent, id: number) => void;
  onNodeContextMenu: (e: React.MouseEvent, id: number) => void;
  onNodeClick: (e: React.MouseEvent, id: number) => void;
  setTextFileViewer: (
    v: { nodeId: number; fileName: string; content: string } | null,
  ) => void;
  setHoveredId: React.Dispatch<React.SetStateAction<number | null>>;
  updateNodeField: (id: number, field: "title" | "body", value: string) => void;
  startNodeDrag: (e: React.MouseEvent, id: number) => void;
  onDotClick: (e: React.MouseEvent, id: number) => void;
  onResizeMouseDown: (e: React.MouseEvent, id: number) => void;
  dimmed?: boolean;
  isMultiSelected?: boolean;
}

export const NodeView = React.memo(function NodeView({
  n,
  selected,
  connectDrag,
  hoveredId,
  editingNodeIdRef,
  connectDragRef,
  onNodeMouseDown,
  onNodeContextMenu,
  onNodeClick,
  setTextFileViewer,
  setHoveredId,
  updateNodeField,
  startNodeDrag,
  onDotClick,
  onResizeMouseDown,
  dimmed,
  isMultiSelected,
}: NodeViewProps) {
  const isSel = selected === n.id;
  const isText = n.type === "text";
  const isCircle = n.type === "circle" || n.type === "oval";
  const isDiamond = n.type === "diamond";
  const isRounded = n.type === "rounded";
  const isImage = n.type === "image";
  const isTextFile = n.type === "textfile";
  const { r: _nr, g: _ng, b: _nb } = parseColor(n.color);
  const isDark = (0.299 * _nr + 0.587 * _ng + 0.114 * _nb) / 255 < 0.45;
  const fs = n.fontSize ?? 13;

  const isPotentialTarget =
    connectDrag !== null && n.id !== connectDrag.fromId && !isText;

  const hostBg = isDiamond || isText || isImage ? "transparent" : n.color;
  const hostBorder =
    isDiamond || isText || isImage
      ? "none"
      : isSel
        ? "1px solid rgba(255,255,255,0.28)"
        : "0.5px solid rgba(255,255,255,0.13)";
  const hostShadow =
    isDiamond || isText || isImage
      ? "none"
      : isPotentialTarget
        ? "0 0 0 2px rgba(255,177,98,0.35)"
        : isSel
          ? "0 4px 24px rgba(0,0,0,0.5), 0 1px 6px rgba(0,0,0,0.3)"
          : "0 2px 12px rgba(0,0,0,0.4)";
  const hostRadius = isCircle ? "50%" : isRounded ? 24 : 12;

  const showResize = (hoveredId === n.id || isSel) && !isText;
  const isSource = connectDrag?.fromId === n.id;
  const showDots =
    !isText &&
    ((hoveredId === n.id && !connectDrag) || isSource);

  return (
    <div
      key={n.id}
      data-node-id={n.id}
      onMouseDown={(e) => onNodeMouseDown(e, n.id)}
      onContextMenu={(e) => onNodeContextMenu(e, n.id)}
      onClick={(e) => {
        const wasConnecting = !!connectDragRef.current;
        onNodeClick(e, n.id);
        if (!wasConnecting && isTextFile) {
          e.stopPropagation();
          setTextFileViewer({
            nodeId: n.id,
            fileName: n.textFileName ?? n.title,
            content: n.textFileContent ?? "",
          });
        }
      }}
      onMouseEnter={() => setHoveredId(n.id)}
      onMouseLeave={() =>
        setHoveredId((prev) => (prev === n.id ? null : prev))
      }
      style={{
        position: "absolute",
        left: n.x,
        top: n.y,
        width: n.w,
        height: isText ? "auto" : n.h,
        minHeight: isText ? Math.max(32, n.h) : undefined,
        background: hostBg,
        border: hostBorder,
        borderRadius: hostRadius,
        boxShadow: hostShadow,
        padding: isText
          ? "8px 12px"
          : isCircle
            ? 0
            : isDiamond
              ? 0
              : "14px 18px",
        cursor:
          connectDrag !== null && n.id !== connectDrag.fromId
            ? "crosshair"
            : "default",
        userSelect: "none",
        outline: isSource
          ? "1.5px solid rgba(255,177,98,0.5)"
          : isMultiSelected
            ? `2px solid ${ACCENT}`
            : isText && (isSel || n.title === "")
              ? "1.5px dashed rgba(255,255,255,0.45)"
              : "none",
        opacity: dimmed ? 0.15 : 1,
        pointerEvents: dimmed ? "none" : undefined,
        transition:
          "box-shadow 0.15s ease, border-color 0.15s ease, opacity 0.2s ease",
        display: "flex",
        flexDirection: "column",
        justifyContent: isCircle || isText ? "center" : "flex-start",
        alignItems: isCircle || isText ? "center" : "flex-start",
        overflow: "visible",
        isolation: "isolate",
      }}
    >
      {/* Diamond */}
      {isDiamond && (
        <>
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              overflow: "visible",
              pointerEvents: "none",
            }}
            viewBox={`0 0 ${n.w} ${n.h}`}
            preserveAspectRatio="none"
          >
            <defs>
              <filter
                id={`ds-${n.id}`}
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feDropShadow
                  dx="0"
                  dy="1"
                  stdDeviation={isSel ? 5 : 3}
                  floodColor={
                    isSel ? "rgba(0,0,0,0.13)" : "rgba(0,0,0,0.08)"
                  }
                />
              </filter>
            </defs>
            <polygon
              points={`${n.w / 2},2 ${n.w - 2},${n.h / 2} ${n.w / 2},${n.h - 2} 2,${n.h / 2}`}
              fill={n.color}
              stroke={
                isPotentialTarget
                  ? ACCENT
                  : isSel
                    ? "rgba(255,255,255,0.25)"
                    : "rgba(255,255,255,0.12)"
              }
              strokeWidth={isPotentialTarget || isSel ? 1.5 : 0.8}
              filter={`url(#ds-${n.id})`}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1,
              padding: "0 28px",
            }}
          >
            <div
              ref={(el) => {
                if (el && editingNodeIdRef.current !== n.id)
                  el.textContent = n.title;
              }}
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Diamond"
              onMouseDown={(e) => e.stopPropagation()}
              onFocus={() => {
                editingNodeIdRef.current = n.id;
              }}
              onBlur={(e) => {
                updateNodeField(
                  n.id,
                  "title",
                  (e.target as HTMLElement).innerText,
                );
                editingNodeIdRef.current = null;
              }}
              style={{
                fontSize: fs,
                fontWeight: n.bold ? 700 : 500,
                fontStyle: n.italic ? "italic" : "normal",
                textDecoration: n.underline ? "underline" : "none",
                color: n.textColor ?? (isDark ? "#E8E6E1" : "#111"),
                outline: "none",
                textAlign: "center",
                letterSpacing: "-0.2px",
                width: "100%",
                overflowWrap: "break-word",
                wordBreak: "break-word",
                overflow: "hidden",
              }}
            />
            {n.body && (
              <div
                ref={(el) => {
                  if (el && editingNodeIdRef.current !== n.id)
                    el.textContent = n.body;
                }}
                contentEditable
                suppressContentEditableWarning
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={() => {
                  editingNodeIdRef.current = n.id;
                }}
                onBlur={(e) => {
                  updateNodeField(
                    n.id,
                    "body",
                    (e.target as HTMLElement).innerText,
                  );
                  editingNodeIdRef.current = null;
                }}
                style={{
                  fontSize: Math.max(11, fs - 2),
                  fontWeight: n.bold ? 600 : 400,
                  fontStyle: n.italic ? "italic" : "normal",
                  textDecoration: n.underline ? "underline" : "none",
                  color: n.textColor
                    ? n.textColor + "bb"
                    : isDark
                      ? "rgba(255,255,255,0.82)"
                      : "#888",
                  outline: "none",
                  textAlign: "center",
                  marginTop: 3,
                  width: "100%",
                  overflowWrap: "break-word",
                  wordBreak: "break-word",
                  overflow: "hidden",
                }}
              />
            )}
          </div>
        </>
      )}

      {/* Image */}
      {isImage && (
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
          }}
        >
          {n.imageUrl ? (
            <img
              src={n.imageUrl}
              alt=""
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                borderRadius: 12,
                pointerEvents: "none",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6B7280",
                fontSize: 13,
              }}
            >
              No Image
            </div>
          )}
          {isSel && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 12,
                border: "1.5px solid rgba(255,255,255,0.2)",
                pointerEvents: "none",
                zIndex: 5,
              }}
            />
          )}
        </div>
      )}

      {/* Text File */}
      {isTextFile && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 12px",
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            cursor: "pointer",
            pointerEvents: "none",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span
            style={{
              fontSize: fs,
              color: "rgba(255,255,255,0.82)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              letterSpacing: "-0.1px",
            }}
          >
            {n.textFileName ?? n.title}
          </span>
        </div>
      )}

      {/* Block / Rounded / Circle */}
      {!isText && !isDiamond && !isImage && !isTextFile && (
        <>
          <div
            ref={(el) => {
              if (el && editingNodeIdRef.current !== n.id)
                el.textContent = n.title;
            }}
            contentEditable
            suppressContentEditableWarning
            data-placeholder={
              n.type === "circle"
                ? "Circle"
                : n.type === "oval"
                  ? "Oval"
                  : n.type === "rounded"
                    ? "Area"
                    : "Block"
            }
            onMouseDown={(e) => e.stopPropagation()}
            onFocus={() => {
              editingNodeIdRef.current = n.id;
            }}
            onBlur={(e) => {
              updateNodeField(
                n.id,
                "title",
                (e.target as HTMLElement).innerText,
              );
              editingNodeIdRef.current = null;
            }}
            style={{
              fontSize: fs,
              fontWeight: n.bold ? 700 : 500,
              fontStyle: n.italic ? "italic" : "normal",
              textDecoration: n.underline ? "underline" : "none",
              color: n.textColor ?? (isDark ? "#E8E6E1" : "#111"),
              outline: "none",
              letterSpacing: "-0.2px",
              textAlign: isCircle ? "center" : "left",
              zIndex: 1,
              background: "transparent",
              minWidth: 40,
              overflowWrap: "break-word",
              wordBreak: "break-word",
              overflow: "hidden",
            }}
          />
          <div
            ref={(el) => {
              if (el && editingNodeIdRef.current !== n.id)
                el.textContent = n.body;
            }}
            contentEditable
            suppressContentEditableWarning
            onMouseDown={(e) => e.stopPropagation()}
            onFocus={() => {
              editingNodeIdRef.current = n.id;
            }}
            onBlur={(e) => {
              updateNodeField(
                n.id,
                "body",
                (e.target as HTMLElement).innerText,
              );
              editingNodeIdRef.current = null;
            }}
            style={{
              fontSize: Math.max(11, fs - 2),
              fontWeight: n.bold ? 600 : 400,
              fontStyle: n.italic ? "italic" : "normal",
              textDecoration: n.underline ? "underline" : "none",
              color: n.textColor
                ? n.textColor + "bb"
                : isDark
                  ? "rgba(255,255,255,0.82)"
                  : "#888",
              marginTop: 5,
              outline: "none",
              lineHeight: 1.55,
              minHeight: 16,
              zIndex: 1,
              background: "transparent",
              width: "100%",
              textAlign: isCircle ? "center" : "left",
              overflowWrap: "break-word",
              wordBreak: "break-word",
              overflow: "hidden",
            }}
          />
        </>
      )}

      {/* Free text */}
      {isText && (
        <div
          ref={(el) => {
            if (el && editingNodeIdRef.current !== n.id)
              el.textContent = n.title;
          }}
          contentEditable
          suppressContentEditableWarning
          onMouseDown={(e) => e.stopPropagation()}
          onFocus={() => {
            editingNodeIdRef.current = n.id;
          }}
          onBlur={(e) => {
            updateNodeField(
              n.id,
              "title",
              (e.target as HTMLElement).innerText,
            );
            editingNodeIdRef.current = null;
          }}
          style={{
            fontSize: fs,
            fontWeight: n.bold ? 700 : 400,
            fontStyle: n.italic ? "italic" : "normal",
            textDecoration: n.underline ? "underline" : "none",
            color: n.textColor ?? "#E8E6E1",
            outline: "none",
            textAlign: "center",
            lineHeight: 1.55,
            minHeight: 32,
            minWidth: 120,
            letterSpacing: "-0.2px",
            background: "transparent",
            width: "100%",
            overflowWrap: "break-word",
            wordBreak: "break-word",
            overflow: "visible",
          }}
        />
      )}

      {/* Move handle — text nodes only, top-left, visible on hover/select */}
      {isText && (hoveredId === n.id || isSel) && (
        <div
          data-role="move-handle"
          onMouseDown={(e) => {
            e.stopPropagation();
            startNodeDrag(e, n.id);
          }}
          style={{
            position: "absolute",
            left: -8,
            top: -8,
            width: 16,
            height: 16,
            background: "rgba(28,32,36,0.97)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 4,
            cursor: "move",
            zIndex: 20,
            boxShadow: "0 1px 6px rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            fill="none"
            style={{ pointerEvents: "none", display: "block" }}
          >
            <circle cx="2" cy="2" r="0.8" fill="rgba(255,255,255,0.55)" />
            <circle cx="4" cy="2" r="0.8" fill="rgba(255,255,255,0.55)" />
            <circle cx="6" cy="2" r="0.8" fill="rgba(255,255,255,0.55)" />
            <circle cx="2" cy="4" r="0.8" fill="rgba(255,255,255,0.55)" />
            <circle cx="4" cy="4" r="0.8" fill="rgba(255,255,255,0.55)" />
            <circle cx="6" cy="4" r="0.8" fill="rgba(255,255,255,0.55)" />
            <circle cx="2" cy="6" r="0.8" fill="rgba(255,255,255,0.55)" />
            <circle cx="4" cy="6" r="0.8" fill="rgba(255,255,255,0.55)" />
            <circle cx="6" cy="6" r="0.8" fill="rgba(255,255,255,0.55)" />
          </svg>
        </div>
      )}

      {/* Connect dots — four cardinal positions, conditional render only */}
      {showDots &&
        ([
          { key: "top",    top: -19,           left: n.w / 2 - 11 },
          { key: "bottom", top: n.h - 3,       left: n.w / 2 - 11 },
          { key: "left",   top: n.h / 2 - 11,  left: -19 },
          { key: "right",  top: n.h / 2 - 11,  left: n.w - 3 },
        ] as { key: string; top: number; left: number }[]).map(({ key, top, left }) => (
          <div
            key={key}
            data-role="connect-dot"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDotClick(e, n.id);
            }}
            style={{
              position: "absolute",
              top,
              left,
              width: 22,
              height: 22,
              cursor: "crosshair",
              pointerEvents: "all",
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              className="connect-dot-svg"
              style={{ display: "block" }}
            >
              <circle
                cx="11"
                cy="11"
                r="9"
                fill="#141618"
                stroke={
                  isSource ? "rgba(255,177,98,0.85)" : "rgba(255,177,98,0.3)"
                }
                strokeWidth={isSource ? "2" : "1.5"}
              />
              <circle
                cx="11"
                cy="11"
                r={isSource ? "6.5" : "5.5"}
                fill={isSource ? "#FFB162" : "rgba(255,177,98,0.65)"}
              />
            </svg>
          </div>
        ))}

      {/* Resize handle — outside node boundary, appears on hover */}
      {showResize && (
        <div
          data-role="resize-handle"
          onMouseDown={(e) => onResizeMouseDown(e, n.id)}
          style={{
            position: "absolute",
            right: -11,
            bottom: -11,
            width: 22,
            height: 22,
            padding: 6,
            boxSizing: "content-box",
            background: "rgba(28,32,36,0.97)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 4,
            cursor: "nwse-resize",
            zIndex: 20,
            boxShadow: "0 1px 6px rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: hoveredId === n.id || isSel ? 1 : 0,
            transition:
              "opacity 0.15s ease, box-shadow 0.15s ease, background 0.1s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 2px 10px rgba(0,0,0,0.7)";
            (e.currentTarget as HTMLElement).style.background =
              "rgba(40,46,54,0.99)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 1px 6px rgba(0,0,0,0.6)";
            (e.currentTarget as HTMLElement).style.background =
              "rgba(28,32,36,0.97)";
          }}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 8 8"
            fill="none"
            style={{ pointerEvents: "none", display: "block" }}
          >
            <line
              x1="1.5"
              y1="7"
              x2="7"
              y2="1.5"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="4.5"
              y1="7"
              x2="7"
              y2="4.5"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
});
