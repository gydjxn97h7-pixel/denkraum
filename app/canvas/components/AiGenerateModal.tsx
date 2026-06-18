"use client";
import { useState } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { ICON, ICON_PROPS } from "../lib/design-tokens";
import { ACCENT } from "../lib/canvas-types";
import { generateGraph, type GeneratedGraph } from "../lib/ai-generate";
import { AiCharacter, type AiCharacterState } from "./AiCharacter";

interface AiGenerateModalProps {
  open: boolean;
  onClose: () => void;
  apiKey: string;
  onPlace: (graph: GeneratedGraph) => void;
  // Shared assistant state — mirrored here (the modal covers the toolbar during
  // a call) and reported back so the toolbar character reacts too.
  aiState: AiCharacterState;
  onState: (state: AiCharacterState) => void;
}

// ── AI Generate modal — prompt → node graph ──
export function AiGenerateModal({
  open,
  onClose,
  apiKey,
  onPlace,
  aiState,
  onState,
}: AiGenerateModalProps) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const close = () => {
    if (busy) return;
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (busy || prompt.trim() === "") return;
    setBusy(true);
    setError(null);
    onState("thinking");
    const r = await generateGraph(prompt, apiKey);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      onState("error");
      return;
    }
    onState("done");
    onPlace(r.graph);
    setPrompt("");
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
          disabled={busy}
          placeholder="e.g. a flowchart for user onboarding"
          spellCheck={false}
          onChange={(e) => {
            setPrompt(e.target.value);
            if (error) setError(null);
          }}
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

        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: ACCENT,
            }}
          >
            <AlertTriangle size={ICON.sm} {...ICON_PROPS} />
            {error}
          </div>
        )}

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
            disabled={busy}
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
              cursor: busy ? "default" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || prompt.trim() === ""}
            style={{
              height: 34,
              padding: "0 16px",
              borderRadius: 10,
              border: "none",
              background:
                busy || prompt.trim() === ""
                  ? "rgba(197,107,71,0.4)"
                  : ACCENT,
              color: "#FCFBF8",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: busy || prompt.trim() === "" ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Sparkles size={ICON.sm} {...ICON_PROPS} />
            {busy ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}
