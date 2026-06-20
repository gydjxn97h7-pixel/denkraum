"use client";
import type { NodeType } from "../lib/canvas-types";
import { Search, X } from "lucide-react";
import { ICON, ICON_PROPS, tokens } from "../lib/design-tokens";

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
        // Sits a full cluster-gap (12px) below the toolbar's bottom edge
        // (toolbar top 20 + 52px cluster height = 72) so it reads as a
        // separate bar, matching the spacing between the toolbar clusters.
        top: 84,
        left: "50%",
        transform: "translateX(-50%)",
        background: tokens.color.muted,
        borderRadius: tokens.radius.md,
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        boxShadow: "0 4px 12px rgba(58,48,38,0.10), 0 16px 44px rgba(58,48,38,0.20)",
        zIndex: 202,
        minWidth: 420,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Search
          size={ICON.sm}
          {...ICON_PROPS}
          color="rgba(42,40,35,0.7)"
          style={{ flexShrink: 0 }}
        />
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
            color: "#2A2823",
            fontSize: 13,
            fontFamily: "inherit",
            caretColor: tokens.color.ink,
          }}
        />
        <span
          style={{
            fontSize: 11,
            color: "rgba(42,40,35,0.7)",
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
            color: "rgba(42,40,35,0.7)",
            cursor: "pointer",
            padding: 4,
            borderRadius: tokens.radius.xs,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.color =
              "rgba(42,40,35,0.85)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.color =
              "rgba(42,40,35,0.7)")
          }
        >
          <X size={ICON.sm} {...ICON_PROPS} />
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
            { value: "triangle", label: "Triangle" },
            { value: "star", label: "Star" },
            { value: "arrow", label: "Arrow" },
            { value: "parallelogram", label: "Parallelogram" },
            { value: "sticky", label: "Sticky Note" },
            { value: "checklist", label: "Checklist" },
            { value: "link", label: "Link" },
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
                borderRadius: tokens.radius.xs,
                border: active
                  ? `0.5px solid ${tokens.color.ink}`
                  : "1px solid rgba(42,40,35,0.07)",
                background: active ? tokens.color.sand : "transparent",
                color: active ? tokens.color.ink : "rgba(42,40,35,0.7)",
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                transition: "all 0.1s",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color =
                    "rgba(42,40,35,0.85)";
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "rgba(42,40,35,0.15)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color =
                    "rgba(42,40,35,0.7)";
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "rgba(42,40,35,0.07)";
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
