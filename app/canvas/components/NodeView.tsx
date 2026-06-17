"use client";
import React, { useState, useEffect, useCallback } from "react";
import { ACCENT } from "../lib/canvas-types";
import { NODE_SHADOW, ICON, ICON_PROPS } from "../lib/design-tokens";
import { FileText, Grip } from "lucide-react";
import type { CanvasNode, ConnectDrag, RichText } from "../lib/canvas-types";
import { setEditableContent, editableRichText } from "../lib/rich-text";

interface NodeViewProps {
  n: CanvasNode;
  // Pre-computed per-node state (instead of the global selected/hovered/connect
  // scalars) so React.memo holds for every node a change doesn't actually touch —
  // hovering or selecting one node no longer re-renders the whole board.
  isSelected: boolean;
  isHovered: boolean;
  isConnectSource: boolean; // this node is the source of an in-progress connect
  connecting: boolean; // a connect drag is in progress (any source)
  editingNodeIdRef: React.RefObject<number | null>;
  connectDragRef: React.RefObject<ConnectDrag>;
  onNodeMouseDown: (e: React.MouseEvent, id: number) => void;
  onNodeContextMenu: (e: React.MouseEvent, id: number) => void;
  onNodeClick: (e: React.MouseEvent, id: number) => void;
  onOpenDocument: (nodeId: number) => void;
  setHoveredId: React.Dispatch<React.SetStateAction<number | null>>;
  commitNodeText: (id: number, field: "title" | "body", rich: RichText) => void;
  startNodeDrag: (e: React.MouseEvent, id: number) => void;
  onDotClick: (e: React.MouseEvent, id: number) => void;
  onResizeMouseDown: (e: React.MouseEvent, id: number) => void;
  dimmed?: boolean;
  isMultiSelected?: boolean;
  // This is the presentation-focused node — give it the "on stage" elevation.
  onStage?: boolean;
  zoom: number;
}

export const NodeView = React.memo(function NodeView({
  n,
  isSelected,
  isHovered,
  isConnectSource,
  connecting,
  editingNodeIdRef,
  connectDragRef,
  onNodeMouseDown,
  onNodeContextMenu,
  onNodeClick,
  onOpenDocument,
  setHoveredId,
  commitNodeText,
  startNodeDrag,
  onDotClick,
  onResizeMouseDown,
  dimmed,
  isMultiSelected,
  onStage,
  zoom,
}: NodeViewProps) {
  const isSel = isSelected;
  const isText = n.type === "text";
  const isCircle = n.type === "circle" || n.type === "oval";
  const isDiamond = n.type === "diamond";
  const isRounded = n.type === "rounded";
  const isImage = n.type === "image";
  const isTextFile = n.type === "textfile";
  const fs = n.fontSize ?? 13;

  const [isEditing, setIsEditing] = useState(false);

  // Paste as plain text — node text is plain state, so pasted HTML would only
  // be flattened lossily at blur time anyway.
  const onEditablePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    document.execCommand(
      "insertText",
      false,
      e.clipboardData.getData("text/plain"),
    );
  };

  useEffect(() => {
    if (!isText && editingNodeIdRef.current === n.id) setIsEditing(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stable contenteditable ref callbacks. Inline `ref={(el) => …}` get a fresh
  // identity every render, so React detach/re-attaches them and re-runs the DOM
  // sync on EVERY render. Keying these to the content fields means the DOM is
  // only re-written when the content actually changes (or on mount) — not on
  // every hover/select re-render. editingNodeIdRef is stable (a ref).
  const titleRef = useCallback(
    (el: HTMLElement | null) => {
      if (el && editingNodeIdRef.current !== n.id)
        setEditableContent(el, n.titleRich, n.title);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n.id, n.titleRich, n.title],
  );
  const bodyRef = useCallback(
    (el: HTMLElement | null) => {
      if (el && editingNodeIdRef.current !== n.id)
        setEditableContent(el, n.bodyRich, n.body);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n.id, n.bodyRich, n.body],
  );

  const isPotentialTarget = connecting && !isConnectSource && !isText;

  const hostBg = isDiamond || isText || isImage ? "transparent" : "#FCFBF8";
  // Borderless cards — the soft drop shadow does the separation now.
  const hostBorder = "none";
  // Elevation by state: selected/dragged sits highest, hover lifts slightly.
  const elevation = isSel
    ? NODE_SHADOW.active
    : isHovered
      ? NODE_SHADOW.hover
      : NODE_SHADOW.rest;
  // Diamond casts its shadow via an SVG filter; text floats via a glyph
  // drop-shadow (see below) — neither uses a box shadow on the host.
  const hostShadow =
    isDiamond || isText
      ? "none"
      : onStage
        ? NODE_SHADOW.stage
        : isPotentialTarget
          ? `0 0 0 2px rgba(197,107,71,0.5), ${elevation}`
          : elevation;
  const hostRadius = isCircle ? "50%" : isRounded ? 16 : 12;

  const showResize = (isHovered || isSel) && !isText;
  const isSource = isConnectSource;
  const showDots = !isText && ((isHovered && !connecting) || isSource);

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
          onOpenDocument(n.id);
        }
      }}
      onDoubleClick={(e) => {
        if (isText) return;
        const t = e.target as HTMLElement;
        if (t.dataset.role === "connect-dot") return;
        if (t.dataset.role === "resize-handle") return;
        if (t.dataset.role === "move-handle") return;
        e.stopPropagation();
        editingNodeIdRef.current = n.id;
        setIsEditing(true);
        setTimeout(() => {
          const el = document.querySelector<HTMLElement>(
            `[data-node-id="${n.id}"] [contenteditable="true"]`,
          );
          if (!el) return;
          el.focus();
          const range = document.createRange();
          const sel = window.getSelection();
          if (sel) {
            range.selectNodeContents(el);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }, 0);
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
              : "12px 16px",
        cursor:
          connecting && !isConnectSource ? "crosshair" : "default",
        userSelect: "none",
        outline: isSource
          ? "1.5px solid rgba(197,107,71,0.6)"
          : isMultiSelected
            ? `2px solid ${ACCENT}`
            : isEditing
              ? "1.5px solid rgba(42,40,35,0.18)"
              : isText && (isSel || n.title === "")
                ? "1.5px dashed rgba(176,121,94,0.5)"
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
                x="-90%"
                y="-90%"
                width="280%"
                height="280%"
              >
                <feDropShadow
                  dx="0"
                  dy={isSel ? 9 : 4}
                  stdDeviation={isSel ? 17 : 10}
                  floodColor="rgb(58,48,38)"
                  floodOpacity={isSel ? 0.28 : 0.18}
                />
              </filter>
            </defs>
            <polygon
              points={`${n.w / 2},2 ${n.w - 2},${n.h / 2} ${n.w / 2},${n.h - 2} 2,${n.h / 2}`}
              fill="#FCFBF8"
              stroke={
                isPotentialTarget
                  ? ACCENT
                  : isSel
                    ? "rgba(197,107,71,0.55)"
                    : "rgba(124,122,78,0.4)"
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
              ref={titleRef}
              contentEditable={isEditing}
              suppressContentEditableWarning
              data-placeholder="Diamond"
              onMouseDown={(e) => e.stopPropagation()}
              onPaste={onEditablePaste}
              onFocus={() => {
                editingNodeIdRef.current = n.id;
              }}
              onBlur={(e) => {
                commitNodeText(
                  n.id,
                  "title",
                  editableRichText(e.target as HTMLElement),
                );
                editingNodeIdRef.current = null;
                setIsEditing(false);
              }}
              style={{
                fontSize: fs,
                fontWeight: n.bold ? 700 : 500,
                fontStyle: n.italic ? "italic" : "normal",
                textDecoration: n.underline ? "underline" : "none",
                color: n.textColor ?? "#2A2823",
                fontFamily: "var(--font-clash), system-ui, sans-serif",
                outline: "none",
                textAlign: "center",
                letterSpacing: "-0.2px",
                width: "100%",
                whiteSpace: "pre-wrap",
                overflowWrap: "break-word",
                wordBreak: "break-word",
                overflow: "hidden",
                pointerEvents: isEditing ? "auto" : "none",
                cursor: isEditing ? "text" : "default",
              }}
            />
            {n.body && (
              <div
                ref={bodyRef}
                contentEditable={isEditing}
                suppressContentEditableWarning
                onMouseDown={(e) => e.stopPropagation()}
                onPaste={onEditablePaste}
                onFocus={() => {
                  editingNodeIdRef.current = n.id;
                }}
                onBlur={(e) => {
                  commitNodeText(
                    n.id,
                    "body",
                    editableRichText(e.target as HTMLElement),
                  );
                  editingNodeIdRef.current = null;
                  setIsEditing(false);
                }}
                style={{
                  fontSize: Math.max(11, fs - 2),
                  fontWeight: n.bold ? 600 : 400,
                  fontStyle: n.italic ? "italic" : "normal",
                  textDecoration: n.underline ? "underline" : "none",
                  color: n.textColor
                    ? n.textColor + "bb"
                    : "rgba(42,40,35,0.55)",
                  outline: "none",
                  textAlign: "center",
                  marginTop: 4,
                  width: "100%",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "break-word",
                  wordBreak: "break-word",
                  overflow: "hidden",
                  pointerEvents: isEditing ? "auto" : "none",
                  cursor: isEditing ? "text" : "default",
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
                color: "rgba(42,40,35,0.4)",
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
                border: "1.5px solid rgba(197,107,71,0.5)",
                pointerEvents: "none",
                zIndex: 5,
              }}
            />
          )}
        </div>
      )}

      {/* Document (textfile) — title + short preview, never the full content */}
      {isTextFile && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "12px 16px",
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            cursor: "pointer",
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
              flexShrink: 0,
            }}
          >
            <FileText
              size={ICON.sm}
              {...ICON_PROPS}
              color="rgba(42,40,35,0.4)"
              style={{ flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: fs,
                fontWeight: 600,
                color: "#2A2823",
                fontFamily: "var(--font-clash), system-ui, sans-serif",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
                letterSpacing: "-0.1px",
              }}
            >
              {n.title.trim() || n.textFileName || "Untitled document"}
            </span>
          </div>
          {(n.textFileContent ?? "").trim() !== "" && (
            <div
              style={{
                fontSize: Math.max(10, fs - 3),
                lineHeight: 1.5,
                color: "rgba(42,40,35,0.55)",
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflowWrap: "break-word",
                wordBreak: "break-word",
              }}
            >
              {(n.textFileContent ?? "").slice(0, 240)}
            </div>
          )}
        </div>
      )}

      {/* Block / Rounded / Circle */}
      {!isText && !isDiamond && !isImage && !isTextFile && (
        <>
          <div
            ref={titleRef}
            contentEditable={isEditing}
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
            onPaste={onEditablePaste}
            onFocus={() => {
              editingNodeIdRef.current = n.id;
            }}
            onBlur={(e) => {
              commitNodeText(
                n.id,
                "title",
                editableRichText(e.target as HTMLElement),
              );
              editingNodeIdRef.current = null;
              setIsEditing(false);
            }}
            style={{
              fontSize: fs,
              fontWeight: n.bold ? 700 : 500,
              fontStyle: n.italic ? "italic" : "normal",
              textDecoration: n.underline ? "underline" : "none",
              color: n.textColor ?? "#2A2823",
              fontFamily: "var(--font-clash), system-ui, sans-serif",
              outline: "none",
              letterSpacing: "-0.2px",
              textAlign: isCircle ? "center" : "left",
              zIndex: 1,
              background: "transparent",
              minWidth: 40,
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
              wordBreak: "break-word",
              overflow: "hidden",
              pointerEvents: isEditing ? "auto" : "none",
              cursor: isEditing ? "text" : "default",
            }}
          />
          <div
            ref={bodyRef}
            contentEditable={isEditing}
            suppressContentEditableWarning
            onMouseDown={(e) => e.stopPropagation()}
            onPaste={onEditablePaste}
            onFocus={() => {
              editingNodeIdRef.current = n.id;
            }}
            onBlur={(e) => {
              commitNodeText(
                n.id,
                "body",
                editableRichText(e.target as HTMLElement),
              );
              editingNodeIdRef.current = null;
              setIsEditing(false);
            }}
            style={{
              fontSize: Math.max(11, fs - 2),
              fontWeight: n.bold ? 600 : 400,
              fontStyle: n.italic ? "italic" : "normal",
              textDecoration: n.underline ? "underline" : "none",
              color: n.textColor
                ? n.textColor + "bb"
                : "rgba(42,40,35,0.55)",
              marginTop: 4,
              outline: "none",
              lineHeight: 1.55,
              minHeight: 16,
              zIndex: 1,
              background: "transparent",
              width: "100%",
              textAlign: isCircle ? "center" : "left",
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
              wordBreak: "break-word",
              overflow: "hidden",
              pointerEvents: isEditing ? "auto" : "none",
              cursor: isEditing ? "text" : "default",
            }}
          />
        </>
      )}

      {/* Free text */}
      {isText && (
        <div
          ref={titleRef}
          contentEditable
          suppressContentEditableWarning
          onMouseDown={(e) => e.stopPropagation()}
          onPaste={onEditablePaste}
          onFocus={() => {
            editingNodeIdRef.current = n.id;
          }}
          onBlur={(e) => {
            commitNodeText(
              n.id,
              "title",
              editableRichText(e.target as HTMLElement),
            );
            editingNodeIdRef.current = null;
          }}
          style={{
            fontSize: fs,
            fontWeight: n.bold ? 700 : 400,
            fontStyle: n.italic ? "italic" : "normal",
            textDecoration: n.underline ? "underline" : "none",
            color: n.textColor ?? "#2A2823",
            fontFamily: "var(--font-clash), system-ui, sans-serif",
            outline: "none",
            textAlign: "center",
            lineHeight: 1.55,
            minHeight: 32,
            minWidth: 120,
            letterSpacing: "-0.2px",
            background: "transparent",
            width: "100%",
            whiteSpace: "pre-wrap",
            overflowWrap: "break-word",
            wordBreak: "break-word",
            overflow: "visible",
            // Free text has no card — a soft glyph drop-shadow gives it the same
            // lifted feel as the floating card nodes.
            filter: isSel
              ? "drop-shadow(0 3px 9px rgba(58,48,38,0.30))"
              : "drop-shadow(0 2px 6px rgba(58,48,38,0.22))",
          }}
        />
      )}

      {/* Move handle — text nodes only, top-left, visible on hover/select */}
      {isText && (isHovered || isSel) && (
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
            background: "rgba(42,40,35,0.95)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 4,
            cursor: "move",
            zIndex: 20,
            boxShadow: "0 1px 6px rgba(58,48,38,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Grip
            size={12}
            {...ICON_PROPS}
            color="rgba(255,255,255,0.55)"
            style={{ pointerEvents: "none" }}
          />
        </div>
      )}

      {/* Connect dots — constant screen size regardless of zoom.
          All canvas-unit values are divided by zoom so that after
          the canvas scale(zoom) transform the net on-screen size
          stays fixed. Hit container is 40 screen px; visual dot is 22 screen px. */}
      {showDots && (() => {
        const z = zoom;
        // Screen-pixel constants
        const HIT  = 40;   // hit-area diameter (screen px)
        const VIS  = 22;   // visible dot diameter (screen px)
        const EDGE = 8;    // dot-center distance from node edge (screen px)
        const hh = HIT / 2 / z;  // hit half-size in canvas units
        const vh = VIS / 2 / z;  // vis half-size in canvas units
        const eg = EDGE / z;     // edge gap in canvas units
        return ([
          { key: "top",    top: -(eg + hh),       left: n.w / 2 - hh },
          { key: "bottom", top: n.h + eg - hh,    left: n.w / 2 - hh },
          { key: "left",   top: n.h / 2 - hh,    left: -(eg + hh) },
          { key: "right",  top: n.h / 2 - hh,    left: n.w + eg - hh },
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
              width: HIT / z,
              height: HIT / z,
              cursor: "crosshair",
              pointerEvents: "all",
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width={VIS / z}
              height={VIS / z}
              viewBox="0 0 22 22"
              className="connect-dot-svg"
              style={{ display: "block", flexShrink: 0 }}
            >
              <circle
                cx="11"
                cy="11"
                r="9"
                fill="#FCFBF8"
                stroke={
                  isSource ? "#C56B47" : "rgba(176,121,94,0.6)"
                }
                strokeWidth={isSource ? "2" : "1.5"}
              />
              <circle
                cx="11"
                cy="11"
                r={isSource ? "6.5" : "5.5"}
                fill={isSource ? "#C56B47" : "rgba(176,121,94,0.7)"}
              />
            </svg>
          </div>
        ));
      })()}

      {/* Resize handle — constant screen size, same technique as connect-dots.
          All canvas-unit values divided by zoom; after scale(zoom) the net
          on-screen sizes are identical to zoom=1. */}
      {showResize && (
        <div
          data-role="resize-handle"
          onMouseDown={(e) => onResizeMouseDown(e, n.id)}
          style={{
            position: "absolute",
            right: -11 / zoom,
            bottom: -11 / zoom,
            width: 22 / zoom,
            height: 22 / zoom,
            padding: 8 / zoom,
            boxSizing: "content-box",
            background: "rgba(42,40,35,0.95)",
            border: `${1 / zoom}px solid rgba(252,251,248,0.18)`,
            borderRadius: 4 / zoom,
            cursor: "nwse-resize",
            zIndex: 20,
            boxShadow: `0 ${1 / zoom}px ${6 / zoom}px rgba(58,48,38,0.4)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: isHovered || isSel ? 1 : 0,
            transition:
              "opacity 0.15s ease, box-shadow 0.15s ease, background 0.1s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow =
              `0 ${2 / zoom}px ${10 / zoom}px rgba(58,48,38,0.5)`;
            (e.currentTarget as HTMLElement).style.background =
              "rgba(58,52,44,0.98)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow =
              `0 ${1 / zoom}px ${6 / zoom}px rgba(58,48,38,0.4)`;
            (e.currentTarget as HTMLElement).style.background =
              "rgba(28,32,36,0.97)";
          }}
        >
          <svg
            width={11 / zoom}
            height={11 / zoom}
            viewBox="0 0 8 8"
            fill="none"
            style={{ pointerEvents: "none", display: "block", flexShrink: 0 }}
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
