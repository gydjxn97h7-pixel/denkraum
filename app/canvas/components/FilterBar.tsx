"use client";
import { ACCENT } from "../lib/canvas-types";
import type { NodeType } from "../lib/canvas-types";

interface FilterBarProps {
  filterInputRef: React.RefObject<HTMLInputElement | null>;
  filterText: string;
  setFilterText: React.Dispatch<React.SetStateAction<string>>;
  filterType: NodeType | "all";
  setFilterType: React.Dispatch<React.SetStateAction<NodeType | "all">>;
  setFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  filterActive: boolean;
  matchCount: number;
  nodeCount: number;
}

// ── Filter Bar ── (search input + node-type chips; shown while filter is open)
export function FilterBar({
  filterInputRef,
  filterText,
  setFilterText,
  filterType,
  setFilterType,
  setFilterOpen,
  filterActive,
  matchCount,
  nodeCount,
}: FilterBarProps) {
  return (
    <div
      style={{
        position: "fixed",
        top: 68,
        left: "50%",
        transform: "translateX(-50%)",
        background:
          "linear-gradient(180deg, rgba(157,200,141,0.04) 0%, rgba(157,200,141,0) 100%), rgba(22,64,56,0.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16,
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
        zIndex: 202,
        minWidth: 420,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={filterInputRef}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Suchen…"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setFilterOpen(false);
              setFilterText("");
              setFilterType("all");
            }
            e.stopPropagation();
          }}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#FFFFFF",
            fontSize: 13,
            fontFamily: "inherit",
            caretColor: ACCENT,
          }}
        />
        <span
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.7)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {filterActive ? `${matchCount} Treffer` : `${nodeCount} Nodes`}
        </span>
        <button
          onClick={() => {
            setFilterOpen(false);
            setFilterText("");
            setFilterType("all");
          }}
          style={{
            border: "none",
            background: "transparent",
            color: "rgba(255,255,255,0.7)",
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
            padding: 4,
            borderRadius: 8,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.color =
              "rgba(255,255,255,0.85)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.color =
              "rgba(255,255,255,0.7)")
          }
        >
          ✕
        </button>
      </div>

      {/* Type buttons */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {(
          [
            { value: "all", label: "Alle" },
            { value: "block", label: "Block" },
            { value: "rounded", label: "Area" },
            { value: "circle", label: "Circle" },
            { value: "oval", label: "Oval" },
            { value: "diamond", label: "Diamond" },
            { value: "text", label: "Text" },
            { value: "image", label: "Image" },
            { value: "textfile", label: "File" },
          ] as { value: NodeType | "all"; label: string }[]
        ).map(({ value, label }) => {
          const active = filterType === value;
          return (
            <button
              key={value}
              onClick={() => setFilterType(value)}
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                border: active
                  ? `1px solid ${ACCENT}66`
                  : "1px solid rgba(255,255,255,0.07)",
                background: active ? `${ACCENT}22` : "transparent",
                color: active ? ACCENT : "rgba(255,255,255,0.7)",
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                transition: "all 0.1s",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color =
                    "rgba(255,255,255,0.85)";
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "rgba(255,255,255,0.15)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color =
                    "rgba(255,255,255,0.7)";
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "rgba(255,255,255,0.07)";
                }
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
