"use client";
import { Sparkles, FileText, GitBranch } from "lucide-react";
import { ICON, ICON_PROPS } from "../lib/design-tokens";
import { ACCENT } from "../lib/canvas-types";
import { PanelSectionLabel } from "./panel-ui";
import { useApiKey } from "../lib/ai-key";
import { AiCharacter, type AiCharacterState } from "./AiCharacter";

// Caption shown under the assistant character per state.
const STATE_CAPTION: Record<AiCharacterState, string> = {
  idle: "Ready",
  thinking: "Thinking…",
  done: "Done",
  error: "Hmm…",
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
}: {
  aiState: AiCharacterState;
  nodeCount: number;
  onSummarize: () => void;
  onGenerate: () => void;
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
        <AiCharacter state={aiState} size={48} color="#2A2823" />
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: "rgba(42,40,35,0.5)",
          }}
        >
          {STATE_CAPTION[aiState]}
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
              borderRadius: 10,
              border: "none",
              background: ACCENT,
              color: "#FCFBF8",
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
              borderRadius: 10,
              border: "1px solid rgba(42,40,35,0.12)",
              background: "transparent",
              color:
                aiState === "thinking"
                  ? "rgba(42,40,35,0.4)"
                  : "rgba(42,40,35,0.85)",
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
              background: "rgba(42,40,35,0.04)",
              border: "1px solid rgba(42,40,35,0.08)",
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
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: ACCENT,
                background: "rgba(197,107,71,0.10)",
                border: "1px solid rgba(197,107,71,0.18)",
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
