"use client";
import { useState } from "react";
import { Sparkles, Globe } from "lucide-react";
import { ICON, ICON_PROPS } from "../lib/design-tokens";
import { ACCENT } from "../lib/canvas-types";
import { AiCharacter, type AiCharacterState } from "./AiCharacter";

interface AiGenerateModalProps {
  open: boolean;
  onClose: () => void;
  // Fire-and-forget: the modal hands the prompt off and closes immediately;
  // the actual AI call runs in the background while the canvas stays usable.
  // `research` enables web search before the graph is built.
  onSubmit: (prompt: string, research: boolean) => void;
  aiState: AiCharacterState;
}

// ── AI Generate modal — prompt → node graph (non-blocking) ──
export function AiGenerateModal({
  open,
  onClose,
  onSubmit,
  aiState,
}: AiGenerateModalProps) {
  const [prompt, setPrompt] = useState("");
  const [research, setResearch] = useState(false);

  if (!open) return null;

  const close = () => {
    onClose();
  };

  const submit = () => {
    const p = prompt.trim();
    if (p === "") return;
    onSubmit(p, research);
    setPrompt("");
    setResearch(false);
    onClose();
  };

  return (
    <div
      onMouseDown={close}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "rgba(24,18,12,0.38)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "16vh",
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 460,
          maxWidth: "calc(100vw - 48px)",
          background:
            "linear-gradient(180deg, rgba(216,201,168,0.05) 0%, rgba(216,201,168,0) 100%), rgba(252,251,248,0.98)",
          border: "1px solid rgba(42,40,35,0.1)",
          borderRadius: 16,
          boxShadow:
            "0 4px 12px rgba(58,48,38,0.12), 0 24px 64px rgba(58,48,38,0.28)",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Title — the assistant character reacts to the call state */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AiCharacter state={aiState} size={30} color="#2A2823" />
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "0.01em",
              color: "#2A2823",
              fontFamily: "var(--font-clash), system-ui, sans-serif",
            }}
          >
            Generate
          </span>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.5,
            color: "rgba(42,40,35,0.6)",
          }}
        >
          Describe what to map out — DNKRM will create the nodes and connections
          on your canvas.
        </p>

        <input
          autoFocus
          value={prompt}
          placeholder="e.g. a flowchart for user onboarding"
          spellCheck={false}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") submit();
            else if (e.key === "Escape") close();
          }}
          style={{
            height: 40,
            borderRadius: 10,
            border: "1px solid rgba(42,40,35,0.16)",
            background: "rgba(42,40,35,0.04)",
            padding: "0 12px",
            fontSize: 13,
            fontFamily: "inherit",
            color: "#2A2823",
            outline: "none",
            width: "100%",
            boxSizing: "border-box",
          }}
        />

        {/* Research toggle — searches the web before building the graph */}
        <button
          onClick={() => setResearch((r) => !r)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 12px",
            borderRadius: 10,
            border: `1px solid ${
              research ? "rgba(197,107,71,0.5)" : "rgba(42,40,35,0.12)"
            }`,
            background: research ? "rgba(197,107,71,0.08)" : "transparent",
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "inherit",
            transition: "background 120ms, border-color 120ms",
          }}
        >
          <Globe
            size={ICON.sm}
            {...ICON_PROPS}
            color={research ? ACCENT : "rgba(42,40,35,0.55)"}
          />
          <span
            style={{
              flex: 1,
              fontSize: 12,
              lineHeight: 1.4,
              color: research ? "#2A2823" : "rgba(42,40,35,0.7)",
            }}
          >
            Research mode — AI searches the web first
          </span>
          {/* Switch */}
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              width: 32,
              height: 18,
              borderRadius: 9,
              background: research ? ACCENT : "rgba(42,40,35,0.2)",
              position: "relative",
              transition: "background 120ms",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: research ? 16 : 2,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#FCFBF8",
                transition: "left 120ms",
              }}
            />
          </span>
        </button>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 2,
          }}
        >
          <button
            onClick={close}
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 10,
              border: "1px solid rgba(42,40,35,0.12)",
              background: "transparent",
              color: "rgba(42,40,35,0.8)",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={prompt.trim() === ""}
            style={{
              height: 34,
              padding: "0 16px",
              borderRadius: 10,
              border: "none",
              background:
                prompt.trim() === "" ? "rgba(197,107,71,0.4)" : ACCENT,
              color: "#FCFBF8",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: prompt.trim() === "" ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Sparkles size={ICON.sm} {...ICON_PROPS} />
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
