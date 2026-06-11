"use client";
import type { PanelSection } from "../lib/canvas-types";

interface SidebarStripProps {
  isPresenting: boolean;
  activePanel: PanelSection | null;
  setActivePanel: React.Dispatch<React.SetStateAction<PanelSection | null>>;
}

// ── Sidebar Strip (always visible, 52px) ──
export function SidebarStrip({
  isPresenting,
  activePanel,
  setActivePanel,
}: SidebarStripProps) {
  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        left: 12,
        height: "calc(100vh - 24px)",
        width: 52,
        background:
          "linear-gradient(180deg, rgba(157,200,141,0.04) 0%, rgba(157,200,141,0) 100%), rgba(30,74,65,0.97)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: 16,
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 0 rgba(255,255,255,0.12)",
        zIndex: 151,
        display: isPresenting ? "none" : "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "14px 0",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
      }}
    >
      {/* Logo mark — decorative, not clickable */}
      <svg
        width="22"
        height="22"
        viewBox="0 0 22 22"
        fill="none"
        style={{ flexShrink: 0, display: "block" }}
      >
        <rect
          x="0.5"
          y="0.5"
          width="21"
          height="21"
          rx="5"
          stroke="rgba(241,178,74,0.3)"
          strokeWidth="1"
        />
        <rect
          x="4"
          y="4"
          width="14"
          height="14"
          rx="3"
          fill="rgba(241,178,74,0.12)"
        />
        <rect
          x="7"
          y="7"
          width="8"
          height="8"
          rx="2"
          fill="rgba(241,178,74,0.45)"
        />
      </svg>

      {/* gap */}
      <div style={{ height: 20 }} />

      {/* Nav buttons */}
      {(
        [
          {
            section: "board" as const,
            title: "Board",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
              </svg>
            ),
          },
          {
            section: "nodes" as const,
            title: "Nodes",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="6" cy="6" r="2.5" />
                <circle cx="18" cy="18" r="2.5" />
                <line x1="8" y1="8" x2="16" y2="16" />
              </svg>
            ),
          },
          {
            section: "presentation" as const,
            title: "Presentation",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="5,3 19,12 5,21" />
              </svg>
            ),
          },
          {
            section: "saveload" as const,
            title: "Save / Load",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            ),
          },
          {
            section: "shortcuts" as const,
            title: "Shortcuts",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <line x1="6" y1="10" x2="6.01" y2="10" />
                <line x1="10" y1="10" x2="10.01" y2="10" />
                <line x1="14" y1="10" x2="14.01" y2="10" />
                <line x1="8" y1="14" x2="16" y2="14" />
              </svg>
            ),
          },
        ] as {
          section: PanelSection;
          title: string;
          icon: React.ReactNode;
        }[]
      ).map(({ section, title, icon }) => {
        const isActive = activePanel === section;
        return (
          <button
            key={section}
            title={title}
            onClick={() =>
              setActivePanel((prev) => (prev === section ? null : section))
            }
            style={{
              position: "relative",
              width: 36,
              height: 36,
              borderRadius: 9,
              marginBottom: 6,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isActive ? "#F1B24A" : "rgba(255,255,255,0.75)",
              background: isActive ? "rgba(241,178,74,0.12)" : "transparent",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(255,255,255,0.95)";
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(255,255,255,0.06)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(255,255,255,0.75)";
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
              }
            }}
          >
            {isActive && (
              <div
                style={{
                  position: "absolute",
                  left: -8,
                  top: 6,
                  width: 2.5,
                  height: 24,
                  background: "#F1B24A",
                  borderRadius: "0 2px 2px 0",
                }}
              />
            )}
            {icon}
          </button>
        );
      })}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Avatar */}
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
          border: "0.5px solid rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 600,
          color: "rgba(255,255,255,0.4)",
          flexShrink: 0,
        }}
      >
        A
      </div>
    </div>
  );
}
