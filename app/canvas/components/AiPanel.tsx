"use client";
import { Sparkles, FileText, GitBranch, Crosshair, X } from "lucide-react";
import { ICON, ICON_PROPS, tokens } from "../lib/design-tokens";
import { PanelSectionLabel } from "./panel-ui";
import { useApiKey } from "../lib/ai-key";
import Image from "next/image";
import type { AiCharacterState } from "./AiCharacter";

// The companion has a name so it reads as a presence, not a status icon.
const COMPANION_NAME = "Sol";

// A warm, in-character mood line per state — the companion "speaking".
const STATE_MOOD: Record<AiCharacterState, string> = {
  idle: "Ready when you are",
  thinking: "Thinking it through…",
  done: "There you go!",
  error: "That didn't work",
};

// Soft status dot colour matching the mood.
const STATE_DOT: Record<AiCharacterState, string> = {
  idle: tokens.color.fern, // fern — calm
  thinking: tokens.color.driftwood, // warm — working
  done: tokens.color.fern, // fern — happy/settled
  error: tokens.color.alert, // red — attention
};

// What the assistant can do today — strictly the features that work now.
const FEATURES: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}[] = [
  {
    icon: <Sparkles size={ICON.sm} {...ICON_PROPS} />,
    title: "Generate",
    desc: "Describe an idea and AI builds a node graph.",
  },
  {
    icon: <GitBranch size={ICON.sm} {...ICON_PROPS} />,
    title: "Expand",
    desc: "Right-click any node to branch it with AI.",
  },
  {
    icon: <FileText size={ICON.sm} {...ICON_PROPS} />,
    title: "Summarize",
    desc: "Condense your entire board into one text node.",
  },
];

// ── AI assistant actions + feature overview ──
export function AiPanel({
  aiState,
  nodeCount,
  onSummarize,
  onGenerate,
  workspace,
  placingWorkspace,
  onAssignWorkspace,
  onClearWorkspace,
}: {
  aiState: AiCharacterState;
  nodeCount: number;
  onSummarize: () => void;
  onGenerate: () => void;
  workspace: { x: number; y: number } | null;
  placingWorkspace: boolean;
  onAssignWorkspace: () => void;
  onClearWorkspace: () => void;
}) {
  const { hasKey } = useApiKey();

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        paddingTop: 16,
      }}
    >
      {/* Assistant character */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          padding: "4px 16px 18px",
        }}
      >
        {/* Bonsai companion — a painted bonsai on its stone, centered. */}
        <Image
          src="/assets/bonsai.webp"
          alt=""
          width={482}
          height={434}
          priority
          style={{ width: 120, height: "auto" }}
        />

        {/* Name */}
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.01em",
            color: "#2A2823",
            fontFamily: "var(--font-clash), system-ui, sans-serif",
            marginTop: 2,
          }}
        >
          {COMPANION_NAME}
        </span>

        {/* Mood line with a status dot */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.01em",
            color: "rgba(42,40,35,0.5)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: STATE_DOT[aiState],
              flexShrink: 0,
              transition: "background 0.3s ease",
            }}
          />
          {STATE_MOOD[aiState]}
        </span>
      </div>

      {/* Generate — primary AI entry point */}
      {hasKey && (
        <div style={{ padding: "0 16px 8px" }}>
          <button
            onClick={onGenerate}
            disabled={aiState === "thinking"}
            title="Generate a node graph with AI"
            style={{
              width: "100%",
              height: 36,
              borderRadius: tokens.radius.xs,
              border: "none",
              background: tokens.color.ink,
              color: tokens.color.canvas,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: aiState === "thinking" ? "default" : "pointer",
              opacity: aiState === "thinking" ? 0.6 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Sparkles size={ICON.sm} {...ICON_PROPS} />
            Generate
          </button>
        </div>
      )}

      {/* Summarize — only when a key is set and the board has nodes */}
      {hasKey && nodeCount > 0 && (
        <div style={{ padding: "0 16px 4px" }}>
          <button
            onClick={onSummarize}
            disabled={aiState === "thinking"}
            title="Summarize the board into a text node"
            style={{
              width: "100%",
              height: 36,
              borderRadius: tokens.radius.xs,
              border: `0.5px solid ${tokens.color.border}`,
              background: "transparent",
              color:
                aiState === "thinking"
                  ? "rgba(42,40,35,0.4)"
                  : tokens.color.text,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: aiState === "thinking" ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <FileText size={ICON.sm} {...ICON_PROPS} />
            {aiState === "thinking" ? "Summarizing…" : "Summarize board"}
          </button>
        </div>
      )}

      {/* AI workspace marker — assign / clear a spot for AI output */}
      {hasKey && (
        <div style={{ padding: "0 16px 4px" }}>
          <button
            onClick={
              placingWorkspace
                ? undefined
                : workspace
                  ? onClearWorkspace
                  : onAssignWorkspace
            }
            title={
              workspace
                ? "Remove the AI workspace marker"
                : "Pick a spot on the canvas for AI output"
            }
            style={{
              width: "100%",
              height: 36,
              borderRadius: tokens.radius.xs,
              border: placingWorkspace
                ? `0.5px solid ${tokens.color.ink}`
                : `0.5px solid ${tokens.color.border}`,
              background: placingWorkspace ? tokens.color.sand : "transparent",
              color: placingWorkspace ? tokens.color.ink : tokens.color.text,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: placingWorkspace ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {workspace && !placingWorkspace ? (
              <X size={ICON.sm} {...ICON_PROPS} />
            ) : (
              <Crosshair size={ICON.sm} {...ICON_PROPS} />
            )}
            {placingWorkspace
              ? "Click on canvas…"
              : workspace
                ? "Clear workspace"
                : "Assign AI workspace"}
          </button>

          {/* Coordinate hint when a marker is set */}
          {workspace && (
            <div
              style={{
                marginTop: 6,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.02em",
                color: "rgba(42,40,35,0.5)",
                textAlign: "center",
              }}
            >
              x: {Math.round(workspace.x)}, y: {Math.round(workspace.y)}
            </div>
          )}
        </div>
      )}

      {/* Hint when no key — points to the Settings panel */}
      {!hasKey && (
        <div style={{ padding: "0 16px 4px" }}>
          <div
            style={{
              fontSize: 11.5,
              lineHeight: 1.5,
              color: "rgba(42,40,35,0.55)",
              padding: "10px 12px",
              borderRadius: 10,
              background: tokens.color.sand,
              border: `0.5px solid ${tokens.color.border}`,
            }}
          >
            Add your Anthropic API key in Settings to start using the assistant.
          </div>
        </div>
      )}

      {/* Feature overview */}
      <PanelSectionLabel>What AI can do</PanelSectionLabel>
      <div
        style={{
          padding: "0 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {FEATURES.map(({ icon, title, desc }) => (
          <div
            key={title}
            style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
          >
            <div
              style={{
                flexShrink: 0,
                width: 28,
                height: 28,
                borderRadius: tokens.radius.xs,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: tokens.color.wood,
                background: tokens.color.sand,
                border: `0.5px solid ${tokens.color.border}`,
              }}
            >
              {icon}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#2A2823",
                }}
              >
                {title}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  lineHeight: 1.45,
                  color: "rgba(42,40,35,0.6)",
                }}
              >
                {desc}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
