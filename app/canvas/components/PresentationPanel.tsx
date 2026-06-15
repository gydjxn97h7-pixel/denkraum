"use client";
import type { CanvasNode } from "../lib/canvas-types";
import { PanelSectionLabel } from "./panel-ui";

interface PresentationPanelProps {
  presentationOrder: number[];
  nodeMap: Map<number, CanvasNode>;
  presentActiveSeqLength: number;
  toggleExcludeFromPresentation: (id: number, toExclude: boolean) => void;
  movePresentationNodeUp: (id: number) => void;
  movePresentationNodeDown: (id: number) => void;
  onPresent: () => void;
}

// ── PRESENTATION section ── (slide order list + Present button)
export function PresentationPanel({
  presentationOrder,
  nodeMap,
  presentActiveSeqLength,
  toggleExcludeFromPresentation,
  movePresentationNodeUp,
  movePresentationNodeDown,
  onPresent,
}: PresentationPanelProps) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flex: 1, overflowY: "auto", paddingTop: 16 }}>
        <PanelSectionLabel first>Slide Order</PanelSectionLabel>
        {presentationOrder.length === 0 ? (
          <div
            style={{
              padding: "8px 20px",
              fontSize: 12,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            No nodes yet
          </div>
        ) : (
          (() => {
            let activePos = 0;
            return presentationOrder.map((id, idx) => {
              const n = nodeMap.get(id);
              if (!n) return null;
              const excluded = !!n.excludeFromPresentation;
              if (!excluded) activePos += 1;
              const seqNum = excluded ? "–" : String(activePos);
              const label =
                (n.label ?? n.title).replace(/<[^>]*>/g, "").trim() ||
                "Untitled";
              const isFirst = idx === 0;
              const isLast = idx === presentationOrder.length - 1;
              return (
                <div
                  key={id}
                  style={{
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    padding: "0 8px 0 16px",
                    gap: 8,
                    opacity: excluded ? 0.45 : 1,
                  }}
                >
                  {/* Sequence number */}
                  <span
                    style={{
                      fontSize: 11,
                      color: excluded
                        ? "rgba(255,255,255,0.4)"
                        : "rgba(255,255,255,0.3)",
                      flexShrink: 0,
                      width: 16,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {seqNum}
                  </span>

                  {/* Label */}
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      color: excluded
                        ? "rgba(255,255,255,0.5)"
                        : "rgba(255,255,255,0.8)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                      textDecoration: excluded ? "line-through" : "none",
                    }}
                  >
                    {label}
                  </span>

                  {/* Exclude / include toggle */}
                  <button
                    onClick={() => toggleExcludeFromPresentation(id, !excluded)}
                    title={
                      excluded
                        ? "Include in presentation"
                        : "Exclude from presentation"
                    }
                    style={{
                      width: 22,
                      height: 22,
                      border: "none",
                      borderRadius: 8,
                      background: "transparent",
                      color: excluded
                        ? "rgba(255,255,255,0.4)"
                        : "rgba(157,200,141,0.7)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "rgba(255,255,255,0.06)";
                      (e.currentTarget as HTMLElement).style.color = excluded
                        ? "rgba(255,255,255,0.75)"
                        : "#9DC88D";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "transparent";
                      (e.currentTarget as HTMLElement).style.color = excluded
                        ? "rgba(255,255,255,0.4)"
                        : "rgba(157,200,141,0.7)";
                    }}
                  >
                    {excluded ? (
                      /* eye-off: slash through eye */
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      /* eye: visible */
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>

                  {/* Up/Down buttons */}
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => movePresentationNodeUp(id)}
                      disabled={isFirst}
                      title="Move up"
                      style={{
                        width: 22,
                        height: 22,
                        border: "none",
                        borderRadius: 8,
                        background: "transparent",
                        color: isFirst
                          ? "rgba(255,255,255,0.15)"
                          : "rgba(255,255,255,0.55)",
                        cursor: isFirst ? "default" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                      }}
                      onMouseEnter={(e) => {
                        if (!isFirst)
                          (e.currentTarget as HTMLElement).style.background =
                            "rgba(255,255,255,0.06)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background =
                          "transparent";
                      }}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                      >
                        <path
                          d="M2 7L5 3L8 7"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => movePresentationNodeDown(id)}
                      disabled={isLast}
                      title="Move down"
                      style={{
                        width: 22,
                        height: 22,
                        border: "none",
                        borderRadius: 8,
                        background: "transparent",
                        color: isLast
                          ? "rgba(255,255,255,0.15)"
                          : "rgba(255,255,255,0.55)",
                        cursor: isLast ? "default" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                      }}
                      onMouseEnter={(e) => {
                        if (!isLast)
                          (e.currentTarget as HTMLElement).style.background =
                            "rgba(255,255,255,0.06)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background =
                          "transparent";
                      }}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                      >
                        <path
                          d="M2 3L5 7L8 3"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            });
          })()
        )}
      </div>

      {/* Present button */}
      <div
        style={{
          padding: "12px 16px",
          flexShrink: 0,
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          disabled={presentActiveSeqLength === 0}
          onClick={onPresent}
          style={{
            width: "100%",
            height: 38,
            borderRadius: 12,
            border: "none",
            background:
              presentActiveSeqLength === 0
                ? "rgba(201,168,118,0.35)"
                : "#C9A876",
            color: "#0C2018",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: presentActiveSeqLength === 0 ? "default" : "pointer",
            letterSpacing: "-0.1px",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => {
            if (presentActiveSeqLength > 0)
              (e.currentTarget as HTMLElement).style.opacity = "0.88";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "1";
          }}
        >
          Present
        </button>
      </div>
    </div>
  );
}
