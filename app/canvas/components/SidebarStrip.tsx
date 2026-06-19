"use client";
import { memo } from "react";
import type { PanelSection } from "../lib/canvas-types";
import {
  LayoutDashboard,
  Workflow,
  Play,
  FolderOpen,
  Keyboard,
  Cpu,
} from "lucide-react";
import { ICON, ICON_PROPS } from "../lib/design-tokens";

interface SidebarStripProps {
  isPresenting: boolean;
  activePanel: PanelSection | null;
  setActivePanel: React.Dispatch<React.SetStateAction<PanelSection | null>>;
}

// ── Sidebar Strip (always visible, 52px) ──
function SidebarStripImpl({
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
          "linear-gradient(180deg, rgba(216,201,168,0.04) 0%, rgba(216,201,168,0) 100%), rgba(252,251,248,0.97)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: 16,
        boxShadow:
          "0 4px 12px rgba(58,48,38,0.10), 0 16px 44px rgba(58,48,38,0.20)",
        zIndex: 151,
        display: isPresenting ? "none" : "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "16px 0",
        fontFamily:
          "var(--font-geist-mono), ui-monospace, monospace",
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
          stroke="rgba(197,107,71,0.3)"
          strokeWidth="1"
        />
        <rect
          x="4"
          y="4"
          width="14"
          height="14"
          rx="3"
          fill="rgba(197,107,71,0.12)"
        />
        <rect
          x="7"
          y="7"
          width="8"
          height="8"
          rx="2"
          fill="rgba(197,107,71,0.45)"
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
              <LayoutDashboard size={ICON.lg} {...ICON_PROPS} />
            ),
          },
          {
            section: "nodes" as const,
            title: "Nodes",
            icon: (
              <Workflow size={ICON.lg} {...ICON_PROPS} />
            ),
          },
          {
            section: "presentation" as const,
            title: "Presentation",
            icon: (
              <Play size={ICON.lg} {...ICON_PROPS} />
            ),
          },
          {
            section: "saveload" as const,
            title: "Save / Load",
            icon: (
              <FolderOpen size={ICON.lg} {...ICON_PROPS} />
            ),
          },
          {
            section: "shortcuts" as const,
            title: "Shortcuts",
            icon: (
              <Keyboard size={ICON.lg} {...ICON_PROPS} />
            ),
          },
          {
            section: "ai" as const,
            title: "AI",
            icon: (
              <Cpu size={ICON.lg} {...ICON_PROPS} />
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
              borderRadius: 8,
              marginBottom: 16,
              border: isActive
                ? "1px solid rgba(197,107,71,0.35)"
                : "1px solid rgba(42,40,35,0.07)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isActive ? "#C56B47" : "rgba(42,40,35,0.75)",
              background: isActive
                ? "rgba(197,107,71,0.14)"
                : "rgba(42,40,35,0.04)",
              flexShrink: 0,
              transition: "color 0.12s, background 0.12s, border-color 0.12s",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(42,40,35,0.95)";
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(42,40,35,0.09)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(42,40,35,0.75)";
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(42,40,35,0.04)";
              }
            }}
          >
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
          background: "rgba(42,40,35,0.06)",
          border: "1px solid rgba(42,40,35,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 600,
          color: "rgba(42,40,35,0.4)",
          flexShrink: 0,
        }}
      >
        A
      </div>
    </div>
  );
}

export const SidebarStrip = memo(SidebarStripImpl);
